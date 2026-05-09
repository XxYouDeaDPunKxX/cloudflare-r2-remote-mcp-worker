# 🚀 Deploy

## 🧭 Deployment Model

The deployed Worker exposes:

```text
/healthz
/mcp
/authorize
/callback
/token
/register
```

`/mcp` is the MCP endpoint. With `AUTH_MODE=github`, the OAuth routes protect access to `/mcp`.

The Worker needs:

- one R2 bucket binding
- one KV namespace for OAuth state when GitHub auth is enabled
- GitHub OAuth secrets for public deployments

## 1. 🔑 Install And Login

```sh
npm install
npx wrangler login
```

## 2. 🪣 Create Buckets

Create the production bucket:

```sh
npx wrangler r2 bucket create your-bucket-name
```

Create a preview bucket:

```sh
npx wrangler r2 bucket create your-preview-bucket-name
```

The production bucket is used by deployed Workers. The preview bucket is used by local or preview Worker runs.

Dashboard path:

```text
Cloudflare Dashboard -> R2 Object Storage -> Create bucket
```

## 3. ⚙️ Configure Worker

```sh
cp wrangler.example.jsonc wrangler.jsonc
```

Edit:

- `name`
- `r2_buckets[0].bucket_name`
- `r2_buckets[0].preview_bucket_name`
- `vars.R2_BUCKET_NAME`
- `vars.R2_ROOT_PREFIX`
- `vars.AUTH_MODE`
- `vars.ALLOWED_GITHUB_LOGINS`
- feature flags

`wrangler.jsonc` is ignored by git so real bucket names do not enter the public repository.

## 4. 🔗 Bind R2

Required binding:

```jsonc
"r2_buckets": [
  {
    "binding": "R2_BUCKET",
    "bucket_name": "your-bucket-name",
    "preview_bucket_name": "your-preview-bucket-name"
  }
]
```

All object tools operate through this binding.

## 5. 🗃️ Configure OAuth State KV

Create a KV namespace:

```sh
npx wrangler kv namespace create OAUTH_KV
```

Add the namespace ID:

```jsonc
"kv_namespaces": [
  {
    "binding": "OAUTH_KV",
    "id": "your-kv-namespace-id"
  }
]
```

KV stores short-lived OAuth state for callback validation.

## 6. 🧾 Configure GitHub OAuth App

Public deployments should use:

```text
AUTH_MODE=github
```

Known subdomain path:

1. Choose `name` in `wrangler.jsonc`.
2. Identify your Cloudflare Workers subdomain.
3. Expected Worker URL:

   ```text
   https://<worker-name>.<account-subdomain>.workers.dev
   ```

4. Use this GitHub OAuth callback:

   ```text
   https://<worker-name>.<account-subdomain>.workers.dev/callback
   ```

Unknown subdomain path:

1. Choose `name` in `wrangler.jsonc`.
2. Deploy once after setting non-secret config.
3. Copy the Worker URL printed by Wrangler or shown in the Cloudflare dashboard.
4. Create or update the GitHub OAuth App callback:

   ```text
   https://<actual-worker-url-host>/callback
   ```

5. Set OAuth secrets.
6. Deploy again.

## 7. 🔐 Set Secrets

Required for `AUTH_MODE=github`:

```sh
npx wrangler secret put GITHUB_CLIENT_ID -c wrangler.jsonc
npx wrangler secret put GITHUB_CLIENT_SECRET -c wrangler.jsonc
npx wrangler secret put COOKIE_ENCRYPTION_KEY -c wrangler.jsonc
```

Optional read-only account tools:

```sh
npx wrangler secret put CLOUDFLARE_API_TOKEN -c wrangler.jsonc
```

Optional presign tools:

```sh
npx wrangler secret put R2_ACCESS_KEY_ID -c wrangler.jsonc
npx wrangler secret put R2_SECRET_ACCESS_KEY -c wrangler.jsonc
```

## 8. 👁️ Optional Account Tools

Read-only account tools require:

```text
ENABLE_ACCOUNT_TOOLS=true
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_API_TOKEN=...
R2_BUCKET_NAME=...
```

Use the narrowest token scope that can read the R2 resources required by the deployment.

## 9. ✍️ Optional Presign Tools

Presign tools require:

```text
ENABLE_PRESIGN_TOOLS=true
R2_BUCKET_NAME=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_S3_REGION=auto
```

If `R2_S3_ENDPOINT` is omitted, the server derives it from:

```text
https://<CLOUDFLARE_ACCOUNT_ID>.r2.cloudflarestorage.com
```

## 10. ✅ Verify Locally

```sh
npm run dev
```

Check:

```text
http://localhost:8787/healthz
```

Expected:

```json
{
  "ok": true,
  "bucketAccessible": true
}
```

## 11. 🚀 Deploy

```sh
npm run deploy
```

Remote MCP endpoint:

```text
https://<worker-name>.<account-subdomain>.workers.dev/mcp
```

Run final verification from [Verify](verify.md).
