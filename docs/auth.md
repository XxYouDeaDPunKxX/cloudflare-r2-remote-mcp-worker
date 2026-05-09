# 🔐 Auth

## 🧱 Auth Boundary

GitHub OAuth is used to decide who can access the MCP endpoint.

It does not grant access to GitHub repositories. The GitHub login is only used as an identity signal and checked against `ALLOWED_GITHUB_LOGINS`.

R2 access is still controlled by the Worker configuration:

- `R2_BUCKET` binding for object tools
- optional Cloudflare API token for read-only admin tools
- optional R2 S3 credentials for presigned URLs

## ⚙️ Modes

| Mode | Use |
| --- | --- |
| `AUTH_MODE=github` | Public deployments. |
| `AUTH_MODE=none` | Local development or externally protected environments only. |

If `AUTH_MODE` is omitted, the Worker defaults to `github`.

Do not expose `AUTH_MODE=none` on a public URL unless another layer protects the endpoint.

## 🧾 GitHub OAuth App, Not GitHub App

Use a GitHub OAuth App.

Do not use a GitHub App. GitHub Apps use installation IDs, private keys, and repository permissions; that is not the model used here.

Do not use a personal access token for user authentication.

## 🔁 OAuth Flow

```text
MCP client
-> Worker /authorize
-> GitHub login
-> Worker /callback
-> allowlist check
-> MCP client receives OAuth token
-> MCP client calls /mcp
```

The Worker exposes:

| Route | Purpose |
| --- | --- |
| `/authorize` | Starts OAuth authorization. |
| `/callback` | Receives GitHub OAuth callback. |
| `/token` | OAuth token endpoint for MCP clients. |
| `/register` | Dynamic client registration endpoint. |
| `/mcp` | Protected MCP endpoint. |

Clients should be configured with the `/mcp` URL.

## 🛠️ GitHub OAuth App Setup

Create a GitHub OAuth App:

```text
GitHub -> Settings -> Developer settings -> OAuth Apps -> New OAuth App
```

Callback URL:

```text
https://<worker-url>/callback
```

For local development with a public tunnel:

```text
https://<tunnel-url>/callback
```

## 🗃️ KV State

OAuth state is stored in Cloudflare KV so callback requests can be validated.

Create a KV namespace:

```sh
npx wrangler kv namespace create OAUTH_KV
```

Add the generated namespace ID to `wrangler.jsonc`:

```jsonc
"kv_namespaces": [
  {
    "binding": "OAUTH_KV",
    "id": "your-kv-namespace-id"
  }
]
```

## ✅ Allowlist

Set:

```jsonc
"vars": {
  "AUTH_MODE": "github",
  "ALLOWED_GITHUB_LOGINS": "your-github-login"
}
```

Comma-separated allowlist:

```text
alice,bob,charlie
```

If the allowlist is empty, no GitHub login is accepted.

## 🔑 Secrets

Set:

```sh
npx wrangler secret put GITHUB_CLIENT_ID -c wrangler.jsonc
npx wrangler secret put GITHUB_CLIENT_SECRET -c wrangler.jsonc
npx wrangler secret put COOKIE_ENCRYPTION_KEY -c wrangler.jsonc
```

`COOKIE_ENCRYPTION_KEY` should be a random high-entropy string:

```sh
openssl rand -base64 32
```

## 🧯 Failure Modes

OAuth fails before GitHub:

- `AUTH_MODE` is not `github`.
- `OAUTH_KV` is missing.
- OAuth secrets are missing.

GitHub login completes but access is denied:

- login is not listed in `ALLOWED_GITHUB_LOGINS`.

Callback fails:

- GitHub OAuth App callback URL does not match the Worker URL.
