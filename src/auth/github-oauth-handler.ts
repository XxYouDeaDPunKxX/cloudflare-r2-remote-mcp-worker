import type { AuthRequest, OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import { Hono } from "hono";
import { Octokit } from "octokit";
import {
  addApprovedClient,
  bindStateToSession,
  createOAuthState,
  generateCSRFProtection,
  isClientApproved,
  OAuthFlowError,
  renderApprovalDialog,
  requireGithubOAuthEnv,
  validateCSRFToken,
  validateOAuthState,
} from "./oauth-utils";

type GithubUserProps = {
  accessToken: string;
  email: string | null;
  login: string;
  name: string | null;
};

const app = new Hono<{ Bindings: Env & { OAUTH_PROVIDER: OAuthHelpers } }>();

function allowedGitHubLogins(env: Env): string[] {
  return (env.ALLOWED_GITHUB_LOGINS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function isGitHubLoginAllowed(env: Env, login: string): boolean {
  const allowed = allowedGitHubLogins(env);
  return allowed.length > 0 && allowed.includes(login.toLowerCase());
}

function buildUpstreamAuthorizeUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("scope", "read:user user:email");
  url.searchParams.set("state", input.state);
  url.searchParams.set("response_type", "code");
  return url.href;
}

async function fetchGithubAccessToken(input: {
  clientId: string;
  clientSecret: string;
  code: string | undefined;
  redirectUri: string;
}): Promise<string> {
  if (!input.code) {
    throw new OAuthFlowError("invalid_request", "Missing GitHub authorization code", 400);
  }

  const response = await fetch("https://github.com/login/oauth/access_token", {
    body: new URLSearchParams({
      client_id: input.clientId,
      client_secret: input.clientSecret,
      code: input.code,
      redirect_uri: input.redirectUri,
    }).toString(),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });

  const body = (await response.json()) as { access_token?: string; error?: string };
  if (!response.ok || !body.access_token) {
    throw new OAuthFlowError(
      "server_error",
      body.error ? `GitHub token exchange failed: ${body.error}` : "GitHub token exchange failed",
      502,
    );
  }

  return body.access_token;
}

function redirectToGithub(request: Request, clientId: string, stateToken: string, headers?: Headers): Response {
  const responseHeaders = headers ?? new Headers();
  responseHeaders.set(
    "Location",
    buildUpstreamAuthorizeUrl({
      clientId,
      redirectUri: new URL("/callback", request.url).href,
      state: stateToken,
    }),
  );

  return new Response(null, {
    headers: responseHeaders,
    status: 302,
  });
}

app.get("/authorize", async (c) => {
  try {
    const oauthEnv = requireGithubOAuthEnv(c.env);
    const oauthReqInfo = await c.env.OAUTH_PROVIDER.parseAuthRequest(c.req.raw);
    const { clientId } = oauthReqInfo;
    if (!clientId) {
      return c.text("Invalid OAuth request", 400);
    }

    if (await isClientApproved(c.req.raw, clientId, oauthEnv.cookieSecret)) {
      const { stateToken } = await createOAuthState(oauthReqInfo, oauthEnv.kv);
      const { setCookie } = await bindStateToSession(stateToken);
      return redirectToGithub(c.req.raw, oauthEnv.clientId, stateToken, new Headers({ "Set-Cookie": setCookie }));
    }

    const { token: csrfToken, setCookie } = generateCSRFProtection();
    return renderApprovalDialog(c.req.raw, {
      client: await c.env.OAUTH_PROVIDER.lookupClient(clientId),
      csrfToken,
      server: {
        description: "Remote MCP server for Cloudflare R2.",
        name: "Cloudflare R2 Remote MCP Worker",
      },
      setCookie,
      state: { oauthReqInfo },
    });
  } catch (error) {
    if (error instanceof OAuthFlowError) {
      return error.toResponse();
    }
    return c.text("Internal server error", 500);
  }
});

app.post("/authorize", async (c) => {
  try {
    const oauthEnv = requireGithubOAuthEnv(c.env);
    const formData = await c.req.raw.formData();
    const { clearCookie: clearCsrfCookie } = validateCSRFToken(formData, c.req.raw);

    const encodedState = formData.get("state");
    if (!encodedState || typeof encodedState !== "string") {
      return c.text("Missing state", 400);
    }

    let state: { oauthReqInfo?: AuthRequest };
    try {
      state = JSON.parse(atob(encodedState));
    } catch {
      return c.text("Invalid state", 400);
    }

    if (!state.oauthReqInfo?.clientId) {
      return c.text("Invalid OAuth request", 400);
    }

    const approvedClientCookie = await addApprovedClient(
      c.req.raw,
      state.oauthReqInfo.clientId,
      oauthEnv.cookieSecret,
    );
    const { stateToken } = await createOAuthState(state.oauthReqInfo, oauthEnv.kv);
    const { setCookie: sessionBindingCookie } = await bindStateToSession(stateToken);

    const headers = new Headers();
    headers.append("Set-Cookie", approvedClientCookie);
    headers.append("Set-Cookie", sessionBindingCookie);
    headers.append("Set-Cookie", clearCsrfCookie);

    return redirectToGithub(c.req.raw, oauthEnv.clientId, stateToken, headers);
  } catch (error) {
    if (error instanceof OAuthFlowError) {
      return error.toResponse();
    }
    return c.text("Internal server error", 500);
  }
});

app.get("/callback", async (c) => {
  try {
    const oauthEnv = requireGithubOAuthEnv(c.env);
    const { clearCookie, oauthReqInfo } = await validateOAuthState(c.req.raw, oauthEnv.kv);
    if (!oauthReqInfo.clientId) {
      return c.text("Invalid OAuth request", 400);
    }

    const accessToken = await fetchGithubAccessToken({
      clientId: oauthEnv.clientId,
      clientSecret: oauthEnv.clientSecret,
      code: c.req.query("code"),
      redirectUri: new URL("/callback", c.req.url).href,
    });

    const user = await new Octokit({ auth: accessToken }).rest.users.getAuthenticated();
    const { email, login, name } = user.data;
    if (!isGitHubLoginAllowed(c.env, login)) {
      return c.text("GitHub login is not allowed to access this MCP server", 403);
    }

    const { redirectTo } = await c.env.OAUTH_PROVIDER.completeAuthorization({
      metadata: {
        label: name ?? login,
      },
      props: {
        accessToken,
        email,
        login,
        name,
      } satisfies GithubUserProps,
      request: oauthReqInfo,
      scope: oauthReqInfo.scope,
      userId: login,
    });

    return new Response(null, {
      headers: {
        Location: redirectTo,
        "Set-Cookie": clearCookie,
      },
      status: 302,
    });
  } catch (error) {
    if (error instanceof OAuthFlowError) {
      return error.toResponse();
    }
    return c.text("Internal server error", 500);
  }
});

export { app as GitHubOAuthHandler };
