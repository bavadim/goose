import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { BrowserWindowConstructorOptions } from "electron";
import {
  BrowserWindow,
  Menu,
  Notification,
  app,
  dialog,
  ipcMain,
  shell,
} from "electron";
import { createLogger } from "../../logging/index.js";
import {
  DesktopServerMessageBridge,
  IPC_MESSAGE_EVENT_CHANNEL,
  MainEventBus,
  registerDesktopIpc,
} from "../ipc/index.js";
import type { SendLogsResult } from "../shared/api.js";
import { runWindowsPreflight } from "../windowsPreflight.js";
import { NotificationService } from "./notifications/service.js";
import { executeSendLogsRequest } from "./send-logs.js";
import { createElectronSecretCrypto } from "./settings/secrets/crypto.js";
import { SettingsStore, type SettingsStoreAppDirs } from "./settings/store.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const mainWindowViteDevServerUrl =
  (globalThis as { MAIN_WINDOW_VITE_DEV_SERVER_URL?: string })
    .MAIN_WINDOW_VITE_DEV_SERVER_URL ??
  process.env.MAIN_WINDOW_VITE_DEV_SERVER_URL;

const isDev = !app.isPackaged;
const generatedIconsDir = path.resolve(
  process.cwd(),
  "src",
  "desktop",
  "renderer",
  "assets",
  "app-icons",
  "generated",
);

const createAppDirs = (): SettingsStoreAppDirs => {
  const root = app.getPath("userData");
  const config = path.join(root, "config");
  const logs = path.join(root, "logs");
  const cache = path.join(root, "cache");

  fs.mkdirSync(config, { recursive: true });
  fs.mkdirSync(logs, { recursive: true });
  fs.mkdirSync(cache, { recursive: true });

  return { root, config, logs, cache };
};

const resolveBackendEntry = (): string => path.join(currentDir, "server.js");

const waitForHealth = async (baseUrl: string): Promise<void> => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/status`);
      if (response.ok) {
        return;
      }
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Backend health check timed out");
};

let mainWindow: BrowserWindow | null = null;
let backendProcess: ChildProcessWithoutNullStreams | null = null;
let backendUrl = "";
let backendError = "";
let backendSecretKey = "";
let windowsPreflightMessages: string[] = [];
let appDirs: SettingsStoreAppDirs | null = null;
let settingsStore: SettingsStore | null = null;
let notificationService: NotificationService | null = null;
let isSendingLogs = false;
const eventBus = new MainEventBus(() => mainWindow?.webContents ?? null);
const messageBridge = new DesktopServerMessageBridge({
  backendUrl: () => backendUrl,
  secretKey: () => backendSecretKey,
  eventBus,
  onMessage: (message) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_MESSAGE_EVENT_CHANNEL, message);
    }
  },
});
const logger = createLogger("desktop-main");

const startBackend = async (
  dirs: SettingsStoreAppDirs,
): Promise<{
  process: ChildProcessWithoutNullStreams;
  baseUrl: string;
  secretKey: string;
}> => {
  const port = Number(process.env.AGENT_DESKTOP_BACKEND_PORT ?? "43111");
  const baseUrl = `http://127.0.0.1:${port}`;
  const env = settingsStore
    ? settingsStore.buildServerEnv(process.env, dirs, port)
    : {
        ...process.env,
        HOST: "127.0.0.1",
        PORT: String(port),
        SERVER_SECRET_KEY: process.env.SERVER_SECRET_KEY ?? "dev-secret",
        AGENT_PATH_ROOT: dirs.root,
        AGENT_CONFIG_DIR: dirs.config,
        AGENT_LOGS_DIR: dirs.logs,
        AGENT_CACHE_DIR: dirs.cache,
      };
  const secretKey = String(env.SERVER_SECRET_KEY ?? "dev-secret");

  const child = spawn(process.execPath, [resolveBackendEntry()], {
    env: {
      ...env,
      ELECTRON_RUN_AS_NODE: "1",
    },
    stdio: "pipe",
  });

  child.stdout.on("data", (chunk) => {
    logger.info("backend_stdout", { output: String(chunk) });
  });
  child.stderr.on("data", (chunk) => {
    logger.warn("backend_stderr", { output: String(chunk) });
  });

  await waitForHealth(baseUrl);
  logger.info("backend_ready", { baseUrl });
  notificationService?.notify({
    code: "runtime.backend.ready",
    context: { baseUrl },
  });
  return { process: child, baseUrl, secretKey };
};

const shutdownBackend = (): void => {
  messageBridge.stop();
  if (!backendProcess || backendProcess.killed) {
    return;
  }
  backendProcess.kill("SIGTERM");
};

const createWindow = (): BrowserWindow => {
  const windowIcon = path.join(generatedIconsDir, "icon.png");
  const options: BrowserWindowConstructorOptions = {
    width: 980,
    height: 720,
    webPreferences: {
      preload: path.join(currentDir, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  };

  if (fs.existsSync(windowIcon)) {
    options.icon = windowIcon;
  }

  mainWindow = new BrowserWindow(options);

  if (mainWindowViteDevServerUrl) {
    void mainWindow.loadURL(mainWindowViteDevServerUrl);
  } else {
    const file = path.join(currentDir, "../renderer/main_window/index.html");
    void mainWindow.loadFile(file);
  }

  return mainWindow;
};

const sendLogsFromDesktop = async (): Promise<SendLogsResult> => {
  if (isSendingLogs) {
    return { ok: false, message: "Send logs already in progress" };
  }

  isSendingLogs = true;
  try {
    const result = await executeSendLogsRequest({
      fetchFn: fetch,
      backendUrl,
      secretKey: backendSecretKey,
      logger,
    });
    notificationService?.notify({
      code: result.ok
        ? "diagnostics.send_logs.succeeded"
        : "diagnostics.send_logs.failed",
      ...(result.ok ? {} : { context: { reason: result.message } }),
    });
    return result;
  } catch {
    notificationService?.notify({
      code: "diagnostics.send_logs.failed",
      context: { reason: "Send logs request failed" },
    });
    return { ok: false, message: "Send logs request failed" };
  } finally {
    isSendingLogs = false;
  }
};

const createApplicationMenu = (): void => {
  const template =
    process.platform === "darwin"
      ? [
          { role: "appMenu" as const },
          { role: "fileMenu" as const },
          { role: "editMenu" as const },
          { role: "viewMenu" as const },
          { role: "windowMenu" as const },
          {
            role: "help" as const,
            submenu: [
              {
                label: "Send Logs",
                click: () => {
                  void sendLogsFromDesktop();
                },
              },
            ],
          },
        ]
      : [
          { role: "fileMenu" as const },
          { role: "editMenu" as const },
          { role: "viewMenu" as const },
          { role: "windowMenu" as const },
          {
            role: "help" as const,
            submenu: [
              {
                label: "Send Logs",
                click: () => {
                  void sendLogsFromDesktop();
                },
              },
            ],
          },
        ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
};

const ensureMainWindow = (): BrowserWindow => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return mainWindow;
  }
  return createWindow();
};

const resolveHostPort = (): string | null => {
  if (!backendUrl) {
    return null;
  }
  try {
    const parsed = new URL(backendUrl);
    return parsed.host;
  } catch {
    return null;
  }
};

const normalizeFsPath = (rawPath: string): string => path.normalize(rawPath);

const readFileSafe = async (
  filePath: string,
): Promise<{
  file: string;
  filePath: string;
  error: string | null;
  found: boolean;
}> => {
  const normalized = normalizeFsPath(filePath);
  try {
    const file = await fs.promises.readFile(normalized, "utf8");
    return {
      file,
      filePath: normalized,
      error: null,
      found: true,
    };
  } catch (error: unknown) {
    return {
      file: "",
      filePath: normalized,
      error: error instanceof Error ? error.message : String(error),
      found: false,
    };
  }
};

const listFilesSafe = async (
  dirPath: string,
  extension?: string,
): Promise<string[]> => {
  const normalized = normalizeFsPath(dirPath);
  const entries = await fs.promises.readdir(normalized, {
    withFileTypes: true,
  });
  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(normalized, entry.name));

  if (!extension) {
    return files;
  }
  return files.filter((file) => path.extname(file) === extension);
};

registerDesktopIpc({
  ipcMain,
  rpc: {
    getState: () => ({
      backendUrl,
      backendError,
      windowsPreflightMessages,
      appDirs,
      isDev,
    }),
    sendLogs: () => sendLogsFromDesktop(),
    getGoosedHostPort: () => resolveHostPort(),
    chooseDirectory: async () =>
      dialog.showOpenDialog(ensureMainWindow(), {
        properties: ["openDirectory", "createDirectory"],
      }),
    selectFileOrDirectory: async (defaultPath) => {
      const result = await dialog.showOpenDialog(ensureMainWindow(), {
        properties: ["openFile", "openDirectory", "createDirectory"],
        ...(defaultPath ? { defaultPath } : {}),
      });
      return result.canceled ? null : (result.filePaths[0] ?? null);
    },
    readFile: (filePath) => readFileSafe(filePath),
    writeFile: async (filePath, content) => {
      await fs.promises.writeFile(normalizeFsPath(filePath), content, "utf8");
      return true;
    },
    ensureDirectory: async (dirPath) => {
      await fs.promises.mkdir(normalizeFsPath(dirPath), { recursive: true });
      return true;
    },
    listFiles: (dirPath, extension) => listFilesSafe(dirPath, extension),
    getAllowedExtensions: () => [".md", ".txt", ".json", ".yaml", ".yml"],
    openDirectoryInExplorer: async (targetPath) => {
      const result = await shell.openPath(normalizeFsPath(targetPath));
      return result.length === 0;
    },
    addRecentDir: (dir) => {
      app.addRecentDocument(normalizeFsPath(dir));
      return true;
    },
    openExternal: (url) => shell.openExternal(url),
    fetchMetadata: async (url) => {
      const response = await fetch(url, { method: "HEAD" });
      return response.headers.get("content-type") ?? "";
    },
    checkOllama: async () => {
      try {
        const response = await fetch("http://127.0.0.1:11434/api/tags", {
          method: "GET",
        });
        return response.ok;
      } catch {
        return false;
      }
    },
    sendClientMessage: async (payload) => {
      const message = payload as {
        id?: unknown;
        topic?: unknown;
        sentAt?: unknown;
        payload?: unknown;
      };
      if (
        typeof message.id !== "string" ||
        typeof message.topic !== "string" ||
        typeof message.sentAt !== "string"
      ) {
        throw {
          code: "IPC_INVALID_INPUT",
          message: "Invalid client message envelope",
        };
      }
      const result = await messageBridge.send({
        id: message.id,
        topic: message.topic,
        sentAt: message.sentAt,
        ...(message.payload && typeof message.payload === "object"
          ? { payload: message.payload as Record<string, unknown> }
          : {}),
      });
      if (!result.ok) {
        throw result.error;
      }
      return result.data;
    },
  },
  cmd: {
    eventBus,
    notify: (input) => {
      if (Notification.isSupported()) {
        new Notification({ title: input.title, body: input.body }).show();
      }
    },
    logInfo: (message) => {
      logger.info("renderer_log_info", { message });
    },
    getWindowForEvent: (event) => BrowserWindow.fromWebContents(event.sender),
    ensureMainWindow: () => ensureMainWindow(),
    restartApp: () => {
      app.relaunch();
      app.quit();
    },
    openInChrome: async (url) => {
      await shell.openExternal(url);
    },
    getAppVersion: () => app.getVersion(),
    dispatchClientMessage: async (topic, payload) => {
      const result = await messageBridge.send({
        id: randomUUID(),
        topic,
        sentAt: new Date().toISOString(),
        ...(payload ? { payload } : {}),
      });
      if (!result.ok) {
        logger.warn("bridge_send_failed", {
          topic,
          code: result.error.code,
          message: result.error.message,
        });
      }
    },
  },
});

void app.whenReady().then(async () => {
  notificationService = new NotificationService({
    transport: {
      isSupported: () => Notification.isSupported(),
      show: ({ title, body }) => {
        new Notification({ title, body }).show();
      },
    },
  });

  const preflight = runWindowsPreflight();
  windowsPreflightMessages = preflight.messages;
  if (!preflight.ok) {
    backendError = `Windows preflight failed: ${preflight.messages.join(" ")}`;
    logger.error("windows_preflight_failed", {
      messages: windowsPreflightMessages,
    });
    notificationService.notify({ code: "runtime.preflight.failed" });
  }

  appDirs = createAppDirs();
  settingsStore = new SettingsStore({
    configDir: appDirs.config,
    crypto: createElectronSecretCrypto(),
  });

  if (!backendError) {
    try {
      const started = await startBackend(appDirs);
      backendProcess = started.process;
      backendUrl = started.baseUrl;
      backendSecretKey = started.secretKey;
      messageBridge.start();
    } catch (error: unknown) {
      backendError = error instanceof Error ? error.message : String(error);
      logger.error("backend_start_failed", {
        error:
          error instanceof Error
            ? { name: error.name, message: error.message }
            : { message: String(error) },
      });
      notificationService.notify({
        code: "runtime.backend.start_failed",
        context: { message: backendError },
      });
    }
  }
  createApplicationMenu();
  ensureMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      ensureMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  shutdownBackend();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  shutdownBackend();
});
