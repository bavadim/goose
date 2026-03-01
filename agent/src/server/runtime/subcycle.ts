import { createActor, fromTransition } from "xstate";

import type { MessageEvent } from "./types.js";

type SubcycleActorState = {
  status: "idle" | "running" | "done";
};

type SubcycleActorEvent = { type: "RUN" };

const transition = (
  state: SubcycleActorState,
  event: SubcycleActorEvent,
): SubcycleActorState => {
  if (event.type !== "RUN") {
    return state;
  }
  return { status: "running" };
};

const notificationEvent = (
  requestId: string,
  _message: string,
): MessageEvent => ({
  type: "Notification",
  request_id: requestId,
  message: {},
});

export const spawnDetachedSubcycle = (
  parentSessionId: string,
  toolName: string,
  emit: (event: MessageEvent) => void,
): string => {
  const requestId = `subcycle-${parentSessionId}-${Date.now()}`;
  const logic = fromTransition(transition, {
    status: "idle",
  } satisfies SubcycleActorState);
  const actor = createActor(logic);
  actor.start();
  emit(notificationEvent(requestId, `${toolName}:started`));
  actor.send({ type: "RUN" });
  queueMicrotask(() => {
    emit(notificationEvent(requestId, `${toolName}:finished`));
    actor.stop();
  });
  return requestId;
};
