import { describe, expect, it } from "vitest";
import {
  AgentRuntime,
  InMemorySessionStore,
  StubExtension,
  StubProvider,
  transitionAgentState,
} from "../src/server/agent/index.js";

describe("MUST agent runtime skeleton requirements", () => {
  it("MUST provide deterministic state transitions", () => {
    expect(transitionAgentState("idle", { type: "START" })).toBe("running");
    expect(transitionAgentState("running", { type: "PROVIDER_OK" })).toBe(
      "streaming",
    );
    expect(transitionAgentState("streaming", { type: "STREAM_DONE" })).toBe(
      "completed",
    );
  });

  it("MUST execute stubbed provider runtime turn", async () => {
    const emitted: unknown[] = [];
    const runtime = new AgentRuntime({
      provider: new StubProvider(),
      extensions: [new StubExtension("stub")],
      sessions: new InMemorySessionStore(),
      emit: async (message) => {
        emitted.push(message);
      },
    });

    const result = await runtime.runTurn("session-1", "hello");

    expect(result.ok).toBe(true);
    expect(emitted.length).toBe(1);
  });
});
