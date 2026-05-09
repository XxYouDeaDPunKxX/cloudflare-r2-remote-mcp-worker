# ✅ Verify

## 🧪 Static Checks

These checks confirm the TypeScript project compiles and the repository contains the expected public files.

```sh
npm install
npm run type-check
npm run smoke
```

Expected:

```text
type-check exits 0
smoke ok
```

## 🫀 Health

Health verifies that the Worker can load config and reach the bound R2 bucket.

Local:

```sh
npm run dev
```

```text
http://localhost:8787/healthz
```

Remote:

```text
https://<worker-url>/healthz
```

Expected:

```json
{
  "ok": true,
  "bucketAccessible": true
}
```

## 📋 MCP Tools/List

`tools/list` verifies that the MCP endpoint is reachable and exposes tools.

Run MCP Inspector:

```sh
npx @modelcontextprotocol/inspector@latest
```

Connect to:

```text
https://<worker-url>/mcp
```

For local authless development:

```text
http://localhost:8787/mcp
```

Expected with `AUTH_MODE=github`:

- OAuth opens in a browser.
- GitHub login completes.
- the GitHub login is in `ALLOWED_GITHUB_LOGINS`.
- `tools/list` returns the enabled tool set.

Passing health and `tools/list` confirms the Worker can reach R2 and the MCP endpoint exposes tools.

## 🧰 Expected Default Tools

With default feature flags:

```text
r2_download_base64
r2_object_copy
r2_object_delete
r2_object_delete_many
r2_object_get
r2_object_head
r2_object_list
r2_object_move
r2_object_put
r2_object_put_if_absent
r2_object_rename
r2_upload_base64
```

With `ENABLE_ACCOUNT_TOOLS=true`, read-only admin tools should also appear.

With `ENABLE_PRESIGN_TOOLS=true`, presign tools should also appear.

## 🔌 SDK Tools/List Smoke

This check is for local development with `AUTH_MODE=none`.

Start the Worker:

```sh
npm run dev
```

Run:

```sh
node --input-type=module <<'EOF'
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const client = new Client({ name: "r2-mcp-verify", version: "0.0.0" });
const transport = new StreamableHTTPClientTransport(new URL("http://127.0.0.1:8787/mcp"));
await client.connect(transport);
const tools = await client.listTools();
console.log(JSON.stringify(tools.tools.map((tool) => tool.name).sort(), null, 2));
await client.close();
EOF
```

Expected output includes:

```text
r2_object_list
r2_object_get
r2_object_put
r2_download_base64
```

## 🧯 Failure Modes

`/healthz` fails:

- R2 binding is missing.
- bucket name is wrong.
- Wrangler config points at the wrong environment.

OAuth fails:

- GitHub OAuth callback URL does not match the Worker URL.
- `GITHUB_CLIENT_ID` or `GITHUB_CLIENT_SECRET` is missing.
- `COOKIE_ENCRYPTION_KEY` is missing.
- `OAUTH_KV` binding is missing.

Login succeeds but access is denied:

- GitHub login is not listed in `ALLOWED_GITHUB_LOGINS`.

Tools are missing:

- feature flag disabled.
- client has not refreshed tools after a server change.
- client is connected to the wrong URL.
