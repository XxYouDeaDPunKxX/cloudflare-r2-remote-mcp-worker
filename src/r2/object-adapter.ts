import { ServerConfig } from "../config";
import { R2McpError } from "../errors";
import { basenameKey, toRelativeKey, toScopedKey, toScopedPrefix } from "./keys";

export type ObjectMetadata = {
  contentType: string | null;
  customMetadata: Record<string, string>;
  etag: string;
  key: string;
  lastModified: string | null;
  size: number;
};

export type DownloadedObject = ObjectMetadata & {
  body: ArrayBuffer;
};

export type ListedObject = ObjectMetadata;

function assertReadableSize(size: number, maxBytes: number | undefined, key: string): void {
  if (maxBytes !== undefined && size > maxBytes) {
    throw new R2McpError("payload_too_large", "Object exceeds the configured transfer limit", {
      details: { key, maxBytes, size },
      status: 413,
    });
  }
}

function buildMetadata(
  rootPrefix: string,
  scopedKey: string,
  object: Pick<R2Object, "customMetadata" | "etag" | "size" | "uploaded" | "httpMetadata">,
): ObjectMetadata {
  return {
    contentType: object.httpMetadata?.contentType ?? null,
    customMetadata: object.customMetadata ?? {},
    etag: object.etag,
    key: toRelativeKey(rootPrefix, scopedKey),
    lastModified: object.uploaded ? object.uploaded.toISOString() : null,
    size: object.size,
  };
}

export async function listObjects(
  env: Env,
  config: ServerConfig,
  options: {
    cursor?: string;
    delimiter?: string;
    limit?: number;
    prefix?: string;
  },
): Promise<{
  cursor?: string;
  delimitedPrefixes: string[];
  objects: ListedObject[];
  rootPrefix: string;
  truncated: boolean;
}> {
  const limit = Math.min(options.limit ?? config.maxListLimit, config.maxListLimit);
  const scopedPrefix = toScopedPrefix(config.rootPrefix, options.prefix);
  const listed = await env.R2_BUCKET.list({
    cursor: options.cursor,
    delimiter: options.delimiter,
    limit,
    prefix: scopedPrefix,
  });

  return {
    cursor: "cursor" in listed ? listed.cursor : undefined,
    delimitedPrefixes: (listed.delimitedPrefixes ?? []).map((value) =>
      toRelativeKey(config.rootPrefix, value.endsWith("/") ? value.slice(0, -1) : value),
    ),
    objects: listed.objects.map((object) => buildMetadata(config.rootPrefix, object.key, object)),
    rootPrefix: config.rootPrefix,
    truncated: listed.truncated,
  };
}

export async function headObject(
  env: Env,
  config: ServerConfig,
  key: string,
): Promise<ObjectMetadata> {
  const scopedKey = toScopedKey(config.rootPrefix, key);
  const object = await env.R2_BUCKET.head(scopedKey);
  if (!object) {
    throw new R2McpError("object_not_found", "Object not found", {
      details: { key },
      status: 404,
    });
  }
  return buildMetadata(config.rootPrefix, scopedKey, object);
}

export async function getObject(
  env: Env,
  config: ServerConfig,
  key: string,
  options?: { maxBytes?: number },
): Promise<DownloadedObject> {
  const scopedKey = toScopedKey(config.rootPrefix, key);
  const object = await env.R2_BUCKET.get(scopedKey);
  if (!object) {
    throw new R2McpError("object_not_found", "Object not found", {
      details: { key },
      status: 404,
    });
  }

  assertReadableSize(object.size, options?.maxBytes, key);
  const body = await object.arrayBuffer();
  return {
    ...buildMetadata(config.rootPrefix, scopedKey, object),
    body,
  };
}

export async function putObject(
  env: Env,
  config: ServerConfig,
  input: {
    contentType?: string;
    customMetadata?: Record<string, string>;
    expectedEtag?: string;
    key: string;
    value: ArrayBuffer | string | Uint8Array;
  },
): Promise<ObjectMetadata> {
  const scopedKey = toScopedKey(config.rootPrefix, input.key);
  const putResult = await env.R2_BUCKET.put(scopedKey, input.value, {
    customMetadata: input.customMetadata,
    httpMetadata: input.contentType ? { contentType: input.contentType } : undefined,
    onlyIf: input.expectedEtag ? { etagMatches: input.expectedEtag } : undefined,
  });

  if (putResult === null) {
    throw new R2McpError(
      "etag_conflict",
      "Conditional write failed because the current object ETag did not match",
      {
        details: { expectedEtag: input.expectedEtag, key: input.key },
        status: 409,
      },
    );
  }

  return buildMetadata(config.rootPrefix, scopedKey, putResult);
}

export async function putObjectIfAbsent(
  env: Env,
  config: ServerConfig,
  input: {
    contentType?: string;
    customMetadata?: Record<string, string>;
    key: string;
    value: ArrayBuffer | string | Uint8Array;
  },
): Promise<ObjectMetadata> {
  const scopedKey = toScopedKey(config.rootPrefix, input.key);
  const putResult = await env.R2_BUCKET.put(scopedKey, input.value, {
    customMetadata: input.customMetadata,
    httpMetadata: input.contentType ? { contentType: input.contentType } : undefined,
    onlyIf: { etagDoesNotMatch: "*" },
  });

  if (putResult === null) {
    throw new R2McpError(
      "object_already_exists",
      "Create-if-absent failed because the object already exists",
      {
        details: { key: input.key },
        status: 409,
      },
    );
  }

  return buildMetadata(config.rootPrefix, scopedKey, putResult);
}

export async function deleteObject(
  env: Env,
  config: ServerConfig,
  key: string,
): Promise<{ deleted: true; key: string }> {
  const scopedKey = toScopedKey(config.rootPrefix, key);
  await env.R2_BUCKET.delete(scopedKey);
  return { deleted: true, key: toRelativeKey(config.rootPrefix, scopedKey) };
}

export async function deleteObjects(
  env: Env,
  config: ServerConfig,
  keys: string[],
): Promise<{ deletedKeys: string[] }> {
  const scopedKeys = keys.map((key) => toScopedKey(config.rootPrefix, key));
  await env.R2_BUCKET.delete(scopedKeys);
  return { deletedKeys: scopedKeys.map((key) => toRelativeKey(config.rootPrefix, key)) };
}

export async function copyObject(
  env: Env,
  config: ServerConfig,
  input: {
    allowOverwrite?: boolean;
    destinationKey: string;
    expectedDestinationEtag?: string;
    expectedSourceEtag?: string;
    sourceKey: string;
  },
): Promise<{ destination: ObjectMetadata; source: ObjectMetadata }> {
  const source = await getObject(env, config, input.sourceKey, {
    maxBytes: config.maxTransferBytes,
  });
  if (input.expectedSourceEtag && source.etag !== input.expectedSourceEtag) {
    throw new R2McpError("etag_conflict", "Source object ETag does not match the expected ETag", {
      details: {
        currentEtag: source.etag,
        expectedEtag: input.expectedSourceEtag,
        sourceKey: input.sourceKey,
      },
      status: 409,
    });
  }

  if (!input.allowOverwrite) {
    const existing = await env.R2_BUCKET.head(toScopedKey(config.rootPrefix, input.destinationKey));
    if (existing) {
      throw new R2McpError("destination_exists", "Destination object already exists", {
        details: { destinationKey: input.destinationKey },
        status: 409,
      });
    }
  }

  const destination = await putObject(env, config, {
    contentType: source.contentType ?? undefined,
    customMetadata: source.customMetadata,
    expectedEtag: input.expectedDestinationEtag,
    key: input.destinationKey,
    value: source.body,
  });

  return {
    destination,
    source: {
      contentType: source.contentType,
      customMetadata: source.customMetadata,
      etag: source.etag,
      key: source.key,
      lastModified: source.lastModified,
      size: source.size,
    },
  };
}

export async function moveObject(
  env: Env,
  config: ServerConfig,
  input: {
    allowOverwrite?: boolean;
    destinationKey: string;
    expectedDestinationEtag?: string;
    expectedSourceEtag?: string;
    sourceKey: string;
  },
): Promise<{ deletedSourceKey: string; destination: ObjectMetadata; sourceKey: string }> {
  const copied = await copyObject(env, config, input);
  await deleteObject(env, config, input.sourceKey);
  return {
    deletedSourceKey: input.sourceKey,
    destination: copied.destination,
    sourceKey: input.sourceKey,
  };
}

export async function renameObject(
  env: Env,
  config: ServerConfig,
  input: {
    allowOverwrite?: boolean;
    currentKey: string;
    expectedDestinationEtag?: string;
    expectedSourceEtag?: string;
    newName: string;
    targetPrefix?: string;
  },
): Promise<{ deletedSourceKey: string; destination: ObjectMetadata; destinationKey: string; sourceKey: string }> {
  const normalizedNewName = normalizeBasename(input.newName);
  const basename = basenameKey(input.currentKey);
  if (basename === normalizedNewName) {
    throw new R2McpError("no_op_rename", "New name must differ from the current object name");
  }

  const parts = input.currentKey.split("/");
  parts.pop();
  const parentPrefix = input.targetPrefix ?? parts.join("/");
  const destinationKey = [parentPrefix, normalizedNewName].filter(Boolean).join("/");

  const moved = await moveObject(env, config, {
    allowOverwrite: input.allowOverwrite,
    destinationKey,
    expectedDestinationEtag: input.expectedDestinationEtag,
    expectedSourceEtag: input.expectedSourceEtag,
    sourceKey: input.currentKey,
  });

  return {
    ...moved,
    destinationKey,
  };
}

function normalizeBasename(rawName: string): string {
  const name = rawName.trim();
  if (!name) {
    throw new R2McpError("invalid_path", "New name must not be empty");
  }
  if (name.includes("/") || name.includes("\\")) {
    throw new R2McpError("invalid_path", "New name must be a basename, not a path");
  }
  if (name === "." || name === ".." || name.includes("\0")) {
    throw new R2McpError("invalid_path", "Invalid object basename");
  }
  return name;
}

