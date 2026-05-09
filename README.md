# 🪣 Cloudflare R2 Remote MCP Worker

Remote MCP server for Cloudflare R2 on Cloudflare Workers.

## 🧭 What This Is

This Worker exposes R2 object operations through a remote MCP endpoint:

```text
ChatGPT / MCP client
-> GitHub OAuth
-> Cloudflare Worker /mcp
-> R2 bucket
```

The main surface is object-level access to one bound R2 bucket. Account-level tools are optional and read-only. Presigned URL tools are optional and use R2 S3 credentials.

This is not full Cloudflare R2 account administration. Mutating account operations such as bucket creation, CORS updates, lifecycle updates, domain changes, and notification changes are intentionally not exposed as MCP tools.

## 🧩 What It Exposes

| Surface | Used for | Credentials |
| --- | --- | --- |
| Worker R2 binding | Object list/head/get/put/delete/copy/move/rename in the bound bucket. | Cloudflare Worker R2 binding |
| Cloudflare API | Optional read-only bucket/admin visibility. | Cloudflare API token |
| S3-compatible API | Optional presigned GET/PUT URLs. | R2 access key and secret |

Default enabled tools:

- object tools
- base64 upload/download tools
- GitHub OAuth protection when `AUTH_MODE=github`

Optional tools:

- read-only account/admin tools with `ENABLE_ACCOUNT_TOOLS=true`
- presigned URL tools with `ENABLE_PRESIGN_TOOLS=true`

## 📦 Required Pieces

- Node.js 20 or newer
- Wrangler 4
- Cloudflare account
- R2 bucket
- Cloudflare Worker
- GitHub OAuth App for public deployments
- MCP client, for example ChatGPT custom MCP connector or MCP Inspector

## 🛠️ Setup Order

### 1. Install

```sh
npm install
npx wrangler login
```

### 2. Create Buckets

```sh
npx wrangler r2 bucket create your-bucket-name
npx wrangler r2 bucket create your-preview-bucket-name
```

### 3. Configure Worker

```sh
cp wrangler.example.jsonc wrangler.jsonc
```

Edit:

- `name`
- `r2_buckets[0].bucket_name`
- `r2_buckets[0].preview_bucket_name`
- `vars.R2_BUCKET_NAME`
- `vars.AUTH_MODE`
- `vars.ALLOWED_GITHUB_LOGINS`

Do not commit `wrangler.jsonc`.

### 4. Configure Local Dev Variables

```sh
cp .dev.vars.example .dev.vars
```

`.dev.vars.example` uses `AUTH_MODE=none` for local development.

Public deployments should use:

```text
AUTH_MODE=github
```

Do not commit `.dev.vars`.

### 5. Configure OAuth State

```sh
npx wrangler kv namespace create OAUTH_KV
```

Add the generated namespace ID to `wrangler.jsonc`.

### 6. Configure GitHub OAuth

Create a GitHub OAuth App.

Callback URL:

```text
https://<worker-name>.<account-subdomain>.workers.dev/callback
```

Set secrets:

```sh
npx wrangler secret put GITHUB_CLIENT_ID -c wrangler.jsonc
npx wrangler secret put GITHUB_CLIENT_SECRET -c wrangler.jsonc
npx wrangler secret put COOKIE_ENCRYPTION_KEY -c wrangler.jsonc
```

GitHub OAuth verifies the login allowed to access the MCP endpoint. It does not grant access to GitHub repositories.

### 7. Deploy

```sh
npm run deploy
```

MCP endpoint:

```text
https://<worker-name>.<account-subdomain>.workers.dev/mcp
```

Health endpoint:

```text
https://<worker-name>.<account-subdomain>.workers.dev/healthz
```

### 8. Connect ChatGPT

Add a custom MCP connector:

```text
URL = https://<worker-name>.<account-subdomain>.workers.dev/mcp
Auth = OAuth
```

Approve through GitHub with a login listed in `ALLOWED_GITHUB_LOGINS`, then refresh/list tools.

### 9. Verify

```sh
npm run type-check
npm run smoke
```

Then verify:

- `/healthz` returns `ok: true`
- MCP `tools/list` returns object tools
- ChatGPT or MCP Inspector can see `r2_object_list`

See [Verify](docs/verify.md).

## 🧪 Local Development

Run:

```sh
npm run dev
```

Local endpoints:

```text
http://localhost:8787/healthz
http://localhost:8787/mcp
```

Local authless development is controlled by:

```text
AUTH_MODE=none
```

Do not expose `AUTH_MODE=none` on a public URL unless another access layer protects the Worker.

## 🔐 Security Defaults

- Public auth mode defaults to GitHub OAuth when `AUTH_MODE` is omitted.
- Account/admin tools are disabled by default.
- Account/admin tools are read-only when enabled.
- Presigned URL tools are disabled by default.
- Destructive object tools require `confirm: true`.
- Batch delete, move, and rename support `dryRun: true`.
- `R2_ROOT_PREFIX` can restrict object operations to one prefix.

## 📚 Documentation

- [Deploy](docs/deploy.md)
- [Auth](docs/auth.md)
- [Client Setup](docs/client-setup.md)
- [Verify](docs/verify.md)
- [Tools](docs/tools.md)
- [Security](docs/security.md)
- [Deferred Scope](docs/deferred.md)
- [References](docs/references.md)

## 📄 License

MIT. See [LICENSE](LICENSE).

## 🧑‍💻 Authorship Note

Cloudflare R2 Remote MCP Worker is a human-led project by XxYouDeaDPunKxX.

The concept, structure, behavioral logic, and final direction are human-authored. AI assistance was used during development for drafting, rewriting, refinement, iteration speed, and support material.
