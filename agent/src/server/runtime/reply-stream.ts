import type { MessageEvent } from "./types.js";

export const toSseStream = (events: MessageEvent[]): string =>
  events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("");
