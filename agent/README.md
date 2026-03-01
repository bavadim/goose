# Goose Agent (Alternative Runtime)

This repository contains a desktop AI agent runtime focused on practical work on your own computer through chat.

The project follows the same core Goose direction (local, extensible, automation-oriented), but in a simplified implementation aimed at easier maintenance and requirement-level compatibility.

## For Users

### Who this app is for

- Engineers and technical users who want to solve computer tasks faster via chat.
- People who prefer a local desktop workflow instead of a browser-only assistant.
- Teams that want an agent that can evolve with their engineering stack.

### Why use it

- To turn chat requests into concrete actions and outcomes on your machine.
- To reduce manual repetitive work in technical workflows.
- To keep a direct “ask in chat -> get result” loop inside a desktop app.

### What this application is

- A desktop chat agent (Electron app) connected to a local runtime server.
- A foundation for automating engineering and computer-side tasks with LLM-driven flows.

## For Developers

### Prerequisites

- Node.js (current LTS recommended)
- npm
- Linux headless e2e: `xvfb` installed (the test command auto-detects it)

### Quick start

```bash
npm install
npm run dev
```

`npm run dev` starts:
- server in watch mode,
- Electron desktop app,
- Vitest in watch mode.

### Test and quality

Canonical full pipeline:

```bash
npm run test
```

Fast local loop:

```bash
npm run test:fast
```

`npm run test` includes:
- TypeScript type check
- Biome checks
- OpenAPI schema validation (`swagger-cli`)
- Vitest suites
- dependency/dead-code checks (`knip`, `dpdm`)
- duplication check (`jscpd`)
- production dependency audit (`npm audit --omit=dev --audit-level=high`)
- desktop builds (main/preload/renderer)
- Playwright e2e (with `xvfb-run` on headless Linux)

### Packaging

```bash
npm run desktop:make:linux
npm run desktop:make:mac
npm run desktop:make:win
```

Each packaging target runs the full test pipeline first.
Packaging is built via `electron-builder`.

### Environment variables

| Variable | Default | Used in | Purpose |
|---|---|---|---|
| `HOST` | `127.0.0.1` | server | HTTP bind host |
| `PORT` | `3001` | server | HTTP bind port |
| `SERVER_SECRET_KEY` | `dev-secret` | server | Auth key for protected routes (`X-Secret-Key`) |
| `AGENT_SERVER_URL` | `http://127.0.0.1:3001` | desktop main | Backend URL in desktop/dev flow |
| `AGENT_DESKTOP_BACKEND_PORT` | `43111` | desktop main | Port for backend process spawned by packaged desktop |
| `DISPLAY` / `WAYLAND_DISPLAY` | n/a | test runner | Detect graphical session; fallback to `xvfb-run` when missing |

### Project structure (top level)

- `src/server` — HTTP server implementation and OpenAPI route handling
- `src/desktop` — Electron main/preload/renderer app
- `tests` — manual requirements tests, runtime contract tests, e2e tests
- `docs/requirements` — normative behavior requirements and OpenAPI contract
- `docs/tasks` — issues-as-code task tracking
- `AGENTS.md` — engineering and testing rules for contributors/agents

### Development principles

- Requirements-first changes (source of truth: `docs/requirements`).
- TDD workflow: tests first, then implementation.
- Tests are requirement-oriented and use `MUST/SHOULD/MAY` naming.
- Keep implementation strict, typed, and simple.

## References

- [Repository rules](./AGENTS.md)
- [Architecture notes](./docs/ARCHITECTURE.md)
- [Server OpenAPI contract](./docs/requirements/GOOSE_SERVER_OPENAPI.json)
- [Tasks workflow](./docs/tasks/README.md)
