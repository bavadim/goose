import type {
  ProtocolResult,
  ServerToClientMessage,
} from "../../core/protocol/index.js";
import type { ExtensionPort, ProviderPort, SessionPort } from "./ports.js";
import { type AgentRuntimeState, transitionAgentState } from "./state.js";

type AgentRuntimeDependencies = {
  provider: ProviderPort;
  extensions: ExtensionPort[];
  sessions: SessionPort;
  emit: (message: ServerToClientMessage) => Promise<void>;
  now?: () => string;
};

export class AgentRuntime {
  private readonly now: () => string;

  constructor(private readonly deps: AgentRuntimeDependencies) {
    this.now = deps.now ?? (() => new Date().toISOString());
  }

  async runTurn(
    sessionId: string,
    input: string,
  ): Promise<ProtocolResult<{ state: AgentRuntimeState }>> {
    const session =
      (await this.deps.sessions.get(sessionId)) ??
      (await this.deps.sessions.create(sessionId));

    let state: AgentRuntimeState = transitionAgentState(session.status, {
      type: "START",
    });

    try {
      const providerOk = await this.deps.provider.health();
      if (!providerOk) {
        state = transitionAgentState(state, { type: "FAIL" });
        await this.persist(sessionId, state);
        return {
          ok: false,
          error: {
            code: "IPC_INTERNAL",
            message: "Provider is unavailable",
          },
        };
      }

      const response = await this.deps.provider.generate({ sessionId, input });
      state = transitionAgentState(state, { type: "PROVIDER_OK" });

      await this.deps.emit({
        id: `runtime-${sessionId}`,
        topic: "event.forward",
        sentAt: this.now(),
        payload: {
          event: "new-chat",
          payload: { text: response.text },
        },
      });

      state = transitionAgentState(state, { type: "STREAM_DONE" });
      await this.persist(sessionId, state);
      return { ok: true, data: { state } };
    } catch (error: unknown) {
      state = transitionAgentState(state, { type: "FAIL" });
      await this.persist(sessionId, state);
      return {
        ok: false,
        error: {
          code: "IPC_INTERNAL",
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  private async persist(
    sessionId: string,
    status: AgentRuntimeState,
  ): Promise<void> {
    const current = await this.deps.sessions.get(sessionId);
    if (!current) {
      return;
    }
    await this.deps.sessions.update({
      ...current,
      status,
      updatedAt: this.now(),
    });
  }
}
