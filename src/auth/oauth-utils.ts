import type { AuthRequest, ClientInfo } from "@cloudflare/workers-oauth-provider";

export class OAuthFlowError extends Error {
  constructor(
    readonly code: string,
    readonly description: string,
    readonly statusCode = 400,
  ) {
    super(description);
    this.name = "OAuthFlowError";
  }

  toResponse(): Response {
    return new Response(
      JSON.stringify({
        error: this.code,
        error_description: this.description,
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: this.statusCode,
      },
    );
  }
}

export type OAuthStateResult = {
  stateToken: string;
};

export type ValidateStateResult = {
  clearCookie: string;
  oauthReqInfo: AuthRequest;
};

function requireValue(value: string | undefined, name: string): string {
  if (!value?.trim()) {
    throw new OAuthFlowError("server_error", `${name} is not configured`, 500);
  }
  return value.trim();
}

export function requireGithubOAuthEnv(env: Env): {
  clientId: string;
  clientSecret: string;
  cookieSecret: string;
  kv: KVNamespace;
} {
  if (!env.OAUTH_KV) {
    throw new OAuthFlowError("server_error", "OAUTH_KV is not configured", 500);
  }

  return {
    clientId: requireValue(env.GITHUB_CLIENT_ID, "GITHUB_CLIENT_ID"),
    clientSecret: requireValue(env.GITHUB_CLIENT_SECRET, "GITHUB_CLIENT_SECRET"),
    cookieSecret: requireValue(env.COOKIE_ENCRYPTION_KEY, "COOKIE_ENCRYPTION_KEY"),
    kv: env.OAUTH_KV,
  };
}

export function sanitizeText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function sanitizeUrl(url: string): string {
  const normalized = url.trim();
  if (!normalized) {
    return "";
  }

  for (let i = 0; i < normalized.length; i++) {
    const code = normalized.charCodeAt(i);
    if ((code >= 0x00 && code <= 0x1f) || (code >= 0x7f && code <= 0x9f)) {
      return "";
    }
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(normalized);
  } catch {
    return "";
  }

  const scheme = parsedUrl.protocol.slice(0, -1).toLowerCase();
  if (scheme !== "https" && scheme !== "http") {
    return "";
  }

  return normalized;
}

export function generateCSRFProtection(): { setCookie: string; token: string } {
  const cookieName = "__Host-CSRF_TOKEN";
  const token = crypto.randomUUID();
  return {
    setCookie: `${cookieName}=${token}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=600`,
    token,
  };
}

export function validateCSRFToken(formData: FormData, request: Request): { clearCookie: string } {
  const cookieName = "__Host-CSRF_TOKEN";
  const tokenFromForm = formData.get("csrf_token");
  if (!tokenFromForm || typeof tokenFromForm !== "string") {
    throw new OAuthFlowError("invalid_request", "Missing CSRF token", 400);
  }

  const cookieHeader = request.headers.get("Cookie") || "";
  const tokenFromCookie = cookieHeader
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${cookieName}=`))
    ?.substring(cookieName.length + 1);

  if (!tokenFromCookie || tokenFromForm !== tokenFromCookie) {
    throw new OAuthFlowError("invalid_request", "Invalid CSRF token", 400);
  }

  return {
    clearCookie: `${cookieName}=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0`,
  };
}

export async function createOAuthState(
  oauthReqInfo: AuthRequest,
  kv: KVNamespace,
  stateTTL = 600,
): Promise<OAuthStateResult> {
  const stateToken = crypto.randomUUID();
  await kv.put(`oauth:state:${stateToken}`, JSON.stringify(oauthReqInfo), {
    expirationTtl: stateTTL,
  });
  return { stateToken };
}

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function bindStateToSession(stateToken: string): Promise<{ setCookie: string }> {
  const cookieName = "__Host-CONSENTED_STATE";
  const stateHash = await sha256Hex(stateToken);
  return {
    setCookie: `${cookieName}=${stateHash}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=600`,
  };
}

export async function validateOAuthState(
  request: Request,
  kv: KVNamespace,
): Promise<ValidateStateResult> {
  const cookieName = "__Host-CONSENTED_STATE";
  const url = new URL(request.url);
  const stateFromQuery = url.searchParams.get("state");
  if (!stateFromQuery) {
    throw new OAuthFlowError("invalid_request", "Missing state parameter", 400);
  }

  const storedDataJson = await kv.get(`oauth:state:${stateFromQuery}`);
  if (!storedDataJson) {
    throw new OAuthFlowError("invalid_request", "Invalid or expired state", 400);
  }

  const cookieHeader = request.headers.get("Cookie") || "";
  const consentedStateHash = cookieHeader
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${cookieName}=`))
    ?.substring(cookieName.length + 1);

  if (!consentedStateHash || consentedStateHash !== (await sha256Hex(stateFromQuery))) {
    throw new OAuthFlowError("invalid_request", "State validation failed", 400);
  }

  let oauthReqInfo: AuthRequest;
  try {
    oauthReqInfo = JSON.parse(storedDataJson) as AuthRequest;
  } catch {
    throw new OAuthFlowError("server_error", "Invalid state data", 500);
  }

  await kv.delete(`oauth:state:${stateFromQuery}`);

  return {
    clearCookie: `${cookieName}=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0`,
    oauthReqInfo,
  };
}

export async function isClientApproved(
  request: Request,
  clientId: string,
  cookieSecret: string,
): Promise<boolean> {
  const approvedClients = await getApprovedClientsFromCookie(request, cookieSecret);
  return approvedClients?.includes(clientId) ?? false;
}

export async function addApprovedClient(
  request: Request,
  clientId: string,
  cookieSecret: string,
): Promise<string> {
  const cookieName = "__Host-APPROVED_CLIENTS";
  const maxAge = 2592000;
  const existingApprovedClients = (await getApprovedClientsFromCookie(request, cookieSecret)) || [];
  const updatedApprovedClients = Array.from(new Set([...existingApprovedClients, clientId]));
  const payload = JSON.stringify(updatedApprovedClients);
  const signature = await signData(payload, cookieSecret);
  const cookieValue = `${signature}.${btoa(payload)}`;

  return `${cookieName}=${cookieValue}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=${maxAge}`;
}

export function renderApprovalDialog(
  request: Request,
  options: {
    client: ClientInfo | null;
    csrfToken: string;
    server: { description?: string; name: string };
    setCookie: string;
    state: Record<string, unknown>;
  },
): Response {
  const clientName = options.client?.clientName
    ? sanitizeText(options.client.clientName)
    : "Unknown MCP Client";
  const serverName = sanitizeText(options.server.name);
  const serverDescription = options.server.description ? sanitizeText(options.server.description) : "";
  const encodedState = btoa(JSON.stringify(options.state));
  const clientUri = options.client?.clientUri
    ? sanitizeText(sanitizeUrl(options.client.clientUri))
    : "";

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${serverName} Authorization</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 0; background: #f8fafc; color: #111827; }
      main { max-width: 640px; margin: 48px auto; padding: 24px; }
      section { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px; }
      h1 { font-size: 22px; margin: 0 0 8px; }
      p { line-height: 1.5; }
      code { word-break: break-all; }
      .actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px; }
      button { border: 1px solid #d1d5db; border-radius: 6px; padding: 10px 14px; background: white; cursor: pointer; }
      button[type="submit"] { background: #111827; color: white; border-color: #111827; }
    </style>
  </head>
  <body>
    <main>
      <section>
        <h1>${serverName}</h1>
        ${serverDescription ? `<p>${serverDescription}</p>` : ""}
        <p><strong>${clientName}</strong> is requesting access to this MCP server.</p>
        ${clientUri ? `<p>Client URI: <code>${clientUri}</code></p>` : ""}
        <form method="post" action="${new URL(request.url).pathname}">
          <input type="hidden" name="state" value="${encodedState}">
          <input type="hidden" name="csrf_token" value="${sanitizeText(options.csrfToken)}">
          <div class="actions">
            <button type="button" onclick="history.back()">Cancel</button>
            <button type="submit">Approve</button>
          </div>
        </form>
      </section>
    </main>
  </body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Security-Policy": "frame-ancestors 'none'",
      "Content-Type": "text/html; charset=utf-8",
      "Set-Cookie": options.setCookie,
      "X-Frame-Options": "DENY",
    },
  });
}

async function getApprovedClientsFromCookie(
  request: Request,
  cookieSecret: string,
): Promise<string[] | null> {
  const cookieName = "__Host-APPROVED_CLIENTS";
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) {
    return null;
  }

  const cookieValue = cookieHeader
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${cookieName}=`))
    ?.substring(cookieName.length + 1);
  if (!cookieValue) {
    return null;
  }

  const parts = cookieValue.split(".");
  if (parts.length !== 2) {
    return null;
  }

  const [signatureHex, base64Payload] = parts;
  const payload = atob(base64Payload);
  if (!(await verifySignature(signatureHex, payload, cookieSecret))) {
    return null;
  }

  try {
    const approvedClients = JSON.parse(payload);
    if (
      !Array.isArray(approvedClients) ||
      !approvedClients.every((item) => typeof item === "string")
    ) {
      return null;
    }
    return approvedClients as string[];
  } catch {
    return null;
  }
}

async function signData(data: string, secret: string): Promise<string> {
  const key = await importKey(secret);
  const encoded = new TextEncoder().encode(data);
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoded);
  return Array.from(new Uint8Array(signatureBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function verifySignature(
  signatureHex: string,
  data: string,
  secret: string,
): Promise<boolean> {
  const key = await importKey(secret);
  const encoded = new TextEncoder().encode(data);
  try {
    const signatureBytes = new Uint8Array(
      signatureHex.match(/.{1,2}/g)!.map((byte) => Number.parseInt(byte, 16)),
    );
    return await crypto.subtle.verify("HMAC", key, signatureBytes.buffer, encoded);
  } catch {
    return false;
  }
}

async function importKey(secret: string): Promise<CryptoKey> {
  const encoded = new TextEncoder().encode(secret);
  return crypto.subtle.importKey(
    "raw",
    encoded,
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign", "verify"],
  );
}

