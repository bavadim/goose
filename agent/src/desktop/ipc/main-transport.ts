import type { IpcMain, IpcMainEvent, IpcMainInvokeEvent } from "electron";
import {
  CMD_CHANNELS,
  type CmdChannel,
  RPC_CHANNELS,
  type RpcChannel,
} from "./contracts.js";
import type { MainEventBus } from "./event-bus.js";

type WindowController = {
  show: () => void;
  focus: () => void;
  hide: () => void;
  close: () => void;
  reload: () => void;
};

type CmdHandler = (payload: unknown, event: IpcMainEvent) => void;
type RpcHandler = (
  payload: unknown,
  event: IpcMainInvokeEvent,
) => Promise<unknown> | unknown;

type RpcHandlerMap = Record<RpcChannel, RpcHandler>;
type CmdHandlerMap = Record<CmdChannel, CmdHandler>;

type FileReadResult = {
  file: string;
  filePath: string;
  error: string | null;
  found: boolean;
};

type RpcHandlerDependencies = {
  getState: () => {
    backendUrl: string;
    backendError: string;
    windowsPreflightMessages: string[];
    appDirs: {
      root: string;
      config: string;
      logs: string;
      cache: string;
    } | null;
    isDev: boolean;
  };
  sendLogs: () => Promise<{
    ok: boolean;
    message: string;
    artifactPath?: string;
    remotePath?: string;
  }>;
  getGoosedHostPort: () => string | null;
  chooseDirectory: () => Promise<unknown>;
  selectFileOrDirectory: (defaultPath?: string) => Promise<string | null>;
  readFile: (filePath: string) => Promise<FileReadResult>;
  writeFile: (filePath: string, content: string) => Promise<boolean>;
  ensureDirectory: (dirPath: string) => Promise<boolean>;
  listFiles: (dirPath: string, extension?: string) => Promise<string[]>;
  getAllowedExtensions: () => string[];
  openDirectoryInExplorer: (targetPath: string) => Promise<boolean>;
  addRecentDir: (dir: string) => boolean | undefined;
  openExternal: (url: string) => Promise<void>;
  fetchMetadata: (url: string) => Promise<string>;
  checkOllama: () => Promise<boolean>;
  sendClientMessage: (payload: unknown) => Promise<{ accepted: true }>;
};

type CmdHandlerDependencies = {
  eventBus: MainEventBus;
  notify: (input: { title: string; body: string }) => void;
  logInfo: (message: string) => void;
  getWindowForEvent: (event: IpcMainEvent) => WindowController | null;
  ensureMainWindow: () => WindowController;
  restartApp: () => void;
  openInChrome: (url: string) => Promise<void>;
  getAppVersion: () => string;
  dispatchClientMessage: (
    topic: string,
    payload?: Record<string, unknown>,
  ) => Promise<void>;
};

type IpcRegistryDependencies = {
  ipcMain: IpcMain;
  rpc: RpcHandlerDependencies;
  cmd: CmdHandlerDependencies;
};

const makeIpcError = (
  code: string,
  message: string,
  details?: Record<string, unknown>,
): { code: string; message: string; details?: Record<string, unknown> } => ({
  code,
  message,
  ...(details ? { details } : {}),
});

const asRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object") {
    throw makeIpcError("IPC_INVALID_INPUT", "Payload must be an object");
  }
  return value as Record<string, unknown>;
};

const requireString = (
  record: Record<string, unknown>,
  key: string,
): string => {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw makeIpcError(
      "IPC_INVALID_INPUT",
      `Field ${key} must be a non-empty string`,
    );
  }
  return value;
};

const parseOptionalString = (
  record: Record<string, unknown>,
  key: string,
): string | undefined => {
  const value = record[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw makeIpcError("IPC_INVALID_INPUT", `Field ${key} must be a string`);
  }
  return value;
};

const assertSafeUrl = (value: string): string => {
  try {
    const url = new URL(value);
    if (!["http:", "https:", "mailto:"].includes(url.protocol)) {
      throw makeIpcError("IPC_INVALID_INPUT", "URL protocol is not allowed", {
        protocol: url.protocol,
      });
    }
    return url.toString();
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: unknown }).code === "IPC_INVALID_INPUT"
    ) {
      throw error;
    }
    throw makeIpcError("IPC_INVALID_INPUT", "Invalid URL payload");
  }
};

const parseNotifyPayload = (
  payload: unknown,
): { title: string; body: string } => {
  const input = asRecord(payload);
  const title = parseOptionalString(input, "title");
  const body = parseOptionalString(input, "body");
  if (!title || !body) {
    throw makeIpcError(
      "IPC_INVALID_INPUT",
      "notify payload must include title and body",
    );
  }
  return { title, body };
};

const parseThemePayload = (
  payload: unknown,
): { mode: string; useSystemTheme: boolean; theme: string } => {
  const input = asRecord(payload);
  const mode = parseOptionalString(input, "mode");
  const theme = parseOptionalString(input, "theme");
  const useSystemTheme = input.useSystemTheme;
  if (!mode || !theme || typeof useSystemTheme !== "boolean") {
    throw makeIpcError(
      "IPC_INVALID_INPUT",
      "broadcast-theme-change payload is invalid",
    );
  }
  return { mode, useSystemTheme, theme };
};

const parseCreateChatWindowPayload = (payload: unknown): { query?: string } => {
  if (payload === undefined) {
    return {};
  }
  const input = asRecord(payload);
  const query = parseOptionalString(input, "query");
  return { ...(query ? { query } : {}) };
};

const parseUrlPayload = (payload: unknown): string => {
  const input = asRecord(payload);
  const url = parseOptionalString(input, "url");
  if (!url) {
    throw makeIpcError("IPC_INVALID_INPUT", "URL is required");
  }
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw makeIpcError("IPC_INVALID_INPUT", "URL protocol is not allowed", {
      protocol: parsed.protocol,
    });
  }
  return parsed.toString();
};

const runSafely = (
  run: () => void,
  onError: (error: unknown) => void,
): void => {
  try {
    run();
  } catch (error: unknown) {
    onError(error);
  }
};

const makeUnsupportedRpcHandler = (channel: RpcChannel): RpcHandler => {
  return () => {
    throw makeIpcError(
      "IPC_NOT_FOUND",
      `IPC channel is not implemented: ${channel}`,
      {
        channel,
      },
    );
  };
};

const makeUnsupportedCmdHandler = (_channel: CmdChannel): CmdHandler => {
  return () => {
    // compatibility placeholder
  };
};

export const createRpcHandlerMap = (
  dependencies: RpcHandlerDependencies,
): RpcHandlerMap => {
  const implemented: Partial<RpcHandlerMap> = {
    "desktop:get-state": () => dependencies.getState(),
    "desktop:send-logs": async () => dependencies.sendLogs(),
    "desktop:send-message": async (payload) =>
      dependencies.sendClientMessage(payload),
    "get-goosed-host-port": () => dependencies.getGoosedHostPort(),
    "directory-chooser": async () => dependencies.chooseDirectory(),
    "select-file-or-directory": async (payload) => {
      const input = payload === undefined ? {} : asRecord(payload);
      const defaultPath = parseOptionalString(input, "defaultPath");
      return dependencies.selectFileOrDirectory(defaultPath);
    },
    "read-file": async (payload) => {
      const input = asRecord(payload);
      const filePath = requireString(input, "filePath");
      return dependencies.readFile(filePath);
    },
    "write-file": async (payload) => {
      const input = asRecord(payload);
      const filePath = requireString(input, "filePath");
      const content = requireString(input, "content");
      return dependencies.writeFile(filePath, content);
    },
    "ensure-directory": async (payload) => {
      const input = asRecord(payload);
      const dirPath = requireString(input, "dirPath");
      return dependencies.ensureDirectory(dirPath);
    },
    "list-files": async (payload) => {
      const input = asRecord(payload);
      const dirPath = requireString(input, "dirPath");
      const extension = parseOptionalString(input, "extension");
      return dependencies.listFiles(dirPath, extension);
    },
    "get-allowed-extensions": () => dependencies.getAllowedExtensions(),
    "open-directory-in-explorer": async (payload) => {
      const input = asRecord(payload);
      const targetPath = requireString(input, "path");
      return dependencies.openDirectoryInExplorer(targetPath);
    },
    "add-recent-dir": (payload) => {
      const input = asRecord(payload);
      const dir = requireString(input, "dir");
      return dependencies.addRecentDir(dir);
    },
    "open-external": async (payload) => {
      const input = asRecord(payload);
      const url = assertSafeUrl(requireString(input, "url"));
      await dependencies.openExternal(url);
      return undefined;
    },
    "fetch-metadata": async (payload) => {
      const input = asRecord(payload);
      const url = assertSafeUrl(requireString(input, "url"));
      return dependencies.fetchMetadata(url);
    },
    "check-ollama": async () => dependencies.checkOllama(),
  };

  const handlers = {} as RpcHandlerMap;
  for (const channel of RPC_CHANNELS) {
    const handler = implemented[channel] ?? makeUnsupportedRpcHandler(channel);
    handlers[channel] = handler;
  }
  return handlers;
};

export const createCmdHandlerMap = (
  dependencies: CmdHandlerDependencies,
): CmdHandlerMap => {
  const implemented: Partial<CmdHandlerMap> = {
    "react-ready": (_payload, event) => {
      dependencies.eventBus.markRendererReady(event.sender.id);
    },
    notify: (payload) => {
      runSafely(
        () => {
          dependencies.notify(parseNotifyPayload(payload));
        },
        (error) => {
          dependencies.logInfo(`notify rejected: ${JSON.stringify(error)}`);
        },
      );
    },
    logInfo: (payload) => {
      if (typeof payload === "string") {
        dependencies.logInfo(payload);
      }
    },
    "hide-window": (_payload, event) => {
      dependencies.getWindowForEvent(event)?.hide();
    },
    "close-window": (_payload, event) => {
      dependencies.getWindowForEvent(event)?.close();
    },
    "reload-app": (_payload, event) => {
      dependencies.getWindowForEvent(event)?.reload();
    },
    "restart-app": () => {
      dependencies.restartApp();
    },
    "create-chat-window": (payload) => {
      runSafely(
        () => {
          const input = parseCreateChatWindowPayload(payload);
          const window = dependencies.ensureMainWindow();
          window.show();
          window.focus();
          void dependencies.dispatchClientMessage(
            "desktop.chat-window.create",
            {
              ...(input.query ? { query: input.query } : {}),
            },
          );
          if (input.query) {
            dependencies.eventBus.emit("set-initial-message", input.query);
          }
        },
        (error) => {
          dependencies.logInfo(
            `create-chat-window rejected: ${JSON.stringify(error)}`,
          );
        },
      );
    },
    "open-in-chrome": (payload) => {
      runSafely(
        () => {
          void dependencies.openInChrome(parseUrlPayload(payload));
        },
        (error) => {
          dependencies.logInfo(
            `open-in-chrome rejected: ${JSON.stringify(error)}`,
          );
        },
      );
    },
    "broadcast-theme-change": (payload) => {
      runSafely(
        () => {
          dependencies.eventBus.emit(
            "theme-changed",
            parseThemePayload(payload),
          );
        },
        (error) => {
          dependencies.logInfo(
            `broadcast-theme-change rejected: ${JSON.stringify(error)}`,
          );
        },
      );
    },
    "get-app-version": (_payload, event) => {
      (event as IpcMainEvent & { returnValue?: unknown }).returnValue =
        dependencies.getAppVersion();
    },
  };

  const handlers = {} as CmdHandlerMap;
  for (const channel of CMD_CHANNELS) {
    const handler = implemented[channel] ?? makeUnsupportedCmdHandler(channel);
    handlers[channel] = handler;
  }
  return handlers;
};

export const registerDesktopIpc = ({
  ipcMain,
  rpc,
  cmd,
}: IpcRegistryDependencies): {
  rpcHandlers: RpcHandlerMap;
  cmdHandlers: CmdHandlerMap;
} => {
  const rpcHandlers = createRpcHandlerMap(rpc);
  const cmdHandlers = createCmdHandlerMap(cmd);

  for (const channel of RPC_CHANNELS) {
    ipcMain.handle(channel, (event, payload) => {
      const handler = rpcHandlers[channel];
      return handler(payload, event);
    });
  }

  for (const channel of CMD_CHANNELS) {
    ipcMain.on(channel, (event, payload) => {
      const handler = cmdHandlers[channel];
      handler(payload, event);
    });
  }

  return { rpcHandlers, cmdHandlers };
};
