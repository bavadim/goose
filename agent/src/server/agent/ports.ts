export type ProviderRequest = {
  sessionId: string;
  input: string;
};

export type ProviderResponse = {
  text: string;
};

export interface ProviderPort {
  health(): Promise<boolean>;
  generate(request: ProviderRequest): Promise<ProviderResponse>;
}

export type ExtensionToolCall = {
  name: string;
  args: Record<string, unknown>;
};

export type ExtensionToolResult = {
  ok: boolean;
  output?: string;
  error?: string;
};

export interface ExtensionPort {
  id: string;
  health(): Promise<boolean>;
  listTools(): Promise<string[]>;
  callTool(call: ExtensionToolCall): Promise<ExtensionToolResult>;
}

export type AgentSession = {
  id: string;
  status:
    | "idle"
    | "running"
    | "waiting_tool"
    | "streaming"
    | "completed"
    | "failed";
  createdAt: string;
  updatedAt: string;
};

export interface SessionPort {
  create(sessionId: string): Promise<AgentSession>;
  get(sessionId: string): Promise<AgentSession | null>;
  update(session: AgentSession): Promise<void>;
}
