export type MessageEnvelope<TTopic extends string, TPayload> = {
  id: string;
  topic: TTopic;
  sentAt: string;
  payload?: TPayload;
};

export type ProtocolErrorCode =
  | "IPC_INVALID_INPUT"
  | "IPC_UNAUTHORIZED"
  | "IPC_UNSUPPORTED_PLATFORM"
  | "IPC_NOT_FOUND"
  | "IPC_IO_ERROR"
  | "IPC_INTERNAL";

export type ProtocolError = {
  code: ProtocolErrorCode;
  message: string;
  details?: Record<string, unknown>;
  retryable?: boolean;
};

export type ProtocolResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ProtocolError };
