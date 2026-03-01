import type { components } from "../../shared/http/openapi.generated.js";
import type { ExtensionPort, ProviderPort, SessionPort } from "./ports.js";
import { type AgentRuntimeState, transitionAgentState } from "./state.js";

type AgentRuntimeResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: "IPC_INTERNAL"; message: string } };

type AgentRuntimeDependencies = {
  provider: ProviderPort;
  extensions: ExtensionPort[];
  sessions: SessionPort;
  emit: (message: components["schemas"]["MessageEvent"]) => Promise<void>;
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
  ): Promise<AgentRuntimeResult<{ state: AgentRuntimeState }>> {
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
        type: "Message",
        message: {
          role: "assistant",
          created: Date.now(),
          metadata: {
            userVisible: true,
            agentVisible: true,
          },
          content: [{ type: "text", text: response.text }],
        },
        token_state: {
          accumulatedInputTokens: 0,
          accumulatedOutputTokens: 0,
          accumulatedTotalTokens: 0,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
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
