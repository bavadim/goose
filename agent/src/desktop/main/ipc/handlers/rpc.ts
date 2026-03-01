import type { IpcMainInvokeEvent } from "electron";
import type { DesktopState, SendLogsResult } from "../../../shared/api.js";
import { RPC_CHANNELS, type RpcChannel } from "../../../shared/ipc.js";

type RpcHandler = (
  payload: unknown,
  event: IpcMainInvokeEvent,
) => Promise<unknown> | unknown;

type RpcHandlerMap = Record<RpcChannel, RpcHandler>;

export type RpcHandlerDependencies = {
  getState: () => DesktopState;
  sendLogs: () => Promise<SendLogsResult>;
};

const makeUnsupportedRpcHandler = (channel: RpcChannel): RpcHandler => {
  return () => {
    throw {
      code: "IPC_NOT_FOUND",
      message: `IPC channel is not implemented: ${channel}`,
      details: { channel },
    };
  };
};

export const createRpcHandlerMap = (
  dependencies: RpcHandlerDependencies,
): RpcHandlerMap => {
  const implemented: Partial<RpcHandlerMap> = {
    "desktop:get-state": () => dependencies.getState(),
    "desktop:send-logs": async () => dependencies.sendLogs(),
  };

  const handlers = {} as RpcHandlerMap;
  for (const channel of RPC_CHANNELS) {
    const handler = implemented[channel] ?? makeUnsupportedRpcHandler(channel);
    handlers[channel] = handler;
  }

  return handlers;
};
