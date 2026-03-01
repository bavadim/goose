import { createLogger } from "../../../logging/index.js";

export type NotificationCode =
  | "runtime.preflight.failed"
  | "runtime.backend.ready"
  | "runtime.backend.start_failed"
  | "diagnostics.send_logs.succeeded"
  | "diagnostics.send_logs.failed";

export type NotificationEvent = {
  code: NotificationCode;
  context?: {
    baseUrl?: string;
    message?: string;
    reason?: string;
  };
};

type NotificationPayload = {
  title: string;
  body: string;
};

type NotificationTransport = {
  isSupported: () => boolean;
  show: (payload: NotificationPayload) => void;
};

type NotificationLogger = {
  info: (event: string, details?: Record<string, unknown>) => void;
  warn: (event: string, details?: Record<string, unknown>) => void;
  error: (event: string, details?: Record<string, unknown>) => void;
};

type NotificationServiceOptions = {
  transport: NotificationTransport;
  logger?: NotificationLogger;
  now?: () => number;
  dedupWindowMs?: number;
};

const defaultLogger = createLogger("desktop-notifications");

const toPayload = (event: NotificationEvent): NotificationPayload => {
  switch (event.code) {
    case "runtime.preflight.failed":
      return {
        title: "Agent Desktop",
        body: "Startup checks failed. Open app logs for details.",
      };
    case "runtime.backend.ready":
      return {
        title: "Agent Desktop",
        body: "Local backend is ready.",
      };
    case "runtime.backend.start_failed":
      return {
        title: "Agent Desktop",
        body: "Failed to start local backend. Open app logs for details.",
      };
    case "diagnostics.send_logs.succeeded":
      return {
        title: "Agent Desktop",
        body: "Logs prepared for sending.",
      };
    case "diagnostics.send_logs.failed":
      return {
        title: "Agent Desktop",
        body: "Failed to send logs. Open app logs for details.",
      };
  }
};

const dedupKey = (event: NotificationEvent): string =>
  JSON.stringify({
    code: event.code,
    baseUrl: event.context?.baseUrl ?? "",
  });

export class NotificationService {
  private readonly transport: NotificationTransport;

  private readonly logger: NotificationLogger;

  private readonly now: () => number;

  private readonly dedupWindowMs: number;

  private readonly lastEmittedAt = new Map<string, number>();

  constructor(options: NotificationServiceOptions) {
    this.transport = options.transport;
    this.logger = options.logger ?? defaultLogger;
    this.now = options.now ?? Date.now;
    this.dedupWindowMs = options.dedupWindowMs ?? 30_000;
  }

  notify(event: NotificationEvent): void {
    if (!this.transport.isSupported()) {
      this.logger.warn("notification_unsupported", { code: event.code });
      return;
    }

    const key = dedupKey(event);
    const current = this.now();
    const last = this.lastEmittedAt.get(key);
    if (typeof last === "number" && current - last < this.dedupWindowMs) {
      this.logger.warn("notification_suppressed", {
        code: event.code,
        dedupWindowMs: this.dedupWindowMs,
      });
      return;
    }

    this.lastEmittedAt.set(key, current);
    const payload = toPayload(event);

    try {
      this.transport.show(payload);
      this.logger.info("notification_shown", { code: event.code });
    } catch (error: unknown) {
      this.logger.error("notification_failed", {
        code: event.code,
        error:
          error instanceof Error
            ? { name: error.name, message: error.message }
            : { message: String(error) },
      });
    }
  }
}
