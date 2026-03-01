import type {
  ProtocolError,
  ProtocolErrorCode,
} from "../../../core/protocol.js";

const DEFAULT_IPC_ERROR_CODE: ProtocolErrorCode = "IPC_INTERNAL";

export const normalizeIpcError = (
  error: unknown,
  fallbackMessage: string,
): ProtocolError => {
  if (error instanceof Error) {
    return {
      code: DEFAULT_IPC_ERROR_CODE,
      message: error.message,
    };
  }

  if (error && typeof error === "object") {
    const candidate = error as {
      code?: unknown;
      message?: unknown;
      cause?: unknown;
    };
    if (
      typeof candidate.code === "string" &&
      typeof candidate.message === "string"
    ) {
      return {
        code: candidate.code as ProtocolErrorCode,
        message: candidate.message,
      };
    }
    if (candidate.cause && typeof candidate.cause === "object") {
      return normalizeIpcError(candidate.cause, fallbackMessage);
    }
    if (typeof candidate.message === "string") {
      return {
        code: DEFAULT_IPC_ERROR_CODE,
        message: candidate.message,
      };
    }
  }

  return {
    code: DEFAULT_IPC_ERROR_CODE,
    message: fallbackMessage,
  };
};
