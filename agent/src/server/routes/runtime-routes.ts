import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import type {
  components,
  operations,
} from "../../shared/http/openapi.generated.js";
import { resolveResponse } from "../responder.js";
import { RuntimeRegistry } from "../runtime/registry.js";
import { toSseStream } from "../runtime/reply-stream.js";
import type { OpenAPISpec } from "../spec.js";

type HttpMethod = "get" | "post" | "delete";

type RuntimeRouteOptions = {
  app: FastifyInstance;
  spec: OpenAPISpec;
  secretKey: string;
};

const SEND_LOGS_COMMAND = "/send-logs";

const RUNTIME_ROUTES = [
  { method: "post", path: "/agent/start" },
  { method: "post", path: "/agent/resume" },
  { method: "post", path: "/agent/restart" },
  { method: "post", path: "/agent/stop" },
  { method: "post", path: "/agent/add_extension" },
  { method: "post", path: "/agent/remove_extension" },
  { method: "post", path: "/agent/update_provider" },
  { method: "get", path: "/config/extensions" },
  { method: "post", path: "/config/extensions" },
  { method: "delete", path: "/config/extensions/:name" },
  { method: "get", path: "/config/providers" },
  { method: "post", path: "/config/check_provider" },
  { method: "post", path: "/config/detect-provider" },
  { method: "post", path: "/config/set_provider" },
  { method: "post", path: "/reply" },
] as const;

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const routeOperation = (
  spec: OpenAPISpec,
  openApiPath: string,
  method: HttpMethod,
): Record<string, unknown> => {
  const paths = asRecord(spec.paths);
  const pathItem = asRecord(paths[openApiPath]);
  return asRecord(pathItem[method]);
};

const sampleResponse = (
  spec: OpenAPISpec,
  openApiPath: string,
  method: HttpMethod,
  statusCode: number,
): { contentType: string | null; body: unknown } => {
  const operation = routeOperation(spec, openApiPath, method);
  const resolved = resolveResponse(operation, statusCode, spec);
  return { contentType: resolved.contentType, body: resolved.body };
};

const unauthorized = (reply: FastifyReply): void => {
  reply.code(401).send({ message: "Unauthorized" });
};

const withAuth = (
  request: FastifyRequest,
  reply: FastifyReply,
  secretKey: string,
): boolean => {
  const headerValue = request.headers["x-secret-key"];
  const token = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (!token || token !== secretKey) {
    unauthorized(reply);
    return false;
  }
  return true;
};

const extractReplyCommand = (
  request: operations["reply"]["requestBody"]["content"]["application/json"],
): string | null => {
  const blocks = request.user_message.content;
  for (const block of blocks) {
    if (block.type === "text") {
      return block.text.trim();
    }
  }
  return null;
};

const sendLogsStubPayload = (): string =>
  JSON.stringify({
    ok: true,
    message: "Send logs dry-run completed",
    artifactPath: `${process.env.AGENT_LOGS_DIR ?? ""}/send-logs-dry-run.txt`,
    remotePath: "dry-run://pending",
  });

const patchSessionBody = (
  body: unknown,
  session: {
    id: string;
    workingDir: string;
    createdAt: string;
    updatedAt: string;
    provider: string;
    model: string;
    conversation: components["schemas"]["Message"][];
  },
): unknown => {
  const sample = asRecord(body);
  const modelConfig = asRecord(sample.model_config);
  return {
    ...sample,
    id: session.id,
    working_dir: session.workingDir,
    created_at: session.createdAt,
    updated_at: session.updatedAt,
    provider_name: session.provider,
    conversation: session.conversation,
    model_config: {
      ...modelConfig,
      model_name: session.model,
    },
  };
};

export const runtimeRouteSet = new Set(
  RUNTIME_ROUTES.map((route) => `${route.method.toUpperCase()} ${route.path}`),
);

export const registerRuntimeRoutes = ({
  app,
  spec,
  secretKey,
}: RuntimeRouteOptions): void => {
  const registry = new RuntimeRegistry({
    settingsDir: process.env.AGENT_CONFIG_DIR ?? process.cwd(),
  });

  app.post<{
    Body: operations["start_agent"]["requestBody"]["content"]["application/json"];
  }>("/agent/start", async (request, reply) => {
    if (!withAuth(request, reply, secretKey)) {
      return;
    }
    const session = registry.startAgent(request.body);
    const sampled = sampleResponse(spec, "/agent/start", "post", 200);
    const body = patchSessionBody(sampled.body, {
      id: session.id,
      workingDir: session.workingDir,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      provider: session.provider.provider,
      model: session.provider.model,
      conversation: session.conversation,
    });
    reply.code(200).type("application/json").send(body);
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
    const sampled = sampleResponse(spec, "/agent/resume", "post", 200);
    const raw = asRecord(sampled.body);
    const rawSession = asRecord(raw.session);
    const patchedSession = patchSessionBody(rawSession, {
      id: resumed.data.id,
      workingDir: resumed.data.workingDir,
      createdAt: resumed.data.createdAt,
      updatedAt: resumed.data.updatedAt,
      provider: resumed.data.provider.provider,
      model: resumed.data.provider.model,
      conversation: resumed.data.conversation,
    });
    reply
      .code(200)
      .type("application/json")
      .send({
        ...raw,
        session: patchedSession,
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
    const sampled = sampleResponse(spec, "/agent/restart", "post", 200);
    const raw = asRecord(sampled.body);
    reply
      .code(200)
      .type("application/json")
      .send({
        ...raw,
        extension_results: restarted.data.extensionResults,
      });
  });

  app.post<{
    Body: operations["stop_agent"]["requestBody"]["content"]["application/json"];
  }>("/agent/stop", async (request, reply) => {
    if (!withAuth(request, reply, secretKey)) {
      return;
    }
    const stopped = registry.stopAgent(request.body);
    if (!stopped.ok) {
      reply.code(404).send();
      return;
    }
    const sampled = sampleResponse(spec, "/agent/stop", "post", 200);
    reply
      .code(200)
      .type("text/plain")
      .send(String(sampled.body ?? "ok"));
  });

  app.post<{
    Body: operations["add_extension"]["requestBody"]["content"]["application/json"];
  }>("/config/extensions", async (request, reply) => {
    if (!withAuth(request, reply, secretKey)) {
      return;
    }
    const upserted = registry.upsertExtensionConfig(request.body);
    if (!upserted.ok) {
      reply.code(400).send();
      return;
    }
    const sampled = sampleResponse(spec, "/config/extensions", "post", 200);
    reply
      .code(200)
      .type("text/plain")
      .send(String(sampled.body ?? "ok"));
  });

  app.get("/config/extensions", async (request, reply) => {
    if (!withAuth(request, reply, secretKey)) {
      return;
    }
    const sampled = sampleResponse(spec, "/config/extensions", "get", 200);
    const raw = asRecord(sampled.body);
    const extensions = registry.listExtensions().map((entry) => ({
      ...Object.fromEntries(
        Object.entries(entry.config as Record<string, unknown>).filter(
          ([key]) => key !== "type",
        ),
      ),
      type: "ExtensionEntry",
      enabled: entry.enabled,
      name: entry.name,
    }));
    reply
      .code(200)
      .type("application/json")
      .send({
        ...raw,
        extensions,
        warnings: [],
      });
  });

  app.delete<{ Params: operations["remove_extension"]["parameters"]["path"] }>(
    "/config/extensions/:name",
    async (request, reply) => {
      if (!withAuth(request, reply, secretKey)) {
        return;
      }
      const removed = registry.removeExtensionConfig(request.params.name);
      if (!removed.ok) {
        reply.code(404).send();
        return;
      }
      const sampled = sampleResponse(
        spec,
        "/config/extensions/{name}",
        "delete",
        200,
      );
      reply
        .code(200)
        .type("text/plain")
        .send(String(sampled.body ?? "ok"));
    },
  );

  app.post<{
    Body: operations["agent_add_extension"]["requestBody"]["content"]["application/json"];
  }>("/agent/add_extension", async (request, reply) => {
    if (!withAuth(request, reply, secretKey)) {
      return;
    }
    const added = registry.addSessionExtension(request.body);
    if (!added.ok) {
      reply.code(404).send();
      return;
    }
    const sampled = sampleResponse(spec, "/agent/add_extension", "post", 200);
    reply
      .code(200)
      .type("text/plain")
      .send(String(sampled.body ?? "ok"));
  });

  app.post<{
    Body: operations["agent_remove_extension"]["requestBody"]["content"]["application/json"];
  }>("/agent/remove_extension", async (request, reply) => {
    if (!withAuth(request, reply, secretKey)) {
      return;
    }
    const removed = registry.removeSessionExtension(request.body);
    if (!removed.ok) {
      reply.code(404).send();
      return;
    }
    const sampled = sampleResponse(
      spec,
      "/agent/remove_extension",
      "post",
      200,
    );
    reply
      .code(200)
      .type("text/plain")
      .send(String(sampled.body ?? "ok"));
  });

  app.post<{
    Body: operations["update_agent_provider"]["requestBody"]["content"]["application/json"];
  }>("/agent/update_provider", async (request, reply) => {
    if (!withAuth(request, reply, secretKey)) {
      return;
    }
    const updated = registry.updateProvider(request.body);
    if (!updated.ok) {
      reply.code(404).send();
      return;
    }
    reply.code(200).send();
  });

  app.get("/config/providers", async (request, reply) => {
    if (!withAuth(request, reply, secretKey)) {
      return;
    }
    const sampled = sampleResponse(spec, "/config/providers", "get", 200);
    const body = sampled.body;
    if (!Array.isArray(body) || body.length === 0) {
      reply.code(200).type("application/json").send([]);
      return;
    }
    const first = asRecord(body[0]);
    const metadata = asRecord(first.metadata);
    reply
      .code(200)
      .type("application/json")
      .send([
        {
          ...first,
          name: registry.getProviderState().provider,
          metadata: {
            ...metadata,
            name: registry.getProviderState().provider,
            default_model: registry.getProviderState().model,
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
    const sampled = sampleResponse(spec, "/config/check_provider", "post", 200);
    reply.code(200).type("application/json").send(sampled.body);
  });

  app.post<{
    Body: operations["detect_provider"]["requestBody"]["content"]["application/json"];
  }>("/config/detect-provider", async (request, reply) => {
    if (!withAuth(request, reply, secretKey)) {
      return;
    }
    const sampled = sampleResponse(
      spec,
      "/config/detect-provider",
      "post",
      200,
    );
    const raw = asRecord(sampled.body);
    reply
      .code(200)
      .type("application/json")
      .send({
        ...raw,
        provider_name: registry.getProviderState().provider,
        models: [registry.getProviderState().model],
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
    const command = extractReplyCommand(request.body);
    if (command === SEND_LOGS_COMMAND) {
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
};
