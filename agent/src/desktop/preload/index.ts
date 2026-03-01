import { contextBridge, ipcRenderer } from "electron";
import { createDesktopApi } from "../ipc/index.js";

const desktopApi = createDesktopApi(ipcRenderer);

contextBridge.exposeInMainWorld("desktopApi", desktopApi);
