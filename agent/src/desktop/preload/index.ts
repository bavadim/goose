import { contextBridge, ipcRenderer } from "electron";
import type { DesktopApi } from "../shared/api.js";
import type {
  CmdChannel,
  CmdPayloadMap,
  EventChannel,
  EventPayloadMap,
  IpcError,
  IpcResult,
  RpcChannel,
  RpcRequestMap,
  RpcResponseMap,
} from "../shared/ipc.js";
import { normalizeIpcError } from "../shared/ipc.js";

const invoke = async <C extends RpcChannel>(
  channel: C,
  ...args: RpcRequestMap[C] extends undefined ? [] : [payload: RpcRequestMap[C]]
): Promise<IpcResult<RpcResponseMap[C]>> => {
  try {
    const payload = args[0] as RpcRequestMap[C] | undefined;
    const data = (await ipcRenderer.invoke(
      channel,
      payload,
    )) as RpcResponseMap[C];
    return { ok: true, data };
  } catch (error: unknown) {
    return {
      ok: false,
      error: normalizeIpcError(
        error,
        `IPC call failed for channel: ${channel}`,
      ),
    };
  }
};

const send = <C extends CmdChannel>(
  channel: C,
  ...args: CmdPayloadMap[C] extends undefined ? [] : [payload: CmdPayloadMap[C]]
): void => {
  const payload = args[0] as CmdPayloadMap[C] | undefined;
  ipcRenderer.send(channel, payload);
};

const on = <C extends EventChannel>(
  channel: C,
  listener: (payload: EventPayloadMap[C]) => void,
): (() => void) => {
  const wrapped = (_event: unknown, payload: EventPayloadMap[C]) => {
    listener(payload);
  };
  ipcRenderer.on(channel, wrapped);
  return () => {
    ipcRenderer.removeListener(channel, wrapped);
  };
};

const unwrapResult = async <T>(
  resultPromise: Promise<IpcResult<T>>,
): Promise<T> => {
  const result = await resultPromise;
  if (result.ok) {
    return result.data;
  }
  throw new Error(formatIpcError(result.error));
};

const formatIpcError = (error: IpcError): string =>
  `${error.code}: ${error.message}`;

const desktopApi: DesktopApi = {
  invoke,
  send,
  on,
  getState: () => unwrapResult(invoke("desktop:get-state")),
  sendLogs: () => unwrapResult(invoke("desktop:send-logs")),
  rendererReady: () => {
    send("react-ready");
  },
};

contextBridge.exposeInMainWorld("desktopApi", desktopApi);
