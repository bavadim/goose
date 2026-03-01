import type { components } from "../../shared/http/openapi.generated.js";
import { createMoimStub, injectMoimInstructions } from "./moim.js";
import { loadSkillsInstructions } from "./skills-loader.js";
import type { ProviderState, RuntimeSession } from "./types.js";

type SessionManagerOptions = {
  settingsDir: string;
};

const defaultProviderState = (): ProviderState => ({
  provider: "stub-provider",
  model: "stub-model",
  contextLimit: 8192,
});

const nowIso = (): string => new Date().toISOString();

export class SessionManager {
  private readonly settingsDir: string;

  private readonly sessions = new Map<string, RuntimeSession>();

  constructor(options: SessionManagerOptions) {
    this.settingsDir = options.settingsDir;
  }

  list(): RuntimeSession[] {
    return [...this.sessions.values()];
  }

  get(sessionId: string): RuntimeSession | null {
    return this.sessions.get(sessionId) ?? null;
  }

  create(sessionId: string, workingDir: string): RuntimeSession {
    const existing = this.sessions.get(sessionId);
    if (existing) {
      return existing;
    }
    const createdAt = nowIso();
    const skills = loadSkillsInstructions(workingDir, this.settingsDir);
    const session: RuntimeSession = {
      id: sessionId,
      status: "idle",
      workingDir,
      createdAt,
      updatedAt: createdAt,
      skillsInstructions: skills.mergedInstructions,
      moim: createMoimStub(sessionId),
      provider: defaultProviderState(),
      activeExtensions: [],
      conversation: [],
    };
    this.sessions.set(sessionId, session);
    return session;
  }

  update(session: RuntimeSession): RuntimeSession {
    const updated: RuntimeSession = {
      ...session,
      updatedAt: nowIso(),
    };
    this.sessions.set(updated.id, updated);
    return updated;
  }

  remove(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  appendMessage(
    sessionId: string,
    message: components["schemas"]["Message"],
  ): RuntimeSession | null {
    const session = this.get(sessionId);
    if (!session) {
      return null;
    }
    const updated = this.update({
      ...session,
      conversation: [...session.conversation, message],
    });
    return updated;
  }

  setProvider(
    sessionId: string,
    provider: ProviderState,
  ): RuntimeSession | null {
    const session = this.get(sessionId);
    if (!session) {
      return null;
    }
    return this.update({
      ...session,
      provider,
    });
  }

  setActiveExtensions(
    sessionId: string,
    names: string[],
  ): RuntimeSession | null {
    const session = this.get(sessionId);
    if (!session) {
      return null;
    }
    return this.update({
      ...session,
      activeExtensions: names,
    });
  }

  buildProviderInstructions(sessionId: string): string {
    const session = this.get(sessionId);
    if (!session) {
      return "";
    }
    return injectMoimInstructions(session, session.skillsInstructions);
  }
}
