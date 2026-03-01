import type { EventChannel, EventPayloadMap } from "./contracts.js";

type RendererSink = {
  id: number;
  send: (channel: string, payload?: unknown) => void;
  isDestroyed?: () => boolean;
};

type QueuedEvent = {
  channel: EventChannel;
  payload: EventPayloadMap[EventChannel];
};

export class MainEventBus {
  private readonly readyRendererIds = new Set<number>();

  private readonly queue: QueuedEvent[] = [];

  constructor(private readonly getSink: () => RendererSink | null) {}

  emit<C extends EventChannel>(channel: C, payload: EventPayloadMap[C]): void {
    const sink = this.getSink();
    if (!sink || sink.isDestroyed?.()) {
      this.queue.push({
        channel,
        payload: payload as EventPayloadMap[EventChannel],
      });
      return;
    }

    if (!this.readyRendererIds.has(sink.id)) {
      this.queue.push({
        channel,
        payload: payload as EventPayloadMap[EventChannel],
      });
      return;
    }

    sink.send(channel, payload);
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
