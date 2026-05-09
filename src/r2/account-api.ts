import { ServerConfig } from "../config";
import { R2McpError } from "../errors";

const CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4";

export type AccountApi = {
  get(path: string, query?: Record<string, string | number | boolean | undefined>): Promise<unknown>;
};

function requireAccountConfig(config: ServerConfig): { accountId: string; apiToken: string } {
  if (!config.accountToolsEnabled) {
    throw new R2McpError("account_tools_disabled", "Read-only account tools are disabled", {
      status: 403,
    });
  }
  if (!config.accountId || !config.apiToken) {
    throw new R2McpError("account_config_missing", "CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required", {
      status: 500,
    });
  }
  return { accountId: config.accountId, apiToken: config.apiToken };
}

function encodePathPart(value: string): string {
  return encodeURIComponent(value);
}

function appendQuery(url: URL, query?: Record<string, string | number | boolean | undefined>): void {
  if (!query) {
    return;
  }

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }
}

export function createAccountApi(config: ServerConfig): AccountApi {
  const { accountId, apiToken } = requireAccountConfig(config);

  return {
    async get(path, query) {
      const url = new URL(`${CLOUDFLARE_API_BASE}/accounts/${encodePathPart(accountId)}${path}`);
      appendQuery(url, query);

      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${apiToken}`,
        },
        method: "GET",
      });

      let body: unknown;
      const text = await response.text();
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = text;
      }

      if (!response.ok) {
        throw new R2McpError("cloudflare_api_error", "Cloudflare API request failed", {
          details: {
            body,
            status: response.status,
          },
          status: response.status,
        });
      }

      return body;
    },
  };
}

export function bucketPath(bucketName: string, suffix = ""): string {
  return `/r2/buckets/${encodePathPart(bucketName)}${suffix}`;
}

