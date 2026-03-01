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

Создать базовую IPC-инфраструктуру для `src/desktop`: единый typed contract, preload bridge и main registry, чтобы все следующие IPC-каналы добавлялись без дублирования.

## 2. In Scope

- `src/desktop/shared/ipc.ts`:
  - channel constants,
  - request/response/event payload types,
  - `IpcError` / `IpcErrorCode` / `IpcResult<T>`,
  - inventory lists для contract tests.
- Расширение `src/desktop/shared/api.ts` до near-full surface.
- Обновление `src/desktop/preload/index.ts`:
  - typed invoke/send wrappers,
  - typed event subscriptions,
  - error normalization.
- Введение main-side registry:
  - `src/desktop/main/ipc/register.ts`,
  - `src/desktop/main/ipc/events.ts`,
  - каркас `src/desktop/main/ipc/handlers/*`.

## 3. Out of Scope

- Реальные бизнес-реализации всех каналов.
- Полный перенос legacy UI к новым API usage patterns.

## 4. Requirements

- `MUST` не использовать `any` в публичном IPC API.
- `MUST` сохранить wire-совместимость legacy channel names.
- `MUST` реализовать единый deterministic error envelope.
- `MUST` поддержать deferred delivery событий до `react-ready`.
- `SHOULD` минимизировать число новых файлов и оставить структуру плоской.

## 5. Acceptance Criteria

- `MUST` `tsc --noEmit` проходит.
- `MUST` `window.desktopApi` включает typed surface для всех RFC каналов.
- `MUST` main registry подключен в `main/index.ts` и используется для всех новых каналов.
- `MUST` есть тесты на базовый error normalization и event subscribe/unsubscribe lifecycle.

## 6. Dependencies

- Starts IPC implementation stream for `feature.019`, `feature.020`, `feature.021`.
