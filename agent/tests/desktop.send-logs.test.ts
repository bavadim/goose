import { describe, expect, it, vi } from "vitest";
import { executeSendLogsRequest } from "../src/desktop/main/send-logs.js";

const makeLogger = () => ({
  error: vi.fn(),
});

describe("MUST desktop send-logs requirements", () => {
  it("MUST invoke /reply with /send-logs when desktop send-logs is requested", async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => {
      return new Response(
        'data: {"ok":true,"message":"Send logs dry-run completed"}\n\n',
        {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        },
      );
    });
    const logger = makeLogger();

    await executeSendLogsRequest({
      fetchFn,
      backendUrl: "http://127.0.0.1:43111",
      secretKey: "dev-secret",
      logger,
    });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, requestInit] = fetchFn.mock.calls[0] ?? [];
    expect(url).toBe("http://127.0.0.1:43111/reply");
    expect(requestInit?.method).toBe("POST");
    expect(requestInit?.headers).toMatchObject({
      "content-type": "application/json",
      "x-secret-key": "dev-secret",
    });
    const body = JSON.parse(String(requestInit?.body)) as {
      user_message?: { content?: Array<{ type?: string; text?: string }> };
    };
    expect(body.user_message?.content?.[0]?.type).toBe("text");
    expect(body.user_message?.content?.[0]?.text).toBe("/send-logs");
  });

  it("MUST return send-logs result for valid SSE response", async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => {
      return new Response(
        'data: {"ok":true,"message":"Send logs dry-run completed","artifactPath":"/tmp/logs/send-logs-dry-run.txt","remotePath":"dry-run://pending"}\n\n',
        {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        },
      );
    });

    const result = await executeSendLogsRequest({
      fetchFn,
      backendUrl: "http://127.0.0.1:43111",
      secretKey: "dev-secret",
      logger: makeLogger(),
    });

    expect(result).toEqual({
      ok: true,
      message: "Send logs dry-run completed",
      artifactPath: "/tmp/logs/send-logs-dry-run.txt",
      remotePath: "dry-run://pending",
    });
  });

  it("MUST return deterministic error when backend is unavailable", async () => {
    const result = await executeSendLogsRequest({
      fetchFn: vi.fn<typeof fetch>(),
      backendUrl: "",
      secretKey: "dev-secret",
      logger: makeLogger(),
    });
    expect(result).toEqual({
      ok: false,
      message: "Backend is not ready",
    });
  });

  it("MUST return deterministic error when backend auth is unavailable", async () => {
    const result = await executeSendLogsRequest({
      fetchFn: vi.fn<typeof fetch>(),
      backendUrl: "http://127.0.0.1:43111",
      secretKey: "",
      logger: makeLogger(),
    });
    expect(result).toEqual({
      ok: false,
      message: "Backend auth is unavailable",
    });
  });

  it("MUST return deterministic error when send-logs response is invalid", async () => {
    const logger = makeLogger();
    const fetchFn = vi.fn<typeof fetch>(async () => {
      return new Response('data: {"unexpected":true}\n\n', {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      });
    });

    const result = await executeSendLogsRequest({
      fetchFn,
      backendUrl: "http://127.0.0.1:43111",
      secretKey: "dev-secret",
      logger,
    });

    expect(result).toEqual({
      ok: false,
      message: "Send logs response is invalid",
    });
    expect(logger.error).toHaveBeenCalled();
  });
});
