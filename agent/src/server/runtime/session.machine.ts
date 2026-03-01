import { createActor, fromTransition } from "xstate";

import type { SessionStatus } from "./types.js";

type SessionActorState = {
  status: SessionStatus;
};

type SessionActorEvent =
  | { type: "START" }
  | { type: "RESUME" }
  | { type: "RESTART" }
  | { type: "STOP" }
  | { type: "FAIL" };

const transition = (
  _state: SessionActorState,
  event: SessionActorEvent,
): SessionActorState => {
  switch (event.type) {
    case "START":
    case "RESUME":
    case "RESTART":
      return { status: "running" };
    case "STOP":
      return { status: "stopped" };
    case "FAIL":
      return { status: "failed" };
  }
};

export const createSessionActor = (
  initial: SessionStatus = "idle",
): ReturnType<typeof createActor> => {
  const logic = fromTransition(transition, { status: initial });
  const actor = createActor(logic);
  actor.start();
  return actor;
};
