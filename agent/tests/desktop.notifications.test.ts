import { describe, expect, it, vi } from "vitest";
import {
  type NotificationEvent,
  NotificationService,
} from "../src/desktop/main/notifications/service.js";

type Payload = { title: string; body: string };

const makeService = (options?: {
  supported?: boolean;
  now?: () => number;
  dedupWindowMs?: number;
}) => {
  const shown: Payload[] = [];
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  const service = new NotificationService({
    transport: {
      isSupported: () => options?.supported ?? true,
      show: (payload) => {
        shown.push(payload);
      },
    },
    logger,
    ...(options?.now ? { now: options.now } : {}),
    ...(typeof options?.dedupWindowMs === "number"
      ? { dedupWindowMs: options.dedupWindowMs }
      : {}),
  });

  return { service, shown, logger };
};

describe("MUST desktop notifications requirements", () => {
  it("MUST show OS notification for runtime.preflight.failed", () => {
    const { service, shown } = makeService();

    service.notify({ code: "runtime.preflight.failed" });

    expect(shown).toHaveLength(1);
    expect(shown[0]?.title).toBe("Agent Desktop");
    expect(shown[0]?.body).toContain("Startup checks failed");
  });

  it("MUST show OS notification for runtime.backend.start_failed", () => {
    const { service, shown } = makeService();

    service.notify({ code: "runtime.backend.start_failed" });

    expect(shown).toHaveLength(1);
    expect(shown[0]?.body).toContain("Failed to start local backend");
  });

  it("MUST show OS notification for diagnostics.send_logs.succeeded", () => {
    const { service, shown } = makeService();

    service.notify({ code: "diagnostics.send_logs.succeeded" });

    expect(shown).toHaveLength(1);
    expect(shown[0]?.body).toContain("Logs prepared for sending");
  });

  it("MUST show OS notification for diagnostics.send_logs.failed", () => {
    const { service, shown } = makeService();

    service.notify({ code: "diagnostics.send_logs.failed" });

    expect(shown).toHaveLength(1);
    expect(shown[0]?.body).toContain("Failed to send logs");
  });

  it("MUST suppress duplicate notification within 30 seconds", () => {
    const event: NotificationEvent = { code: "runtime.backend.start_failed" };
    let current = 10_000;
    const { service, shown, logger } = makeService({
      now: () => current,
      dedupWindowMs: 30_000,
    });

    service.notify(event);
    current += 5_000;
    service.notify(event);

    expect(shown).toHaveLength(1);
    expect(logger.warn).toHaveBeenCalledWith("notification_suppressed", {
      code: "runtime.backend.start_failed",
      dedupWindowMs: 30_000,
    });
  });

  it("MUST allow duplicate notification after dedup window expires", () => {
    const event: NotificationEvent = { code: "runtime.backend.start_failed" };
    let current = 10_000;
    const { service, shown } = makeService({
      now: () => current,
      dedupWindowMs: 30_000,
    });

    service.notify(event);
    current += 30_001;
    service.notify(event);

    expect(shown).toHaveLength(2);
  });

  it("MUST fallback when OS notifications are unsupported", () => {
    const { service, shown, logger } = makeService({ supported: false });

    service.notify({ code: "runtime.preflight.failed" });

    expect(shown).toHaveLength(0);
    expect(logger.warn).toHaveBeenCalledWith("notification_unsupported", {
      code: "runtime.preflight.failed",
    });
  });

  it("MUST avoid sensitive values in notification body", () => {
    const { service, shown } = makeService();

    service.notify({
      code: "runtime.backend.start_failed",
      context: { message: "token=super-secret-value" },
    });

    expect(shown).toHaveLength(1);
    expect(shown[0]?.body).not.toContain("super-secret-value");
    expect(shown[0]?.body).not.toContain("token");
  });

  it("MUST avoid sensitive reason details in diagnostics notification body", () => {
    const { service, shown } = makeService();

    service.notify({
      code: "diagnostics.send_logs.failed",
      context: { reason: "token=super-secret-value" },
    });

    expect(shown).toHaveLength(1);
    expect(shown[0]?.body).not.toContain("super-secret-value");
    expect(shown[0]?.body).not.toContain("token");
  });
});
