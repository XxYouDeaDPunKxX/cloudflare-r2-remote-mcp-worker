# ⏳ Deferred Scope

The following capabilities are intentionally not implemented in the first public surface.

## 🧨 Destructive Account Administration

Excluded:

- bucket create
- bucket delete
- CORS put/delete
- lifecycle put/delete
- custom domain attach/update/delete
- managed domain update
- event notification put/delete
- bucket lock put
- Sippy put/delete

Reason: these change account or bucket configuration. The initial account surface is read-only.

## 📦 Large Object Operations

Excluded:

- multipart upload tools
- multipart copy
- unbounded object copy
- streaming object transfer through MCP

Reason: inline MCP payloads are not appropriate for large object movement. Presigned URLs are the recommended path.

## 🧬 Advanced R2 Features

Deferred:

- bucket locks mutation
- Sippy configuration mutation
- temporary access credentials
- Super Slurper
- Data Catalog
- object range reads

These can be added later with explicit tool contracts and security review.
