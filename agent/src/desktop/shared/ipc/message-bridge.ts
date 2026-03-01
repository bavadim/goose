import type {
  ClientToServerMessage,
  ProtocolResult,
  ServerToClientMessage,
} from "../../../core/protocol.js";
import { createLogger } from "../../../logging/index.js";
import {
  EVENT_CHANNELS,
  type EventChannel,
  type EventMessage,
} from "./contracts.js";
import { normalizeIpcError } from "./errors.js";
import type { MainEventBus } from "./event-bus.js";

type BridgeOptions = {
  backendUrl: () => string;
  secretKey: () => string;
  fetchFn?: typeof fetch;
  eventBus: MainEventBus;
  onMessage?: (message: ServerToClientMessage) => void;
  reconnectDelayMs?: number;
};

const logger = createLogger("desktop-ipc-bridge");

const sleep = async (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const parseSseMessages = (raw: string): ServerToClientMessage[] => {
  const frames = raw
    .split("\n\n")
    .map((frame) => frame.trim())
    .filter((frame) => frame.startsWith("data: "));

  const parsed: ServerToClientMessage[] = [];
  for (const frame of frames) {
    const data = frame.slice("data: ".length);
    try {
      parsed.push(JSON.parse(data) as ServerToClientMessage);
    } catch {
      // ignore malformed frame
    }
  }

  return parsed;
};

const isEventChannel = (value: string): value is EventChannel =>
  EVENT_CHANNELS.includes(value as EventChannel);

const parseForwardEvent = (
  message: ServerToClientMessage,
): EventMessage | null => {
  if (message.topic !== "event.forward") {
    return null;
  }
  const event = message.payload?.event;
  if (!event || !isEventChannel(event)) {
    return null;
  }
  return {
    channel: event,
    payload: message.payload?.payload,
  } as EventMessage;
};

export class DesktopServerMessageBridge {
  private readonly fetchFn: typeof fetch;

  private readonly reconnectDelayMs: number;

  private running = false;

  constructor(private readonly options: BridgeOptions) {
    this.fetchFn = options.fetchFn ?? fetch;
    this.reconnectDelayMs = options.reconnectDelayMs ?? 1_000;
  }

  async send(
    message: ClientToServerMessage,
  ): Promise<ProtocolResult<{ accepted: true }>> {
    const backendUrl = this.options.backendUrl();
    const secretKey = this.options.secretKey();
    if (!backendUrl || !secretKey) {
      return {
        ok: false,
        error: {
          code: "IPC_INTERNAL",
          message: "Backend bridge is not ready",
        },
      };
    }

    try {
      const response = await this.fetchFn(`${backendUrl}/desktop/messages`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-secret-key": secretKey,
        },
        body: JSON.stringify(message),
      });
      if (!response.ok) {
        return {
          ok: false,
          error: {
            code: "IPC_IO_ERROR",
            message: `Bridge POST failed with status ${response.status}`,
          },
        };
      }
      return { ok: true, data: { accepted: true } };
    } catch (error: unknown) {
      return {
        ok: false,
        error: normalizeIpcError(error, "Bridge POST failed"),
      };
    }
  }

  async pollOnce(): Promise<ProtocolResult<{ count: number }>> {
    const backendUrl = this.options.backendUrl();
    const secretKey = this.options.secretKey();
    if (!backendUrl || !secretKey) {
      return {
        ok: false,
        error: {
          code: "IPC_INTERNAL",
          message: "Backend bridge is not ready",
        },
      };
    }

    try {
      const response = await this.fetchFn(
        `${backendUrl}/desktop/messages/stream`,
        {
          method: "GET",
          headers: {
            accept: "text/event-stream",
            "x-secret-key": secretKey,
          },
        },
      );
      if (!response.ok) {
        return {
          ok: false,
          error: {
            code: "IPC_IO_ERROR",
            message: `Bridge stream failed with status ${response.status}`,
          },
        };
      }

      const body = await response.text();
      const messages = parseSseMessages(body);
      for (const message of messages) {
        const event = parseForwardEvent(message);
        if (event) {
          this.options.eventBus.emitMessage(event);
        }
        this.options.onMessage?.(message);
      }
      return { ok: true, data: { count: messages.length } };
    } catch (error: unknown) {
      return {
        ok: false,
        error: normalizeIpcError(error, "Bridge stream failed"),
      };
    }
  }

  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    void this.loop();
  }

  stop(): void {
    this.running = false;
  }

  private async loop(): Promise<void> {
    while (this.running) {
      const result = await this.pollOnce();
      if (!result.ok) {
        logger.warn("bridge_poll_failed", {
          code: result.error.code,
          message: result.error.message,
        });
      }
      await sleep(this.reconnectDelayMs);
    }
  }
}
