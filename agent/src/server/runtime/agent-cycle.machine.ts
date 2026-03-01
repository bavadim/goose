import { createActor, fromTransition } from "xstate";

import type { components } from "../../shared/http/openapi.generated.js";
import { runProviderTurn } from "./provider-factory.js";
import { spawnDetachedSubcycle } from "./subcycle.js";
import type { ToolRouter } from "./tool-router.js";
import type { MessageEvent, RuntimeSession, RuntimeToolCall } from "./types.js";

type AgentCycleState =
  | "idle"
  | "loading_context"
  | "requesting_provider"
  | "processing_tools"
  | "streaming_followup"
  | "finished"
  | "failed";

type AgentCycleSnapshot = {
  state: AgentCycleState;
};

type AgentCycleEvent =
  | { type: "LOAD" }
  | { type: "PROVIDER" }
  | { type: "TOOLS" }
  | { type: "FOLLOWUP" }
  | { type: "FINISH" }
  | { type: "FAIL" };

const tokenState = (): components["schemas"]["TokenState"] => ({
  accumulatedInputTokens: 0,
  accumulatedOutputTokens: 0,
  accumulatedTotalTokens: 0,
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
});

const assistantMessage = (text: string): components["schemas"]["Message"] => ({
  role: "assistant",
  created: Date.now(),
  metadata: { userVisible: true, agentVisible: true },
  content: [{ type: "text", text }],
});

const userMessageText = (message: components["schemas"]["Message"]): string => {
  const first = message.content.find((item) => item.type === "text");
  if (!first || first.type !== "text") {
    return "";
  }
  return first.text;
};

const cycleTransition = (
  _state: AgentCycleSnapshot,
  event: AgentCycleEvent,
): AgentCycleSnapshot => {
  switch (event.type) {
    case "LOAD":
      return { state: "loading_context" };
    case "PROVIDER":
      return { state: "requesting_provider" };
    case "TOOLS":
      return { state: "processing_tools" };
    case "FOLLOWUP":
      return { state: "streaming_followup" };
    case "FINISH":
      return { state: "finished" };
    case "FAIL":
      return { state: "failed" };
  }
};

const toolResponseMessage = (
  toolCall: RuntimeToolCall,
  _output: string,
): components["schemas"]["Message"] => ({
  role: "assistant",
  created: Date.now(),
  metadata: { userVisible: true, agentVisible: true },
  content: [
    {
      type: "toolResponse",
      id: toolCall.id,
      metadata: {},
      toolResult: {},
    },
  ],
});

const appendEvent = (events: MessageEvent[], event: MessageEvent): void => {
  events.push(event);
};

export const runAgentCycle = (input: {
  session: RuntimeSession;
  userMessage: components["schemas"]["Message"];
  router: ToolRouter;
}): {
  events: MessageEvent[];
  newMessages: components["schemas"]["Message"][];
} => {
  const logic = fromTransition(cycleTransition, {
    state: "idle",
  } satisfies AgentCycleSnapshot);
  const actor = createActor(logic);
  actor.start();
  const events: MessageEvent[] = [];
  const newMessages: components["schemas"]["Message"][] = [];
  const emitNotification = (event: MessageEvent): void => {
    appendEvent(events, event);
  };

  actor.send({ type: "LOAD" });
  actor.send({ type: "PROVIDER" });
  const prompt = userMessageText(input.userMessage);
  const providerTurn = runProviderTurn({
    prompt,
    sessionId: input.session.id,
    skillsInstructions: input.session.skillsInstructions,
  });
  const assistant = assistantMessage(providerTurn.assistantText);
  appendEvent(events, {
    type: "Message",
    message: assistant,
    token_state: tokenState(),
  });
  newMessages.push(assistant);
  appendEvent(events, {
    type: "ModelChange",
    model: input.session.provider.model,
    mode: input.session.provider.provider,
  });

  if (providerTurn.toolCalls.length > 0) {
    actor.send({ type: "TOOLS" });
    for (const toolCall of providerTurn.toolCalls) {
      if (toolCall.name.startsWith("summon.")) {
        const requestId = spawnDetachedSubcycle(
          input.session.id,
          toolCall.name,
          emitNotification,
        );
        newMessages.push(
          toolResponseMessage(
            toolCall,
            JSON.stringify({
              status: "accepted",
              requestId,
            }),
          ),
        );
        continue;
      }
      const dispatched = input.router.dispatch(toolCall);
      const output = dispatched.ok
        ? dispatched.data.output
        : `${dispatched.error.code}:${dispatched.error.message}`;
      newMessages.push(toolResponseMessage(toolCall, output));
    }
    for (const message of newMessages.slice(1)) {
      appendEvent(events, {
        type: "Message",
        message,
        token_state: tokenState(),
      });
    }
    actor.send({ type: "FOLLOWUP" });
    const followup = assistantMessage("Tool execution completed.");
    newMessages.push(followup);
    appendEvent(events, {
      type: "Message",
      message: followup,
      token_state: tokenState(),
    });
  }

  actor.send({ type: "FINISH" });
  appendEvent(events, {
    type: "Finish",
    reason: "turn_completed",
    token_state: tokenState(),
  });
  actor.stop();
  return { events, newMessages };
};
