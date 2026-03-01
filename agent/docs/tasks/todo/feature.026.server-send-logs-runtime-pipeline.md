---
ID: 26
Title: [CLIENT][svc:new:server-command-bus] Server diagnostics, Replace /send-logs dry-run with runtime pipeline
Complexity: high
Category: CLIENT
Primary Module: src/server/app.ts
Server Impact: server-runtime
---

# [CLIENT][svc:new:server-command-bus] Server diagnostics, Replace /send-logs dry-run with runtime pipeline

## 1. Executive Summary

**Abstract:**
Текущая реализация `/send-logs` в сервере является dry-run stub и не выполняет реальную отправку логов. Нужно внедрить реальный runtime pipeline команды, сохранив детерминированный SSE-контракт для desktop клиента.

**Objectives (SMART):**
- **Specific:** Заменить stub-ветку `/send-logs` на рабочий command pipeline с детерминированными результатами.
- **Measurable:** `desktop:send-logs` возвращает реальные outcomes (`ok/error`) по SSE без имитации `dry-run://pending`.
- **Achievable:** Реализуется локально в `src/server` без изменения OpenAPI surface.
- **Relevant:** Закрывает серверный gap в пользовательском сценарии "Send Logs" из desktop приложения.
- **Time-bound:** Один инженерный цикл.

## 2. Context & Problem Statement

### Current State

- В `src/server/app.ts` команда `/send-logs` обрабатывается hardcoded stub payload.
- Комментарий `TODO(v2)` явно фиксирует незавершенную реализацию upload pipeline.
- Desktop main уже умеет вызывать `/reply` с `/send-logs` и ждет детерминированный результат.

### The "Why"

Пока сервер отдает только dry-run ответ, feature "Send Logs" формально работает, но не выполняет свою продуктовую функцию.

### In Scope

- Реальный command pipeline для `/send-logs` в сервере.
- Детеминированный формат SSE payload для success/error outcomes.
- Логирование и error mapping без утечки секретов.
- Тесты happy/error path для server и desktop integration точки.

### Out of Scope

- Полноценный UI flow чата.
- Расширенная маршрутизация по нескольким удаленным destinations.
- Переопределение desktop IPC контракта `desktop:send-logs`.

## 3. Proposed Technical Solution

### Architecture Overview

1. Выделить серверный обработчик команды `/send-logs` в отдельный модуль `src/server/send-logs.ts`.
2. Реализовать runtime pipeline этапов:
   - сбор контекста логов,
   - подготовка артефакта,
   - отправка в назначенный transport,
   - формирование финального результата.
3. Оставить wire-совместимый SSE-ответ через существующий `/reply` endpoint.
4. Внедрить deterministic error envelope в event payload (без raw stack traces).

### Interface Changes

- HTTP surface и route names не меняются.
- SSE payload команды `/send-logs` должен оставаться JSON-parseable и включать итоговые поля результата.

### Project Code Reference

- `src/server/app.ts`
- `src/server/responder.ts`
- `src/desktop/main/send-logs.ts`
- `tests/server.test.ts`
- `tests/desktop.send-logs.test.ts`

## 4. Requirements

- `MUST` удалить dry-run stub payload для `/send-logs` и заменить на runtime pipeline.
- `MUST` сохранить обработку команды через `/reply` SSE без изменения публичного endpoint.
- `MUST` возвращать детерминированный JSON payload для success и error outcomes.
- `MUST` не утекать секретами в server logs и response payload.
- `MUST` обеспечить таймауты/ошибки transport с предсказуемым сообщением клиенту.
- `SHOULD` держать orchestration в отдельном модуле, а не в `app.ts`.
- `SHOULD` сохранить совместимость с текущим desktop вызовом `desktop:send-logs` без API churn.

## 5. Acceptance Criteria

- `MUST` server tests покрывают happy path runtime send-logs pipeline.
- `MUST` server tests покрывают error path (transport failure/invalid config/timeout).
- `MUST` desktop integration тест подтверждает получение не-stub результата.
- `MUST` ответы `/reply` для `/send-logs` остаются SSE-совместимыми и JSON-parseable.
- `MUST` `npm run test` проходит.

## 6. Dependencies

- Coordinates with: `docs/tasks/done/feature.006.desktop-send-logs-via-server-stub.md` (stub baseline).
- Coordinates with: `docs/tasks/todo/feature.007.client-managed-per-key-secrets-and-server-env-injection.md` (env/secret inputs for transport).
