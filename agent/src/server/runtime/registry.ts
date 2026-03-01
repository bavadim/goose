import type {
  components,
  operations,
} from "../../shared/http/openapi.generated.js";
import { runAgentCycle } from "./agent-cycle.machine.js";
import { createExtensionActor } from "./extension-factory.js";
import { SessionManager } from "./session-manager.js";
import { createSessionActor } from "./session.machine.js";
import { ToolRouter } from "./tool-router.js";
import type {
  ExtensionStoredEntry,
  MessageEvent,
  ProviderState,
  RuntimeResult,
  RuntimeSession,
} from "./types.js";

type ExtensionActorHandle = ReturnType<typeof createExtensionActor>;

const now = (): string => new Date().toISOString();

const normalizeEntry = (
  payload: components["schemas"]["ExtensionQuery"],
): RuntimeResult<ExtensionStoredEntry> => {
  const entry = {
    type: "ExtensionEntry",
    config: payload.config,
    enabled: payload.enabled,
    name: payload.name,
  } satisfies ExtensionStoredEntry;
  return { ok: true, data: entry };
};

const createUserMessage = (
  body: operations["reply"]["requestBody"]["content"]["application/json"],
): components["schemas"]["Message"] => ({
  ...body.user_message,
  created:
    typeof body.user_message.created === "number"
      ? body.user_message.created
      : Date.parse(String(body.user_message.created ?? now())),
});

const isElicitationResponse = (
  message: components["schemas"]["Message"],
): boolean =>
  message.content.some(
    (content) =>
      content.type === "actionRequired" &&
      content.data.actionType === "elicitationResponse",
  );

export class RuntimeRegistry {
  private readonly sessionManager: SessionManager;

  private readonly sessionActors = new Map<
    string,
    ReturnType<typeof createSessionActor>
  >();

  private readonly extensions = new Map<string, ExtensionStoredEntry>();

  private readonly extensionActors = new Map<string, ExtensionActorHandle>();

  private providerState: ProviderState = {
    provider: "stub-provider",
    model: "stub-model",
    contextLimit: 8192,
  };

  constructor(options: { settingsDir: string }) {
    this.sessionManager = new SessionManager({
      settingsDir: options.settingsDir,
    });
  }

  startAgent(
    request: operations["start_agent"]["requestBody"]["content"]["application/json"],
  ): RuntimeSession {
    const sessionId = `session-${Date.now()}`;
    const workingDir = request.working_dir ?? process.cwd();
    const session = this.sessionManager.create(sessionId, workingDir);
    const actor = createSessionActor("idle");
    actor.send({ type: "START" });
    this.sessionActors.set(sessionId, actor);
    return this.sessionManager.update({
      ...session,
      status: "running",
      provider: this.providerState,
    });
  }

  resumeAgent(
    request: operations["resume_agent"]["requestBody"]["content"]["application/json"],
  ): RuntimeResult<RuntimeSession> {
    const session =
      this.sessionManager.get(request.session_id) ??
      this.sessionManager.create(request.session_id, process.cwd());
    const actor =
      this.sessionActors.get(request.session_id) ?? createSessionActor("idle");
    actor.send({ type: "RESUME" });
    this.sessionActors.set(request.session_id, actor);
    return {
      ok: true,
      data: this.sessionManager.update({ ...session, status: "running" }),
    };
  }

  restartAgent(
    request: operations["restart_agent"]["requestBody"]["content"]["application/json"],
  ): RuntimeResult<{
    session: RuntimeSession;
    extensionResults: { name: string; success: boolean; error?: string }[];
  }> {
    const session =
      this.sessionManager.get(request.session_id) ??
      this.sessionManager.create(request.session_id, process.cwd());
    const actor =
      this.sessionActors.get(request.session_id) ?? createSessionActor("idle");
    actor.send({ type: "RESTART" });
    this.sessionActors.set(request.session_id, actor);
    const extensionResults = session.activeExtensions.map((name) => ({
      name,
      success: true,
    }));
    const updated = this.sessionManager.update({
      ...session,
      status: "running",
      provider: this.providerState,
    });
    return { ok: true, data: { session: updated, extensionResults } };
  }

  stopAgent(
    request: operations["stop_agent"]["requestBody"]["content"]["application/json"],
  ): RuntimeResult<void> {
    const actor =
      this.sessionActors.get(request.session_id) ?? createSessionActor("idle");
    this.sessionActors.set(request.session_id, actor);
    actor.send({ type: "STOP" });
    actor.stop();
    this.sessionActors.delete(request.session_id);
    const session = this.sessionManager.get(request.session_id);
    if (session) {
      this.sessionManager.update({ ...session, status: "stopped" });
    }
    return { ok: true, data: undefined };
  }

  upsertExtensionConfig(
    request: operations["add_extension"]["requestBody"]["content"]["application/json"],
  ): RuntimeResult<void> {
    const normalized = normalizeEntry(request);
    if (!normalized.ok) {
      return normalized;
    }
    this.extensions.set(request.name, normalized.data);
    this.extensionActors.set(
      request.name,
      createExtensionActor(normalized.data),
    );
    return { ok: true, data: undefined };
  }

  removeExtensionConfig(name: string): RuntimeResult<void> {
    if (!this.extensions.has(name)) {
      return {
        ok: false,
        error: {
          code: "SESSION_NOT_FOUND",
          message: "Extension not found",
        },
      };
    }
    this.extensions.delete(name);
    this.extensionActors.delete(name);
    return { ok: true, data: undefined };
  }

  listExtensions(): ExtensionStoredEntry[] {
    return [...this.extensions.values()];
  }

  addSessionExtension(
    request: operations["agent_add_extension"]["requestBody"]["content"]["application/json"],
  ): RuntimeResult<void> {
    const session =
      this.sessionManager.get(request.session_id) ??
      this.sessionManager.create(request.session_id, process.cwd());
    const entry = {
      type: "ExtensionEntry",
      config: request.config,
      enabled: true,
      name: request.config.name,
    } satisfies ExtensionStoredEntry;
    this.extensions.set(entry.name, entry);
    this.extensionActors.set(entry.name, createExtensionActor(entry));
    this.sessionManager.setActiveExtensions(session.id, [
      ...new Set([...session.activeExtensions, entry.name]),
    ]);
    return { ok: true, data: undefined };
  }

  removeSessionExtension(
    request: operations["agent_remove_extension"]["requestBody"]["content"]["application/json"],
  ): RuntimeResult<void> {
    const session =
      this.sessionManager.get(request.session_id) ??
      this.sessionManager.create(request.session_id, process.cwd());
    if (!session) {
      return {
        ok: false,
        error: { code: "SESSION_NOT_FOUND", message: "Session not found" },
      };
    }
    const active = session.activeExtensions.filter(
      (name) => name !== request.name,
    );
    this.sessionManager.setActiveExtensions(session.id, active);
    return { ok: true, data: undefined };
  }

  updateProvider(
    request: operations["update_agent_provider"]["requestBody"]["content"]["application/json"],
  ): RuntimeResult<void> {
    this.sessionManager.get(request.session_id) ??
      this.sessionManager.create(request.session_id, process.cwd());
    const next: ProviderState = {
      provider: request.provider,
      model: request.model ?? this.providerState.model,
      contextLimit: request.context_limit ?? this.providerState.contextLimit,
    };
    this.providerState = next;
    this.sessionManager.setProvider(request.session_id, next);
    return { ok: true, data: undefined };
  }

  setProvider(
    request: operations["set_config_provider"]["requestBody"]["content"]["application/json"],
  ): void {
    this.providerState = {
      provider: request.provider,
      model: request.model,
      contextLimit: this.providerState.contextLimit,
    };
  }

  getProviderState(): ProviderState {
    return this.providerState;
  }

  runReply(
    request: operations["reply"]["requestBody"]["content"]["application/json"],
  ): RuntimeResult<MessageEvent[]> {
    const existing = this.sessionManager.get(request.session_id);
    const session =
      existing ?? this.sessionManager.create(request.session_id, process.cwd());
    if (session.status === "stopped" || session.status === "failed") {
      return {
        ok: false,
        error: {
          code: "SESSION_NOT_ACTIVE",
          message: "Agent session is not active",
        },
      };
    }
    if (!this.sessionActors.has(session.id)) {
      const actor = createSessionActor("idle");
      actor.send({ type: "START" });
      this.sessionActors.set(session.id, actor);
      this.sessionManager.update({ ...session, status: "running" });
    }
    const userMessage = createUserMessage(request);
    this.sessionManager.appendMessage(session.id, userMessage);
    if (isElicitationResponse(userMessage)) {
      return { ok: true, data: [] };
    }
    const router = new ToolRouter({
      getActiveExtensions: () =>
        session.activeExtensions
          .map((name) => this.extensionActors.get(name))
          .filter((entry): entry is ExtensionActorHandle => Boolean(entry)),
    });
    const cycleResult = runAgentCycle({
      session,
      userMessage,
      router,
    });
    for (const message of cycleResult.newMessages) {
      this.sessionManager.appendMessage(session.id, message);
    }
    return { ok: true, data: cycleResult.events };
  }
}
