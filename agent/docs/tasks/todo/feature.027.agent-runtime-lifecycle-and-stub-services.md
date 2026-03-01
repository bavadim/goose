---
ID: 27
Title: [CLIENT][svc:new:agent-runtime-skeleton] Server agent lifecycle, Implement multi-session runtime with extension/provider stubs
Complexity: high
Category: CLIENT
Primary Module: src/server/agent-runtime/index.ts
Server Impact: server-runtime
---

# [CLIENT][svc:new:agent-runtime-skeleton] Server agent lifecycle, Implement multi-session runtime with extension/provider stubs

## 1. Executive Summary

**Abstract:**
Текущий `src/server` в основном работает как OpenAPI mock router и не реализует агентский цикл `/agent/*` с состоянием сессий. Нужно внедрить near-real skeleton агентского runtime: multi-session in-memory lifecycle + session-aware `/reply` stream, а также stateful stubs для расширений и провайдера.

**Objectives (SMART):**
- **Specific:** Реализовать in-memory session runtime для `/agent/start|resume|restart|stop` и интегрировать его в `/reply`.
- **Measurable:** Эндпоинты lifecycle перестают быть sample-only ответами и работают через runtime state machine.
- **Achievable:** Реализуется локально в `src/server` без реального LLM/MCP исполнения.
- **Relevant:** Создает минимально жизнеспособный каркас агентского цикла для дальнейшего переноса продуктовых фич.
- **Time-bound:** Один инженерный цикл.

## 2. Context & Problem Statement

### Current State

- `src/server/app.ts` генерирует большинство ответов из OpenAPI sample/resolver.
- Lifecycle endpoints (`/agent/start`, `/agent/resume`, `/agent/restart`, `/agent/stop`) не управляют реальным runtime state.
- `/reply` отдает валидный SSE, но не использует session-aware agent runtime loop.
- Расширения и провайдеры не имеют согласованного stateful stub слоя.

### The "Why"

Без базового runtime skeleton невозможно системно переносить агентский цикл из `docs/ARCHITECTURE.md` и интегрировать desktop/server поведение вокруг сессий, extensions и providers.

### In Scope

- Multi-session in-memory runtime store.
- Lifecycle state machine для `/agent/start|resume|restart|stop`.
- Session-aware `/reply` near-real skeleton stream.
- Stateful extension stubs:
  - `/config/extensions` CRUD,
  - `/agent/add_extension`,
  - `/agent/remove_extension`.
- Stateful provider stubs (wide set):
  - `/config/providers*`,
  - `/config/check_provider`,
  - `/config/set_provider`,
  - `/config/detect-provider`,
  - `/agent/update_provider`.
- Тесты lifecycle, reply-stream и stub services.

### Out of Scope

- Реальный MCP runtime/transport.
- Реальные provider SDK вызовы.
- Файловая персистентность сессий.
- Полный production parity с оригинальным Goose core.

## 3. Proposed Technical Solution

### Architecture Overview

1. Добавить модуль runtime store и lifecycle orchestration:
   - `src/server/agent-runtime/types.ts`
   - `src/server/agent-runtime/store.ts`
   - `src/server/agent-runtime/lifecycle.ts`
   - `src/server/agent-runtime/reply.ts`
2. Добавить stateful stub-сервисы:
   - `src/server/stubs/extensions-service.ts`
   - `src/server/stubs/providers-service.ts`
3. Добавить explicit runtime route handlers:
   - `src/server/routes/runtime-routes.ts`
   - runtime handlers подключаются раньше generic OpenAPI fallback.
4. Сохранить OpenAPI fallback для непритронутых route.
5. Сохранить `/reply` SSE wire-format и command compatibility (`/send-logs` branch не ломается; отдельная реализация в `feature.026`).

### Interface Changes

- Публичные route names не меняются.
- Поведение `/agent/*`, `/reply`, provider/config/extension endpoints меняется с sample-only на runtime/stateful deterministic.
- Внутренние типы runtime добавляются как source-of-truth для session/lifecycle state.

### Project Code Reference

- `docs/ARCHITECTURE.md`
- `docs/requirements/GOOSE_CORE_REQUIREMENTS.md`
- `docs/requirements/GOOSE_SERVER_OPENAPI.json`
- `src/server/app.ts`
- `src/server/spec.ts`
- `src/server/responder.ts`
- `tests/server.test.ts`

## 4. Requirements

- `MUST` реализовать multi-session in-memory store с детерминированным управлением session lifecycle.
- `MUST` реализовать `/agent/start`, `/agent/resume`, `/agent/restart`, `/agent/stop` через runtime layer, не через sample fallback.
- `MUST` реализовать session-aware `/reply` SSE skeleton с предсказуемыми кадрами и обработкой отсутствующей сессии.
- `MUST` реализовать stateful stubs для extensions CRUD и session-level add/remove extension.
- `MUST` реализовать stateful stubs для provider/config wide endpoint set.
- `MUST` сохранить auth contract (`X-Secret-Key`) без регрессий.
- `MUST` возвращать deterministic errors вместо raw exceptions.
- `MUST` не утекать секретами в logs и response payload.
- `SHOULD` держать runtime код в отдельных модулях, а не в монолитном `app.ts`.
- `SHOULD` сохранить OpenAPI fallback для непритронутых route.

## 5. Acceptance Criteria

- `MUST` `/agent/start|resume|restart|stop` имеют happy/error path тесты и работают через runtime state.
- `MUST` `/reply` стримит валидные SSE кадры в session-aware режиме.
- `MUST` unknown/inactive session в `/reply` дает детерминированный исход (тест подтверждает контракт).
- `MUST` extension stub endpoints проходят CRUD + session activation tests.
- `MUST` provider/config stub endpoints проходят deterministic behavior tests.
- `MUST` текущие runtime contract tests адаптированы под новые runtime semantics.
- `MUST` `npm run test` проходит.

## 6. Dependencies

- Coordinates with: `docs/tasks/todo/feature.026.server-send-logs-runtime-pipeline.md` (`/send-logs` runtime branch ownership).
- Coordinates with: `docs/tasks/todo/feature.021.desktop-ipc-contract-verification.md` (синхронизация runtime expectations в тестах).
- SHOULD follow: `docs/ARCHITECTURE.md` sections on SessionManager/Agent turn loop as skeleton baseline.
