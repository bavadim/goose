---
ID: 20
Title: [CLIENT][svc:new:ipc-stubs] Desktop IPC, Deterministic stubs for non-core channels
Complexity: medium
Category: CLIENT
Primary Module: src/desktop/main/ipc/handlers/stubs.ts
Server Impact: none
---

# [CLIENT][svc:new:ipc-stubs] Desktop IPC, Deterministic stubs for non-core channels

## 1. Executive Summary

Закрыть оставшийся RFC surface каналами-заглушками с deterministic typed поведением, чтобы обеспечить compatibility surface без ложной продуктовой функциональности.

## 2. In Scope

- Recipe trust channels:
  - `has-accepted-recipe-before`,
  - `record-recipe-hash`.
- Legacy edge channels, не попавшие в core реализацию, но присутствующие в RFC inventory.
- Temporary stubs для updater channels разрешены только до завершения `feature.024`:
  - `check-for-updates`, `download-update`, `install-update`,
  - `get-update-state`, `is-using-github-fallback`, `get-current-version`,
  - `updater-event`.

## 3. Out of Scope

- Реальная updater бизнес-логика.
- Полный recipe warning UX.
- Реализация каналов, принадлежащих `feature.022` (settings) и `feature.023` (deeplink).

## 4. Requirements

- `MUST` каждый non-core канал возвращает deterministic documented result.
- `MUST` для unsupported behavior использовать `IPC_NOT_IMPLEMENTED`.
- `MUST` shape ответа/ошибки быть строго типизирован и стабилен.
- `SHOULD` минимизировать branching и код stub-слоя.

## 5. Acceptance Criteria

- `MUST` нет RFC каналов со статусом "missing" без явного stub-статуса.
- `MUST` tests подтверждают deterministic ответы stubs.
- `MUST` renderer не получает raw exceptions.

## 6. Dependencies

- Depends on: `feature.018.desktop-ipc-foundation-and-registry.md`.
- Works with: `feature.019.desktop-ipc-core-channels.md`.
- MUST hand off updater ownership to: `feature.024.desktop-updater-app-infrastructure.md`.
