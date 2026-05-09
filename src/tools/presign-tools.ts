import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ServerConfig } from "../config";
import { errorResult, jsonResult } from "../format";
import { presignGetObject, presignPutObject } from "../r2/presign";

export function registerPresignTools(server: McpServer, config: ServerConfig): void {
  server.registerTool(
    "r2_presign_get",
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
        readOnlyHint: true,
      },
      description: "Create a presigned GET URL for one R2 object.",
      inputSchema: {
        expiresInSeconds: z.number().int().min(1).max(604800).optional(),
        key: z.string(),
      },
      title: "Presign R2 GET",
    },
    async ({ expiresInSeconds, key }) => {
      try {
        return jsonResult(await presignGetObject(config, { expiresInSeconds, key }));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "r2_presign_put",
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
        readOnlyHint: false,
      },
      description: "Create a presigned PUT URL for one R2 object.",
      inputSchema: {
        contentType: z.string().optional(),
        expiresInSeconds: z.number().int().min(1).max(604800).optional(),
        key: z.string(),
      },
      title: "Presign R2 PUT",
    },
    async ({ contentType, expiresInSeconds, key }) => {
      try {
        return jsonResult(await presignPutObject(config, { contentType, expiresInSeconds, key }));
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}

