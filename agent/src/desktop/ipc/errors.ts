import type {
  ProtocolError,
  ProtocolErrorCode,
} from "../../core/protocol/index.js";

const DEFAULT_IPC_ERROR_CODE: ProtocolErrorCode = "IPC_INTERNAL";

const isIpcErrorCode = (value: unknown): value is ProtocolErrorCode => {
  return (
    value === "IPC_INVALID_INPUT" ||
    value === "IPC_UNAUTHORIZED" ||
    value === "IPC_UNSUPPORTED_PLATFORM" ||
    value === "IPC_NOT_FOUND" ||
    value === "IPC_IO_ERROR" ||
    value === "IPC_INTERNAL"
  );
};

export const normalizeIpcError = (
  error: unknown,
  fallbackMessage: string,
): ProtocolError => {
  if (error && typeof error === "object") {
    const candidate = error as {
      code?: unknown;
      message?: unknown;
      details?: unknown;
      retryable?: unknown;
      cause?: unknown;
    };

    if (
      isIpcErrorCode(candidate.code) &&
      typeof candidate.message === "string"
    ) {
      const normalized: ProtocolError = {
        code: candidate.code,
        message: candidate.message,
      };
      if (candidate.details && typeof candidate.details === "object") {
        normalized.details = candidate.details as Record<string, unknown>;
      }
      if (typeof candidate.retryable === "boolean") {
        normalized.retryable = candidate.retryable;
      }
      return normalized;
    }

    if (candidate.cause && typeof candidate.cause === "object") {
      return normalizeIpcError(candidate.cause, fallbackMessage);
    }

    if (typeof candidate.message === "string" && candidate.message.length > 0) {
      return {
        code: DEFAULT_IPC_ERROR_CODE,
        message: candidate.message,
      };
    }
  }

  if (error instanceof Error && error.message.length > 0) {
    return {
      code: DEFAULT_IPC_ERROR_CODE,
      message: error.message,
    };
  }

  return {
    code: DEFAULT_IPC_ERROR_CODE,
    message: fallbackMessage,
  };
};
