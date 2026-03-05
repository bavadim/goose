import fs from "node:fs";
import path from "node:path";
import { createActor, fromTransition } from "xstate";

import type {
  components,
  operations,
} from "../shared/http/openapi.generated.js";

type Message = components["schemas"]["Message"];
type MessageEvent = components["schemas"]["MessageEvent"];
type ExtensionConfig = components["schemas"]["ExtensionConfig"];
type TokenState = components["schemas"]["TokenState"];

type StartAgentBody =
  operations["start_agent"]["requestBody"]["content"]["application/json"];
type ResumeAgentBody =
  operations["resume_agent"]["requestBody"]["content"]["application/json"];
type RestartAgentBody =
  operations["restart_agent"]["requestBody"]["content"]["application/json"];
type StopAgentBody =
  operations["stop_agent"]["requestBody"]["content"]["application/json"];
type AddExtensionBody =
  operations["add_extension"]["requestBody"]["content"]["application/json"];
type AgentAddExtensionBody =
  operations["agent_add_extension"]["requestBody"]["content"]["application/json"];
type AgentRemoveExtensionBody =
  operations["agent_remove_extension"]["requestBody"]["content"]["application/json"];
type UpdateProviderBody =
  operations["update_agent_provider"]["requestBody"]["content"]["application/json"];
type SetProviderBody =
  operations["set_config_provider"]["requestBody"]["content"]["application/json"];
type ReplyBody =
  operations["reply"]["requestBody"]["content"]["application/json"];

type SessionStatus = "idle" | "running" | "stopped" | "failed";
type ProviderState = { provider: string; model: string; contextLimit: number };

type RuntimeErrorCode =
  | "SESSION_NOT_FOUND"
  | "SESSION_NOT_ACTIVE"
  | "TOOL_NOT_FOUND";
type RuntimeResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: RuntimeErrorCode; message: string } };

type RuntimeToolCall = {
  id: string;
  name: string;
  args: Record<string, unknown>;
};
type RuntimeSession = {
  id: string;
  status: SessionStatus;
  workingDir: string;
  createdAt: string;
  updatedAt: string;
  skillsInstructions: string;
  provider: ProviderState;
  activeExtensions: string[];
  conversation: Message[];
};

type ExtensionStoredEntry = {
  type: "ExtensionEntry";
  name: string;
  enabled: boolean;
  config: ExtensionConfig;
};

const now = (): string => new Date().toISOString();

const defaultProvider = (): ProviderState => ({
  provider: "stub-provider",
  model: "stub-model",
  contextLimit: 8192,
});

const tokenState = (): TokenState => ({
  accumulatedInputTokens: 0,
  accumulatedOutputTokens: 0,
  accumulatedTotalTokens: 0,
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
});

const assistantText = (text: string): Message => ({
  role: "assistant",
  created: Date.now(),
  metadata: { userVisible: true, agentVisible: true },
  content: [{ type: "text", text }],
});

const assistantTool = (toolCall: RuntimeToolCall): Message => ({
  role: "assistant",
  created: Date.now(),
  metadata: { userVisible: true, agentVisible: true },
  content: [
    { type: "toolResponse", id: toolCall.id, metadata: {}, toolResult: {} },
  ],
});

const userText = (message: Message): string => {
  const block = message.content.find((item) => item.type === "text");
  return block && block.type === "text" ? block.text : "";
};

const toUserMessage = (body: ReplyBody): Message => ({
  ...body.user_message,
  created: Date.now(),
});

const isElicitationResponse = (message: Message): boolean =>
  message.content.some(
    (item) =>
      item.type === "actionRequired" &&
      item.data.actionType === "elicitationResponse",
  );

const notify = (requestId: string): MessageEvent => ({
  type: "Notification",
  request_id: requestId,
  message: {},
});

const spawnDetachedSubcycle = (
  sessionId: string,
  toolName: string,
  emit: (event: MessageEvent) => void,
): string => {
  const requestId = `subcycle-${sessionId}-${Date.now()}`;
  emit(notify(`${requestId}:${toolName}:started`));
  queueMicrotask(() => emit(notify(`${requestId}:${toolName}:finished`)));
  return requestId;
};

const listSkillFiles = (rootDir: string): string[] => {
  if (!fs.existsSync(rootDir)) {
    return [];
  }
  return fs
    .readdirSync(rootDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(rootDir, entry.name, "SKILL.md"))
    .filter((file) => fs.existsSync(file));
};

const loadSkills = (workingDir: string, settingsDir: string): string => {
  const roots = [
    path.join(settingsDir, "skills"),
    path.join(workingDir, ".codex", "skills"),
  ];
  const byName = new Map<string, string>();

  for (const root of roots) {
    for (const file of listSkillFiles(root)) {
      const name = path.basename(path.dirname(file));
      try {
        byName.set(name, fs.readFileSync(file, "utf8").trim());
      } catch {
        byName.set(name, "");
      }
    }
  }

  return [...byName.entries()]
    .filter(([, body]) => body.length > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, body]) => `# skill:${name}\n${body}`)
    .join("\n\n");
};

const sessionTransition = (
  state: { status: SessionStatus },
  event: { type: string },
): { status: SessionStatus } => {
  switch (event.type) {
    case "START":
    case "RESUME":
    case "RESTART":
      return { status: "running" };
    case "STOP":
      return { status: "stopped" };
    case "FAIL":
      return { status: "failed" };
    default:
      return state;
  }
};

export const createSessionActor = (
  initial: SessionStatus = "idle",
): ReturnType<typeof createActor> => {
  const actor = createActor(
    fromTransition(sessionTransition, { status: initial }),
  );
  actor.start();
  return actor;
};

export class SessionManager {
  private readonly sessions = new Map<string, RuntimeSession>();
  private readonly settingsDir: string;

  constructor(options: string | { settingsDir: string }) {
    this.settingsDir =
      typeof options === "string" ? options : options.settingsDir;
  }

  get(sessionId: string): RuntimeSession | null {
    return this.sessions.get(sessionId) ?? null;
  }

  create(sessionId: string, workingDir: string): RuntimeSession {
    const existing = this.get(sessionId);
    if (existing) {
      return existing;
    }
    const createdAt = now();
    const session: RuntimeSession = {
      id: sessionId,
      status: "idle",
      workingDir,
      createdAt,
      updatedAt: createdAt,
      skillsInstructions: loadSkills(workingDir, this.settingsDir),
      provider: defaultProvider(),
      activeExtensions: [],
      conversation: [],
    };
    this.sessions.set(sessionId, session);
    return session;
  }

  update(session: RuntimeSession): RuntimeSession {
    const updated = { ...session, updatedAt: now() };
    this.sessions.set(updated.id, updated);
    return updated;
  }

  appendMessage(sessionId: string, message: Message): RuntimeSession | null {
    const session = this.get(sessionId);
    return session
      ? this.update({
          ...session,
          conversation: [...session.conversation, message],
        })
      : null;
  }

  setProvider(
    sessionId: string,
    provider: ProviderState,
  ): RuntimeSession | null {
    const session = this.get(sessionId);
    return session ? this.update({ ...session, provider }) : null;
  }

  setActiveExtensions(
    sessionId: string,
    names: string[],
  ): RuntimeSession | null {
    const session = this.get(sessionId);
    return session
      ? this.update({ ...session, activeExtensions: names })
      : null;
  }
}

const extensionTools = (name: string): string[] => {
  const prefix = name.replaceAll(/[^a-zA-Z0-9_-]/g, "_");
  return [`${prefix}.echo`, `summon.${prefix}`];
};

export class ToolRouter {
  private readonly getToolsByExtension: () => Map<string, string[]>;

  constructor(
    options:
      | (() => Map<string, string[]>)
      | { getActiveExtensions: () => { listTools: () => string[] }[] },
  ) {
    this.getToolsByExtension =
      typeof options === "function"
        ? options
        : () =>
            new Map(
              options
                .getActiveExtensions()
                .map((extension, index) => [
                  `ext-${index}`,
                  extension.listTools(),
                ]),
            );
  }

  dispatch(call: RuntimeToolCall): RuntimeResult<{ output: string }> {
    const allTools = [...this.getToolsByExtension().values()];
    if (allTools.some((tools) => tools.includes(call.name))) {
      return {
        ok: true,
        data: { output: `${call.name}:${JSON.stringify(call.args)}` },
      };
    }
    return {
      ok: false,
      error: {
        code: "TOOL_NOT_FOUND",
        message: `Tool not found: ${call.name}`,
      },
    };
  }
}

const providerToolCalls = (prompt: string): RuntimeToolCall[] => {
  if (prompt.startsWith("/tool summon.")) {
    const name =
      prompt.slice("/tool ".length).split(/\s+/)[0] ?? "summon.unknown";
    return [{ id: `tool-${Date.now()}`, name, args: { prompt } }];
  }
  return prompt.includes("summon")
    ? [{ id: `tool-${Date.now()}`, name: "summon.default", args: { prompt } }]
    : [];
};

const runProvider = (
  prompt: string,
  skills: string,
): { text: string; tools: RuntimeToolCall[] } => ({
  text: `stub:${prompt}${skills ? " [skills-loaded]" : " [skills-empty]"}`,
  tools: providerToolCalls(prompt),
});

export const runAgentCycle = (input: {
  session: RuntimeSession;
  userMessage: Message;
  router: ToolRouter;
}): { events: MessageEvent[]; newMessages: Message[] } => {
  const events: MessageEvent[] = [];
  const newMessages: Message[] = [];
  const provider = runProvider(
    userText(input.userMessage),
    input.session.skillsInstructions,
  );

  const first = assistantText(provider.text);
  newMessages.push(first);
  events.push({ type: "Message", message: first, token_state: tokenState() });
  events.push({
    type: "ModelChange",
    model: input.session.provider.model,
    mode: input.session.provider.provider,
  });

  if (provider.tools.length > 0) {
    for (const toolCall of provider.tools) {
      if (toolCall.name.startsWith("summon.")) {
        spawnDetachedSubcycle(input.session.id, toolCall.name, (event) =>
          events.push(event),
        );
      } else {
        input.router.dispatch(toolCall);
      }
      const toolMessage = assistantTool(toolCall);
      newMessages.push(toolMessage);
      events.push({
        type: "Message",
        message: toolMessage,
        token_state: tokenState(),
      });
    }

    const followup = assistantText("Tool execution completed.");
    newMessages.push(followup);
    events.push({
      type: "Message",
      message: followup,
      token_state: tokenState(),
    });
  }

  events.push({
    type: "Finish",
    reason: "turn_completed",
    token_state: tokenState(),
  });
  return { events, newMessages };
};

const toExtensionEntry = (payload: AddExtensionBody): ExtensionStoredEntry => ({
  type: "ExtensionEntry",
  name: payload.name,
  enabled: payload.enabled,
  config: payload.config,
});

export class RuntimeRegistry {
  private readonly sessions: SessionManager;
  private readonly actors = new Map<
    string,
    ReturnType<typeof createSessionActor>
  >();
  private readonly extensions = new Map<string, ExtensionStoredEntry>();
  private readonly toolsByExtension = new Map<string, string[]>();
  private provider = defaultProvider();

  constructor(options: { settingsDir: string }) {
    this.sessions = new SessionManager(options.settingsDir);
  }

  private getOrCreateSession(sessionId: string): RuntimeSession {
    return (
      this.sessions.get(sessionId) ??
      this.sessions.create(sessionId, process.cwd())
    );
  }

  private ensureActor(
    sessionId: string,
    event: "START" | "RESUME" | "RESTART",
  ): void {
    const actor = this.actors.get(sessionId) ?? createSessionActor("idle");
    actor.send({ type: event });
    this.actors.set(sessionId, actor);
  }

  startAgent(request: StartAgentBody): RuntimeSession {
    const session = this.sessions.create(
      `session-${Date.now()}`,
      request.working_dir ?? process.cwd(),
    );
    this.ensureActor(session.id, "START");
    return this.sessions.update({
      ...session,
      status: "running",
      provider: this.provider,
    });
  }

  resumeAgent(request: ResumeAgentBody): RuntimeResult<RuntimeSession> {
    const session = this.getOrCreateSession(request.session_id);
    this.ensureActor(session.id, "RESUME");
    return {
      ok: true,
      data: this.sessions.update({ ...session, status: "running" }),
    };
  }

  restartAgent(request: RestartAgentBody): RuntimeResult<{
    session: RuntimeSession;
    extensionResults: { name: string; success: boolean; error?: string }[];
  }> {
    const session = this.getOrCreateSession(request.session_id);
    this.ensureActor(session.id, "RESTART");
    const updated = this.sessions.update({
      ...session,
      status: "running",
      provider: this.provider,
    });
    return {
      ok: true,
      data: {
        session: updated,
        extensionResults: updated.activeExtensions.map((name) => ({
          name,
          success: true,
        })),
      },
    };
  }

  stopAgent(request: StopAgentBody): RuntimeResult<void> {
    const actor = this.actors.get(request.session_id);
    actor?.send({ type: "STOP" });
    actor?.stop();
    this.actors.delete(request.session_id);

    const session = this.sessions.get(request.session_id);
    if (session) {
      this.sessions.update({ ...session, status: "stopped" });
    }
    return { ok: true, data: undefined };
  }

  upsertExtensionConfig(request: AddExtensionBody): RuntimeResult<void> {
    const entry = toExtensionEntry(request);
    this.extensions.set(entry.name, entry);
    this.toolsByExtension.set(entry.name, extensionTools(entry.name));
    return { ok: true, data: undefined };
  }

  removeExtensionConfig(name: string): RuntimeResult<void> {
    if (!this.extensions.has(name)) {
      return {
        ok: false,
        error: { code: "SESSION_NOT_FOUND", message: "Extension not found" },
      };
    }
    this.extensions.delete(name);
    this.toolsByExtension.delete(name);
    return { ok: true, data: undefined };
  }

  listExtensions(): ExtensionStoredEntry[] {
    return [...this.extensions.values()];
  }

  addSessionExtension(request: AgentAddExtensionBody): RuntimeResult<void> {
    const session = this.getOrCreateSession(request.session_id);
    const entry = {
      type: "ExtensionEntry",
      name: request.config.name,
      enabled: true,
      config: request.config,
    } satisfies ExtensionStoredEntry;

    this.extensions.set(entry.name, entry);
    this.toolsByExtension.set(entry.name, extensionTools(entry.name));
    this.sessions.setActiveExtensions(session.id, [
      ...new Set([...session.activeExtensions, entry.name]),
    ]);
    return { ok: true, data: undefined };
  }

  removeSessionExtension(
    request: AgentRemoveExtensionBody,
  ): RuntimeResult<void> {
    const session = this.getOrCreateSession(request.session_id);
    this.sessions.setActiveExtensions(
      session.id,
      session.activeExtensions.filter((name) => name !== request.name),
    );
    return { ok: true, data: undefined };
  }

  updateProvider(request: UpdateProviderBody): RuntimeResult<void> {
    this.provider = {
      provider: request.provider,
      model: request.model ?? this.provider.model,
      contextLimit: request.context_limit ?? this.provider.contextLimit,
    };
    this.sessions.setProvider(request.session_id, this.provider);
    return { ok: true, data: undefined };
  }

  setProvider(request: SetProviderBody): void {
    this.provider = {
      provider: request.provider,
      model: request.model,
      contextLimit: this.provider.contextLimit,
    };
  }

  getProviderState(): ProviderState {
    return this.provider;
  }

  runReply(request: ReplyBody): RuntimeResult<MessageEvent[]> {
    const session = this.getOrCreateSession(request.session_id);
    if (session.status === "stopped" || session.status === "failed") {
      return {
        ok: false,
        error: {
          code: "SESSION_NOT_ACTIVE",
          message: "Agent session is not active",
        },
      };
    }

    if (!this.actors.has(session.id)) {
      this.ensureActor(session.id, "START");
      this.sessions.update({ ...session, status: "running" });
    }

    const message = toUserMessage(request);
    this.sessions.appendMessage(session.id, message);
    if (isElicitationResponse(message)) {
      return { ok: true, data: [] };
    }

    const activeTools = new Map<string, string[]>();
    for (const extensionName of session.activeExtensions) {
      const tools = this.toolsByExtension.get(extensionName);
      if (tools) {
        activeTools.set(extensionName, tools);
      }
    }

    const cycle = runAgentCycle({
      session,
      userMessage: message,
      router: new ToolRouter(() => activeTools),
    });

    for (const generated of cycle.newMessages) {
      this.sessions.appendMessage(session.id, generated);
    }

    return { ok: true, data: cycle.events };
  }
}

export const toSseStream = (events: MessageEvent[]): string =>
  events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("");
