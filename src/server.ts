import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadConfig } from "./config";
import { registerAllTools } from "./tools/registerAllTools";

export function createServer(env: Env): McpServer {
  const server = new McpServer({
    name: "cloudflare-r2-remote-mcp-worker",
    version: "0.1.0",
  });

  registerAllTools(server, env, loadConfig(env));
  return server;
}
