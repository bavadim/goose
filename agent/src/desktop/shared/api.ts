import type {
  CmdChannel,
  CmdPayloadMap,
  DesktopState,
  EventChannel,
  EventPayloadMap,
  IpcResult,
  RpcChannel,
  RpcRequestMap,
  RpcResponseMap,
  SendLogsResult,
} from "./ipc.js";

export type DesktopEventUnsubscribe = () => void;

export type DesktopApi = {
  invoke: <C extends RpcChannel>(
    channel: C,
    ...args: RpcRequestMap[C] extends undefined
      ? []
      : [payload: RpcRequestMap[C]]
  ) => Promise<IpcResult<RpcResponseMap[C]>>;
  send: <C extends CmdChannel>(
    channel: C,
    ...args: CmdPayloadMap[C] extends undefined
      ? []
      : [payload: CmdPayloadMap[C]]
  ) => void;
  on: <C extends EventChannel>(
    channel: C,
    listener: (payload: EventPayloadMap[C]) => void,
  ) => DesktopEventUnsubscribe;
  getState: () => Promise<DesktopState>;
  sendLogs: () => Promise<SendLogsResult>;
  rendererReady: () => void;
};

export type { DesktopState, SendLogsResult };
