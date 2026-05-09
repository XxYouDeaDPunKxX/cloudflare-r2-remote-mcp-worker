import { readFile } from "node:fs/promises";

const requiredFiles = [
  ".dev.vars.example",
  ".gitignore",
  "LICENSE",
  "README.md",
  "docs/auth.md",
  "docs/client-setup.md",
  "docs/deferred.md",
  "docs/deploy.md",
  "docs/references.md",
  "docs/security.md",
  "docs/tools.md",
  "package.json",
  "package-lock.json",
  "src/config.ts",
  "src/errors.ts",
  "src/format.ts",
  "src/index.ts",
  "src/server.ts",
  "src/r2/account-api.ts",
  "src/r2/keys.ts",
  "src/r2/object-adapter.ts",
  "src/r2/presign.ts",
  "src/tools/admin-read-tools.ts",
  "src/tools/object-tools.ts",
  "src/tools/presign-tools.ts",
  "src/tools/registerAllTools.ts",
  "src/tools/transfer-tools.ts",
  "tsconfig.json",
  "worker-configuration.d.ts",
  "wrangler.example.jsonc",
];

const forbidden = [
  "QWdlbnRpYyBCcmlkZ2U=",
  "YWdlbnRpYyBicmlkZ2U=",
  "YnJpZGdlX2V4ZWN1dGVf",
  "cmVjb3JkX3N0YWdl",
  "d3JpdGViYWNr",
  "Q2xpbmljYWw=",
  "Q29kZXg=",
  "QUdFTlRTLm1k",
].map((value) => Buffer.from(value, "base64").toString("utf8"));

let failed = false;

for (const file of requiredFiles) {
  let content;
  try {
    content = await readFile(file, "utf8");
  } catch (error) {
    failed = true;
    console.error(`missing ${file}`);
    continue;
  }

  for (const token of forbidden) {
    if (content.includes(token)) {
      failed = true;
      console.error(`forbidden token in ${file}: ${token}`);
    }
  }
}

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
for (const script of ["dev", "deploy", "smoke", "type-check"]) {
  if (!packageJson.scripts?.[script]) {
    failed = true;
    console.error(`missing package script: ${script}`);
  }
}

const references = await readFile("docs/references.md", "utf8");
for (const url of [
  "https://developers.cloudflare.com/agents/guides/remote-mcp-server/",
  "https://developers.cloudflare.com/agents/api-reference/mcp-handler-api/",
  "https://developers.cloudflare.com/r2/api/workers/workers-api-reference/",
  "https://developers.cloudflare.com/api/resources/r2/",
  "https://developers.cloudflare.com/r2/api/s3/presigned-urls/",
  "https://github.com/cloudflare/mcp-server-cloudflare",
  "https://github.com/cloudflare/workers-mcp",
]) {
  if (!references.includes(url)) {
    failed = true;
    console.error(`missing reference: ${url}`);
  }
}

if (failed) {
  process.exit(1);
}

console.log("smoke ok");
