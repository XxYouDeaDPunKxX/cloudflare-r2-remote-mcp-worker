# 🧰 Tools

## 🧩 Tool Surfaces

| Surface | Tools | Credentials |
| --- | --- | --- |
| Worker R2 binding | Object and base64 transfer tools. | `R2_BUCKET` binding |
| Cloudflare API | Optional read-only account/admin tools. | `CLOUDFLARE_API_TOKEN` |
| S3-compatible API | Optional presigned URL tools. | `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` |

Object and transfer tools operate on the bound bucket. If `R2_ROOT_PREFIX` is set, object keys are scoped under that prefix and exposed as relative keys.

## 🪣 Object Tools

| Tool | Type | Effect |
| --- | --- | --- |
| `r2_object_list` | read | Lists objects and delimited prefixes. |
| `r2_object_head` | read | Returns object metadata. |
| `r2_object_get` | read | Returns UTF-8 text for text-like objects. |
| `r2_object_put` | write | Writes UTF-8 text to an object. |
| `r2_object_put_if_absent` | write | Creates text object only when absent. |
| `r2_object_delete` | destructive | Deletes one object. |
| `r2_object_delete_many` | destructive | Deletes multiple objects. |
| `r2_object_copy` | write | Copies one object by read plus write. |
| `r2_object_move` | destructive | Copies then deletes source. |
| `r2_object_rename` | destructive | Moves object to a new basename. |

`copy`, `move`, and `rename` are not atomic. `move` and `rename` can leave both source and destination present if delete fails after copy.

## 🧨 Destructive Guards

Destructive object tools require runtime confirmation in the input schema.

| Tool | Required guard | Optional guard |
| --- | --- | --- |
| `r2_object_delete` | `confirm: true` | none |
| `r2_object_delete_many` | `confirm: true` | `dryRun: true` |
| `r2_object_move` | `confirm: true` | `dryRun: true` |
| `r2_object_rename` | `confirm: true` | `dryRun: true` |

When `dryRun: true` is provided, the tool returns the planned operation and does not mutate R2.

## 🧪 Object Examples

List:

```json
{
  "prefix": "notes/",
  "limit": 20
}
```

Put text:

```json
{
  "key": "notes/example.txt",
  "text": "hello",
  "contentType": "text/plain"
}
```

Get text:

```json
{
  "key": "notes/example.txt"
}
```

Delete one object:

```json
{
  "key": "notes/example.txt",
  "confirm": true
}
```

Preview batch delete:

```json
{
  "keys": ["notes/a.txt", "notes/b.txt"],
  "dryRun": true,
  "confirm": true
}
```

Move with preview:

```json
{
  "sourceKey": "notes/a.txt",
  "destinationKey": "archive/a.txt",
  "dryRun": true,
  "confirm": true
}
```

## 📦 Transfer Tools

| Tool | Type | Effect |
| --- | --- | --- |
| `r2_upload_base64` | write | Uploads a base64 payload to R2. |
| `r2_download_base64` | read | Returns object bytes as base64. |

Transfer tools are bounded by `MAX_TRANSFER_BYTES`.

Upload base64:

```json
{
  "key": "images/example.png",
  "contentBase64": "<base64>",
  "contentType": "image/png"
}
```

Download base64:

```json
{
  "key": "images/example.png"
}
```

## ✍️ Presign Tools

Disabled by default. Enable with `ENABLE_PRESIGN_TOOLS=true`.

| Tool | Type | Effect |
| --- | --- | --- |
| `r2_presign_get` | read | Creates a temporary GET URL. |
| `r2_presign_put` | write | Creates a temporary PUT URL. |

URLs are bearer credentials until expiration.

Presign GET:

```json
{
  "key": "large/archive.zip",
  "expiresInSeconds": 900
}
```

Presign PUT:

```json
{
  "key": "uploads/archive.zip",
  "contentType": "application/zip",
  "expiresInSeconds": 900
}
```

## 👁️ Read-Only Admin Tools

Disabled by default. Enable with `ENABLE_ACCOUNT_TOOLS=true`.

| Tool | Type | Effect |
| --- | --- | --- |
| `r2_bucket_list` | read | Lists R2 buckets. |
| `r2_bucket_get` | read | Gets one bucket. |
| `r2_cors_get` | read | Gets CORS rules. |
| `r2_lifecycle_get` | read | Gets lifecycle rules. |
| `r2_domain_custom_list` | read | Lists custom domains. |
| `r2_domain_custom_get` | read | Gets custom domain settings. |
| `r2_domain_managed_get` | read | Gets r2.dev domain settings. |
| `r2_notifications_list` | read | Lists event notification rules. |
| `r2_notifications_get` | read | Gets one event notification queue config. |
| `r2_metrics_get` | read | Gets account-level R2 metrics. |

No account-level create, update, or delete tools are included.
