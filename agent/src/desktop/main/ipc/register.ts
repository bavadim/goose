import type { IpcMain } from "electron";
import { CMD_CHANNELS, RPC_CHANNELS } from "../../shared/ipc.js";
import {
  type CmdHandlerDependencies,
  createCmdHandlerMap,
} from "./handlers/cmd.js";
import {
  type RpcHandlerDependencies,
  createRpcHandlerMap,
} from "./handlers/rpc.js";

type IpcRegistryDependencies = {
  ipcMain: IpcMain;
  rpc: RpcHandlerDependencies;
  cmd: CmdHandlerDependencies;
};

export const registerDesktopIpc = ({
  ipcMain,
  rpc,
  cmd,
}: IpcRegistryDependencies): {
  rpcHandlers: ReturnType<typeof createRpcHandlerMap>;
  cmdHandlers: ReturnType<typeof createCmdHandlerMap>;
} => {
  const rpcHandlers = createRpcHandlerMap(rpc);
  const cmdHandlers = createCmdHandlerMap(cmd);

  for (const channel of RPC_CHANNELS) {
    ipcMain.handle(channel, (event, payload) => {
      const handler = rpcHandlers[channel];
      return handler(payload, event);
    });
  }

  for (const channel of CMD_CHANNELS) {
    ipcMain.on(channel, (event, payload) => {
      const handler = cmdHandlers[channel];
      handler(payload, event);
    });
  }

  return { rpcHandlers, cmdHandlers };
};
