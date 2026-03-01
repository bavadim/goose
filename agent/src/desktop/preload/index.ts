import { contextBridge, ipcRenderer } from "electron";
import type { DesktopApi } from "../shared/api.js";

const desktopApi: DesktopApi = {
  getState: () => ipcRenderer.invoke("desktop:get-state"),
  sendLogs: () => ipcRenderer.invoke("desktop:send-logs"),
};

contextBridge.exposeInMainWorld("desktopApi", desktopApi);
