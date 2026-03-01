import { createActor, fromTransition } from "xstate";

import type {
  ExtensionStoredEntry,
  RuntimeResult,
  RuntimeToolCall,
} from "./types.js";

type ExtensionActorState = {
  tools: string[];
};

type ExtensionActorEvent = {
  type: "SYNC_TOOLS";
  tools: string[];
};

type ExtensionActorHandle = {
  name: string;
  listTools: () => string[];
  callTool: (call: RuntimeToolCall) => RuntimeResult<{ output: string }>;
};

const normalizeToolPrefix = (name: string): string =>
  name.replaceAll(/[^a-zA-Z0-9_-]/g, "_");

export const createExtensionActor = (
  entry: ExtensionStoredEntry,
): ExtensionActorHandle => {
  const extensionName = entry.name;
  const prefix = normalizeToolPrefix(extensionName);
  const baseTools = [`${prefix}.echo`, `summon.${prefix}`];
  let tools = baseTools;
  const logic = fromTransition(
    (state: ExtensionActorState, event: ExtensionActorEvent) => {
      if (event.type !== "SYNC_TOOLS") {
        return state;
      }
      tools = event.tools;
      return { tools };
    },
    { tools },
  );
  const actor = createActor(logic);
  actor.start();

  return {
    name: extensionName,
    listTools: () => tools,
    callTool: (call) => {
      if (!tools.includes(call.name)) {
        return {
          ok: false,
          error: {
            code: "TOOL_NOT_FOUND",
            message: `Tool not found: ${call.name}`,
          },
        };
      }
      return {
        ok: true,
        data: {
          output: `${call.name}:${JSON.stringify(call.args)}`,
        },
      };
    },
  };
};
