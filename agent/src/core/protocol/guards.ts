import type { ClientToServerMessage } from "./client-to-server.js";
import type { ServerToClientMessage } from "./server-to-client.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object";

const hasBaseEnvelopeFields = (value: Record<string, unknown>): boolean =>
  typeof value.id === "string" &&
  value.id.length > 0 &&
  typeof value.topic === "string" &&
  value.topic.length > 0 &&
  typeof value.sentAt === "string" &&
  value.sentAt.length > 0;

export const isClientToServerMessage = (
  value: unknown,
): value is ClientToServerMessage => {
  if (!isRecord(value) || !hasBaseEnvelopeFields(value)) {
    return false;
  }
  if (value.payload === undefined) {
    return true;
  }
  return isRecord(value.payload);
};

export const isServerToClientMessage = (
  value: unknown,
): value is ServerToClientMessage => {
  if (!isRecord(value) || !hasBaseEnvelopeFields(value)) {
    return false;
  }

  if (value.topic === "runtime.ack") {
    if (value.payload === undefined) {
      return true;
    }
    return isRecord(value.payload);
  }

  if (value.topic !== "event.forward" || !isRecord(value.payload)) {
    return false;
  }

  return typeof value.payload.event === "string";
};
