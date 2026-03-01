import { describe, expect, it, vi } from "vitest";
import {
  DesktopServerMessageBridge,
  MainEventBus,
} from "../src/desktop/ipc/index.js";

describe("MUST desktop server bridge requirements", () => {
  it("MUST return deterministic error for invalid send envelope", async () => {
    const eventBus = new MainEventBus(() => null);
    const bridge = new DesktopServerMessageBridge({
      backendUrl: () => "http://127.0.0.1:43111",
      secretKey: () => "dev-secret",
      eventBus,
      fetchFn: vi.fn(),
    });

    const result = await bridge.send({ id: "", topic: "", sentAt: "" });
    expect(result).toEqual({
      ok: false,
      error: {
        code: "IPC_INVALID_INPUT",
        message: "Invalid client message envelope",
      },
    });
  });

  it("MUST process typed SSE events from stream endpoint", async () => {
    const send = vi.fn();
    const eventBus = new MainEventBus(() => ({ id: 11, send }));
    eventBus.markRendererReady(11);

    const fetchFn = vi.fn<typeof fetch>(
      async () =>
        new Response(
          'data: {"id":"1","topic":"event.forward","sentAt":"2026-01-01T00:00:00.000Z","payload":{"event":"focus-input"}}\n\n',
          { status: 200, headers: { "content-type": "text/event-stream" } },
        ),
    );

    const bridge = new DesktopServerMessageBridge({
      backendUrl: () => "http://127.0.0.1:43111",
      secretKey: () => "dev-secret",
      eventBus,
      fetchFn,
    });

    const result = await bridge.pollOnce();

    expect(result).toEqual({ ok: true, data: { count: 1 } });
    expect(send).toHaveBeenCalledWith("focus-input", undefined);
  });

  it("MUST return deterministic failure on stream transport errors", async () => {
    const eventBus = new MainEventBus(() => null);
    const bridge = new DesktopServerMessageBridge({
      backendUrl: () => "http://127.0.0.1:43111",
      secretKey: () => "dev-secret",
      eventBus,
      fetchFn: vi.fn<typeof fetch>(async () => {
        throw new Error("network down");
      }),
    });

    const result = await bridge.pollOnce();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("IPC_INTERNAL");
      expect(result.error.message).toContain("network down");
    }
  });
});
