# MCP, Transports, and Extensions in Goose

> Note: Normative compatibility requirements are now defined in:
> - `agent/requirements/GOOSE_CORE_REQUIREMENTS.md`
> - `agent/requirements/MCP_SERVER_REQUIREMENTS.md`
>
> This file remains a conceptual overview/reference.

This guide explains the MCP model, transport behavior, and extension runtime that Goose supports today.

It is written for engineers integrating a new MCP server, debugging extension behavior, or changing Goose core.

## 1. MCP Primer (What matters in practice)

Model Context Protocol (MCP) is a JSON-RPC based protocol between a host/client and MCP servers.

At a minimum, implementations are expected to support:
- Base protocol (JSON-RPC message model)
- Lifecycle (initialize handshake and capability negotiation)

The practical model is:
- Host creates MCP clients.
- Each client holds a stateful session with one server.
- Servers expose primitives (tools/resources/prompts).
- Capabilities negotiated at init define which primitives can be used in that session.

In the 2025-06-18 MCP specification:
- Standard transports are `stdio` and `Streamable HTTP`.
- Streamable HTTP replaced the older HTTP+SSE transport shape from 2024-11-05.

## 2. Core MCP Lifecycle

Lifecycle sequence used by compliant clients/servers:
1. Client sends `initialize` with protocol version, client capabilities, and client info.
2. Server responds with server capabilities and server info.
3. Client sends `notifications/initialized`.
4. Normal operation starts (tools/resources/prompts and notifications).

Important capability examples:
- `tools` capability for tool discovery/invocation.
- `resources` capability for `resources/list` and `resources/read`.
- `prompts` capability for `prompts/list` and `prompts/get`.

## 3. MCP Primitives You Need for Goose

### Tools
- Discovery via `tools/list`.
- Invocation via `tools/call`.
- Tool schemas are JSON-Schema-like input definitions advertised by the server.

### Resources
- Discovery via `resources/list`.
- Fetch via `resources/read`.
- Resources can be file-like data, templates, or typed payloads.

### Prompts
- Discovery via `prompts/list`.
- Fetching resolved prompt payloads via `prompts/get`.
- Typically user-triggered in hosts, but presentation is host-specific.

## 4. Transport Standards vs Goose Runtime Support

### MCP standard (2025-06-18)
- `stdio`: newline-delimited JSON-RPC over subprocess stdin/stdout.
- `Streamable HTTP`: POST/GET transport with optional SSE streaming for server messages.

### Goose support in this repo
- Supported for external MCP servers: `stdio`, `streamable_http`.
- `sse` in config is legacy compatibility only and treated as unsupported at runtime.

Code anchors:
- Extension config variants: `crates/goose/src/agents/extension.rs`
- Unsupported SSE runtime error: `crates/goose/src/agents/extension_manager.rs`
- SSE migration warning in config layer: `crates/goose/src/config/extensions.rs`

## 5. Goose Extension Types

Goose extension configuration is represented by `ExtensionConfig` in `crates/goose/src/agents/extension.rs`.

Current types:
- `builtin`: Goose bundled MCP extensions.
- `platform`: In-process platform extensions with direct agent integration.
- `stdio`: Subprocess MCP server.
- `streamable_http`: Remote MCP server over Streamable HTTP.
- `frontend`: Frontend-provided tool surface (not loaded as a server extension).
- `inline_python`: Python-backed extension launched through Goose runtime path.
- `sse`: legacy/unsupported transport entry kept for config compatibility.

Important runtime detail:
- `frontend` cannot be added as a normal server extension through `ExtensionManager::add_extension`; it is handled via frontend tool request flow.

## 6. How Goose Loads and Uses Extensions

High-level flow:
1. Extension config is stored/enabled in config (desktop/CLI path).
2. Session resolves extension set (recipe overrides, CLI overrides, or enabled defaults).
3. `ExtensionManager` activates each extension:
   - spawn subprocess (`stdio` / some builtin modes),
   - connect remote endpoint (`streamable_http`),
   - initialize MCP client and cache tools/instructions.
4. Agent loop aggregates tools and extension instructions into model context.
5. Tool calls are dispatched by owner extension/tool namespace.

Key files:
- `crates/goose/src/config/extensions.rs`
- `crates/goose/src/agents/extension_manager.rs`
- `crates/goose/src/agents/agent.rs`

## 7. Transport Details Specific to Goose

### `stdio`
- Goose launches command + args.
- Environment is merged and filtered.
- Disallowed env keys are blocked at config model level.

### `streamable_http`
- Goose resolves headers and env substitutions before connection.
- Uses MCP client capability negotiation (including MCP UI capability support flags where applicable).

### `sse` (legacy entry)
- Kept to read older config, but runtime add fails fast with a migration message.

## 8. MCP-UI / MCP Apps in Goose

Goose desktop supports UI resources delivered through MCP-compatible patterns:
- UI resources are rendered in desktop via `@mcp-ui/client`.
- Goose server exposes a UI proxy route used by renderer integration.
- Resource-based UI payloads can be rendered when returned from tool flows/resources.

Relevant implementation:
- Renderer: `ui/desktop/src/components/MCPUIResourceRenderer.tsx`
- Proxy route: `crates/goose-server/src/routes/mcp_ui_proxy.rs`
- Resource handling in extension runtime: `crates/goose/src/agents/extension_manager.rs`

Practical note:
- Host-side handling of UI actions is intentionally constrained. Some action kinds are currently partial/unsupported in renderer logic and are surfaced as host-side errors/notifications.

## 9. Security and Isolation Model

MCP-level expectations (from spec):
- Capability negotiation limits what each side can use.
- Streamable HTTP has explicit origin/auth/local-binding security guidance.

Goose-level controls:
- Extension env filtering and disallowed key checks.
- Deeplink/install validation in desktop extension flow.
- Explicit unsupported transport fail-fast (`sse`).
- Host mediation between model, tools, and extension calls.

## 10. Compatibility Checklist for New MCP Servers

When integrating a new server with Goose, validate:
1. Transport is `stdio` or `streamable_http`.
2. `initialize`/`initialized` lifecycle is compliant.
3. Server capabilities correctly advertise the primitives you actually implement.
4. `tools/list` and `tools/call` payloads are schema-valid.
5. If using resources, `resources/list` and `resources/read` are implemented consistently.
6. If using prompt templates, implement `prompts/list` and `prompts/get`.
7. Avoid relying on deprecated standalone SSE transport behavior.

## 11. Troubleshooting Quick Map

### Extension fails to load immediately
- Check extension type and transport.
- If config type is `sse`, Goose will reject it at runtime.

### Tools not visible to model
- Verify server returns `tools` capability and `tools/list` response.
- Check extension is enabled in resolved session config.

### Resource read/list fails
- Confirm server declared `resources` capability and methods are implemented.
- Confirm Goose extension manager can reach the correct extension instance.

### UI resource not rendering
- Verify resource shape and MIME type expected by host renderer.
- Verify desktop can reach `/mcp-ui-proxy` route.

## 12. Sources (Internet + Repo)

MCP spec/docs:
- https://modelcontextprotocol.io/specification/2025-06-18/basic/index
- https://modelcontextprotocol.io/specification/2025-06-18/basic/lifecycle
- https://modelcontextprotocol.io/specification/2025-06-18/basic/transports
- https://modelcontextprotocol.io/specification/2025-06-18/server/tools
- https://modelcontextprotocol.io/specification/2025-06-18/server/resources
- https://modelcontextprotocol.io/specification/2025-06-18/server/prompts
- https://modelcontextprotocol.io/specification/2025-06-18/architecture

MCP-UI / MCP Apps references:
- https://mcpui.dev
- https://github.com/idosal/mcp-ui

Goose code references:
- `crates/goose/src/agents/extension.rs`
- `crates/goose/src/agents/extension_manager.rs`
- `crates/goose/src/config/extensions.rs`
- `crates/goose/src/agents/agent.rs`
- `ui/desktop/src/components/MCPUIResourceRenderer.tsx`
- `crates/goose-server/src/routes/mcp_ui_proxy.rs`
- `AGENT_ARCHITECTURE.md`
