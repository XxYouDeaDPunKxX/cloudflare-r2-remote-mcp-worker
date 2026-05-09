import { normalizeRootPrefix } from "./r2/keys";

export type ServerConfig = {
  accountId?: string;
  accountToolsEnabled: boolean;
  apiToken?: string;
  authMode: "github" | "none";
  bucketName?: string;
  maxInlineTextBytes: number;
  maxListLimit: number;
  maxTransferBytes: number;
  presignAccessKeyId?: string;
  presignSecretAccessKey?: string;
  presignEndpoint?: string;
  presignRegion: string;
  presignToolsEnabled: boolean;
  rootPrefix: string;
};

const DEFAULT_MAX_INLINE_TEXT_BYTES = 262_144;
const DEFAULT_MAX_TRANSFER_BYTES = 1_048_576;
const DEFAULT_MAX_LIST_LIMIT = 100;

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  const normalized = clean(value);
  if (!normalized) {
    return fallback;
  }
  return normalized.toLowerCase() === "true";
}

function parseAuthMode(value: string | undefined): "github" | "none" {
  const normalized = clean(value)?.toLowerCase();
  if (!normalized) {
    return "github";
  }
  if (normalized === "github" || normalized === "none") {
    return normalized;
  }
  throw new Error("AUTH_MODE must be 'github' or 'none'");
}

function parsePositiveInteger(
  value: string | undefined,
  fallback: number,
  fieldName: string,
): number {
  const normalized = clean(value);
  if (!normalized) {
    return fallback;
  }

  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} must be a positive integer`);
  }
  return parsed;
}

function defaultR2Endpoint(accountId?: string): string | undefined {
  if (!accountId) {
    return undefined;
  }
  return `https://${accountId}.r2.cloudflarestorage.com`;
}

export function loadConfig(env: Env): ServerConfig {
  const accountId = clean(env.CLOUDFLARE_ACCOUNT_ID);

  return {
    accountId,
    accountToolsEnabled: parseBoolean(env.ENABLE_ACCOUNT_TOOLS, false),
    apiToken: clean(env.CLOUDFLARE_API_TOKEN),
    authMode: parseAuthMode(env.AUTH_MODE),
    bucketName: clean(env.R2_BUCKET_NAME),
    maxInlineTextBytes: parsePositiveInteger(
      env.MAX_INLINE_TEXT_BYTES,
      DEFAULT_MAX_INLINE_TEXT_BYTES,
      "MAX_INLINE_TEXT_BYTES",
    ),
    maxListLimit: parsePositiveInteger(
      env.MAX_LIST_LIMIT,
      DEFAULT_MAX_LIST_LIMIT,
      "MAX_LIST_LIMIT",
    ),
    maxTransferBytes: parsePositiveInteger(
      env.MAX_TRANSFER_BYTES,
      DEFAULT_MAX_TRANSFER_BYTES,
      "MAX_TRANSFER_BYTES",
    ),
    presignAccessKeyId: clean(env.R2_ACCESS_KEY_ID),
    presignEndpoint: clean(env.R2_S3_ENDPOINT) ?? defaultR2Endpoint(accountId),
    presignRegion: clean(env.R2_S3_REGION) ?? "auto",
    presignSecretAccessKey: clean(env.R2_SECRET_ACCESS_KEY),
    presignToolsEnabled: parseBoolean(env.ENABLE_PRESIGN_TOOLS, false),
    rootPrefix: normalizeRootPrefix(env.R2_ROOT_PREFIX ?? ""),
  };
}
