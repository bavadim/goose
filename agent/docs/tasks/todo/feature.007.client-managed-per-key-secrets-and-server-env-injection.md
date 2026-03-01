---
ID: 7
Title: [CLIENT][svc:existing:settings-store] Desktop security, Complete client-managed secrets/settings propagation with backend restart
Complexity: high
Category: CLIENT
Primary Module: src/desktop/main/settings/store.ts
Server Impact: orchestrator-only
---

# [CLIENT][svc:existing:settings-store] Desktop security, Complete client-managed secrets/settings propagation with backend restart

## 1. Executive Summary

**Abstract:**  
Базовая модель client-managed secrets и env-only boot уже внедрена, но runtime-поток применения изменений неполный: обновления ключей и настроек должны гарантированно доноситься до backend через restart. Задача — закрыть этот gap и зафиксировать детерминированное поведение restart.

**Objectives (SMART):**
- **Specific:** Доработать runtime lifecycle так, чтобы изменения secrets/settings всегда приводили к controlled backend restart с новым env snapshot.
- **Measurable:** Для операций изменения secrets/settings есть единый apply-flow с restart и подтверждением health; тесты покрывают restart/rollback behavior.
- **Achievable:** Реализуется в текущем Electron + TypeScript стеке.
- **Relevant:** Упрощает контракт и изолирует секреты от server API слоя.
- **Time-bound:** Один полный инженерный цикл.

## 2. Context & Problem Statement

### Current State

- Секреты уже хранятся client-side по модели per-key (`DesktopSecretStore`) с secure backend + fallback `secrets.env`.
- Backend уже запускается из desktop main и получает env через `SettingsStore.buildServerEnv(...)`.
- Deterministic key->env mapping уже реализован.
- Gap: runtime-обновления секретов/настроек не связаны с обязательным restart backend, поэтому сервер может работать со stale env до следующего старта.

### The "Why"

Требуется strict runtime contract: при изменении любого значения, влияющего на server env (ключи/настройки), backend должен перезапускаться и проходить health-check, иначе поведение становится недетерминированным.

### In Scope

- Restart orchestration в desktop main для изменений secrets/settings.
- Единый apply-flow: сохранить -> пересобрать env -> restart backend -> health-check -> статус результата.
- Поведение при ошибке restart (rollback/сообщение об ошибке/сохранение процесса в консистентном состоянии).
- Тесты и docs updates.

### Out of Scope

- Полноценный чатовый интерфейс управления секретами.
- Авто-ротация ключей.
- Удаленный secret management сервис.

## 3. Proposed Technical Solution

### Architecture Overview

1. Desktop main хранит секреты per-key в primary secure backend.
2. Если secure backend недоступен, автоматически включается fallback env-export file.
3. При старте backend main собирает env из:
   - базовых runtime env,
   - mapped per-key secret env.
4. При изменении секрета или настроек, влияющих на env, main выполняет controlled restart backend с новым env snapshot.
5. После restart main подтверждает готовность backend через health-check.
6. Renderer получает только metadata/status API, без plaintext secret values.

### Interface Changes

- Публичный desktop API не обязан раскрывать plaintext секреты.
- Должен существовать deterministic apply entrypoint для изменений, влияющих на server env.
- `desktop:get-state` SHOULD отражать runtime restart status (`idle|restarting|failed`) для диагностируемости.

### Project Code Reference

- `src/desktop/main/index.ts`
- `src/desktop/main/settings/secrets/*`
- `src/desktop/main/settings/*`
- `src/desktop/shared/api.ts`
- `src/desktop/preload/index.ts`
- `tests/secrets.*.test.ts`
- `tests/settings-store.test.ts`
- `tests/e2e/desktop.smoke.spec.ts`

## 4. Requirements

- `MUST` хранить секреты в desktop client-side secret store по модели per-key.
- `MUST` не передавать plaintext secret values в renderer.
- `MUST` запускать backend server только из desktop main в dev и packaged режимах.
- `MUST` передавать секреты в server только через env на этапе spawn.
- `MUST` использовать deterministic mapping для env имен:
  - `provider.*`
  - `sftp.*`
  - `mcp.system.*`
  - `mcp.ext.<id>.*`
- `MUST` перезапускать backend после любого изменения secrets/settings, которое влияет на server env.
- `MUST` использовать единый controlled restart flow:
  - graceful stop старого процесса,
  - старт нового процесса с обновленным env,
  - health-check readiness,
  - детерминированный результат (`ok|error`).
- `MUST` поддерживать fallback `secrets.env` при недоступности secure backend.
- `SHOULD` вести metadata-only аудит операций с секретами.
- `SHOULD` возвращать детерминированный статус backend restart в desktop state.
- `SHOULD` не терять работоспособный backend при неуспешном restart (best-effort rollback на последний рабочий env/process).
- `WON'T` добавлять авто-ротацию секретов в рамках задачи.

## 5. Acceptance Criteria

- `MUST` backend получает ожидаемые env переменные из per-key storage.
- `MUST` изменение секрета вызывает restart backend и восстановление health.
- `MUST` изменение настройки, влияющей на env, вызывает restart backend и восстановление health.
- `MUST` при ошибке restart возвращается детерминированная ошибка без утечки секретов.
- `MUST` dev режим не требует отдельного запуска `src/server/index.ts`.
- `MUST` тесты `npm run test` проходят с новыми unit/e2e сценариями.
