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

export type DesktopApi = {
  getState: () => Promise<DesktopState>;
  sendLogs: () => Promise<SendLogsResult>;
};
