import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import openapiTS, { astToString } from "openapi-typescript";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const specPath = path.join(
  projectRoot,
  "docs",
  "requirements",
  "GOOSE_SERVER_OPENAPI.json",
);
const outDir = path.join(projectRoot, "src", "shared", "http");
const outPath = path.join(outDir, "openapi.generated.ts");

const run = async () => {
  const raw = await fs.readFile(specPath, "utf8");
  const schema = JSON.parse(raw);
  const ast = await openapiTS(schema);
  const output = astToString(ast);
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(
    outPath,
    `/* eslint-disable */\n${output}`,
    "utf8",
  );
};

await run();
