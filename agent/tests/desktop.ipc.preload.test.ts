import { afterEach, describe, expect, it, vi } from "vitest";

const electronMock = vi.hoisted(() => {
  const invoke = vi.fn();
  const send = vi.fn();
  const on = vi.fn();
  const removeListener = vi.fn();
  const exposeInMainWorld = vi.fn();

  return {
    invoke,
    send,
    on,
    removeListener,
    exposeInMainWorld,
  };
});

vi.mock("electron", () => ({
  contextBridge: {
    exposeInMainWorld: electronMock.exposeInMainWorld,
  },
  ipcRenderer: {
    invoke: electronMock.invoke,
    send: electronMock.send,
    on: electronMock.on,
    removeListener: electronMock.removeListener,
  },
}));

describe("MUST desktop preload IPC bridge requirements", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("MUST normalize RPC errors into deterministic envelope", async () => {
    electronMock.invoke.mockRejectedValueOnce({
      cause: { code: "IPC_INVALID_INPUT", message: "Bad payload" },
    });

    await import("../src/desktop/preload/index.js");

    const exposed = electronMock.exposeInMainWorld.mock.calls[0]?.[1] as {
      invoke: (channel: "desktop:get-state") => Promise<unknown>;
    };

    const result = (await exposed.invoke("desktop:get-state")) as {
      ok: boolean;
      error?: { code?: string; message?: string };
    };

    expect(result.ok).toBe(false);
    expect(result.error).toEqual({
      code: "IPC_INVALID_INPUT",
      message: "Bad payload",
    });
  });

  it("MUST support subscribe and unsubscribe lifecycle for renderer events", async () => {
    await import("../src/desktop/preload/index.js");

    const exposed = electronMock.exposeInMainWorld.mock.calls[0]?.[1] as {
      on: (
        channel: "set-initial-message",
        listener: (payload: string) => void,
      ) => () => void;
    };

    const listener = vi.fn();
    const unsubscribe = exposed.on("set-initial-message", listener);

    expect(electronMock.on).toHaveBeenCalledTimes(1);
    expect(electronMock.on).toHaveBeenCalledWith(
      "set-initial-message",
      expect.any(Function),
    );

    unsubscribe();

    expect(electronMock.removeListener).toHaveBeenCalledTimes(1);
    expect(electronMock.removeListener).toHaveBeenCalledWith(
      "set-initial-message",
      expect.any(Function),
    );
  });
});
