import { createActor, fromTransition } from "xstate";

import type { ProviderTurn } from "./types.js";

type ProviderActorState = {
  status: "idle" | "done";
  turn: ProviderTurn;
};

type ProviderActorEvent = {
  type: "RUN";
  input: string;
  sessionId: string;
  skillsInstructions: string;
};

const buildToolCalls = (input: string): ProviderTurn["toolCalls"] => {
  const trimmed = input.trim();
  if (trimmed.startsWith("/tool summon.")) {
    const toolName =
      trimmed.slice("/tool ".length).split(/\s+/)[0] ?? "summon.unknown";
    return [
      {
        id: `tool-${Date.now()}`,
        name: toolName,
        args: { prompt: trimmed },
      },
    ];
  }
  if (trimmed.includes("summon")) {
    return [
      {
        id: `tool-${Date.now()}`,
        name: "summon.default",
        args: { prompt: trimmed },
      },
    ];
  }
  return [];
};

const transition = (
  state: ProviderActorState,
  event: ProviderActorEvent,
): ProviderActorState => {
  if (event.type !== "RUN") {
    return state;
  }
  const toolCalls = buildToolCalls(event.input);
  const suffix =
    event.skillsInstructions.length > 0
      ? " [skills-loaded]"
      : " [skills-empty]";
  return {
    status: "done",
    turn: {
      assistantText: `stub:${event.input}${suffix}`,
      toolCalls,
    },
  };
};

export const runProviderTurn = (input: {
  prompt: string;
  sessionId: string;
  skillsInstructions: string;
}): ProviderTurn => {
  let turn: ProviderTurn = {
    assistantText: "",
    toolCalls: [],
  };
  const logic = fromTransition(transition, {
    status: "idle",
    turn,
  } satisfies ProviderActorState);
  const actor = createActor(logic);
  actor.start();
  actor.send({
    type: "RUN",
    input: input.prompt,
    sessionId: input.sessionId,
    skillsInstructions: input.skillsInstructions,
  });
  turn = transition(
    { status: "idle", turn },
    {
      type: "RUN",
      input: input.prompt,
      sessionId: input.sessionId,
      skillsInstructions: input.skillsInstructions,
    },
  ).turn;
  actor.stop();
  return turn;
};
