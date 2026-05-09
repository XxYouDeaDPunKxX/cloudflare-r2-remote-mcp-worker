import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ServerConfig } from "../config";
import { R2McpError } from "../errors";
import { errorResult, jsonResult } from "../format";
import { bucketPath, createAccountApi } from "../r2/account-api";

function requireBucketName(config: ServerConfig, bucketName?: string): string {
  const resolved = bucketName?.trim() || config.bucketName;
  if (!resolved) {
    throw new R2McpError("bucket_name_missing", "A bucket name is required", {
      status: 400,
    });
  }
  return resolved;
}

export function registerAdminReadTools(server: McpServer, config: ServerConfig): void {
  server.registerTool(
    "r2_bucket_list",
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
        readOnlyHint: true,
      },
      description: "List R2 buckets in the configured Cloudflare account.",
      inputSchema: {
        cursor: z.string().optional(),
        direction: z.enum(["asc", "desc"]).optional(),
        nameContains: z.string().optional(),
        perPage: z.number().int().min(1).max(1000).optional(),
      },
      title: "List R2 Buckets",
    },
    async ({ cursor, direction, nameContains, perPage }) => {
      try {
        const api = createAccountApi(config);
        return jsonResult(
          await api.get("/r2/buckets", {
            cursor,
            direction,
            name_contains: nameContains,
            per_page: perPage,
          }),
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "r2_bucket_get",
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
        readOnlyHint: true,
      },
      description: "Get metadata for one R2 bucket.",
      inputSchema: {
        bucketName: z.string().optional(),
      },
      title: "Get R2 Bucket",
    },
    async ({ bucketName }) => {
      try {
        const api = createAccountApi(config);
        return jsonResult(await api.get(bucketPath(requireBucketName(config, bucketName))));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "r2_cors_get",
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
        readOnlyHint: true,
      },
      description: "Get CORS rules for one R2 bucket.",
      inputSchema: {
        bucketName: z.string().optional(),
      },
      title: "Get R2 CORS Rules",
    },
    async ({ bucketName }) => {
      try {
        const api = createAccountApi(config);
        return jsonResult(await api.get(bucketPath(requireBucketName(config, bucketName), "/cors")));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "r2_lifecycle_get",
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
        readOnlyHint: true,
      },
      description: "Get lifecycle rules for one R2 bucket.",
      inputSchema: {
        bucketName: z.string().optional(),
      },
      title: "Get R2 Lifecycle Rules",
    },
    async ({ bucketName }) => {
      try {
        const api = createAccountApi(config);
        return jsonResult(await api.get(bucketPath(requireBucketName(config, bucketName), "/lifecycle")));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "r2_domain_custom_list",
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
        readOnlyHint: true,
      },
      description: "List custom domains attached to one R2 bucket.",
      inputSchema: {
        bucketName: z.string().optional(),
      },
      title: "List R2 Custom Domains",
    },
    async ({ bucketName }) => {
      try {
        const api = createAccountApi(config);
        return jsonResult(
          await api.get(bucketPath(requireBucketName(config, bucketName), "/domains/custom")),
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "r2_domain_custom_get",
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
        readOnlyHint: true,
      },
      description: "Get custom domain settings for one R2 bucket.",
      inputSchema: {
        bucketName: z.string().optional(),
        domain: z.string(),
      },
      title: "Get R2 Custom Domain",
    },
    async ({ bucketName, domain }) => {
      try {
        const api = createAccountApi(config);
        return jsonResult(
          await api.get(
            bucketPath(
              requireBucketName(config, bucketName),
              `/domains/custom/${encodeURIComponent(domain)}`,
            ),
          ),
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "r2_domain_managed_get",
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
        readOnlyHint: true,
      },
      description: "Get r2.dev managed domain settings for one R2 bucket.",
      inputSchema: {
        bucketName: z.string().optional(),
      },
      title: "Get R2 Managed Domain",
    },
    async ({ bucketName }) => {
      try {
        const api = createAccountApi(config);
        return jsonResult(
          await api.get(bucketPath(requireBucketName(config, bucketName), "/domains/managed")),
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "r2_notifications_list",
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
        readOnlyHint: true,
      },
      description: "List event notification rules for one R2 bucket.",
      inputSchema: {
        bucketName: z.string().optional(),
      },
      title: "List R2 Event Notifications",
    },
    async ({ bucketName }) => {
      try {
        const api = createAccountApi(config);
        const bucket = encodeURIComponent(requireBucketName(config, bucketName));
        return jsonResult(await api.get(`/event_notifications/r2/${bucket}/configuration`));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "r2_notifications_get",
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
        readOnlyHint: true,
      },
      description: "Get one event notification queue configuration for an R2 bucket.",
      inputSchema: {
        bucketName: z.string().optional(),
        queueId: z.string(),
      },
      title: "Get R2 Event Notification",
    },
    async ({ bucketName, queueId }) => {
      try {
        const api = createAccountApi(config);
        const bucket = encodeURIComponent(requireBucketName(config, bucketName));
        return jsonResult(
          await api.get(
            `/event_notifications/r2/${bucket}/configuration/queues/${encodeURIComponent(queueId)}`,
          ),
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "r2_metrics_get",
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
        readOnlyHint: true,
      },
      description: "Get account-level R2 storage metrics.",
      inputSchema: {},
      title: "Get R2 Metrics",
    },
    async () => {
      try {
        const api = createAccountApi(config);
        return jsonResult(await api.get("/r2/metrics"));
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}

