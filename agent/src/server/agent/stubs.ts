import type {
  AgentSession,
  ExtensionPort,
  ExtensionToolCall,
  ExtensionToolResult,
  ProviderPort,
  ProviderRequest,
  ProviderResponse,
  SessionPort,
} from "./ports.js";

export class StubProvider implements ProviderPort {
  async health(): Promise<boolean> {
    return true;
  }

  async generate(request: ProviderRequest): Promise<ProviderResponse> {
    return {
      text: `stub:${request.input}`,
    };
  }
}

export class StubExtension implements ExtensionPort {
  constructor(public readonly id: string) {}

  async health(): Promise<boolean> {
    return true;
  }

  async listTools(): Promise<string[]> {
    return ["stub.echo"];
  }

  async callTool(call: ExtensionToolCall): Promise<ExtensionToolResult> {
    return {
      ok: true,
      output: `${call.name}:${JSON.stringify(call.args)}`,
    };
  }
}

export class InMemorySessionStore implements SessionPort {
  private readonly sessions = new Map<string, AgentSession>();

  async create(sessionId: string): Promise<AgentSession> {
    const now = new Date().toISOString();
    const session: AgentSession = {
      id: sessionId,
      status: "idle",
      createdAt: now,
      updatedAt: now,
    };
    this.sessions.set(sessionId, session);
    return session;
  }

  async get(sessionId: string): Promise<AgentSession | null> {
    return this.sessions.get(sessionId) ?? null;
  }

  async update(session: AgentSession): Promise<void> {
    this.sessions.set(session.id, session);
  }
}
