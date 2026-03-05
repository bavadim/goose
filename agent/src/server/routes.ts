import fs from "node:fs";
import path from "node:path";
import swagger from "@fastify/swagger";
import Fastify from "fastify";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import type {
  components,
  operations,
} from "../shared/http/openapi.generated.js";
import { RuntimeRegistry, toSseStream } from "./runtime.js";

const PUBLIC_PATHS = new Set(["/status", "/mcp-ui-proxy", "/mcp-app-proxy"]);
const SEND_LOGS_COMMAND = "/send-logs";
const specPath = path.resolve("docs/requirements/GOOSE_SERVER_OPENAPI.json");

export const IMPLEMENTED_OPERATIONS = [
  ["GET", "/status"],
  ["GET", "/mcp-ui-proxy"],
  ["GET", "/mcp-app-proxy"],
  ["POST", "/agent/start"],
  ["POST", "/agent/resume"],
  ["POST", "/agent/restart"],
  ["POST", "/agent/stop"],
  ["POST", "/agent/add_extension"],
  ["POST", "/agent/remove_extension"],
  ["POST", "/agent/update_provider"],
  ["GET", "/config/extensions"],
  ["POST", "/config/extensions"],
  ["DELETE", "/config/extensions/{name}"],
  ["GET", "/config/providers"],
  ["POST", "/config/check_provider"],
  ["POST", "/config/detect-provider"],
  ["POST", "/config/set_provider"],
  ["POST", "/reply"],
  ["POST", "/recipes/save"],
] as const;

type OpenAPISpec = Record<string, unknown>;

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

export const loadSpec = (): OpenAPISpec =>
  JSON.parse(fs.readFileSync(specPath, "utf8")) as OpenAPISpec;

const unauthorized = (reply: FastifyReply): void => {
  reply.code(401).send({ message: "Unauthorized" });
};

const withAuth = (
  request: FastifyRequest,
  reply: FastifyReply,
  secretKey: string,
): boolean => {
  const routePath = request.routeOptions.url ?? "";
  if (PUBLIC_PATHS.has(routePath)) {
    return true;
  }
  const header = request.headers["x-secret-key"];
  const token = Array.isArray(header) ? header[0] : header;
  if (token !== secretKey) {
    unauthorized(reply);
    return false;
  }
  return true;
};

const extractReplyCommand = (
  body: operations["reply"]["requestBody"]["content"]["application/json"],
): string | null => {
  const text = body.user_message.content.find((item) => item.type === "text");
  return text && text.type === "text" ? text.text.trim() : null;
};

const sendLogsStubPayload = (): string =>
  JSON.stringify({
    ok: true,
    message: "Send logs dry-run completed",
    artifactPath: `${process.env.AGENT_LOGS_DIR ?? ""}/send-logs-dry-run.txt`,
    remotePath: "dry-run://pending",
  });

const toSessionPayload = (session: {
  id: string;
  workingDir: string;
  createdAt: string;
  updatedAt: string;
  provider: string;
  model: string;
  conversation: components["schemas"]["Message"][];
}): Record<string, unknown> => ({
  id: session.id,
  working_dir: session.workingDir,
  created_at: session.createdAt,
  updated_at: session.updatedAt,
  provider_name: session.provider,
  conversation: session.conversation,
  model_config: { model_name: session.model },
});

const registerRuntimeRoutes = (
  app: FastifyInstance,
  secretKey: string,
): void => {
  const registry = new RuntimeRegistry({
    settingsDir: process.env.AGENT_CONFIG_DIR ?? process.cwd(),
  });

  app.get("/status", async (_request, reply) => {
    reply.code(200).type("text/plain").send("ok");
  });

  app.get<{
    Querystring: operations["mcp_ui_proxy"]["parameters"]["query"];
  }>("/mcp-ui-proxy", async (request, reply) => {
    if (!request.query.secret || request.query.secret !== secretKey) {
      reply.code(401).send("Unauthorized");
      return;
    }
    reply
      .code(200)
      .type("text/html")
      .send("<!doctype html><html><body><h1>MCP UI Proxy</h1></body></html>");
  });

  app.get("/mcp-app-proxy", async (_request, reply) => {
    reply.code(200).type("text/plain").send("MCP app proxy");
  });

  app.post<{
    Body: operations["start_agent"]["requestBody"]["content"]["application/json"];
  }>("/agent/start", async (request, reply) => {
    if (!withAuth(request, reply, secretKey)) {
      return;
    }
    const session = registry.startAgent(request.body);
    reply
      .code(200)
      .type("application/json")
      .send(
        toSessionPayload({
          id: session.id,
          workingDir: session.workingDir,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          provider: session.provider.provider,
          model: session.provider.model,
          conversation: session.conversation,
        }),
      );
  });

  app.post<{
    Body: operations["resume_agent"]["requestBody"]["content"]["application/json"];
  }>("/agent/resume", async (request, reply) => {
    if (!withAuth(request, reply, secretKey)) {
      return;
    }
    const resumed = registry.resumeAgent(request.body);
    if (!resumed.ok) {
      reply.code(404).send();
      return;
    }
    reply
      .code(200)
      .type("application/json")
      .send({
        session: toSessionPayload({
          id: resumed.data.id,
          workingDir: resumed.data.workingDir,
          createdAt: resumed.data.createdAt,
          updatedAt: resumed.data.updatedAt,
          provider: resumed.data.provider.provider,
          model: resumed.data.provider.model,
          conversation: resumed.data.conversation,
        }),
        extension_results: [],
      });
  });

  app.post<{
    Body: operations["restart_agent"]["requestBody"]["content"]["application/json"];
  }>("/agent/restart", async (request, reply) => {
    if (!withAuth(request, reply, secretKey)) {
      return;
    }
    const restarted = registry.restartAgent(request.body);
    if (!restarted.ok) {
      reply.code(404).send();
      return;
    }
    reply
      .code(200)
      .type("application/json")
      .send({
        session: toSessionPayload({
          id: restarted.data.session.id,
          workingDir: restarted.data.session.workingDir,
          createdAt: restarted.data.session.createdAt,
          updatedAt: restarted.data.session.updatedAt,
          provider: restarted.data.session.provider.provider,
          model: restarted.data.session.provider.model,
          conversation: restarted.data.session.conversation,
        }),
        extension_results: restarted.data.extensionResults,
      });
  });

  app.post<{
    Body: operations["stop_agent"]["requestBody"]["content"]["application/json"];
  }>("/agent/stop", async (request, reply) => {
    if (!withAuth(request, reply, secretKey)) {
      return;
    }
    const result = registry.stopAgent(request.body);
    if (!result.ok) {
      reply.code(404).send();
      return;
    }
    reply.code(200).type("text/plain").send("ok");
  });

  app.post<{
    Body: operations["add_extension"]["requestBody"]["content"]["application/json"];
  }>("/config/extensions", async (request, reply) => {
    if (!withAuth(request, reply, secretKey)) {
      return;
    }
    const result = registry.upsertExtensionConfig(request.body);
    if (!result.ok) {
      reply.code(400).send();
      return;
    }
    reply.code(200).type("text/plain").send("ok");
  });

  app.get("/config/extensions", async (request, reply) => {
    if (!withAuth(request, reply, secretKey)) {
      return;
    }
    reply
      .code(200)
      .type("application/json")
      .send({
        extensions: registry.listExtensions().map((entry) => ({
          ...Object.fromEntries(
            Object.entries(entry.config as Record<string, unknown>).filter(
              ([key]) => key !== "type",
            ),
          ),
          type: "ExtensionEntry",
          enabled: entry.enabled,
          name: entry.name,
        })),
        warnings: [],
      });
  });

  app.delete<{
    Params: operations["remove_extension"]["parameters"]["path"];
  }>("/config/extensions/:name", async (request, reply) => {
    if (!withAuth(request, reply, secretKey)) {
      return;
    }
    const result = registry.removeExtensionConfig(request.params.name);
    if (!result.ok) {
      reply.code(404).send();
      return;
    }
    reply.code(200).type("text/plain").send("ok");
  });

  app.post<{
    Body: operations["agent_add_extension"]["requestBody"]["content"]["application/json"];
  }>("/agent/add_extension", async (request, reply) => {
    if (!withAuth(request, reply, secretKey)) {
      return;
    }
    const result = registry.addSessionExtension(request.body);
    if (!result.ok) {
      reply.code(404).send();
      return;
    }
    reply.code(200).type("text/plain").send("ok");
  });

  app.post<{
    Body: operations["agent_remove_extension"]["requestBody"]["content"]["application/json"];
  }>("/agent/remove_extension", async (request, reply) => {
    if (!withAuth(request, reply, secretKey)) {
      return;
    }
    const result = registry.removeSessionExtension(request.body);
    if (!result.ok) {
      reply.code(404).send();
      return;
    }
    reply.code(200).type("text/plain").send("ok");
  });

  app.post<{
    Body: operations["update_agent_provider"]["requestBody"]["content"]["application/json"];
  }>("/agent/update_provider", async (request, reply) => {
    if (!withAuth(request, reply, secretKey)) {
      return;
    }
    const result = registry.updateProvider(request.body);
    if (!result.ok) {
      reply.code(404).send();
      return;
    }
    reply.code(200).send();
  });

  app.get("/config/providers", async (request, reply) => {
    if (!withAuth(request, reply, secretKey)) {
      return;
    }
    const provider = registry.getProviderState();
    reply
      .code(200)
      .type("application/json")
      .send([
        {
          name: provider.provider,
          metadata: {
            name: provider.provider,
            default_model: provider.model,
          },
        },
      ]);
  });

  app.post<{
    Body: operations["check_provider"]["requestBody"]["content"]["application/json"];
  }>("/config/check_provider", async (request, reply) => {
    if (!withAuth(request, reply, secretKey)) {
      return;
    }
    reply.code(200).type("application/json").send({
      ok: true,
      provider: request.body.provider,
    });
  });

  app.post<{
    Body: operations["detect_provider"]["requestBody"]["content"]["application/json"];
  }>("/config/detect-provider", async (request, reply) => {
    if (!withAuth(request, reply, secretKey)) {
      return;
    }
    const provider = registry.getProviderState();
    reply
      .code(200)
      .type("application/json")
      .send({
        provider_name: provider.provider,
        models: [provider.model],
      });
  });

  app.post<{
    Body: operations["set_config_provider"]["requestBody"]["content"]["application/json"];
  }>("/config/set_provider", async (request, reply) => {
    if (!withAuth(request, reply, secretKey)) {
      return;
    }
    registry.setProvider(request.body);
    reply.code(200).send();
  });

  app.post<{
    Body: operations["reply"]["requestBody"]["content"]["application/json"];
  }>("/reply", async (request, reply) => {
    if (!withAuth(request, reply, secretKey)) {
      return;
    }
    if (extractReplyCommand(request.body) === SEND_LOGS_COMMAND) {
      reply
        .code(200)
        .type("text/event-stream")
        .send(`data: ${sendLogsStubPayload()}\n\n`);
      return;
    }

    const result = registry.runReply(request.body);
    if (!result.ok) {
      reply.code(424).send();
      return;
    }
    reply.code(200).type("text/event-stream").send(toSseStream(result.data));
  });

  app.post("/recipes/save", async (request, reply) => {
    if (!withAuth(request, reply, secretKey)) {
      return;
    }
    void request;
    reply.code(204).send();
  });
};

const registerNotImplemented = (
  app: FastifyInstance,
  spec: OpenAPISpec,
): void => {
  const implemented = new Set(
    IMPLEMENTED_OPERATIONS.map(
      ([method, openapiPath]) => `${method} ${openapiPath}`,
    ),
  );

  app.setNotFoundHandler(async (request, reply) => {
    const routeKey = `${request.method.toUpperCase()} ${request.url.split("?")[0] ?? ""}`;
    const paths = asRecord(spec.paths);
    const knownInSpec = Object.keys(paths).includes(
      request.url.split("?")[0] ?? "",
    );

    if (!implemented.has(routeKey) && knownInSpec) {
      reply.code(501).type("application/json").send({
        code: "NOT_IMPLEMENTED",
        route: routeKey,
      });
      return;
    }

    reply.code(404).type("application/json").send({
      code: "NOT_FOUND",
      route: routeKey,
    });
  });
};

export const buildApp = (): ReturnType<typeof Fastify> => {
  const app = Fastify({ logger: false });
  const spec = loadSpec();
  const secretKey = process.env.SERVER_SECRET_KEY ?? "dev-secret";

  void app.register(swagger, {
    mode: "dynamic",
    openapi: spec as never,
  });

  app.get("/openapi.json", async () => spec);
  registerRuntimeRoutes(app, secretKey);
  registerNotImplemented(app, spec);

  return app;
};
