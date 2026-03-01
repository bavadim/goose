import type { IpcMain, IpcMainEvent } from "electron";
import {
  CMD_CHANNELS,
  type CmdChannel,
  type CmdHandler,
  type CmdHandlerMap,
  type CmdPayloadMap,
  RPC_CHANNELS,
  type RpcChannel,
  type RpcHandler,
  type RpcHandlerMap,
  type RpcRequestMap,
  type RpcResponseMap,
} from "./contracts.js";
import type { MainEventBus } from "./event-bus.js";

type WindowController = {
  show: () => void;
  focus: () => void;
  hide: () => void;
  close: () => void;
  reload: () => void;
};

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
  sendClientMessage: (
    payload: RpcRequestMap["desktop:send-message"],
  ) => Promise<RpcResponseMap["desktop:send-message"]>;
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

type SyncReturnEvent = IpcMainEvent & { returnValue?: unknown };

const safely = (run: () => void, onError: (error: unknown) => void): void => {
  try {
    run();
  } catch (error: unknown) {
    onError(error);
  }
};

const unsupportedRpc = <C extends RpcChannel>(channel: C): RpcHandler<C> => {
  return async () => {
    throw {
      code: "IPC_NOT_FOUND",
      message: `IPC channel is not implemented: ${channel}`,
      details: { channel },
    };
  };
};

export const createRpcHandlerMap = (
  dependencies: RpcHandlerDependencies,
): RpcHandlerMap => ({
  "directory-chooser": async () => dependencies.chooseDirectory(),
  "show-message-box": unsupportedRpc("show-message-box"),
  "show-save-dialog": unsupportedRpc("show-save-dialog"),
  "fetch-metadata": async (payload) => dependencies.fetchMetadata(payload.url),
  "check-ollama": async () => dependencies.checkOllama(),
  "select-file-or-directory": async (payload) =>
    dependencies.selectFileOrDirectory(payload?.defaultPath),
  "get-binary-path": unsupportedRpc("get-binary-path"),
  "read-file": async (payload) => dependencies.readFile(payload.filePath),
  "write-file": async (payload) =>
    dependencies.writeFile(payload.filePath, payload.content),
  "ensure-directory": async (payload) =>
    dependencies.ensureDirectory(payload.dirPath),
  "list-files": async (payload) =>
    dependencies.listFiles(payload.dirPath, payload.extension),
  "get-allowed-extensions": () => dependencies.getAllowedExtensions(),
  "set-menu-bar-icon": unsupportedRpc("set-menu-bar-icon"),
  "get-menu-bar-icon-state": unsupportedRpc("get-menu-bar-icon-state"),
  "set-dock-icon": unsupportedRpc("set-dock-icon"),
  "get-dock-icon-state": unsupportedRpc("get-dock-icon-state"),
  "get-settings": unsupportedRpc("get-settings"),
  "save-settings": unsupportedRpc("save-settings"),
  "get-secret-key": unsupportedRpc("get-secret-key"),
  "get-goosed-host-port": () => dependencies.getGoosedHostPort(),
  "set-wakelock": unsupportedRpc("set-wakelock"),
  "get-wakelock-state": unsupportedRpc("get-wakelock-state"),
  "set-spellcheck": unsupportedRpc("set-spellcheck"),
  "get-spellcheck-state": unsupportedRpc("get-spellcheck-state"),
  "open-notifications-settings": unsupportedRpc("open-notifications-settings"),
  "open-external": async (payload) => {
    await dependencies.openExternal(payload.url);
    return undefined;
  },
  "check-for-updates": unsupportedRpc("check-for-updates"),
  "download-update": unsupportedRpc("download-update"),
  "install-update": unsupportedRpc("install-update"),
  "get-update-state": unsupportedRpc("get-update-state"),
  "is-using-github-fallback": unsupportedRpc("is-using-github-fallback"),
  "has-accepted-recipe-before": unsupportedRpc("has-accepted-recipe-before"),
  "record-recipe-hash": unsupportedRpc("record-recipe-hash"),
  "open-directory-in-explorer": async (payload) =>
    dependencies.openDirectoryInExplorer(payload.path),
  "add-recent-dir": (payload) => dependencies.addRecentDir(payload.dir),
  "get-current-version": unsupportedRpc("get-current-version"),
  "desktop:get-state": () => dependencies.getState(),
  "desktop:send-logs": async () => dependencies.sendLogs(),
  "desktop:send-message": async (payload) =>
    dependencies.sendClientMessage(payload),
});

export const createCmdHandlerMap = (
  dependencies: CmdHandlerDependencies,
): CmdHandlerMap => ({
  "react-ready": (_payload, event) => {
    dependencies.eventBus.markRendererReady(event.sender.id);
  },
  "hide-window": (_payload, event) => {
    dependencies.getWindowForEvent(event)?.hide();
  },
  "create-chat-window": (payload) => {
    safely(
      () => {
        const window = dependencies.ensureMainWindow();
        window.show();
        window.focus();
        void dependencies.dispatchClientMessage("desktop.chat-window.create", {
          ...(payload.query ? { query: payload.query } : {}),
        });
        if (payload.query) {
          dependencies.eventBus.emit("set-initial-message", payload.query);
        }
      },
      (error) =>
        dependencies.logInfo(
          `create-chat-window rejected: ${JSON.stringify(error)}`,
        ),
    );
  },
  logInfo: (payload) => {
    dependencies.logInfo(payload);
  },
  notify: (payload) => {
    safely(
      () => dependencies.notify(payload),
      (error) =>
        dependencies.logInfo(`notify rejected: ${JSON.stringify(error)}`),
    );
  },
  "open-in-chrome": (payload) => {
    safely(
      () => {
        void dependencies.openInChrome(payload.url);
      },
      (error) =>
        dependencies.logInfo(
          `open-in-chrome rejected: ${JSON.stringify(error)}`,
        ),
    );
  },
  "reload-app": (_payload, event) => {
    dependencies.getWindowForEvent(event)?.reload();
  },
  "broadcast-theme-change": (payload) => {
    safely(
      () => dependencies.eventBus.emit("theme-changed", payload),
      (error) =>
        dependencies.logInfo(
          `broadcast-theme-change rejected: ${JSON.stringify(error)}`,
        ),
    );
  },
  "restart-app": () => {
    dependencies.restartApp();
  },
  "close-window": (_payload, event) => {
    dependencies.getWindowForEvent(event)?.close();
  },
  "get-app-version": (_payload, event) => {
    (event as SyncReturnEvent).returnValue = dependencies.getAppVersion();
  },
});

const registerRpcChannel = <C extends RpcChannel>(
  ipcMain: IpcMain,
  channel: C,
  handler: RpcHandler<C>,
): void => {
  ipcMain.handle(channel, (event, payload) => {
    return handler(payload as RpcRequestMap[C], event);
  });
};

const registerCmdChannel = <C extends CmdChannel>(
  ipcMain: IpcMain,
  channel: C,
  handler: CmdHandler<C>,
): void => {
  ipcMain.on(channel, (event, payload) => {
    handler(payload as CmdPayloadMap[C], event);
  });
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
    registerRpcChannel(
      ipcMain,
      channel,
      rpcHandlers[channel] as RpcHandler<typeof channel>,
    );
  }

  for (const channel of CMD_CHANNELS) {
    registerCmdChannel(
      ipcMain,
      channel,
      cmdHandlers[channel] as CmdHandler<typeof channel>,
    );
  }

  return { rpcHandlers, cmdHandlers };
};
