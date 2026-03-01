import type {
  components,
  operations,
} from "../../shared/http/openapi.generated.js";

type StartAgentRequest =
  operations["start_agent"]["requestBody"]["content"]["application/json"];
type StartAgentResponse =
  operations["start_agent"]["responses"][200]["content"]["application/json"];
type ChatRequest =
  operations["reply"]["requestBody"]["content"]["application/json"];
type Message = components["schemas"]["Message"];

const createUserMessage = (text: string): Message => ({
  role: "user",
  created: Date.now(),
  metadata: {
    agentVisible: true,
    userVisible: true,
  },
  content: [{ type: "text", text }],
});

type DesktopServerClientOptions = {
  baseUrl: () => string;
  secretKey: () => string;
  workingDir: () => string;
  fetchFn?: typeof fetch;
};

export class DesktopServerClient {
  private readonly fetchFn: typeof fetch;

  constructor(private readonly options: DesktopServerClientOptions) {
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async startSession(initialUserMessage?: string): Promise<string> {
    const baseUrl = this.options.baseUrl();
    const secretKey = this.options.secretKey();
    if (!baseUrl || !secretKey) {
      throw new Error("Backend is not ready");
    }

    const request: StartAgentRequest = {
      working_dir: this.options.workingDir(),
    };

    const startResponse = await this.fetchFn(`${baseUrl}/agent/start`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-secret-key": secretKey,
      },
      body: JSON.stringify(request),
    });
    if (!startResponse.ok) {
      throw new Error(`Failed to start session: ${startResponse.status}`);
    }
    const session = (await startResponse.json()) as StartAgentResponse;
    const sessionId = session.id;
    if (!sessionId) {
      throw new Error("Server returned session without id");
    }

    if (initialUserMessage && initialUserMessage.trim().length > 0) {
      const replyBody: ChatRequest = {
        session_id: sessionId,
        user_message: createUserMessage(initialUserMessage),
      };
      const replyResponse = await this.fetchFn(`${baseUrl}/reply`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "text/event-stream",
          "x-secret-key": secretKey,
        },
        body: JSON.stringify(replyBody),
      });
      if (!replyResponse.ok) {
        throw new Error(
          `Failed to send initial message: ${replyResponse.status}`,
        );
      }
      await replyResponse.text();
    }

    return sessionId;
  }
}
