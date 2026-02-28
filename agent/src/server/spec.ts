import fs from "node:fs";
import path from "node:path";

export type OpenAPISpec = Record<string, unknown>;

const specPath = path.resolve("docs/requirements/GOOSE_SERVER_OPENAPI.json");

export const loadSpec = (): OpenAPISpec => {
  const raw = fs.readFileSync(specPath, "utf8");
  return JSON.parse(raw) as OpenAPISpec;
};

export const toFastifyPath = (openApiPath: string): string =>
  openApiPath.replaceAll(/\{([^}]+)\}/g, ":$1");

export const pickSuccessStatus = (
  responses: Record<string, unknown>,
): number => {
  const preferred = ["200", "201", "202", "204"];
  for (const code of preferred) {
    if (responses[code] !== undefined) {
      return Number(code);
    }
  }

  const first2xx = Object.keys(responses)
    .filter((code) => /^2\d\d$/.test(code))
    .sort()[0];

  if (first2xx) {
    return Number(first2xx);
  }

  return 200;
};
