import { describe, expect, it, vi } from "vitest";
import {
  CMD_CHANNELS,
  IPC_INVENTORY,
  RPC_CHANNELS,
} from "../src/desktop/ipc/contracts.js";
import { MainEventBus } from "../src/desktop/ipc/event-bus.js";
import { registerDesktopIpc } from "../src/desktop/ipc/main-transport.js";

type HandleFn = (event: unknown, payload: unknown) => unknown;
type OnFn = (event: { sender: { id: number } }, payload: unknown) => void;

const makeRpcDeps = () => ({
  getState: () => ({
    backendUrl: "http://127.0.0.1:43111",
    backendError: "",
    windowsPreflightMessages: [],
    appDirs: null,
    isDev: true as const,
  }),
  sendLogs: async () => ({ ok: true as const, message: "ok" }),
  getGoosedHostPort: () => "127.0.0.1:43111",
  chooseDirectory: async () => ({ canceled: false, filePaths: ["/tmp"] }),
  selectFileOrDirectory: async () => "/tmp",
  readFile: async () => ({
    file: "",
    filePath: "/tmp",
    error: null,
    found: true,
  }),
  writeFile: async () => true,
  ensureDirectory: async () => true,
  listFiles: async () => ["/tmp/a"],
  getAllowedExtensions: () => [".md"],
  openDirectoryInExplorer: async () => true,
  addRecentDir: () => true,
  openExternal: async () => undefined,
  fetchMetadata: async () => "text/plain",
  checkOllama: async () => true,
  sendClientMessage: async () => ({ accepted: true as const }),
});

const makeCmdDeps = (eventBus: MainEventBus) => ({
  eventBus,
  notify: () => {},
  logInfo: () => {},
  getWindowForEvent: () => null,
  ensureMainWindow: () => ({
    show: () => {},
    focus: () => {},
    hide: () => {},
    close: () => {},
    reload: () => {},
  }),
  restartApp: () => {},
  openInChrome: async () => undefined,
  getAppVersion: () => "1.0.0",
  dispatchClientMessage: async () => undefined,
});

describe("MUST desktop IPC registry requirements", () => {
  it("MUST register handler maps that exactly match typed IPC inventory", () => {
    const handles = new Map<string, HandleFn>();
    const listeners = new Map<string, OnFn>();

    const fakeIpcMain = {
      handle: (channel: string, handler: HandleFn) => {
        handles.set(channel, handler);
      },
      on: (channel: string, listener: OnFn) => {
        listeners.set(channel, listener);
      },
    };

    const eventBus = new MainEventBus(() => null);

    const registered = registerDesktopIpc({
      ipcMain: fakeIpcMain as never,
      rpc: makeRpcDeps(),
      cmd: makeCmdDeps(eventBus),
    });

    expect(Object.keys(registered.rpcHandlers).sort()).toEqual(
      [...IPC_INVENTORY.rpc].sort(),
    );
    expect(Object.keys(registered.cmdHandlers).sort()).toEqual(
      [...IPC_INVENTORY.cmd].sort(),
    );
    expect([...handles.keys()].sort()).toEqual([...RPC_CHANNELS].sort());
    expect([...listeners.keys()].sort()).toEqual([...CMD_CHANNELS].sort());
  });

  it("MUST keep desktop:get-state and desktop:send-logs channels behavior-compatible", async () => {
    const handles = new Map<string, HandleFn>();
    const fakeIpcMain = {
      handle: (channel: string, handler: HandleFn) => {
        handles.set(channel, handler);
      },
      on: () => {},
    };

    registerDesktopIpc({
      ipcMain: fakeIpcMain as never,
      rpc: {
        ...makeRpcDeps(),
        sendLogs: async () => ({ ok: true as const, message: "sent" }),
      },
      cmd: makeCmdDeps(new MainEventBus(() => null)),
    });

    const stateHandler = handles.get("desktop:get-state");
    const sendLogsHandler = handles.get("desktop:send-logs");

    expect(stateHandler).toBeDefined();
    expect(sendLogsHandler).toBeDefined();

    expect(stateHandler?.({}, undefined)).toEqual({
      backendUrl: "http://127.0.0.1:43111",
      backendError: "",
      windowsPreflightMessages: [],
      appDirs: null,
      isDev: true,
    });
    await expect(sendLogsHandler?.({}, undefined)).resolves.toEqual({
      ok: true,
      message: "sent",
    });
  });

  it("MUST return deterministic IPC_NOT_FOUND for unsupported RPC channels", async () => {
    const handles = new Map<string, HandleFn>();

    registerDesktopIpc({
      ipcMain: {
        handle: (channel: string, handler: HandleFn) => {
          handles.set(channel, handler);
        },
        on: () => {},
      } as never,
      rpc: makeRpcDeps(),
      cmd: makeCmdDeps(new MainEventBus(() => null)),
    });

    const handler = handles.get("get-settings");
    expect(handler).toBeDefined();

    await expect(async () => {
      await handler?.({}, undefined);
    }).rejects.toMatchObject({
      code: "IPC_NOT_FOUND",
      message: "IPC channel is not implemented: get-settings",
    });
  });

  it("MUST defer main-to-renderer events until renderer sends react-ready", () => {
    const send = vi.fn();
    const sink = {
      id: 42,
      send,
      isDestroyed: () => false,
    };

    const eventBus = new MainEventBus(() => sink);
    eventBus.emit("set-initial-message", "hello");

    expect(send).not.toHaveBeenCalled();

    const cmdHandlers = registerDesktopIpc({
      ipcMain: {
        handle: () => {},
        on: () => {},
      } as never,
      rpc: makeRpcDeps(),
      cmd: makeCmdDeps(eventBus),
    }).cmdHandlers;

    cmdHandlers["react-ready"](undefined, { sender: { id: 42 } } as never);

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith("set-initial-message", "hello");
  });
});
