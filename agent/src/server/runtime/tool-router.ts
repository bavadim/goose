import type { RuntimeResult, RuntimeToolCall } from "./types.js";

type ExtensionActorHandle = {
  name: string;
  listTools: () => string[];
  callTool: (call: RuntimeToolCall) => RuntimeResult<{ output: string }>;
};

type ToolRouterOptions = {
  getActiveExtensions: () => ExtensionActorHandle[];
};

export class ToolRouter {
  private readonly getActiveExtensions: ToolRouterOptions["getActiveExtensions"];

  constructor(options: ToolRouterOptions) {
    this.getActiveExtensions = options.getActiveExtensions;
  }

  dispatch(call: RuntimeToolCall): RuntimeResult<{ output: string }> {
    const extensions = this.getActiveExtensions();
    for (const extension of extensions) {
      if (extension.listTools().includes(call.name)) {
        return extension.callTool(call);
      }
    }
    return {
      ok: false,
      error: {
        code: "TOOL_NOT_FOUND",
        message: `Tool not found: ${call.name}`,
      },
    };
  }
}
