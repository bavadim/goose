import { describe, expect, it } from "vitest";
import { runAgentCycle } from "../src/server/runtime/agent-cycle.machine.js";
import { SessionManager } from "../src/server/runtime/session-manager.js";
import { createSessionActor } from "../src/server/runtime/session.machine.js";
import { ToolRouter } from "../src/server/runtime/tool-router.js";

describe("MUST agent runtime skeleton requirements", () => {
  it("MUST provide deterministic state transitions", () => {
    const actor = createSessionActor("idle");
    actor.send({ type: "START" });
    expect(actor.getSnapshot().context.status).toBe("running");
    actor.send({ type: "STOP" });
    expect(actor.getSnapshot().context.status).toBe("stopped");
    actor.stop();
  });

  it("MUST execute stubbed provider runtime turn", async () => {
    const sessions = new SessionManager({
      settingsDir: process.cwd(),
    });
    const session = sessions.create("session-1", process.cwd());
    const router = new ToolRouter({
      getActiveExtensions: () => [],
    });

    const result = runAgentCycle({
      session: { ...session, status: "running" },
      userMessage: {
        role: "user",
        created: Date.now(),
        metadata: {
          userVisible: true,
          agentVisible: true,
        },
        content: [{ type: "text", text: "hello" }],
      },
      router,
    });

    expect(result.events.length).toBeGreaterThan(0);
    expect(result.events.some((event) => event.type === "Message")).toBe(true);
  });
});
