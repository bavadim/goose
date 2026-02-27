# Goose Core Compatibility Requirements (MCP Scope)

Version: 1.0
Status: Normative
Language conventions: The key words MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY are to be interpreted as described in RFC 2119.

## 1. Purpose

This document defines the minimum requirements for a Goose-compatible core/server implementation so Goose clients (Desktop and CLI) can use MCP features reliably.

This is a compatibility document, not an implementation guide.

## 2. Scope

In scope:
- MCP extension lifecycle in Goose.
- Builtin and external MCP extension compatibility.
- Transport requirements for `stdio` and `streamable_http`.
- Goose desktop deep link and extension install flow requirements.
- Goose server API requirements required by MCP-related client flows.

Out of scope:
- `platform` tools semantics.
- Non-MCP system tools and policies.

## 3. Normative Baseline

A compatible core MUST implement MCP integration consistent with the MCP 2025-06-18 protocol baseline:
- lifecycle (`initialize`, `notifications/initialized`),
- capability-driven behavior,
- server primitives (tools/resources/prompts) where declared.

References:
- https://modelcontextprotocol.io/specification/2025-06-18/basic/lifecycle
- https://modelcontextprotocol.io/specification/2025-06-18/basic/transports

## 4. Client/Core Connectivity Requirements

### 4.1 Auth

A Goose-compatible HTTP server MUST enforce a shared secret header on protected endpoints:
- Header: `X-Secret-Key`
- Unauthorized requests MUST return `401 Unauthorized`.

The following routes MUST remain unauthenticated for stock Desktop behavior:
- `/status`
- `/mcp-ui-proxy`
- `/mcp-app-proxy` (if implemented)

Source anchor:
- `crates/goose-server/src/auth.rs`

### 4.2 Readiness

The server MUST expose `GET /status` and return `200` with a simple success payload so Desktop can verify backend startup.

Source anchors:
- `crates/goose-server/src/routes/status.rs`
- `ui/desktop/src/goosed.ts`

## 5. MCP Transport Support Matrix

A compatible core MUST support:
- `stdio` extensions.
- `streamable_http` extensions.

A compatible core MUST NOT activate `sse` extensions at runtime.
- `sse` MAY be accepted in persisted config for backward compatibility.
- Runtime activation MUST fail fast with an explicit migration error.

Source anchors:
- `crates/goose/src/agents/extension.rs`
- `crates/goose/src/agents/extension_manager.rs`
- `crates/goose/src/config/extensions.rs`

## 6. Extension Configuration Contract

Core implementations MUST accept the Goose extension config model (`ExtensionConfig`) with these relevant types in MCP scope:
- `builtin`
- `stdio`
- `streamable_http`
- `frontend`
- `inline_python`
- `sse` (legacy config only, runtime unsupported)

Notes:
- `platform` is explicitly out of scope for this document.
- `frontend` is in scope only where it impacts MCP-facing client behavior.

Source anchor:
- `crates/goose/src/agents/extension.rs`

## 7. Goose Server API Requirements (Endpoint-Level)

The following endpoints are REQUIRED for Desktop MCP-related interoperability.

## 7.1 Extension Persistence API

### `GET /config/extensions`
MUST return persisted extension entries and migration warnings.

### `POST /config/extensions`
MUST create or update a persisted extension config entry.
Request MUST include:
- `name`
- `enabled`
- `config` (`ExtensionConfig`)

### `DELETE /config/extensions/{name}`
MUST remove persisted extension by normalized key/name.

Source anchor:
- `crates/goose-server/src/routes/config_management.rs`

## 7.2 Agent Lifecycle and MCP Runtime API

### `POST /agent/start`
MUST initialize a session-scoped agent and apply resolved extensions.
Request MUST support:
- `working_dir`
- optional recipe sources (`recipe`, `recipe_id`, `recipe_deeplink`)
- optional `extension_overrides`

### `POST /agent/resume`
MUST resume an existing session agent.
Request MUST support:
- `session_id`
- `load_model_and_extensions`

### `POST /agent/restart`
MUST recreate runtime state and reload extensions for session.

### `POST /agent/stop`
MUST stop/remove session agent runtime.

### `POST /agent/update_working_dir`
MUST validate path, update session working directory, and restart agent.

Source anchor:
- `crates/goose-server/src/routes/agent.rs`

## 7.3 MCP Tool and Resource Surface

### `GET /agent/tools`
MUST return tool inventory for a session, optionally filtered by extension.

### `POST /agent/add_extension`
MUST activate extension in running session.

### `POST /agent/remove_extension`
MUST deactivate extension in running session.

### `POST /agent/read_resource`
MUST read an MCP resource from a session extension and return normalized payload.

### `POST /agent/call_tool`
MUST dispatch tool invocation to extension runtime and return MCP-compatible tool result content.

Source anchor:
- `crates/goose-server/src/routes/agent.rs`

## 7.4 Reply Streaming API

### `POST /reply`
MUST provide SSE response (`Content-Type: text/event-stream`) for conversational turns.
Server MUST emit `data: <json>\n\n` frames.

This endpoint is REQUIRED because MCP tool calls are exercised through the agent turn loop, not only via direct `/agent/call_tool`.

Source anchor:
- `crates/goose-server/src/routes/reply.rs`

## 7.5 MCP UI Proxy API

### `GET /mcp-ui-proxy?secret=<secret>`
MUST return proxy HTML only when query secret matches runtime secret.
MUST return `401` when secret is missing/invalid.

Source anchor:
- `crates/goose-server/src/routes/mcp_ui_proxy.rs`

## 8. Transport-Specific Core Requirements

## 8.1 STDIO Requirements

For `stdio` extension activation, core MUST:
1. Spawn configured command and args.
2. Attach MCP client transport to process stdio.
3. Apply environment merge from `envs` + `env_keys` secrets.
4. Enforce disallowed env-key policy.
5. Enforce timeout/failure propagation.

If running in containerized mode, core SHOULD support equivalent behavior through container exec transport.

Source anchors:
- `crates/goose/src/agents/extension_manager.rs`
- `crates/goose/src/agents/extension.rs`

## 8.2 Streamable HTTP Requirements

For `streamable_http` extension activation, core MUST:
1. Require `uri` (not `url`) in extension config.
2. Merge envs and resolve header variable substitution.
3. Initialize MCP client over Streamable HTTP transport.
4. Surface auth/transport initialization failures as actionable extension-load errors.

Source anchors:
- `crates/goose/src/agents/extension_manager.rs`
- `crates/goose/src/agents/validate_extensions.rs`

## 9. Deep Link Requirements (Desktop Integration)

A Goose-compatible desktop integration MUST support extension deep links under `goose://`.

For extension install links:
- `name` MUST be present.
- Exactly one transport source SHOULD be provided:
  - `cmd` (+ `arg` params) for `stdio`, or
  - `url` for `streamable_http`.
- Optional fields MAY include `description`, `timeout`, `header`, `env`, `installation_notes`.

Security requirements:
- Desktop MUST enforce allowlist/trust policy before install.
- For `stdio`, command MUST be validated against allowed command policy.
- `npx -c` MUST be blocked.

Activation requirement:
- Deep link install MUST persist extension config.
- If env/header secrets are unresolved, Desktop MUST route user to extension settings flow before activation.

Source anchors:
- `ui/desktop/src/components/settings/extensions/deeplink.ts`
- `ui/desktop/src/components/ExtensionInstallModal.tsx`
- `ui/desktop/src/main.ts`

## 10. Builtin and External MCP Compatibility Requirements

Core MUST treat both builtin and external MCP servers as MCP clients behind a unified extension runtime interface.

Core MUST provide the same capability-driven dispatch model for both classes:
- tool discovery,
- tool calls,
- resources read/list (when supported by server capabilities).

Builtin delivery mechanism (in-process duplex vs subprocess/container) MAY differ, but behavior visible to client and agent loop MUST remain consistent.

Source anchor:
- `crates/goose/src/agents/extension_manager.rs`

## 11. Conformance Checklist (Core)

A Goose-compatible core implementation is conformant only if all checks pass:
1. Protected endpoints enforce `X-Secret-Key` (`401` on mismatch).
2. `/status` is reachable unauthenticated and used for readiness.
3. `/reply` emits valid SSE frames.
4. `/config/extensions` CRUD works with Goose `ExtensionConfig`.
5. Runtime extension activation supports `stdio` and `streamable_http`.
6. `sse` extension activation fails fast with migration guidance.
7. `/agent/tools`, `/agent/call_tool`, `/agent/read_resource` are functional.
8. Deep link ingestion enforces scheme, required fields, and security restrictions.
9. `/mcp-ui-proxy` enforces secret query requirement.

## 12. References

Protocol:
- https://modelcontextprotocol.io/specification/2025-06-18/basic/lifecycle
- https://modelcontextprotocol.io/specification/2025-06-18/basic/transports

Goose code:
- `crates/goose/src/agents/extension.rs`
- `crates/goose/src/agents/extension_manager.rs`
- `crates/goose/src/config/extensions.rs`
- `crates/goose-server/src/routes/agent.rs`
- `crates/goose-server/src/routes/config_management.rs`
- `crates/goose-server/src/routes/reply.rs`
- `crates/goose-server/src/routes/mcp_ui_proxy.rs`
- `crates/goose-server/src/auth.rs`
- `ui/desktop/src/components/settings/extensions/deeplink.ts`
- `ui/desktop/src/components/ExtensionInstallModal.tsx`
- `ui/desktop/src/goosed.ts`
- `ui/desktop/src/main.ts`
