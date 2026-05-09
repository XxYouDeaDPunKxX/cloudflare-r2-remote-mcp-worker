import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ServerConfig } from "../config";
import { R2McpError } from "../errors";
import { errorResult, jsonResult } from "../format";
import {
  copyObject,
  deleteObject,
  deleteObjects,
  getObject,
  headObject,
  listObjects,
  moveObject,
  putObject,
  putObjectIfAbsent,
  renameObject,
} from "../r2/object-adapter";

const textEncoder = new TextEncoder();

function isTextLike(contentType: string | null): boolean {
  if (!contentType) {
    return true;
  }
  if (contentType.startsWith("text/")) {
    return true;
  }
  return [
    "application/json",
    "application/ld+json",
    "application/xml",
    "application/yaml",
    "application/x-yaml",
    "application/javascript",
    "application/x-javascript",
    "application/typescript",
  ].includes(contentType.toLowerCase());
}

function assertTextPayloadWithinLimit(text: string, config: ServerConfig, key: string): void {
  const encodedLength = textEncoder.encode(text).byteLength;
  if (encodedLength > config.maxTransferBytes) {
    throw new R2McpError("payload_too_large", "Text payload exceeds MAX_TRANSFER_BYTES", {
      details: { encodedLength, key, maxBytes: config.maxTransferBytes },
      status: 413,
    });
  }
}

function dryRunResult(operation: string, payload: unknown): ReturnType<typeof jsonResult> {
  return jsonResult({
    dryRun: true,
    operation,
    ...(
      typeof payload === "object" && payload !== null && !Array.isArray(payload)
        ? payload as Record<string, unknown>
        : { payload }
    ),
  });
}

export function registerObjectTools(server: McpServer, env: Env, config: ServerConfig): void {
  server.registerTool(
    "r2_object_list",
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
        readOnlyHint: true,
      },
      description: "List objects under the configured R2 root prefix.",
      inputSchema: {
        cursor: z.string().optional(),
        delimiter: z.string().max(1).optional(),
        limit: z.number().int().min(1).max(config.maxListLimit).optional(),
        prefix: z.string().optional(),
      },
      title: "List R2 Objects",
    },
    async ({ cursor, delimiter, limit, prefix }) => {
      try {
        return jsonResult(await listObjects(env, config, { cursor, delimiter, limit, prefix }));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "r2_object_head",
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
        readOnlyHint: true,
      },
      description: "Return metadata for one R2 object without returning its body.",
      inputSchema: {
        key: z.string(),
      },
      title: "Head R2 Object",
    },
    async ({ key }) => {
      try {
        return jsonResult(await headObject(env, config, key));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "r2_object_get",
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
        readOnlyHint: true,
      },
      description: "Read a text-like R2 object, bounded by MAX_INLINE_TEXT_BYTES.",
      inputSchema: {
        key: z.string(),
      },
      title: "Get R2 Object",
    },
    async ({ key }) => {
      try {
        const metadata = await headObject(env, config, key);
        if (!isTextLike(metadata.contentType)) {
          throw new R2McpError("unsupported_content_type", "Object is not text-like", {
            details: { contentType: metadata.contentType, key },
            status: 415,
          });
        }
        if (metadata.size > config.maxInlineTextBytes) {
          throw new R2McpError("payload_too_large", "Object exceeds MAX_INLINE_TEXT_BYTES", {
            details: { key, maxBytes: config.maxInlineTextBytes, size: metadata.size },
            status: 413,
          });
        }

        const object = await getObject(env, config, key, {
          maxBytes: config.maxInlineTextBytes,
        });
        return jsonResult({
          content: new TextDecoder().decode(object.body),
          contentType: object.contentType,
          etag: object.etag,
          key: object.key,
          lastModified: object.lastModified,
          size: object.size,
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "r2_object_put",
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
        readOnlyHint: false,
      },
      description: "Write UTF-8 text to one R2 object. expectedEtag enables conditional overwrite.",
      inputSchema: {
        contentType: z.string().optional(),
        customMetadata: z.record(z.string(), z.string()).optional(),
        expectedEtag: z.string().optional(),
        key: z.string(),
        text: z.string(),
      },
      title: "Put R2 Object",
    },
    async ({ contentType, customMetadata, expectedEtag, key, text }) => {
      try {
        assertTextPayloadWithinLimit(text, config, key);
        return jsonResult(
          await putObject(env, config, {
            contentType,
            customMetadata,
            expectedEtag,
            key,
            value: text,
          }),
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "r2_object_put_if_absent",
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
        readOnlyHint: false,
      },
      description: "Create a UTF-8 text object only if the key does not already exist.",
      inputSchema: {
        contentType: z.string().optional(),
        customMetadata: z.record(z.string(), z.string()).optional(),
        key: z.string(),
        text: z.string(),
      },
      title: "Put R2 Object If Absent",
    },
    async ({ contentType, customMetadata, key, text }) => {
      try {
        assertTextPayloadWithinLimit(text, config, key);
        return jsonResult(
          await putObjectIfAbsent(env, config, {
            contentType,
            customMetadata,
            key,
            value: text,
          }),
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "r2_object_delete",
    {
      annotations: {
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
        readOnlyHint: false,
      },
      description: "Delete one R2 object under the configured root prefix.",
      inputSchema: {
        confirm: z.literal(true),
        key: z.string(),
      },
      title: "Delete R2 Object",
    },
    async ({ key }) => {
      try {
        return jsonResult(await deleteObject(env, config, key));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "r2_object_delete_many",
    {
      annotations: {
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
        readOnlyHint: false,
      },
      description: "Delete multiple R2 objects under the configured root prefix.",
      inputSchema: {
        confirm: z.literal(true),
        dryRun: z.boolean().optional(),
        keys: z.array(z.string()).min(1).max(config.maxListLimit),
      },
      title: "Delete R2 Objects",
    },
    async ({ dryRun, keys }) => {
      try {
        if (dryRun) {
          return dryRunResult("r2_object_delete_many", {
            keys,
            wouldDeleteCount: keys.length,
          });
        }
        return jsonResult(await deleteObjects(env, config, keys));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "r2_object_copy",
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
        readOnlyHint: false,
      },
      description: "Copy one R2 object to another key. This operation is read plus write.",
      inputSchema: {
        allowOverwrite: z.boolean().optional(),
        destinationKey: z.string(),
        expectedDestinationEtag: z.string().optional(),
        expectedSourceEtag: z.string().optional(),
        sourceKey: z.string(),
      },
      title: "Copy R2 Object",
    },
    async ({
      allowOverwrite,
      destinationKey,
      expectedDestinationEtag,
      expectedSourceEtag,
      sourceKey,
    }) => {
      try {
        return jsonResult(
          await copyObject(env, config, {
            allowOverwrite,
            destinationKey,
            expectedDestinationEtag,
            expectedSourceEtag,
            sourceKey,
          }),
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "r2_object_move",
    {
      annotations: {
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
        readOnlyHint: false,
      },
      description: "Move one R2 object. This is copy followed by delete, not an atomic operation.",
      inputSchema: {
        allowOverwrite: z.boolean().optional(),
        confirm: z.literal(true),
        destinationKey: z.string(),
        dryRun: z.boolean().optional(),
        expectedDestinationEtag: z.string().optional(),
        expectedSourceEtag: z.string().optional(),
        sourceKey: z.string(),
      },
      title: "Move R2 Object",
    },
    async ({
      allowOverwrite,
      dryRun,
      destinationKey,
      expectedDestinationEtag,
      expectedSourceEtag,
      sourceKey,
    }) => {
      try {
        if (dryRun) {
          return dryRunResult("r2_object_move", {
            allowOverwrite: allowOverwrite ?? false,
            destinationKey,
            expectedDestinationEtag: expectedDestinationEtag ?? null,
            expectedSourceEtag: expectedSourceEtag ?? null,
            sourceKey,
            steps: ["copy source to destination", "delete source"],
          });
        }
        return jsonResult(
          await moveObject(env, config, {
            allowOverwrite,
            destinationKey,
            expectedDestinationEtag,
            expectedSourceEtag,
            sourceKey,
          }),
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "r2_object_rename",
    {
      annotations: {
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
        readOnlyHint: false,
      },
      description: "Rename one R2 object within its current prefix or an explicit target prefix.",
      inputSchema: {
        allowOverwrite: z.boolean().optional(),
        confirm: z.literal(true),
        currentKey: z.string(),
        dryRun: z.boolean().optional(),
        expectedDestinationEtag: z.string().optional(),
        expectedSourceEtag: z.string().optional(),
        newName: z.string().min(1),
        targetPrefix: z.string().optional(),
      },
      title: "Rename R2 Object",
    },
    async ({
      allowOverwrite,
      currentKey,
      dryRun,
      expectedDestinationEtag,
      expectedSourceEtag,
      newName,
      targetPrefix,
    }) => {
      try {
        if (dryRun) {
          return dryRunResult("r2_object_rename", {
            allowOverwrite: allowOverwrite ?? false,
            currentKey,
            expectedDestinationEtag: expectedDestinationEtag ?? null,
            expectedSourceEtag: expectedSourceEtag ?? null,
            newName,
            targetPrefix: targetPrefix ?? null,
            steps: ["copy current key to renamed destination", "delete current key"],
          });
        }
        return jsonResult(
          await renameObject(env, config, {
            allowOverwrite,
            currentKey,
            expectedDestinationEtag,
            expectedSourceEtag,
            newName,
            targetPrefix,
          }),
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}
