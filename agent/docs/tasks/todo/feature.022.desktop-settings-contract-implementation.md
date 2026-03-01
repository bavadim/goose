---
ID: 22
Title: [CLIENT][svc:existing:settings-store] Desktop settings, Implement DESKTOP_SETTINGS_CONTRACT Section 7
Complexity: high
Category: CLIENT
Primary Module: src/desktop/main/settings/store.ts
Server Impact: orchestrator-only
---

# [CLIENT][svc:existing:settings-store] Desktop settings, Implement DESKTOP_SETTINGS_CONTRACT Section 7

## 1. Executive Summary

**Abstract:**  
Реализовать settings IPC-контракт из `docs/requirements/DESKTOP_SETTINGS_CONTRACT.md` (Section 7) в текущем desktop runtime. Цель: сделать пользовательские настройки управляемыми через `window.desktopApi`, сохранить backend-agnostic модель `SettingsStore` и закрыть основной compatibility gap по settings/system channels.

**Objectives (SMART):**
- **Specific:** Внедрить все settings/system IPC каналы из RFC Section 7 с deterministic поведением.
- **Measurable:** Каналы доступны в preload/main, проходят happy/error path тесты.
- **Achievable:** Реализация поверх существующего `SettingsStore` и текущего backend lifecycle.
- **Relevant:** Закрывает обязательный runtime-слой после подготовки RFC.
- **Time-bound:** Один инженерный цикл.

## 2. Context & Problem Statement

### Current State

- RFC `DESKTOP_SETTINGS_CONTRACT.md` принят и зафиксировал обязательный settings IPC behavior.
- В текущем runtime из settings API фактически реализованы только `desktop:get-state` и `desktop:send-logs`.
- Каналы Section 7 отсутствуют, что создает явный разрыв между RFC и кодом.

### The "Why"

Без реализации Section 7 не получится сохранить совместимость settings UX и корректно применять canonical settings в runtime.

### In Scope

- Реализация settings/system IPC каналов из Section 7:
  - `get-settings`, `save-settings`,
  - `set/get-menu-bar-icon`,
  - `set/get-dock-icon`,
  - `set/get-wakelock`,
  - `set/get-spellcheck`,
  - `open-notifications-settings`.
- Расширение typed `window.desktopApi` в `shared/preload`.
- Main handlers с валидацией payload и deterministic ответами.
- Backend restart только на `save-settings` с health-check.
- Тесты (unit/integration) для новых каналов.

### Out of Scope

- Runtime migration localStorage keys в canonical store.
- Keyboard shortcuts / telemetry / externalGoosed domains.
- Полная унификация на общий IPC error envelope за пределами settings surface.

## 3. Proposed Technical Solution

### Architecture Overview

1. Расширить `DesktopApi` settings/system методами (typed only через `window.desktopApi`).
2. Добавить main-side handlers для всех Section 7 channels.
3. Использовать `SettingsStore` как source-of-truth:
   - чтение canonical snapshot,
   - сохранение normalized snapshot.
4. На `save-settings` выполнять controlled backend restart:
   - stop старого процесса,
   - старт нового с `SettingsStore.buildServerEnv(...)`,
   - health-check readiness.
5. Для toggle channels (`set-*`) применять локальные runtime-эффекты без backend restart.

### Interface Changes

- `src/desktop/shared/api.ts`:
  - добавить settings/system методы в `DesktopApi`.
- `src/desktop/preload/index.ts`:
  - добавить typed invoke wrappers для новых channels.
- `src/desktop/renderer/global.d.ts`:
  - обновить тип `window.desktopApi`.
- `src/desktop/main/index.ts`:
  - зарегистрировать settings/system handlers.

### Project Code Reference

- RFC: `docs/requirements/DESKTOP_SETTINGS_CONTRACT.md`
- Runtime:
  - `src/desktop/main/index.ts`
  - `src/desktop/main/settings/*`
  - `src/desktop/shared/api.ts`
  - `src/desktop/preload/index.ts`
- Tests:
  - `tests/settings-store.test.ts`
  - `tests/desktop.settings.ui.test.tsx`
  - `tests/e2e/desktop.smoke.spec.ts`

## 4. Requirements

- `MUST` реализовать все settings/system channels из RFC Section 7.
- `MUST` использовать `SettingsStore` как source-of-truth для чтения/сохранения settings.
- `MUST` валидировать boolean payload для `set-*` channels.
- `MUST` обеспечить deterministic outcomes для platform-specific операций.
- `MUST` выполнять backend restart на `save-settings` и подтверждать health-check.
- `MUST` не выполнять backend restart для `set-*` channels в рамках этой задачи.
- `MUST` не утекать секретами в error/log payload.
- `SHOULD` сохранить совместимость legacy channel names на wire-уровне.
- `SHOULD` сохранить поведение `desktop:get-state`/`desktop:send-logs` без регрессий.

## 5. Acceptance Criteria

- `MUST` typed `window.desktopApi` содержит все Section 7 settings/system методы.
- `MUST` `get-settings` возвращает canonical settings snapshot.
- `MUST` `save-settings` персистит settings и приводит к успешному backend restart+health.
- `MUST` `set-*` channels применяют изменения и не перезапускают backend.
- `MUST` invalid payload обрабатывается детерминированно без raw exceptions.
- `MUST` platform-specific behavior по dock/notifications имеет стабильные результаты.
- `MUST` `npm run test` проходит с добавленными tests.

## 6. Dependencies

- Depends on: `feature.018.desktop-ipc-foundation-and-registry.md`.
- Depends on: `feature.007.client-managed-per-key-secrets-and-server-env-injection.md`.
- Coordinates with: `feature.019.desktop-ipc-core-channels.md` (task 019 MUST NOT own settings channels).
