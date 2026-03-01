import type { SendLogsResult } from "../shared/api.js";

type Logger = {
  error: (event: string, details?: Record<string, unknown>) => void;
};

type ExecuteSendLogsRequestOptions = {
  fetchFn: typeof fetch;
  backendUrl: string;
  secretKey: string;
  logger: Logger;
};

const SEND_LOGS_COMMAND = "/send-logs";

const parseSsePayload = (body: string): SendLogsResult => {
  const line = body
    .split("\n")
    .map((part) => part.trim())
    .find((part) => part.startsWith("data: "));
  if (!line) {
    throw new Error("Send logs response is missing SSE data frame");
  }
  const raw = line.slice("data: ".length);
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const ok = parsed.ok;
  const message = parsed.message;
  if (typeof ok !== "boolean" || typeof message !== "string") {
    throw new Error("Send logs response payload is invalid");
  }
  const artifactPath =
    typeof parsed.artifactPath === "string" ? parsed.artifactPath : undefined;
  const remotePath =
    typeof parsed.remotePath === "string" ? parsed.remotePath : undefined;
  return {
    ok,
    message,
    ...(artifactPath ? { artifactPath } : {}),
    ...(remotePath ? { remotePath } : {}),
  };
};

export const executeSendLogsRequest = async ({
  fetchFn,
  backendUrl,
  secretKey,
  logger,
}: ExecuteSendLogsRequestOptions): Promise<SendLogsResult> => {
  if (!backendUrl) {
    return { ok: false, message: "Backend is not ready" };
  }
  if (!secretKey) {
    return { ok: false, message: "Backend auth is unavailable" };
  }

  let response: Response;
  try {
    response = await fetchFn(`${backendUrl}/reply`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-secret-key": secretKey,
      },
      body: JSON.stringify({
        session_id: "desktop-send-logs",
        user_message: {
          role: "user",
          created: new Date().toISOString(),
          content: [{ type: "text", text: SEND_LOGS_COMMAND }],
        },
      }),
    });
  } catch (error: unknown) {
    logger.error("send_logs_request_failed", {
      error:
        error instanceof Error
          ? { name: error.name, message: error.message }
          : { message: String(error) },
    });
    return { ok: false, message: "Send logs request failed" };
  }

  if (!response.ok) {
    return {
      ok: false,
      message: `Send logs request failed (${response.status})`,
    };
  }

  let body = "";
  try {
    body = await response.text();
    return parseSsePayload(body);
  } catch (error: unknown) {
    logger.error("send_logs_response_invalid", {
      responseBody: body,
      error:
        error instanceof Error
          ? { name: error.name, message: error.message }
          : { message: String(error) },
    });
    return { ok: false, message: "Send logs response is invalid" };
  }
};
