import type { IpcRenderer } from "electron";
import type {
  ClientToServerMessage,
  ServerToClientMessage,
} from "../../core/protocol/index.js";
import type {
  CmdChannel,
  CmdPayloadMap,
  DesktopApi,
  EventChannel,
  EventPayloadMap,
  RpcChannel,
  RpcRequestMap,
  RpcResponseMap,
} from "./contracts.js";
import { normalizeIpcError } from "./errors.js";

const MESSAGE_EVENT_CHANNEL = "desktop:message-event";

export const createDesktopApi = (ipcRenderer: IpcRenderer): DesktopApi => {
  const invoke = async <C extends RpcChannel>(
    channel: C,
    ...args: RpcRequestMap[C] extends undefined
      ? []
      : [payload: RpcRequestMap[C]]
  ) => {
    try {
      const payload = args[0] as RpcRequestMap[C] | undefined;
      const data = (await ipcRenderer.invoke(
        channel,
        payload,
      )) as RpcResponseMap[C];
      return { ok: true, data } as const;
    } catch (error: unknown) {
      return {
        ok: false,
        error: normalizeIpcError(
          error,
          `IPC call failed for channel: ${channel}`,
        ),
      } as const;
    }
  };

  const send = <C extends CmdChannel>(
    channel: C,
    ...args: CmdPayloadMap[C] extends undefined
      ? []
      : [payload: CmdPayloadMap[C]]
  ): void => {
    const payload = args[0] as CmdPayloadMap[C] | undefined;
    ipcRenderer.send(channel, payload);
  };

  const on = <C extends EventChannel>(
    channel: C,
    listener: (payload: EventPayloadMap[C]) => void,
  ) => {
    const wrapped = (_event: unknown, payload: EventPayloadMap[C]) => {
      listener(payload);
    };
    ipcRenderer.on(channel, wrapped);
    return () => {
      ipcRenderer.removeListener(channel, wrapped);
    };
  };

  const unwrap = async <T>(
    resultPromise: Promise<
      | { ok: true; data: T }
      | { ok: false; error: { code: string; message: string } }
    >,
  ): Promise<T> => {
    const result = await resultPromise;
    if (result.ok) {
      return result.data;
    }
    throw new Error(`${result.error.code}: ${result.error.message}`);
  };

  return {
    getState: () => unwrap(invoke("desktop:get-state")),
    sendLogs: () => unwrap(invoke("desktop:send-logs")),
    sendMessage: (message: ClientToServerMessage) =>
      invoke("desktop:send-message", message),
    subscribeMessages: (listener: (message: ServerToClientMessage) => void) => {
      const wrapped = (_event: unknown, message: ServerToClientMessage) => {
        listener(message);
      };
      ipcRenderer.on(MESSAGE_EVENT_CHANNEL, wrapped);
      return () => {
        ipcRenderer.removeListener(MESSAGE_EVENT_CHANNEL, wrapped);
      };
    },
    rendererReady: () => {
      send("react-ready");
    },
    invoke,
    send,
    on,
  };
};

export const IPC_MESSAGE_EVENT_CHANNEL = MESSAGE_EVENT_CHANNEL;
