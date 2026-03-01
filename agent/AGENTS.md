# Repository Guidelines

## Purpose
This folder contains an alternative implementation of `goose-server`.
The goal is requirement-level compatibility with a shorter, clearer, and easier-to-maintain codebase.

## Source of Truth
- `requirements/`: normative behavior and compatibility requirements.
- `ARCHITECTURE.md`: implementation and flow reference for planning.
- Reference behavior source: `goose-server`.

## Testing Policy
### Core Expectations
- Tests are behavioral documentation and MUST be requirement-oriented.
- Every feature/change MUST include happy-path and error-path coverage.
- Bug fixes MUST start with a reproducible failing test.

### Naming Rules
- Every `it(...)` title MUST start with `MUST`, `SHOULD`, or `MAY`.
- Test titles MUST be short, outcome-oriented, and requirement phrased.
- Test titles MUST NOT use implementation-task wording such as:
  - `validate x variable`
  - `check handler`
  - `test function`

### Naming Examples
- Good:
  - `MUST require X-Secret-Key for protected routes`
  - `MUST return 401 when secret is invalid`
  - `MUST satisfy success contract for /agent/start`
- Bad:
  - `validate secret key`
  - `check auth middleware`
  - `test agent route`

### Vitest Suite Structure
- "Testkits" are expressed through `describe(...)` structure, not deep folder hierarchies.
- Top-level `describe(...)` groups MUST be requirement-oriented.
- Test structure SHOULD remain shallow and easy to scan.

### Runtime Contract Tests
- Runtime contract tests against OpenAPI MUST exist.
- Contract tests MUST validate:
  - success status codes,
  - response media type compatibility,
  - JSON parseability for JSON responses,
  - empty body behavior for `204` responses.
- Endpoints that do not fit generic contract loops MAY be covered by targeted manual requirement tests.

### Execution Policy
- `npm run test` MUST be the single canonical test command.
- PR-ready changes MUST pass `npm run test`.

## Development Workflow (TDD)
1. Formalize or update requirements in `docs/requirements/`.
2. Write or update tests first.
3. Implement the minimum code needed to pass tests.
4. Refactor while keeping tests green.
5. Run `npm run test`.

## Coding Principles
- Project stack: `TypeScript`, `fp-ts`, `xstate`.
- Strict typing is mandatory; `any` is not allowed.
- Prefer simple, expressive code and fail-fast behavior over defensive boilerplate.

## Logging Policy
- Runtime logs MUST use `pino` instead of `console.*`.
- Allowed levels: `debug`, `info`, `warn`, `error`.
- `LOG_LEVEL` controls minimum emitted level, default is `info`.
- `LOG_PRETTY=1` MAY be used for local pretty output; default output is JSON.
- Logs MUST be structured and include `component` and `event`.
- Sensitive fields (`secret`, `token`, `authorization`, `x-secret-key`, `password`, `api_key`) MUST be redacted.
- Secret audit logs MUST NOT contain plaintext secret values or raw secret keys.

## Task management

- use `tasks` skill to manage tasks
