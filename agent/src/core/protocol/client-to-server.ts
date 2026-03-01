import type { MessageEnvelope } from "./envelope.js";
import type { ClientToServerTopic } from "./topics.js";

export type ClientToServerMessage = MessageEnvelope<
  ClientToServerTopic,
  Record<string, unknown>
>;
