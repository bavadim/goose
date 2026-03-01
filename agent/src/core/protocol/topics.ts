export type ClientToServerTopic =
  | "desktop.chat-window.create"
  | "desktop.logs.send"
  | "runtime.ping"
  | (string & {});

export type ServerToClientTopic = "event.forward" | "runtime.ack";
