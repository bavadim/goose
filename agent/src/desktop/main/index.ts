import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { BrowserWindowConstructorOptions } from "electron";
import { BrowserWindow, Menu, Notification, app, ipcMain } from "electron";
import { createLogger } from "../../logging/index.js";
import type { SendLogsResult } from "../shared/api.js";
import { runWindowsPreflight } from "../windowsPreflight.js";
import { MainEventBus } from "./ipc/events.js";
import { registerDesktopIpc } from "./ipc/register.js";
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
  if (!backendProcess || backendProcess.killed) {
    return;
  }
  backendProcess.kill("SIGTERM");
};

const createWindow = (): void => {
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
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
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
