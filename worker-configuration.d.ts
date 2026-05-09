interface Env {
  R2_BUCKET: R2Bucket;
  OAUTH_KV?: KVNamespace;
  AUTH_MODE?: string;
  ALLOWED_GITHUB_LOGINS?: string;
  COOKIE_ENCRYPTION_KEY?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  R2_BUCKET_NAME?: string;
  R2_ROOT_PREFIX?: string;
  MAX_INLINE_TEXT_BYTES?: string;
  MAX_TRANSFER_BYTES?: string;
  MAX_LIST_LIMIT?: string;
  ENABLE_ACCOUNT_TOOLS?: string;
  ENABLE_PRESIGN_TOOLS?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_S3_ENDPOINT?: string;
  R2_S3_REGION?: string;
}
