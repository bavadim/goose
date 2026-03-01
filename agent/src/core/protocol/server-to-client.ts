import type { MessageEnvelope } from "./envelope.js";
import type { ServerToClientTopic } from "./topics.js";

export type ForwardedServerEvent = {
  event: string;
  payload?: unknown;
};

export type ServerToClientMessage =
  | MessageEnvelope<"runtime.ack", { requestId?: string; message?: string }>
  | (MessageEnvelope<"event.forward", ForwardedServerEvent> & {
      topic: ServerToClientTopic;
    });
