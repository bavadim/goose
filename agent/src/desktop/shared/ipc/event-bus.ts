import type {
  EventChannel,
  EventMessage,
  EventPayloadMap,
} from "./contracts.js";

type RendererSink = {
  id: number;
  send: (channel: string, payload?: unknown) => void;
  isDestroyed?: () => boolean;
};

const toEventMessage = <C extends EventChannel>(
  channel: C,
  payload: EventPayloadMap[C],
): EventMessage => ({ channel, payload }) as EventMessage;

export class MainEventBus {
  private readonly readyRendererIds = new Set<number>();

  private readonly queue: EventMessage[] = [];

  constructor(private readonly getSink: () => RendererSink | null) {}

  emit<C extends EventChannel>(channel: C, payload: EventPayloadMap[C]): void {
    const message = toEventMessage(channel, payload);
    this.emitMessage(message);
  }

  emitMessage(message: EventMessage): void {
    const sink = this.getSink();
    if (!sink || sink.isDestroyed?.()) {
      this.queue.push(message);
      return;
    }

    if (!this.readyRendererIds.has(sink.id)) {
      this.queue.push(message);
      return;
    }

    sink.send(message.channel, message.payload);
  }

  markRendererReady(rendererId: number): void {
    this.readyRendererIds.add(rendererId);
    this.flush(rendererId);
  }

  private flush(rendererId: number): void {
    const sink = this.getSink();
    if (!sink || sink.id !== rendererId || sink.isDestroyed?.()) {
      return;
    }

    while (this.queue.length > 0) {
      const next = this.queue.shift();
      if (!next) {
        break;
      }
      sink.send(next.channel, next.payload);
    }
  }
}
