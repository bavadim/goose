---
ID: 8
Title: Desktop compatibility, Compact implementation of DESKTOP_IPC_CONTRACT
Complexity: high
---

# Desktop compatibility, Compact implementation of DESKTOP_IPC_CONTRACT

## 1. Executive Summary

**Abstract:**
Реализовать IPC-контракт desktop-приложения по `docs/requirements/DESKTOP_IPC_CONTRACT.md` в компактном формате: near-full parity по surface (каналы присутствуют), но без оверинжиниринга. Для неперенесенных продуктовых зон используются deterministic typed stubs.

**Objectives (SMART):**
- **Specific:** Добавить legacy IPC surface в `src/desktop` (`shared + preload + main`) без `window.electron` legacy API.
- **Measurable:** Каналы из RFC либо реально работают, либо возвращают документированный deterministic stub.
- **Achievable:** Реализуется на текущей архитектуре (`main lifecycle + SettingsStore + preload bridge`).
- **Relevant:** Это блокирующий каркас для переноса user-facing фич из `../ui/desktop`.
- **Time-bound:** Один инженерный цикл, разбитый на 4 трека.

## 2. Context & Problem Statement

### Current State
- В текущем проекте IPC минимален (`desktop:get-state`, `desktop:send-logs`).
- Полный контракт описан в `DESKTOP_IPC_CONTRACT.md`.
- Подзадачи `009–017` создают избыточную гранулярность и дублирование решений.

### The "Why"
Нужна системная инфраструктура IPC, чтобы переносить фичи быстро и предсказуемо, не добавляя ad-hoc каналы и не раздувая `main/index.ts`.

### In Scope
- Единый typed каталог каналов и payload-типов.
- Единый preload API `window.desktopApi`.
- Main-side регистрация каналов через компактные domain handlers.
- Deterministic error envelope.
- Deterministic stubs для неперенесенных зон.
- Contract tests на inventory и поведение.

### Out of Scope
- Полный перенос updater-бизнес-логики.
- Полный перенос deeplink UX semantics.
- Миграция legacy renderer-кода в рамках этой задачи.

## 3. Proposed Technical Solution

### Architecture Overview
1. `src/desktop/shared/ipc.ts` как source of truth для channel names + request/response/event types + `IpcError`.
2. `src/desktop/shared/api.ts` как единственный публичный typed API для renderer.
3. `src/desktop/preload/index.ts` как тонкий typed bridge (invoke/send/on + normalize errors).
4. `src/desktop/main/ipc/register.ts` + `src/desktop/main/ipc/handlers/*` для компактной доменной регистрации.
5. `src/desktop/main/ipc/events.ts` для main->renderer relay и deferred delivery после `react-ready`.

### Interface Changes
- `window.desktopApi` расширяется до near-full RFC surface.
- Legacy `sendSync get-app-version` адаптируется в async wrapper внутри `desktopApi`.
- Каналы updater/recipe MAY быть stubbed с `IPC_NOT_IMPLEMENTED`.

### Project Code Reference
- `docs/requirements/DESKTOP_IPC_CONTRACT.md`
- `src/desktop/shared/api.ts`
- `src/desktop/preload/index.ts`
- `src/desktop/main/index.ts`
- `src/desktop/main/settings/*`
- `tests/*.test.ts`, `tests/e2e/desktop.smoke.spec.ts`

## 4. Requirements

- `MUST` поддержать все legacy wire channel names из RFC.
- `MUST` оставить публичный renderer API только через `window.desktopApi`.
- `MUST` внедрить единый `IpcError` envelope (`code`, `message`, optional `details`, optional `retryable`).
- `MUST` валидировать URL/path/boolean payload у privileged каналов.
- `MUST` реализовать core IPC behavior (window/settings/fs/shell + текущие `desktop:get-state` и `desktop:send-logs`).
- `MUST` реализовать deterministic stubs для non-core зон (включая updater family).
- `MUST` не утекать секретами в IPC errors/logs.
- `SHOULD` держать registration логику в компактных domain handlers, а не в монолите `main/index.ts`.
- `WON'T` добавлять отдельный "IPC bus service" при отсутствии реальной многопроцессной необходимости.

## 5. Acceptance Criteria

- `MUST` все каналы из RFC inventory доступны в IPC surface (real или stub).
- `MUST` preload API типизирован и компилируется без `any`.
- `MUST` core IPC сценарии покрыты happy/error тестами.
- `MUST` stub-каналы возвращают deterministic `IPC_NOT_IMPLEMENTED`.
- `MUST` `npm run test` проходит.
- `MUST` gap matrix в `DESKTOP_IPC_CONTRACT.md` синхронизирован со статусами реализации.

## 6. Execution Strategy (Compact)

Эта задача выполняется через 4 трека:

1. `feature.018.desktop-ipc-foundation-and-registry.md`
2. `feature.019.desktop-ipc-core-channels.md`
3. `feature.020.desktop-ipc-stubbed-channels.md`
4. `feature.021.desktop-ipc-contract-verification.md`

## 7. Legacy Subtasks

Подзадачи `feature.009` ... `feature.017` помечаются как superseded и используются только как историческая декомпозиция.

## 8. Dependency Checklist (Epic Tracking)

- [ ] `feature.018.desktop-ipc-foundation-and-registry.md`
- [ ] `feature.019.desktop-ipc-core-channels.md`
- [ ] `feature.020.desktop-ipc-stubbed-channels.md`
- [ ] `feature.021.desktop-ipc-contract-verification.md`

## Implementation Notes

- This epic is superseded by modular stream tasks in `docs/tasks/todo/feature.018` ... `feature.021`.
- Settings/deeplink/updater ownership was split into dedicated tasks:
  - `feature.022.desktop-settings-contract-implementation.md`
  - `feature.023.desktop-deeplink-protocol-implementation.md`
  - `feature.024.desktop-updater-app-infrastructure.md`
- Task moved from `todo` to `done` to keep active backlog module-scoped and non-duplicated.
