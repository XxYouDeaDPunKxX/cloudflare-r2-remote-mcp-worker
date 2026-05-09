import { R2McpError } from "../errors";

function normalizePath(raw: string, allowEmpty: boolean): string {
  if (typeof raw !== "string") {
    throw new R2McpError("invalid_path", "Path must be a string");
  }

  let normalized = raw.replace(/\\/g, "/").trim();

  if (normalized.startsWith("/")) {
    throw new R2McpError("invalid_path", "Absolute paths are not allowed");
  }

  if (/^[A-Za-z]:/.test(normalized)) {
    throw new R2McpError("invalid_path", "Drive-letter paths are not allowed");
  }

  while (normalized.includes("//")) {
    normalized = normalized.replace(/\/\//g, "/");
  }

  const parts = normalized.split("/").filter(Boolean);
  for (const part of parts) {
    if (part === "." || part === "..") {
      throw new R2McpError("invalid_path", "Path segments '.' and '..' are not allowed");
    }
    if (part.includes("\0")) {
      throw new R2McpError("invalid_path", "Null bytes are not allowed");
    }
  }

  const joined = parts.join("/");
  if (!allowEmpty && joined === "") {
    throw new R2McpError("invalid_path", "Path must not be empty");
  }

  return joined;
}

export function normalizeRootPrefix(raw: string): string {
  return normalizePath(raw, true);
}

export function normalizeRelativeKey(raw: string): string {
  return normalizePath(raw, false);
}

export function normalizeRelativePrefix(raw?: string): string {
  if (!raw) {
    return "";
  }
  return normalizePath(raw, true);
}

export function toScopedKey(rootPrefix: string, relativeKey: string): string {
  const normalizedKey = normalizeRelativeKey(relativeKey);
  if (!rootPrefix) {
    return normalizedKey;
  }
  return `${rootPrefix}/${normalizedKey}`;
}

export function toScopedPrefix(rootPrefix: string, relativePrefix?: string): string {
  const normalizedPrefix = normalizeRelativePrefix(relativePrefix);
  if (!rootPrefix) {
    return normalizedPrefix;
  }
  if (!normalizedPrefix) {
    return `${rootPrefix}/`;
  }
  return `${rootPrefix}/${normalizedPrefix}`;
}

export function toRelativeKey(rootPrefix: string, scopedKey: string): string {
  const normalizedScopedKey = normalizeRelativeKey(scopedKey);
  if (!rootPrefix) {
    return normalizedScopedKey;
  }

  const fullPrefix = `${rootPrefix}/`;
  if (normalizedScopedKey === rootPrefix) {
    return "";
  }
  if (!normalizedScopedKey.startsWith(fullPrefix)) {
    throw new R2McpError("out_of_scope", "Object key falls outside the configured root prefix", {
      details: { rootPrefix, scopedKey: normalizedScopedKey },
      status: 403,
    });
  }

  return normalizedScopedKey.slice(fullPrefix.length);
}

export function basenameKey(relativeKey: string): string {
  const normalized = normalizeRelativeKey(relativeKey);
  const parts = normalized.split("/");
  return parts[parts.length - 1]!;
}

