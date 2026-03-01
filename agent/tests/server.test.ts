import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../src/server/app.js";
import { resolveResponse } from "../src/server/responder.js";
import {
  loadSpec,
  pickSuccessStatus,
  toFastifyPath,
} from "../src/server/spec.js";

type HttpMethod =
  | "get"
  | "post"
  | "put"
  | "patch"
  | "delete"
  | "head"
  | "options"
  | "trace";

type OpenApiOperation = {
  openApiPath: string;
  method: HttpMethod;
  operation: Record<string, unknown>;
  pathItem: Record<string, unknown>;
};

type Parameter = {
  in?: "path" | "query" | "header" | "cookie";
  name?: string;
  example?: unknown;
  schema?: { example?: unknown; type?: string };
};

const METHODS: HttpMethod[] = [
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "head",
  "options",
  "trace",
];
const PUBLIC_PATHS = new Set(["/status", "/mcp-ui-proxy", "/mcp-app-proxy"]);
const CONTRACT_SKIP_PATHS = new Set([
  "/reply",
  "/mcp-ui-proxy",
  "/recipes/save",
]);
const OPENAPI = loadSpec();
const app = buildApp();

const normalizeContentType = (value: string): string => {
  const [base = ""] = value.split(";");
  return base.trim().toLowerCase();
};

const listOperations = (): OpenApiOperation[] => {
  const operations: OpenApiOperation[] = [];
  const paths = (OPENAPI.paths ?? {}) as Record<
    string,
    Record<string, unknown>
  >;

  for (const [openApiPath, pathItem] of Object.entries(paths)) {
    for (const method of METHODS) {
      if (pathItem[method]) {
        operations.push({
          openApiPath,
          method,
          operation: pathItem[method] as Record<string, unknown>,
          pathItem,
        });
      }
    }
  }

  return operations;
};

const exampleForParameter = (parameter: Parameter): string => {
  if (parameter.example !== undefined) {
    return String(parameter.example);
  }
  if (parameter.schema?.example !== undefined) {
    return String(parameter.schema.example);
  }
  switch (parameter.schema?.type) {
    case "integer":
    case "number":
      return "1";
    case "boolean":
      return "true";
    default:
      return "string";
  }
};

const collectParameters = (operation: OpenApiOperation): Parameter[] => {
  const pathParams = (operation.pathItem.parameters ?? []) as Parameter[];
  const opParams = (operation.operation.parameters ?? []) as Parameter[];
  return [...pathParams, ...opParams];
};

const buildRequestUrl = (operation: OpenApiOperation): string => {
  let url = toFastifyPath(operation.openApiPath);
  const parameters = collectParameters(operation);

  for (const parameter of parameters) {
    if (parameter.in === "path" && parameter.name) {
      url = url.replace(
        `:${parameter.name}`,
        encodeURIComponent(exampleForParameter(parameter)),
      );
    }
  }

  const search = new URLSearchParams();
  for (const parameter of parameters) {
    if (parameter.in === "query" && parameter.name) {
      search.set(parameter.name, exampleForParameter(parameter));
    }
  }

  const queryString = search.toString();
  return queryString.length > 0 ? `${url}?${queryString}` : url;
};

const buildJsonPayload = (operation: OpenApiOperation): unknown => {
  const requestBody = operation.operation.requestBody as
    | { content?: Record<string, Record<string, unknown>> }
    | undefined;
  const content = requestBody?.content;
  const json = content?.["application/json"];
  if (!json) {
    return undefined;
  }
  if (json.example !== undefined) {
    return json.example;
  }
  if (json.examples && typeof json.examples === "object") {
    const first = Object.values(json.examples)[0] as
      | Record<string, unknown>
      | undefined;
    if (first?.value !== undefined) {
      return first.value;
    }
  }
  return undefined;
};

const requiresSecretKey = (openApiPath: string): boolean =>
  !PUBLIC_PATHS.has(openApiPath);

const expectedSuccess = (
  operation: OpenApiOperation,
): {
  status: number;
  contentType: string | null;
} => {
  const status = pickSuccessStatus(
    (operation.operation.responses ?? {}) as Record<string, unknown>,
  );
  const resolved = resolveResponse(operation.operation, status, OPENAPI);
  return { status: resolved.statusCode, contentType: resolved.contentType };
};

const operations = listOperations();
const parseSseDataFrame = (body: string): Record<string, unknown> => {
  const line = body
    .split("\n")
    .map((part) => part.trim())
    .find((part) => part.startsWith("data: "));
  if (!line) {
    throw new Error("Missing SSE data frame");
  }
  return JSON.parse(line.slice("data: ".length)) as Record<string, unknown>;
};

beforeAll(async () => {
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe("MUST manual server requirements", () => {
  it("MUST require X-Secret-Key for protected routes", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/agent/start",
      payload: { working_dir: "/tmp" },
    });
    expect(response.statusCode).toBe(401);
  });

  it("MUST stream valid SSE frames on /reply", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/reply",
      headers: { "X-Secret-Key": "dev-secret" },
      payload: {
        session_id: "session-example",
        user_message: {
          role: "user",
          created: "2024-01-01T00:00:00.000Z",
          content: [{ type: "text", text: "hello" }],
        },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(String(response.headers["content-type"] ?? "")).toContain(
      "text/event-stream",
    );
    expect(response.body.startsWith("data: ")).toBe(true);
    expect(response.body.endsWith("\n\n")).toBe(true);
  });

  it("MUST return deterministic send-logs stub event for /reply command /send-logs", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/reply",
      headers: { "X-Secret-Key": "dev-secret" },
      payload: {
        session_id: "session-send-logs",
        user_message: {
          role: "user",
          created: "2024-01-01T00:00:00.000Z",
          content: [{ type: "text", text: "/send-logs" }],
        },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(String(response.headers["content-type"] ?? "")).toContain(
      "text/event-stream",
    );
    const payload = parseSseDataFrame(response.body);
    expect(payload.ok).toBe(true);
    expect(payload.message).toBe("Send logs dry-run completed");
    expect(String(payload.artifactPath ?? "")).toContain(
      "send-logs-dry-run.txt",
    );
    expect(payload.remotePath).toBe("dry-run://pending");
  });

  it("MUST enforce secret query on /mcp-ui-proxy", async () => {
    const ok = await app.inject({
      method: "GET",
      url: "/mcp-ui-proxy?secret=dev-secret",
    });
    const unauthorized = await app.inject({
      method: "GET",
      url: "/mcp-ui-proxy?secret=wrong",
    });

    expect(ok.statusCode).toBe(200);
    expect(unauthorized.statusCode).toBe(401);
  });

  it("MUST return empty body for 204 responses", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/recipes/save",
      headers: { "X-Secret-Key": "dev-secret" },
      payload: {},
    });

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe("");
  });

  it("MUST accept valid typed desktop message envelopes", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/desktop/messages",
      headers: { "X-Secret-Key": "dev-secret" },
      payload: {
        id: "msg-1",
        topic: "desktop.chat-window.create",
        sentAt: "2026-01-01T00:00:00.000Z",
        payload: { query: "hello" },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      accepted: true,
      echoedTopic: "desktop.chat-window.create",
    });
  });

  it("MUST reject invalid typed desktop message envelopes deterministically", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/desktop/messages",
      headers: { "X-Secret-Key": "dev-secret" },
      payload: { topic: "" },
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual({
      code: "IPC_INVALID_INPUT",
      message: "Invalid desktop message envelope",
    });
  });

  it("MUST stream typed desktop server events on /desktop/messages/stream", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/desktop/messages/stream",
      headers: { "X-Secret-Key": "dev-secret" },
    });

    expect(response.statusCode).toBe(200);
    expect(String(response.headers["content-type"] ?? "")).toContain(
      "text/event-stream",
    );
    const payload = parseSseDataFrame(response.body);
    expect(payload.topic).toBe("event.forward");
    expect(typeof payload.id).toBe("string");
    expect(typeof (payload.payload as { event?: unknown }).event).toBe(
      "string",
    );
    expect(typeof payload.sentAt).toBe("string");
  });
});

describe("MUST runtime contract requirements", () => {
  it("MUST expose OpenAPI operations", () => {
    expect(operations.length).toBeGreaterThan(0);
  });

  for (const operation of operations) {
    const id =
      (operation.operation.operationId as string | undefined) ??
      `${operation.method.toUpperCase()} ${operation.openApiPath}`;
    it(`MUST satisfy 2xx contract: ${id}`, async () => {
      if (CONTRACT_SKIP_PATHS.has(operation.openApiPath)) {
        return;
      }

      const expected = expectedSuccess(operation);
      const url = buildRequestUrl(operation);
      const payload = buildJsonPayload(operation);
      const headers: Record<string, string> = {};

      if (requiresSecretKey(operation.openApiPath)) {
        headers["X-Secret-Key"] = "dev-secret";
      }
      if (payload !== undefined) {
        headers["content-type"] = "application/json";
      }

      const response = await app.inject({
        method: operation.method.toUpperCase(),
        url,
        headers,
        payload,
      });

      expect(response.statusCode).toBe(expected.status);

      if (expected.status === 204) {
        expect(response.body).toBe("");
        return;
      }

      if (expected.contentType) {
        const actual = normalizeContentType(
          String(response.headers["content-type"] ?? ""),
        );
        expect(actual).toBe(normalizeContentType(expected.contentType));
      }

      if (expected.contentType === "application/json") {
        expect(() => JSON.parse(response.body)).not.toThrow();
      }
    });
  }
});
