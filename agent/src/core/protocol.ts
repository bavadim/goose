type MessageEnvelope<TTopic extends string, TPayload> = {
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

type ClientToServerTopic =
  | "desktop.chat-window.create"
  | "desktop.logs.send"
  | "runtime.ping"
  | (string & {});

type ClientToServerPayloadByTopic = {
  "desktop.chat-window.create": { query?: string };
  "desktop.logs.send": { reason?: string };
  "runtime.ping": { requestId?: string };
};

type ForwardedServerEvent = {
  event: string;
  payload?: unknown;
};

type ServerToClientPayloadByTopic = {
  "runtime.ack": { requestId?: string; message?: string };
  "event.forward": ForwardedServerEvent;
};

type KnownClientToServerTopic = keyof ClientToServerPayloadByTopic;
type KnownServerToClientTopic = keyof ServerToClientPayloadByTopic;

export type KnownClientToServerMessage = {
  [T in KnownClientToServerTopic]: MessageEnvelope<
    T,
    ClientToServerPayloadByTopic[T]
  >;
}[KnownClientToServerTopic];

export type KnownServerToClientMessage = {
  [T in KnownServerToClientTopic]: MessageEnvelope<
    T,
    ServerToClientPayloadByTopic[T]
  >;
}[KnownServerToClientTopic];

export type GenericClientToServerMessage = MessageEnvelope<
  Exclude<ClientToServerTopic, KnownClientToServerTopic>,
  Record<string, unknown>
>;

export type ClientToServerMessage =
  | KnownClientToServerMessage
  | GenericClientToServerMessage;
export type ServerToClientMessage = KnownServerToClientMessage;
