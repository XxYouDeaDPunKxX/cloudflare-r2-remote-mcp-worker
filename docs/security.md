# 🛡️ Security

## 🧭 Threat Model

The Worker exposes R2 capabilities to MCP clients that can authenticate to the deployed endpoint.

Public deployments should use `AUTH_MODE=github`. `AUTH_MODE=none` is for local development or endpoints protected by an external access layer.

## 🔐 Auth Modes

| Mode | Risk |
| --- | --- |
| `github` | Access is limited to GitHub logins in `ALLOWED_GITHUB_LOGINS`. |
| `none` | Any client that can reach `/mcp` can call enabled tools. |

If `AUTH_MODE=none` is deployed publicly, the R2 bucket binding is effectively exposed through MCP.

## 🌱 Root Prefix

Object tools use the `R2_BUCKET` binding.

Use `R2_ROOT_PREFIX` to restrict tools to one logical subtree:

```text
R2_ROOT_PREFIX=projects/example
```

The server rejects:

- absolute paths
- drive-letter paths
- `.` path segments
- `..` path segments
- null bytes

## 🧨 Destructive Operations

Object delete, delete-many, move, and rename are destructive.

Runtime guards:

- destructive tools require `confirm: true`
- batch delete, move, and rename support `dryRun: true`

Account administration tools are read-only by design. Bucket creation/deletion, CORS mutation, lifecycle mutation, domain mutation, and notification mutation are not implemented.

## ✍️ Presigned URLs

Presigned URLs grant temporary direct access to an object operation.

Treat each URL as a bearer credential until expiration.

Recommended constraints:

- short expirations
- no shared logs containing URLs
- no chat transcripts containing URLs unless the chat is trusted
- use presigned URLs for large transfers instead of inline MCP payloads

## 🔑 Secrets

Never commit:

- `.dev.vars`
- `wrangler.jsonc`
- API tokens
- R2 S3 access keys
- presigned URLs
- GitHub OAuth client secrets
- cookie encryption keys

Use Wrangler secrets for deployed credentials:

```sh
npx wrangler secret put CLOUDFLARE_API_TOKEN -c wrangler.jsonc
npx wrangler secret put GITHUB_CLIENT_ID -c wrangler.jsonc
npx wrangler secret put GITHUB_CLIENT_SECRET -c wrangler.jsonc
npx wrangler secret put COOKIE_ENCRYPTION_KEY -c wrangler.jsonc
npx wrangler secret put R2_ACCESS_KEY_ID -c wrangler.jsonc
npx wrangler secret put R2_SECRET_ACCESS_KEY -c wrangler.jsonc
```

## ☁️ Cloudflare API Token

Read-only account tools require `CLOUDFLARE_API_TOKEN`.

Use the smallest readable R2 scope required by the deployment. Do not use a global token.

## 📏 Payload Limits

Inline MCP transfer is bounded:

- `MAX_INLINE_TEXT_BYTES` for text reads
- `MAX_TRANSFER_BYTES` for base64 transfer and Worker-mediated copy

Use presigned URLs for larger payloads.

## ✅ Public Deployment Checklist

Before exposing `/mcp` publicly:

- `AUTH_MODE=github`
- `ALLOWED_GITHUB_LOGINS` is non-empty
- `OAUTH_KV` is bound
- GitHub OAuth callback URL matches the Worker URL
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and `COOKIE_ENCRYPTION_KEY` are secrets
- `wrangler.jsonc` is not committed
- `.dev.vars` is not committed
- account tools remain disabled unless read-only account visibility is required
- presign tools remain disabled unless direct upload/download URLs are required
