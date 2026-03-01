import type { IpcMainEvent } from "electron";
import { CMD_CHANNELS, type CmdChannel } from "../../../shared/ipc.js";
import type { MainEventBus } from "../events.js";

type CmdHandler = (payload: unknown, event: IpcMainEvent) => void;

type CmdHandlerMap = Record<CmdChannel, CmdHandler>;

export type CmdHandlerDependencies = {
  eventBus: MainEventBus;
  notify: (input: { title: string; body: string }) => void;
  logInfo: (message: string) => void;
};

const noop = (): void => {
  // placeholder for compatibility-only channels
};

const makeUnsupportedCmdHandler = (_channel: CmdChannel): CmdHandler => {
  return () => {
    noop();
  };
};

export const createCmdHandlerMap = (
  dependencies: CmdHandlerDependencies,
): CmdHandlerMap => {
  const implemented: Partial<CmdHandlerMap> = {
    "react-ready": (_payload, event) => {
      dependencies.eventBus.markRendererReady(event.sender.id);
    },
    notify: (payload) => {
      const candidate = payload as { title?: unknown; body?: unknown };
      if (
        typeof candidate.title === "string" &&
        typeof candidate.body === "string"
      ) {
        dependencies.notify({ title: candidate.title, body: candidate.body });
      }
    },
    logInfo: (payload) => {
      if (typeof payload === "string") {
        dependencies.logInfo(payload);
      }
    },
  };

  const handlers = {} as CmdHandlerMap;
  for (const channel of CMD_CHANNELS) {
    const handler = implemented[channel] ?? makeUnsupportedCmdHandler(channel);
    handlers[channel] = handler;
  }

  return handlers;
};
