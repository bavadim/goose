import { contextBridge, ipcRenderer } from "electron";
import { createDesktopApi } from "../shared/ipc/preload-transport.js";

const desktopApi = createDesktopApi(ipcRenderer);

contextBridge.exposeInMainWorld("desktopApi", desktopApi);
