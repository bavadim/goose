import { describe, expect, it, vi } from "vitest";
import { MainEventBus } from "../src/desktop/shared/ipc/event-bus.js";
import { DesktopServerMessageBridge } from "../src/desktop/shared/ipc/message-bridge.js";

describe("MUST desktop server bridge requirements", () => {
  it("MUST forward typed client message envelope to backend", async () => {
    const eventBus = new MainEventBus(() => null);
    const fetchFn = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify({ accepted: true }), { status: 200 }),
    );
    const bridge = new DesktopServerMessageBridge({
      backendUrl: () => "http://127.0.0.1:43111",
      secretKey: () => "dev-secret",
      eventBus,
      fetchFn,
    });

    const message = {
      id: "1",
      topic: "desktop.chat-window.create",
      sentAt: "2026-01-01T00:00:00.000Z",
      payload: { query: "hello" },
    } as const;
    const result = await bridge.send(message);
    expect(result).toEqual({
      ok: true,
      data: { accepted: true },
    });
    expect(fetchFn).toHaveBeenCalledWith(
      "http://127.0.0.1:43111/desktop/messages",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(message),
      }),
    );
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
