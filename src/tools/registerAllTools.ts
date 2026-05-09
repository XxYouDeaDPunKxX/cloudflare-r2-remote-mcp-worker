import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ServerConfig } from "../config";
import { registerAdminReadTools } from "./admin-read-tools";
import { registerObjectTools } from "./object-tools";
import { registerPresignTools } from "./presign-tools";
import { registerTransferTools } from "./transfer-tools";

export function registerAllTools(server: McpServer, env: Env, config: ServerConfig): void {
  registerObjectTools(server, env, config);
  registerTransferTools(server, env, config);

  if (config.presignToolsEnabled) {
    registerPresignTools(server, config);
  }

  if (config.accountToolsEnabled) {
    registerAdminReadTools(server, config);
  }
}

