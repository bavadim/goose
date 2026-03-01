export type {
  DesktopApi,
  DesktopState,
  SendLogsResult,
} from "./contracts.js";
export { MainEventBus } from "./event-bus.js";
export { DesktopServerMessageBridge } from "./message-bridge.js";
export { registerDesktopIpc } from "./main-transport.js";
export {
  createDesktopApi,
  IPC_MESSAGE_EVENT_CHANNEL,
} from "./preload-transport.js";
