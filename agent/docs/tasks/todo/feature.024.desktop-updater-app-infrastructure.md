---
ID: 24
Title: [CLIENT][svc:new:updater-runtime] Desktop updater, Implement in-app updater infrastructure
Complexity: high
Category: CLIENT
Primary Module: src/desktop/main/updater/service.ts
Server Impact: none
---

# [CLIENT][svc:new:updater-runtime] Desktop updater, Implement in-app updater infrastructure

## 1. Executive Summary

**Abstract:**
Реализовать updater runtime в desktop приложении на основе `electron auto-updater` с GitHub Releases как source of updates. Цель — стабильная и простая доставка обновлений с детерминированным поведением на всех поддерживаемых ОС.

**Objectives (SMART):**
- **Specific:** Внедрить updater service в `main` и связать его с IPC surface.
- **Measurable:** Каналы updater перестают быть stubs и проходят happy/error path тесты.
- **Achievable:** Реализуется поверх текущего Electron runtime и существующего IPC контракта.
- **Relevant:** Закрывает ключевой пользовательский сценарий обновления приложения.
- **Time-bound:** Один инженерный цикл.

## 2. Context & Problem Statement

### Current State

- В `DESKTOP_IPC_CONTRACT.md` updater channels определены, но в текущем коде остаются missing/stub.
- Сборка desktop уже делается через `electron-builder`.
- Build store выбран: GitHub Releases.

### The "Why"

Без рабочей updater-инфраструктуры обновления не доставляются стабильно, и пользователь вынужден вручную искать новые версии.

### In Scope

- In-app updater service в `src/desktop/main`.
- Реализация updater IPC channels:
  - `check-for-updates`
  - `download-update`
  - `install-update`
  - `get-update-state`
  - `is-using-github-fallback`
  - `get-current-version`
  - event `updater-event`
- Детеминированная state model updater.
- Platform handling:
  - macOS + Windows: auto-update path,
  - Linux: deterministic `manual_required` fallback.
- Тесты (unit/integration) и логирование.

### Out of Scope

- Multi-channel release model (beta/nightly).
- Hard-required code signing gate.
- Полная переработка UI раздела обновлений.

## 3. Proposed Technical Solution

### Architecture Overview

1. Добавить модуль `main/updater/service.ts`:
   - orchestration check/download/install,
   - in-memory updater state,
   - main->renderer updater events.
2. Добавить `main/updater/types.ts` для state/result payloads.
3. Подключить сервис в `main/index.ts` через компактный registration hook.
4. Реализовать deterministic Linux fallback (`manual_required` + release URL).
5. Интегрировать с existing IPC foundation (`feature.018`) и core channels stream.

### Interface Changes

- Расширить `src/desktop/shared/api.ts` typed updater methods.
- Расширить `src/desktop/preload/index.ts` updater bridge.
- Добавить typed updater event subscription в `desktopApi`.

### Project Code Reference

- `docs/requirements/DESKTOP_IPC_CONTRACT.md`
- `docs/requirements/UPDATER_PRD.md` (to be created/approved)
- `src/desktop/main/index.ts`
- `src/desktop/shared/api.ts`
- `src/desktop/preload/index.ts`

## 4. Requirements

- `MUST` реализовать updater state machine с детерминированными переходами.
- `MUST` реализовать все updater channels из IPC контракта.
- `MUST` поддержать auto-update path на macOS/Windows.
- `MUST` вернуть `manual_required` на Linux с детерминированным payload.
- `MUST` не выбрасывать raw exceptions в renderer API.
- `MUST` не утекать секретами/токенами в logs/events.
- `SHOULD` хранить updater-логи в существующей logging policy.
- `SHOULD` минимизировать изменения в `main/index.ts` (через service module).

## 5. Acceptance Criteria

- `MUST` `check-for-updates` возвращает deterministic result при наличии и отсутствии апдейта.
- `MUST` `download-update` и `install-update` работают по happy/error path с тестами.
- `MUST` `get-update-state` согласован с реальным state machine.
- `MUST` `updater-event` стримит детерминированные события в renderer.
- `MUST` Linux получает `manual_required` fallback вместо неопределенного поведения.
- `MUST` `npm run test` проходит.

## 6. Dependencies

- Depends on:
  - `feature.018.desktop-ipc-foundation-and-registry.md`
  - `feature.020.desktop-ipc-stubbed-channels.md` (replaced updater stubs)
- Coordinates with:
  - `feature.025.desktop-updater-release-infrastructure.md` (artifact/feed compatibility)
