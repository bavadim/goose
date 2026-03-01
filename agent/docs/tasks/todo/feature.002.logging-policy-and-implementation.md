---
ID: 2
Title: [CLIENT][svc:existing:logging] Logging observability, Migrate runtime logging to pino and lock policy
Complexity: medium
Category: CLIENT
Primary Module: src/logging/index.ts
Server Impact: server-runtime
---

# [CLIENT][svc:existing:logging] Logging observability, Migrate runtime logging to pino and lock policy

## 1. Executive Summary

**Abstract:**  
В проекте уже есть единый интерфейс логгера, но сейчас используется самописная реализация JSON-логов. Нужно полностью перейти на `pino` как стандарт runtime-логирования для server и desktop, закрепить это в `AGENTS.md`, и обеспечить безопасное структурированное логирование без утечки секретов.

**Objectives (SMART):**
- **Specific:** Заменить текущую реализацию логгера на `pino`, сохранить единый API `createLogger(component)`, и унифицировать конфиг (`LOG_LEVEL`, `LOG_PRETTY`).
- **Measurable:** В runtime-коде нет `console.*`; все логи идут через `pino` с redaction и структурированными полями.
- **Achievable:** Реализуется локально без изменения бизнес-логики.
- **Relevant:** Улучшает диагностику, поддержку и безопасность, снижает риск невалидных логов в будущем.
- **Time-bound:** Один инженерный цикл.

## 2. Context & Problem Statement

### Current State

- Есть общий логгер `src/logging/index.ts`, но это кастомная реализация.
- Логи уже структурированы и редактируют чувствительные ключи, но поведение не стандартизировано отраслевым инструментом.
- Политика в `AGENTS.md` описывает правила логирования, но должна явно фиксировать `pino` как обязательную библиотеку и настройки.

### The "Why"

Нужен стандартный и предсказуемый logging stack. `pino` дает стабильный формат, зрелую экосистему, лучшее сопровождение и меньше собственного кода для поддержки.

### In Scope

- Внедрение `pino` как единственной runtime logging библиотеки.
- Сохранение текущего контрактного API `createLogger(component)` для минимального churn кода.
- Конфигурация логирования через env (`LOG_LEVEL`, `LOG_PRETTY`).
- Redaction policy для чувствительных полей.
- Обновление `AGENTS.md` и тестов под новый logging backend.

### Out of Scope

- Внешний log shipping (ELK/Loki/SaaS).
- Метрики/трейсинг (OpenTelemetry, Sentry APM).
- Изменение бизнес-логики server/desktop.

## 3. Proposed Technical Solution

### Architecture Overview

1. В `src/logging/index.ts` заменить кастомный writer на `pino`.
2. Экспортировать адаптер `createLogger(component)` с текущим shape (`debug/info/warn/error`), чтобы не менять call sites.
3. Добавить `pino` redaction для чувствительных ключей:
   - `secret`, `token`, `authorization`, `x-secret-key`, `password`, `api_key`.
4. Поддержать режимы:
   - default: JSON logs;
   - `LOG_PRETTY=1`: pretty output (dev-only).
5. Обновить правила в `AGENTS.md`:
   - использовать только `createLogger`/`pino`,
   - запрет `console.*` в runtime paths.

### Interface Changes

- Public logging API остается:
  - `createLogger(component: string)`
  - `.debug(event, details?)`
  - `.info(event, details?)`
  - `.warn(event, details?)`
  - `.error(event, details?)`
- Env contract:
  - `LOG_LEVEL=debug|info|warn|error` (default `info`)
  - `LOG_PRETTY=0|1` (default `0`)

### Project Code Reference

- `src/logging/index.ts`
- `src/server/index.ts`
- `src/server/app.ts`
- `src/desktop/main/index.ts`
- `src/desktop/main/notifications/service.ts`
- `AGENTS.md`
- `tests/*logging*` (новые/обновленные)

## 4. Requirements

- `MUST` использовать `pino` как единственный runtime logging backend.
- `MUST` сохранять единый адаптер `createLogger(component)` для остального кода.
- `MUST` поддерживать `LOG_LEVEL` и `LOG_PRETTY` с детерминированными default.
- `MUST` структурировать каждый лог с полями минимум: `timestamp`, `level`, `component`, `event`.
- `MUST` редактировать чувствительные данные по ключам (`secret|token|authorization|x-secret-key|password|api_key`).
- `MUST` не использовать `console.*` в runtime paths server/desktop.
- `MUST` закрепить policy в `AGENTS.md` с явной ссылкой на `pino` и конфиг.
- `SHOULD` сохранять существующие event names, чтобы не ломать диагностику.
- `SHOULD` логировать startup/runtime ошибки с безопасным metadata-only payload.
- `WON'T` добавлять внешние сервисы логирования в этой задаче.

## 5. Acceptance Criteria

- `MUST` `src/logging/index.ts` использует `pino` и проходит `npm run test`.
- `MUST` в runtime-коде нет прямых `console.*` (кроме допустимых тестовых/tooling файлов).
- `MUST` тесты покрывают:
  - `LOG_LEVEL` default и override,
  - `LOG_PRETTY` behavior,
  - redaction чувствительных полей.
- `MUST` `AGENTS.md` содержит актуальную logging policy с `pino` и env-настройками.
- `MUST` изменения не ломают существующие тесты server/desktop.
