import { describe, expect, it, vi } from "vitest";
import { MainEventBus } from "../src/desktop/ipc/event-bus.js";
import { createCmdHandlerMap } from "../src/desktop/ipc/main-transport.js";

const makeDeps = () => {
  const send = vi.fn();
  const window = {
    show: vi.fn(),
    focus: vi.fn(),
    hide: vi.fn(),
    close: vi.fn(),
    reload: vi.fn(),
  };
  const eventBus = new MainEventBus(() => ({ id: 1, send }));

  return {
    send,
    window,
    deps: {
      eventBus,
      notify: vi.fn(),
      logInfo: vi.fn(),
      getWindowForEvent: vi.fn(() => window),
      ensureMainWindow: vi.fn(() => window),
      restartApp: vi.fn(),
      openInChrome: vi.fn(async () => undefined),
      getAppVersion: vi.fn(() => "1.0.0"),
      dispatchClientMessage: vi.fn(async () => undefined),
    },
  };
};

describe("MUST desktop IPC core CMD requirements", () => {
  it("MUST handle window lifecycle commands", () => {
    const { deps, window } = makeDeps();
    const handlers = createCmdHandlerMap(deps);

    handlers["hide-window"](undefined, { sender: { id: 1 } } as never);
    handlers["close-window"](undefined, { sender: { id: 1 } } as never);
    handlers["reload-app"](undefined, { sender: { id: 1 } } as never);
    handlers["restart-app"](undefined, { sender: { id: 1 } } as never);

    expect(window.hide).toHaveBeenCalledTimes(1);
    expect(window.close).toHaveBeenCalledTimes(1);
    expect(window.reload).toHaveBeenCalledTimes(1);
    expect(deps.restartApp).toHaveBeenCalledTimes(1);
  });

  it("MUST emit typed events for create-chat-window and theme broadcast", () => {
    const { deps, send } = makeDeps();
    const handlers = createCmdHandlerMap(deps);

    handlers["react-ready"](undefined, { sender: { id: 1 } } as never);
    handlers["create-chat-window"]({ query: "hello" }, {
      sender: { id: 1 },
    } as never);
    handlers["broadcast-theme-change"](
      { mode: "light", useSystemTheme: false, theme: "default" },
      { sender: { id: 1 } } as never,
    );

    expect(send).toHaveBeenCalledWith("set-initial-message", "hello");
    expect(send).toHaveBeenCalledWith("theme-changed", {
      mode: "light",
      useSystemTheme: false,
      theme: "default",
    });
    expect(deps.dispatchClientMessage).toHaveBeenCalledWith(
      "desktop.chat-window.create",
      { query: "hello" },
    );
  });

  it("MUST reject invalid command payloads without raw exceptions", () => {
    const { deps } = makeDeps();
    const handlers = createCmdHandlerMap(deps);

    handlers["open-in-chrome"]({ url: "file:///etc/passwd" }, {
      sender: { id: 1 },
    } as never);
    handlers["broadcast-theme-change"]({ mode: "light" }, {
      sender: { id: 1 },
    } as never);

    expect(deps.openInChrome).not.toHaveBeenCalled();
    expect(deps.logInfo).toHaveBeenCalledTimes(2);
  });

  it("MUST support sync app version channel", () => {
    const { deps } = makeDeps();
    const handlers = createCmdHandlerMap(deps);
    const event = { sender: { id: 1 } } as {
      sender: { id: number };
      returnValue?: unknown;
    };

    handlers["get-app-version"](undefined, event as never);

    expect(event.returnValue).toBe("1.0.0");
  });
});
