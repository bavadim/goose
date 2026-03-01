# DESKTOP DEEPLINK PROTOCOL

Version: 1.0  
Status: Normative  
Language conventions: The key words MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY are to be interpreted as described in RFC 2119.

## 1. Purpose

This document defines the normative desktop deep link protocol for compatibility migration from `../ui/desktop`.

Primary goals:
- preserve user-facing deep link behavior across platforms,
- allow independent internal implementation while keeping protocol-compatible observable behavior,
- guarantee secure handling for external extension installation links.

## 2. Scope

In scope:
- `goose://` URI routes and payload semantics,
- app launch entry points that feed deep link processing,
- window routing and deferred dispatch behavior,
- renderer event dispatch contract from deep link processing,
- validation/security rules,
- deterministic deep link error model,
- compatibility gap matrix.

Out of scope:
- implementation details of extension install UI internals,
- non-deeplink IPC contracts outside required dispatch events,
- general shell/open-external policy not required by deep links.

## 3. Protocol Surfaces

### 3.1 URI scheme

- Scheme: `goose://`
- Supported route hosts (normative):
  - `extension`
  - `sessions`
  - `recipe`
  - `bot`

### 3.2 Entry points

Deep links MAY enter runtime from any of the following platform paths:

1. Windows/Linux startup args (`process.argv`).
2. Windows/Linux single-instance relay (`second-instance` command line).
3. macOS `open-url` event.
4. macOS `open-file` / `open-files` (filesystem launch path that may carry recipe context).

Implementations MUST normalize all entry points into one deterministic routing pipeline.

## 4. Canonical Route Schemas

## 4.1 `goose://extension`

Purpose: propose installation of an external extension.

Supported query params:
- Required:
  - `name: string` (non-empty)
- Transport selector:
  - `cmd: string` for `stdio` flow, or
  - `url: string` for `streamable_http` flow
- Optional:
  - `arg: string[]` (repeatable)
  - `env: string[]` (repeatable `KEY=...`, value MUST NOT be auto-filled)
  - `header: string[]` (repeatable `KEY=VALUE`, only for `streamable_http`)
  - `description: string`
  - `timeout: integer`
  - `installation_notes: string`

Transport rules:
- `stdio` transport requires `cmd`.
- `streamable_http` transport requires `url`.
- If both are provided, implementation MUST pick one deterministically and document precedence.

## 4.2 `goose://sessions/{shareToken}`

Purpose: open shared session view.

Path:
- `shareToken: string` (non-empty after trim)

Validation:
- URI MUST start with `goose://sessions/`.
- Missing/empty token MUST be rejected deterministically.

## 4.3 `goose://recipe?...` and `goose://bot?...`

Purpose: open recipe/bot execution in a chat window.

Supported query params:
- `config: string` (required for recipe payload decode)
- `scheduledJob: string` (optional scheduling context)
- any additional query keys become `parameters: Record<string,string>` except:
  - `config`
  - `scheduledJob`

Parsing rules:
- `config` MUST preserve `+` characters (no destructive `URLSearchParams` conversion).
- URL decode failures MUST return deterministic parse failure.
- per-parameter decode failures MUST fallback to raw value for that key.

## 5. External Extension Trust and Security Model (Normative)

## 5.1 Baseline command validation for `stdio`

Allowed command set MUST include only explicitly approved commands. Legacy-compatible baseline set:
- `cu`
- `docker`
- `jbang`
- `npx`
- `uvx`
- `goosed`
- `npx.cmd`
- `i-ching-mcp-server`

If `cmd` is outside allowlist, installation MUST be blocked.

## 5.2 Argument-level security constraints

- For `cmd=npx`, argument `-c` MUST be treated as security risk and blocked.

## 5.3 Runtime allowlist gate

Implementations MUST enforce a trust gate before install attempt:
- `allowed`: command/source is allowlisted.
- `warning`: command/source not allowlisted but policy permits explicit user override.
- `blocked`: policy forbids install.

The gate MAY depend on remotely fetched allowlist policy (for example `GOOSE_ALLOWLIST`), but outcome classes MUST remain deterministic.

## 5.4 Deterministic extension outcomes

For `goose://extension`, runtime MUST produce one of:
- `EXTENSION_ALLOWED`
- `EXTENSION_UNTRUSTED_CONFIRM_REQUIRED`
- `EXTENSION_BLOCKED`
- `EXTENSION_INVALID_PAYLOAD`

Implementations MAY vary in UI (modal/toast/navigation) but MUST preserve outcome semantics.

## 6. Launch Routing and Window Lifecycle Semantics

## 6.1 `extension` and `sessions`

- If a window is already available and renderer is ready, deep link MUST dispatch to that window.
- If renderer is not ready, deep link MUST be buffered and delivered after readiness signal (`react-ready` equivalent).
- Required dispatch events:
  - `add-extension` for `extension`
  - `open-shared-session` for `sessions`

## 6.2 `recipe` and `bot`

- These routes MUST open (or create) chat context with decoded recipe config and parameters.
- Behavior MUST be deterministic for startup and second-instance entry points.
- `scheduledJob` MUST be propagated when provided.

## 6.3 Single-instance behavior

- On Windows/Linux, second-instance deep link MUST route into running instance.
- For `recipe`/`bot`, runtime MAY create a new chat window directly.
- For `extension`/`sessions`, runtime SHOULD focus existing window and dispatch route event.

## 6.4 macOS `open-url` behavior

- `recipe`/`bot`: create new chat window path is allowed.
- `extension`/`sessions`: MAY defer delivery until renderer-ready.

## 7. Main -> Renderer Dispatch Contract

Required deep-link-related renderer events:
- `add-extension` with raw deeplink URL payload.
- `open-shared-session` with raw deeplink URL payload.
- `set-initial-message` for launcher/query flow interactions.

Events MUST be deterministic and idempotent enough to avoid duplicate installs/navigations on repeated delivery.

## 8. Error Taxonomy (Normative)

Deterministic protocol-level error codes:
- `DEEPLINK_INVALID_SCHEME`
- `DEEPLINK_UNSUPPORTED_ROUTE`
- `DEEPLINK_INVALID_PAYLOAD`
- `DEEPLINK_PARSE_FAILED`
- `DEEPLINK_SECURITY_BLOCKED`
- `DEEPLINK_DISPATCH_FAILED`

Error handling requirements:
- MUST avoid crash on malformed URL input.
- MUST return/log deterministic error classification.
- MUST NOT leak secrets/tokens in error payloads.

## 9. Validation Rules

- Route host MUST be one of supported hosts.
- Required fields MUST be non-empty strings.
- URL fields MUST parse with `new URL(...)` when protocol demands external URI.
- Decoding logic MUST preserve semantics for `+` in encoded recipe payload.
- Unknown query fields MAY be ignored unless route defines `parameters` passthrough.

## 10. Compatibility and Extension Evolution

- Internal implementation MAY differ from original desktop architecture.
- Observable protocol semantics and route outcomes MUST remain compatible.
- Future route additions SHOULD follow additive policy and keep existing route behavior stable.

## 11. Gap Matrix (Original vs Required vs Current)

Status model:
- `implemented`
- `partial`
- `missing`
- `incompatible`

| Behavior area | Original source | Required behavior | Current status |
|---|---|---|---|
| Protocol client registration (`goose://`) | `../ui/desktop/src/main.ts` | MUST support scheme entry | missing |
| Windows/Linux startup arg deep link entry | `main.ts` startup argv path | MUST route deterministically | missing |
| Windows/Linux second-instance relay | `main.ts` `second-instance` | MUST relay and dispatch | missing |
| macOS `open-url` routing | `main.ts` open-url handler | MUST route per host semantics | missing |
| macOS `open-file/open-files` path integration | `main.ts` file open handlers | SHOULD integrate with recipe context | missing |
| `extension` route parsing and transport model | `components/settings/extensions/deeplink.ts` | MUST support `stdio` + `streamable_http` | missing |
| Extension trust gate (allow/warn/block) | `ExtensionInstallModal.tsx`, `main.ts` allowlist fetch | MUST enforce deterministic gate | missing |
| `sessions` token route behavior | `sessionLinks.ts`, main dispatch | MUST validate token and dispatch | missing |
| `recipe`/`bot` config+params parsing | `main.ts::parseRecipeDeeplink` | MUST preserve `+`, decode params, propagate scheduledJob | missing |
| Deferred dispatch until renderer-ready | `main.ts` + `react-ready` handler | MUST buffer and flush pending deep links | missing |
| Renderer events `add-extension`/`open-shared-session` | `main.ts` and renderer consumers | MUST dispatch with raw deeplink payload | missing |

## 12. Conformance Checklist

A desktop implementation is conformant to this RFC only if all checks pass:

1. All supported route hosts from Section 3 are recognized.
2. All entry points from Section 3.2 are handled deterministically.
3. `extension` route supports both `stdio` and `streamable_http` payloads.
4. External extension trust gate emits deterministic `allowed/warning/blocked` outcomes.
5. `sessions` route validates and forwards share token path correctly.
6. `recipe`/`bot` parsing preserves encoded config semantics and query parameter extraction.
7. Deferred delivery after renderer readiness exists for non-immediate dispatch paths.
8. Required renderer dispatch events are emitted with expected payload shape.
9. Error handling follows taxonomy in Section 8 and does not crash runtime.

## 13. Source References

Original desktop behavior:
- `../ui/desktop/src/main.ts`
- `../ui/desktop/src/components/settings/extensions/deeplink.ts`
- `../ui/desktop/src/components/ExtensionInstallModal.tsx`
- `../ui/desktop/src/sessionLinks.ts`
- `../ui/desktop/src/recipe/index.ts`
- `../ui/desktop/src/utils/urlSecurity.ts`

Current implementation baseline:
- `src/desktop/main/index.ts`
- `src/desktop/preload/index.ts`
- `src/desktop/shared/api.ts`
- `docs/requirements/DESKTOP_IPC_CONTRACT.md`
