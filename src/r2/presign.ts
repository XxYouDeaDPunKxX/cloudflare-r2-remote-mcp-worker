import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ServerConfig } from "../config";
import { R2McpError } from "../errors";
import { toScopedKey } from "./keys";

const DEFAULT_EXPIRES_IN_SECONDS = 3600;
const MAX_EXPIRES_IN_SECONDS = 604800;

function requirePresignConfig(config: ServerConfig): {
  accessKeyId: string;
  bucketName: string;
  endpoint: string;
  region: string;
  secretAccessKey: string;
} {
  if (!config.presignToolsEnabled) {
    throw new R2McpError("presign_tools_disabled", "Presign tools are disabled", {
      status: 403,
    });
  }

  if (
    !config.bucketName ||
    !config.presignEndpoint ||
    !config.presignAccessKeyId ||
    !config.presignSecretAccessKey
  ) {
    throw new R2McpError(
      "presign_config_missing",
      "R2_BUCKET_NAME, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and an R2 S3 endpoint are required",
      { status: 500 },
    );
  }

  return {
    accessKeyId: config.presignAccessKeyId,
    bucketName: config.bucketName,
    endpoint: config.presignEndpoint,
    region: config.presignRegion,
    secretAccessKey: config.presignSecretAccessKey,
  };
}

function expiresIn(value?: number): number {
  const expires = value ?? DEFAULT_EXPIRES_IN_SECONDS;
  if (!Number.isInteger(expires) || expires < 1 || expires > MAX_EXPIRES_IN_SECONDS) {
    throw new R2McpError("invalid_expiration", "expiresInSeconds must be between 1 and 604800", {
      details: { expiresInSeconds: value },
    });
  }
  return expires;
}

function createClient(config: ServerConfig): { bucketName: string; client: S3Client } {
  const resolved = requirePresignConfig(config);
  return {
    bucketName: resolved.bucketName,
    client: new S3Client({
      credentials: {
        accessKeyId: resolved.accessKeyId,
        secretAccessKey: resolved.secretAccessKey,
      },
      endpoint: resolved.endpoint,
      forcePathStyle: true,
      region: resolved.region,
    }),
  };
}

export async function presignGetObject(
  config: ServerConfig,
  input: {
    expiresInSeconds?: number;
    key: string;
  },
): Promise<{ expiresInSeconds: number; key: string; url: string }> {
  const scopedKey = toScopedKey(config.rootPrefix, input.key);
  const { bucketName, client } = createClient(config);
  const expires = expiresIn(input.expiresInSeconds);
  const url = await getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucketName,
      Key: scopedKey,
    }),
    { expiresIn: expires },
  );

  return {
    expiresInSeconds: expires,
    key: input.key,
    url,
  };
}

export async function presignPutObject(
  config: ServerConfig,
  input: {
    contentType?: string;
    expiresInSeconds?: number;
    key: string;
  },
): Promise<{ contentType?: string; expiresInSeconds: number; key: string; url: string }> {
  const scopedKey = toScopedKey(config.rootPrefix, input.key);
  const { bucketName, client } = createClient(config);
  const expires = expiresIn(input.expiresInSeconds);
  const url = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: bucketName,
      ContentType: input.contentType,
      Key: scopedKey,
    }),
    { expiresIn: expires },
  );

  return {
    contentType: input.contentType,
    expiresInSeconds: expires,
    key: input.key,
    url,
  };
}

