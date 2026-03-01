export type DesktopState = {
  backendUrl: string;
  backendError: string;
  windowsPreflightMessages: string[];
  appDirs: { root: string; config: string; logs: string; cache: string } | null;
  isDev: boolean;
};

export type SendLogsResult = {
  ok: boolean;
  message: string;
  artifactPath?: string;
  remotePath?: string;
};

export type IpcErrorCode =
  | "IPC_INVALID_INPUT"
  | "IPC_UNAUTHORIZED"
  | "IPC_UNSUPPORTED_PLATFORM"
  | "IPC_NOT_FOUND"
  | "IPC_IO_ERROR"
  | "IPC_INTERNAL";

export type IpcError = {
  code: IpcErrorCode;
  message: string;
  details?: Record<string, unknown>;
  retryable?: boolean;
};

export type IpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: IpcError };

export type RpcRequestMap = {
  "directory-chooser": undefined;
  "show-message-box": unknown;
  "show-save-dialog": unknown;
  "fetch-metadata": { url: string };
  "check-ollama": undefined;
  "select-file-or-directory": { defaultPath?: string };
  "get-binary-path": { binaryName: string };
  "read-file": { filePath: string };
  "write-file": { filePath: string; content: string };
  "ensure-directory": { dirPath: string };
  "list-files": { dirPath: string; extension?: string };
  "get-allowed-extensions": undefined;
  "set-menu-bar-icon": { show: boolean };
  "get-menu-bar-icon-state": undefined;
  "set-dock-icon": { show: boolean };
  "get-dock-icon-state": undefined;
  "get-settings": undefined;
  "save-settings": Record<string, unknown>;
  "get-secret-key": undefined;
  "get-goosed-host-port": undefined;
  "set-wakelock": { enable: boolean };
  "get-wakelock-state": undefined;
  "set-spellcheck": { enable: boolean };
  "get-spellcheck-state": undefined;
  "open-notifications-settings": undefined;
  "open-external": { url: string };
  "check-for-updates": undefined;
  "download-update": undefined;
  "install-update": undefined;
  "get-update-state": undefined;
  "is-using-github-fallback": undefined;
  "has-accepted-recipe-before": Record<string, unknown>;
  "record-recipe-hash": Record<string, unknown>;
  "open-directory-in-explorer": { path: string };
  "add-recent-dir": { dir: string };
  "get-current-version": undefined;
  "desktop:get-state": undefined;
  "desktop:send-logs": undefined;
};

export type RpcResponseMap = {
  "directory-chooser": unknown;
  "show-message-box": unknown;
  "show-save-dialog": unknown;
  "fetch-metadata": string;
  "check-ollama": boolean;
  "select-file-or-directory": string | null;
  "get-binary-path": string;
  "read-file": {
    file: string;
    filePath: string;
    error: string | null;
    found: boolean;
  };
  "write-file": boolean;
  "ensure-directory": boolean;
  "list-files": string[];
  "get-allowed-extensions": string[];
  "set-menu-bar-icon": boolean;
  "get-menu-bar-icon-state": boolean;
  "set-dock-icon": boolean;
  "get-dock-icon-state": boolean;
  "get-settings": Record<string, unknown>;
  "save-settings": boolean;
  "get-secret-key": string;
  "get-goosed-host-port": string | null;
  "set-wakelock": boolean;
  "get-wakelock-state": boolean;
  "set-spellcheck": boolean;
  "get-spellcheck-state": boolean;
  "open-notifications-settings": boolean;
  "open-external": undefined;
  "check-for-updates": { updateInfo: unknown; error: string | null };
  "download-update": { success: boolean; error: string | null };
  "install-update": undefined;
  "get-update-state": {
    updateAvailable: boolean;
    latestVersion?: string;
  } | null;
  "is-using-github-fallback": boolean;
  "has-accepted-recipe-before": boolean;
  "record-recipe-hash": boolean;
  "open-directory-in-explorer": boolean;
  "add-recent-dir": boolean | undefined;
  "get-current-version": string;
  "desktop:get-state": DesktopState;
  "desktop:send-logs": SendLogsResult;
};

export type CmdPayloadMap = {
  "react-ready": undefined;
  "hide-window": undefined;
  "create-chat-window": {
    query?: string;
    dir?: string;
    version?: string;
    resumeSessionId?: string;
    viewType?: string;
    recipeDeeplink?: string;
  };
  logInfo: string;
  notify: { title: string; body: string };
  "open-in-chrome": { url: string };
  "reload-app": undefined;
  "broadcast-theme-change": {
    mode: string;
    useSystemTheme: boolean;
    theme: string;
  };
  "restart-app": undefined;
  "close-window": undefined;
  "get-app-version": undefined;
};

export type EventPayloadMap = {
  "add-extension": string;
  "open-shared-session": string;
  "set-initial-message": string;
  "fatal-error": string;
  "mouse-back-button-clicked": undefined;
  "theme-changed": { mode: string; useSystemTheme: boolean; theme: string };
  "updater-event": { event: string; data?: unknown };
  "set-view": { view: string; tab?: string };
  "new-chat": undefined;
  "focus-input": undefined;
  "find-command": undefined;
  "find-next": undefined;
  "find-previous": undefined;
  "use-selection-find": undefined;
};

export const RPC_CHANNELS = [
  "directory-chooser",
  "show-message-box",
  "show-save-dialog",
  "fetch-metadata",
  "check-ollama",
  "select-file-or-directory",
  "get-binary-path",
  "read-file",
  "write-file",
  "ensure-directory",
  "list-files",
  "get-allowed-extensions",
  "set-menu-bar-icon",
  "get-menu-bar-icon-state",
  "set-dock-icon",
  "get-dock-icon-state",
  "get-settings",
  "save-settings",
  "get-secret-key",
  "get-goosed-host-port",
  "set-wakelock",
  "get-wakelock-state",
  "set-spellcheck",
  "get-spellcheck-state",
  "open-notifications-settings",
  "open-external",
  "check-for-updates",
  "download-update",
  "install-update",
  "get-update-state",
  "is-using-github-fallback",
  "has-accepted-recipe-before",
  "record-recipe-hash",
  "open-directory-in-explorer",
  "add-recent-dir",
  "get-current-version",
  "desktop:get-state",
  "desktop:send-logs",
] as const;

export const CMD_CHANNELS = [
  "react-ready",
  "hide-window",
  "create-chat-window",
  "logInfo",
  "notify",
  "open-in-chrome",
  "reload-app",
  "broadcast-theme-change",
  "restart-app",
  "close-window",
  "get-app-version",
] as const;

export const EVENT_CHANNELS = [
  "add-extension",
  "open-shared-session",
  "set-initial-message",
  "fatal-error",
  "mouse-back-button-clicked",
  "theme-changed",
  "updater-event",
  "set-view",
  "new-chat",
  "focus-input",
  "find-command",
  "find-next",
  "find-previous",
  "use-selection-find",
] as const;

export type RpcChannel = (typeof RPC_CHANNELS)[number];
export type CmdChannel = (typeof CMD_CHANNELS)[number];
export type EventChannel = (typeof EVENT_CHANNELS)[number];

export const IPC_INVENTORY = {
  rpc: RPC_CHANNELS,
  cmd: CMD_CHANNELS,
  event: EVENT_CHANNELS,
} as const;

const DEFAULT_IPC_ERROR_CODE: IpcErrorCode = "IPC_INTERNAL";

const isIpcErrorCode = (value: unknown): value is IpcErrorCode => {
  return (
    value === "IPC_INVALID_INPUT" ||
    value === "IPC_UNAUTHORIZED" ||
    value === "IPC_UNSUPPORTED_PLATFORM" ||
    value === "IPC_NOT_FOUND" ||
    value === "IPC_IO_ERROR" ||
    value === "IPC_INTERNAL"
  );
};

export const normalizeIpcError = (
  error: unknown,
  fallbackMessage: string,
): IpcError => {
  if (error && typeof error === "object") {
    const candidate = error as {
      code?: unknown;
      message?: unknown;
      details?: unknown;
      retryable?: unknown;
      cause?: unknown;
    };

    if (
      isIpcErrorCode(candidate.code) &&
      typeof candidate.message === "string"
    ) {
      const normalized: IpcError = {
        code: candidate.code,
        message: candidate.message,
      };
      if (candidate.details && typeof candidate.details === "object") {
        normalized.details = candidate.details as Record<string, unknown>;
      }
      if (typeof candidate.retryable === "boolean") {
        normalized.retryable = candidate.retryable;
      }
      return {
        ...normalized,
      };
    }

    if (candidate.cause && typeof candidate.cause === "object") {
      return normalizeIpcError(candidate.cause, fallbackMessage);
    }

    if (typeof candidate.message === "string" && candidate.message.length > 0) {
      return {
        code: DEFAULT_IPC_ERROR_CODE,
        message: candidate.message,
      };
    }
  }

  if (error instanceof Error && error.message.length > 0) {
    return {
      code: DEFAULT_IPC_ERROR_CODE,
      message: error.message,
    };
  }

  return {
    code: DEFAULT_IPC_ERROR_CODE,
    message: fallbackMessage,
  };
};
