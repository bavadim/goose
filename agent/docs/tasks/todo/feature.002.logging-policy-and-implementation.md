---
ID: 2
Title: [CLIENT][svc:existing:logging] Runtime logging on pino without custom logger facade
Complexity: medium
Category: CLIENT
Primary Module: src/shared/pino.ts
Server Impact: server-runtime
---

# [CLIENT][svc:existing:logging] Runtime logging on pino without custom logger facade

## 1. Executive Summary

**Abstract:**  
Runtime logging must use standard `pino` directly in server and desktop modules. The legacy global logger module (`src/logging/index.ts`) is removed. Logging policy is locked in `AGENTS.md`.

**Objectives (SMART):**
- **Specific:** Replace custom logger usage with direct `pino` instances and shared pino options (`LOG_LEVEL`, `LOG_PRETTY`, redaction).
- **Measurable:** No runtime imports from `src/logging/*`; no `console.*` in runtime paths.
- **Achievable:** Pure refactor, no business logic change.
- **Relevant:** Less code, standard tooling, predictable structured logs.
- **Time-bound:** One engineering cycle.

## 2. Context & Problem Statement

### Current State

- Runtime modules logged through custom `createLogger(...)`.
- Policy referenced removed custom module path.

### In Scope

- Direct `pino` in runtime modules.
- Shared typed pino options in `src/shared/pino.ts`.
- Policy update in `AGENTS.md`.

### Out of Scope

- External log shipping.
- Tracing/APM.

## 3. Proposed Technical Solution

1. Remove `src/logging/index.ts`.
2. Add `src/shared/pino.ts` with common options:
   - `LOG_LEVEL` default `info`
   - `LOG_PRETTY=1` pretty transport
   - redaction paths for secrets/tokens/passwords/api keys.
3. Instantiate `pino(buildPinoOptions(component))` in runtime modules.
4. Keep event names and structured payloads (`event` field).
5. Update `AGENTS.md` logging policy.

## 4. Requirements

- `MUST` use `pino` as the only runtime logger.
- `MUST` remove custom runtime logger facade (`src/logging/index.ts`).
- `MUST` support `LOG_LEVEL` and `LOG_PRETTY`.
- `MUST` redact sensitive keys (`secret`, `token`, `authorization`, `x-secret-key`, `password`, `api_key`).
- `MUST` keep runtime logs structured with `component` and `event`.
- `MUST` avoid `console.*` in runtime server/desktop modules.

## 5. Acceptance Criteria

- `MUST` `src/logging/index.ts` is absent.
- `MUST` runtime modules compile with direct `pino` usage.
- `MUST` `AGENTS.md` logging policy references `pino` and current env config.
- `MUST` `npm run test` passes.
