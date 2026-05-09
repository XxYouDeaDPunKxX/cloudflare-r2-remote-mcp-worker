# 🔌 Client Setup

## 🌐 Endpoint

Remote MCP endpoint:

```text
https://<worker-url>/mcp
```

Local authless endpoint:

```text
http://localhost:8787/mcp
```

With `AUTH_MODE=github`, the client uses OAuth routes exposed by the Worker:

```text
/authorize
/token
/register
/callback
```

The browser login must use a GitHub account listed in `ALLOWED_GITHUB_LOGINS`.

## 💬 ChatGPT

Required values:

```text
URL = https://<worker-url>/mcp
Auth = OAuth
```

Setup:

1. Open ChatGPT settings.
2. Go to Connectors or Apps & Connectors.
3. Enable Developer Mode if required.
4. Create or add a custom connector.
5. Choose MCP or remote MCP connector.
6. Set the connector URL to `https://<worker-url>/mcp`.
7. Choose OAuth authentication.
8. Save or create the connector.
9. Start the connection flow.
10. Approve the GitHub OAuth login.
11. Refresh or list actions/tools.

Write/modify tools may require an explicit confirmation before execution.

References:

- ChatGPT developer mode: https://platform.openai.com/docs/developer-mode
- OpenAI Help Center developer mode article: https://help.openai.com/en/articles/12584461-developer-mode-apps-and-full-mcp-connectors-in-chatgpt-beta

## 🔍 MCP Inspector

Run:

```sh
npx @modelcontextprotocol/inspector@latest
```

Connect to:

```text
https://<worker-url>/mcp
```

Expected:

- OAuth flow opens in a browser when `AUTH_MODE=github`.
- GitHub login completes.
- `tools/list` shows enabled tools.

See [Verify](verify.md) for expected tool names.

## 🔌 Generic MCP Client

Use a client that supports remote MCP over streamable HTTP.

Configure:

```text
endpoint = https://<worker-url>/mcp
auth = OAuth
```

For local `AUTH_MODE=none`, use:

```text
endpoint = http://localhost:8787/mcp
auth = none
```

## 📋 What Tools/List Means

`tools/list` confirms that:

- the client reached `/mcp`
- auth completed when enabled
- the Worker registered tools successfully

It does not prove that every tool can reach R2. `/healthz` verifies bucket access.

## 🧯 Troubleshooting

`401` or OAuth failure:

- verify `AUTH_MODE=github`
- verify GitHub OAuth App callback URL is `https://<worker-url>/callback`
- verify `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are set as Worker secrets
- verify `COOKIE_ENCRYPTION_KEY` is set
- verify `OAUTH_KV` binding exists

Login succeeds but access is denied:

- verify the GitHub login appears in `ALLOWED_GITHUB_LOGINS`

No tools visible:

- verify the client is connected to `/mcp`, not `/healthz`
- refresh tool/action definitions in the client
- verify the Worker deployed successfully
- check `/healthz` for bucket accessibility
