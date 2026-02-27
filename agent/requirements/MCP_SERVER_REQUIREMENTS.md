# MCP Server Compatibility Requirements for Goose

Version: 1.0
Status: Normative
Language conventions: The key words MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY are to be interpreted as described in RFC 2119.

## 1. Purpose

This document defines what an external MCP server must support to interoperate with Goose extension runtime (CLI/Desktop usage through Goose core).

## 2. Scope

In scope:
- External MCP servers connected to Goose as extensions.
- `stdio` and `streamable_http` transport interoperability.
- MCP lifecycle, capabilities, tools/resources/prompts behavior.

Out of scope:
- Goose `platform` tools.
- Goose internal provider formatting and model-specific behavior.

## 3. Mandatory Lifecycle Compliance

A Goose-compatible MCP server MUST implement lifecycle semantics from MCP 2025-06-18:
1. Accept `initialize` request.
2. Return protocol version, server info, and capabilities.
3. Accept `notifications/initialized`.
4. Process subsequent protocol methods according to declared capabilities.

References:
- https://modelcontextprotocol.io/specification/2025-06-18/basic/lifecycle

## 4. Transport Requirements

## 4.1 Supported by Goose

To interoperate with Goose, server transport MUST be one of:
- `stdio`
- `Streamable HTTP`

Legacy standalone SSE transport MUST NOT be relied on for Goose compatibility.

## 4.2 STDIO Server Requirements

A stdio MCP server MUST:
1. Read JSON-RPC requests from stdin.
2. Write JSON-RPC responses/notifications to stdout.
3. Avoid non-protocol output on stdout (logs SHOULD go to stderr).
4. Keep message framing parseable by clients throughout session lifetime.

Rationale: Goose stdio client expects stdout to be protocol stream and treats malformed frames as transport/protocol failure.

## 4.3 Streamable HTTP Server Requirements

A Streamable HTTP MCP server MUST:
1. Implement transport behavior compatible with MCP Streamable HTTP.
2. Preserve lifecycle and capability semantics over HTTP transport.
3. Return parseable protocol errors for auth/validation failures.
4. Keep streaming/event framing standards-compliant where used.

References:
- https://modelcontextprotocol.io/specification/2025-06-18/basic/transports

## 5. Capability and Primitive Requirements

## 5.1 Tools

For tool-enabled use cases with Goose, server MUST:
- implement `tools/list`,
- implement `tools/call`,
- keep tool names stable across process lifetime,
- provide valid, parseable parameter schemas.

Server SHOULD:
- provide deterministic error payloads from tool calls,
- avoid schema changes without versioning.

## 5.2 Resources

If server advertises `resources` capability, it MUST:
- implement `resources/list`,
- implement `resources/read`,
- ensure listed resources are actually readable,
- return consistent content typing.

## 5.3 Prompts

If server advertises `prompts` capability, it MUST:
- implement `prompts/list`,
- implement `prompts/get`.

## 6. Type and Schema Compatibility Requirements

A Goose-compatible server MUST produce JSON payloads that are strict-client safe:
1. Do not emit invalid JSON.
2. Do not change field types within the same event family.
3. Use stable object/array/string typing for repeated fields.
4. Ensure tool parameter schema objects are valid JSON schema-like structures accepted by MCP clients.

Server SHOULD:
- avoid ambiguous numeric typing (for example, switching integer fields to scientific-notation float in semantically integral fields).
- avoid undocumented event variants unless extension clients are prepared to ignore them safely.

## 7. Error Semantics

Server MUST:
1. Return protocol-level errors in parseable JSON-RPC/MCP format.
2. Differentiate transport failures vs method failures where possible.
3. Include stable machine-readable error codes when available.

Server SHOULD:
- provide human-readable error messages that explain the invalid parameter or missing capability.

## 8. Security and Auth Compatibility

For Streamable HTTP servers used by Goose:
- Auth mechanisms MAY be header-based.
- Servers SHOULD support bearer/API-key style headers when deployment requires it.
- Servers SHOULD return explicit unauthorized/forbidden errors for invalid credentials.

For stdio servers:
- Servers MUST treat environment-provided secrets as runtime config and MUST NOT print secrets to stdout/stderr.

## 9. Goose-Specific Interop Notes

## 9.1 Extension Config Expectations from Goose

When Goose connects external MCP servers:
- stdio config is command-based (`cmd`, `args`, env handling).
- streamable config uses `uri` in Goose config (not `url`).

Server authors SHOULD document launch commands and required env variables in a way that maps cleanly to Goose extension config UX.

## 9.2 Resource and UI Payloads

If server returns resource content intended for Goose Desktop rendering:
- payloads SHOULD remain standards-compliant and bounded in size.
- server SHOULD provide explicit MIME types when available.

## 10. Conformance Profiles

## 10.1 Minimum Profile (Tool-first)
- lifecycle compliance,
- one supported transport (`stdio` or `streamable_http`),
- `tools/list` + `tools/call`.

## 10.2 Extended Profile
Minimum profile plus:
- `resources/list` + `resources/read`.

## 10.3 Full Profile
Extended profile plus:
- `prompts/list` + `prompts/get`.

## 11. Validation Checklist for MCP Server Authors

Before claiming Goose compatibility, verify:
1. Server starts cleanly in chosen transport.
2. `initialize`/`initialized` flow succeeds.
3. `tools/list` returns stable and parseable schemas.
4. `tools/call` handles valid/invalid arguments deterministically.
5. If resources are declared, `list` and `read` are both implemented and consistent.
6. No protocol-breaking logs appear on stdout in stdio mode.
7. Streamable HTTP responses and streamed events are parseable by strict clients.

## 12. References

MCP specification:
- https://modelcontextprotocol.io/specification/2025-06-18/basic/index
- https://modelcontextprotocol.io/specification/2025-06-18/basic/lifecycle
- https://modelcontextprotocol.io/specification/2025-06-18/basic/transports
- https://modelcontextprotocol.io/specification/2025-06-18/server/tools
- https://modelcontextprotocol.io/specification/2025-06-18/server/resources
- https://modelcontextprotocol.io/specification/2025-06-18/server/prompts

Goose runtime anchors:
- `crates/goose/src/agents/extension.rs`
- `crates/goose/src/agents/extension_manager.rs`
- `crates/goose/src/agents/mcp_client.rs`
- `crates/goose/src/agents/validate_extensions.rs`
