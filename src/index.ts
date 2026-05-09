import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { createMcpHandler } from "agents/mcp";
import { loadConfig } from "./config";
import { GitHubOAuthHandler } from "./auth/github-oauth-handler";
import { createServer } from "./server";

const MCP_ROUTE = "/mcp";

type FetchOnlyHandler = {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Response | Promise<Response>;
};

function mcpResponse(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Response | Promise<Response> {
  return createMcpHandler(createServer(env), { route: MCP_ROUTE })(request, env, ctx);
}

function mcpApiHandler(): FetchOnlyHandler {
  return {
    fetch: (request: Request, env: Env, ctx: ExecutionContext) => mcpResponse(request, env, ctx),
  };
}

const oauthProvider = new OAuthProvider({
  apiHandlers: {
    [MCP_ROUTE]: mcpApiHandler(),
  },
  authorizeEndpoint: "/authorize",
  clientRegistrationEndpoint: "/register",
  defaultHandler: GitHubOAuthHandler as any,
  tokenEndpoint: "/token",
});

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const config = loadConfig(env);

    if (url.pathname === "/healthz") {
      try {
        await env.R2_BUCKET.list({
          limit: 1,
          prefix: config.rootPrefix ? `${config.rootPrefix}/` : "",
        });

        return Response.json({
          accountToolsEnabled: config.accountToolsEnabled,
          authMode: config.authMode,
          bucketAccessible: true,
          maxInlineTextBytes: config.maxInlineTextBytes,
          maxListLimit: config.maxListLimit,
          maxTransferBytes: config.maxTransferBytes,
          ok: true,
          presignToolsEnabled: config.presignToolsEnabled,
          rootPrefix: config.rootPrefix,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown bucket error";
        return Response.json(
          {
            bucketAccessible: false,
            error: message,
            ok: false,
          },
          { status: 503 },
        );
      }
    }

    if (config.authMode === "github") {
      return oauthProvider.fetch(request, env, ctx);
    }

    return mcpResponse(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
