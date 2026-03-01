---
ID: 21
Title: [CLIENT][svc:new:ipc-contract-tests] Desktop IPC, Contract verification and gap matrix sync
Complexity: medium
Category: CLIENT
Primary Module: tests/desktop.ipc.contract.test.ts
Server Impact: none
---

# [CLIENT][svc:new:ipc-contract-tests] Desktop IPC, Contract verification and gap matrix sync

## 1. Executive Summary

Закрыть IPC stream: автоматизировать проверку RFC inventory и синхронизировать `DESKTOP_IPC_CONTRACT.md` с фактической реализацией.

## 2. In Scope

- Contract tests на весь inventory:
  - presence (RPC/CMD/EVENT),
  - request/response shape,
  - deterministic error envelope.
- Coverage для core channels: happy path + error path.
- Coverage для stub channels: deterministic `IPC_NOT_IMPLEMENTED`/safe fallback.
- Обновление gap matrix в `docs/requirements/DESKTOP_IPC_CONTRACT.md`.

## 3. Out of Scope

- Добавление новых каналов вне RFC.

## 4. Requirements

- `MUST` каждый канал из RFC имеет тестовое подтверждение присутствия.
- `MUST` нет неучтенных `missing` каналов.
- `MUST` статусы в gap matrix соответствуют реальному коду.
- `MUST` `npm run test` проходит.

## 5. Acceptance Criteria

- `MUST` contract tests deterministic и стабильны.
- `MUST` RFC gap matrix обновлен и проверяем в ревью.
- `MUST` PR-ready состояние достигается одной командой `npm run test`.

## 6. Dependencies

- Depends on:
  - `feature.019.desktop-ipc-core-channels.md`
  - `feature.020.desktop-ipc-stubbed-channels.md`
  - `feature.022.desktop-settings-contract-implementation.md`
  - `feature.023.desktop-deeplink-protocol-implementation.md`
  - `feature.024.desktop-updater-app-infrastructure.md`
