export type AgentRuntimeState =
  | "idle"
  | "running"
  | "waiting_tool"
  | "streaming"
  | "completed"
  | "failed";

type AgentRuntimeEvent =
  | { type: "START" }
  | { type: "PROVIDER_OK" }
  | { type: "TOOL_REQUIRED" }
  | { type: "TOOL_DONE" }
  | { type: "STREAM_DONE" }
  | { type: "FAIL" }
  | { type: "RESET" };

export const transitionAgentState = (
  state: AgentRuntimeState,
  event: AgentRuntimeEvent,
): AgentRuntimeState => {
  switch (state) {
    case "idle":
      return event.type === "START" ? "running" : state;
    case "running":
      if (event.type === "TOOL_REQUIRED") {
        return "waiting_tool";
      }
      if (event.type === "PROVIDER_OK") {
        return "streaming";
      }
      return event.type === "FAIL" ? "failed" : state;
    case "waiting_tool":
      if (event.type === "TOOL_DONE") {
        return "running";
      }
      return event.type === "FAIL" ? "failed" : state;
    case "streaming":
      if (event.type === "STREAM_DONE") {
        return "completed";
      }
      return event.type === "FAIL" ? "failed" : state;
    case "completed":
    case "failed":
      return event.type === "RESET" ? "idle" : state;
  }
};
