import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Buffer } from "node:buffer";
import { z } from "zod";
import { ServerConfig } from "../config";
import { R2McpError } from "../errors";
import { errorResult, jsonResult } from "../format";
import { getObject, headObject, putObject } from "../r2/object-adapter";
import { basenameKey } from "../r2/keys";

function maxBase64Chars(maxBytes: number): number {
  return Math.ceil(maxBytes / 3) * 4;
}

function decodeBase64ToBytes(base64: string, maxBytes: number): Uint8Array {
  if (base64.length > maxBase64Chars(maxBytes)) {
    throw new R2McpError("payload_too_large", "Base64 payload exceeds MAX_TRANSFER_BYTES", {
      details: { encodedLength: base64.length, maxBytes },
      status: 413,
    });
  }

  const bytes = Buffer.from(base64, "base64");
  if (bytes.byteLength > maxBytes) {
    throw new R2McpError("payload_too_large", "Decoded payload exceeds MAX_TRANSFER_BYTES", {
      details: { maxBytes, size: bytes.byteLength },
      status: 413,
    });
  }

  return new Uint8Array(bytes);
}

function encodeBytesToBase64(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString("base64");
}

export function registerTransferTools(server: McpServer, env: Env, config: ServerConfig): void {
  server.registerTool(
    "r2_upload_base64",
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
        readOnlyHint: false,
      },
      description: "Upload a base64 payload into one R2 object.",
      inputSchema: {
        contentBase64: z.string(),
        contentType: z.string().optional(),
        customMetadata: z.record(z.string(), z.string()).optional(),
        expectedEtag: z.string().optional(),
        key: z.string(),
      },
      title: "Upload Base64 to R2",
    },
    async ({ contentBase64, contentType, customMetadata, expectedEtag, key }) => {
      try {
        const bytes = decodeBase64ToBytes(contentBase64, config.maxTransferBytes);
        return jsonResult(
          await putObject(env, config, {
            contentType,
            customMetadata,
            expectedEtag,
            key,
            value: bytes,
          }),
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "r2_download_base64",
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
        readOnlyHint: true,
      },
      description: "Return one R2 object as base64 plus metadata, bounded by MAX_TRANSFER_BYTES.",
      inputSchema: {
        key: z.string(),
      },
      title: "Download Base64 from R2",
    },
    async ({ key }) => {
      try {
        const metadata = await headObject(env, config, key);
        if (metadata.size > config.maxTransferBytes) {
          throw new R2McpError("payload_too_large", "Object exceeds MAX_TRANSFER_BYTES", {
            details: { key, maxBytes: config.maxTransferBytes, size: metadata.size },
            status: 413,
          });
        }

        const object = await getObject(env, config, key, {
          maxBytes: config.maxTransferBytes,
        });
        return jsonResult({
          contentBase64: encodeBytesToBase64(object.body),
          contentType: object.contentType,
          etag: object.etag,
          filename: basenameKey(object.key),
          key: object.key,
          lastModified: object.lastModified,
          size: object.size,
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}

