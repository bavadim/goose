import type { components } from "../../shared/http/openapi.generated.js";

type RuntimeErrorCode =
  | "SESSION_NOT_FOUND"
  | "SESSION_NOT_ACTIVE"
  | "INVALID_EXTENSION_CONFIG"
  | "UNSUPPORTED_EXTENSION_TYPE"
  | "PROVIDER_NOT_CONFIGURED"
  | "TOOL_NOT_FOUND"
  | "RUNTIME_INTERNAL";

export type RuntimeError = {
  code: RuntimeErrorCode;
  message: string;
};

export type RuntimeResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: RuntimeError };

export type SessionStatus = "idle" | "running" | "stopped" | "failed";

export type ProviderState = {
  provider: string;
  model: string;
  contextLimit: number;
};

export type MoimContext = {
  enabled: boolean;
  note: string;
};

export type RuntimeSession = {
  id: string;
  status: SessionStatus;
  workingDir: string;
  createdAt: string;
  updatedAt: string;
  skillsInstructions: string;
  moim: MoimContext;
  provider: ProviderState;
  activeExtensions: string[];
  conversation: components["schemas"]["Message"][];
};

export type RuntimeToolCall = {
  id: string;
  name: string;
  args: Record<string, unknown>;
};

export type ProviderTurn = {
  assistantText: string;
  toolCalls: RuntimeToolCall[];
};

export type ExtensionConfig = components["schemas"]["ExtensionConfig"];
export type MessageEvent = components["schemas"]["MessageEvent"];

export type ExtensionStoredEntry = {
  type: "ExtensionEntry";
  name: string;
  enabled: boolean;
  config: ExtensionConfig;
};
