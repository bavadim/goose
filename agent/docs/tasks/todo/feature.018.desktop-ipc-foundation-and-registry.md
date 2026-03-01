---
ID: 18
Title: [CLIENT][svc:new:ipc-registry] Desktop IPC, Foundation and typed registry
Complexity: high
Category: CLIENT
Primary Module: src/desktop/shared/ipc.ts
Server Impact: none
---

# [CLIENT][svc:new:ipc-registry] Desktop IPC, Foundation and typed registry

## 1. Executive Summary

Собрать простой и расширяемый IPC-фундамент для desktop runtime: единый typed контракт каналов, preload typed bridge и main-side registry. Задача должна закрыть инфраструктурный слой полностью, чтобы в следующих задачах добавлялась только бизнес-логика каналов без переделки IPC каркаса.

## 2. In Scope

- Полный typed inventory каналов из `docs/requirements/DESKTOP_IPC_CONTRACT.md` (RPC/CMD/EVENT) в `src/desktop/shared/ipc.ts`.
- Единый контракт ошибок на IPC boundary:
  - `IpcErrorCode`,
  - `IpcError`,
  - `IpcResult<T>`.
- Typed maps:
  - `RpcRequestMap`,
  - `RpcResponseMap`,
  - `CmdPayloadMap`,
  - `EventPayloadMap`.
- Инвентарь каналов как source-of-truth для contract tests.
- Расширение `src/desktop/shared/api.ts`:
  - generic typed transport (`invoke/send/on`),
  - domain wrappers поверх generic API.
- Обновление `src/desktop/preload/index.ts`:
  - typed bridge,
  - subscribe/unsubscribe для main->renderer events,
  - deterministic error normalization.
- Main-side registry skeleton:
  - `src/desktop/main/ipc/register.ts`,
  - `src/desktop/main/ipc/events.ts`,
  - `src/desktop/main/ipc/handlers/rpc.ts`,
  - `src/desktop/main/ipc/handlers/cmd.ts`.
- Deferred event delivery до `react-ready` (queue + flush).
- Регистрация всех RFC каналов сразу:
  - текущие рабочие каналы сохраняют реальную реализацию,
  - остальные получают deterministic placeholder/stub поведение.

## 3. Out of Scope

- Реальные бизнес-реализации всех каналов.
- Полный перенос legacy renderer UX.
- Изменение server HTTP runtime.

## 4. Interface Changes

- Добавляется `src/desktop/shared/ipc.ts` как единственный источник channel names и payload types.
- `DesktopApi` становится двухуровневым:
  - generic typed transport API,
  - domain-level convenience wrappers.
- Main process перестает регистрировать IPC inline в `main/index.ts`; регистрация централизуется в `main/ipc/register.ts`.
- Вводится typed main->renderer event bus с `react-ready` gating.

## 5. Requirements

- `MUST` не использовать `any` в публичном IPC API.
- `MUST` сохранить wire-совместимость legacy channel names 1:1.
- `MUST` реализовать единый deterministic error envelope.
- `MUST` поддержать deferred delivery событий до `react-ready`.
- `MUST` зарегистрировать все каналы из RFC inventory (даже если handler placeholder).
- `MUST` оставить текущие `desktop:get-state` и `desktop:send-logs` рабочими без регрессий.
- `MUST` выдавать deterministic placeholder результат для неготовых каналов.
- `MUST` держать типы каналов в одном месте (`shared/ipc.ts`) без дублирования в preload/main.
- `SHOULD` минимизировать число новых файлов и оставить структуру плоской.
- `SHOULD` использовать registry-driven handler maps вместо ручного `ipcMain.handle/on` в нескольких местах.

## 6. Acceptance Criteria

- `MUST` `tsc --noEmit` проходит.
- `MUST` `window.desktopApi` включает typed surface для всех RFC каналов.
- `MUST` main registry подключен в `main/index.ts` и используется для всех новых каналов.
- `MUST` есть тесты на базовый error normalization и event subscribe/unsubscribe lifecycle.
- `MUST` есть тест на полноту inventory: registry keys = typed inventory keys.
- `MUST` есть тест на deferred delivery: событие до `react-ready` доставляется после `react-ready`.
- `MUST` `npm run test` проходит.

## 7. Dependencies

- Starts IPC implementation stream for `feature.019`, `feature.020`, `feature.021`.
- Blocks:
  - `feature.019.desktop-ipc-core-channels.md`
  - `feature.020.desktop-ipc-stubbed-channels.md`
  - `feature.021.desktop-ipc-contract-verification.md`
- Coordinates with:
  - `feature.022.desktop-settings-contract-implementation.md` (settings channels ownership),
  - `feature.023.desktop-deeplink-protocol-implementation.md` (deeplink event ownership),
  - `feature.024.desktop-updater-app-infrastructure.md` (updater channels ownership).

## 8. Risks & Guardrails

- Риск: расхождение typed inventory и реальной регистрации каналов.
  - Guardrail: inventory parity test обязателен.
- Риск: дублирование типов между `shared/api.ts` и `shared/ipc.ts`.
  - Guardrail: все channel payload types объявляются только в `shared/ipc.ts`.
- Риск: скрытая ломка существующих каналов при рефакторе `main/index.ts`.
  - Guardrail: regression tests для `desktop:get-state` и `desktop:send-logs` обязательны.
