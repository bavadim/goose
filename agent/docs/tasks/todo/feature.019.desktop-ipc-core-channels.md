---
ID: 19
Title: [CLIENT][svc:new:ipc-core] Desktop IPC, Core channels implementation
Complexity: high
Category: CLIENT
Primary Module: src/desktop/main/ipc/handlers/core.ts
Server Impact: minimal
---

# [CLIENT][svc:new:ipc-core] Desktop IPC, Core channels implementation

## 1. Executive Summary

Реализовать core IPC-каналы поверх foundation из `feature.018`, сохранить legacy-совместимость и добавить минимальный typed message skeleton между desktop и server, чтобы новые сообщения добавлялись без рефакторинга каркаса.

## 2. In Scope

- Commands:
  - `react-ready`,
  - `create-chat-window`,
  - `close-window`,
  - `hide-window`,
  - `reload-app`,
  - `restart-app`.
- Runtime compatibility RPC:
  - `get-goosed-host-port`,
  - compatibility check for `desktop:get-state`, `desktop:send-logs`.
- Filesystem RPC:
  - `directory-chooser`, `select-file-or-directory`,
  - `read-file`, `write-file`,
  - `ensure-directory`, `list-files`,
  - `get-allowed-extensions`,
  - `open-directory-in-explorer`, `add-recent-dir`.
- Shell/network utility:
  - `open-external`, `open-in-chrome`,
  - `fetch-metadata`,
  - `check-ollama`,
  - `logInfo`, `notify`,
  - `broadcast-theme-change`.
- Main->renderer events (core delivery path):
  - `fatal-error`, `theme-changed`, `set-view`, `focus-input`,
  - `new-chat`, `find-command`, `find-next`, `find-previous`, `use-selection-find`,
  - `mouse-back-button-clicked`.
- Typed message skeleton (desktop <-> server):
  - typed envelope types in `src/desktop/shared/ipc.ts`,
  - `POST /desktop/messages` (client -> server),
  - `GET /desktop/messages/stream` SSE (server -> client),
  - main-side bridge module for dispatch/subscribe and forwarding to renderer events.

## 3. Out of Scope

- Полная updater-логика.
- Полная recipe trust бизнес-семантика.
- Полная бизнес-логика server message topics (только skeleton/stub dispatch).
- Полная реализация settings/deeplink доменов (`feature.022`, `feature.023`).

## 4. Requirements

- `MUST` валидировать URL/path/boolean payload.
- `MUST` возвращать deterministic errors вместо raw throw.
- `MUST` не утекать секретами в ошибки и логи.
- `MUST` использовать типизированные message envelopes для desktop/server обмена.
- `MUST` сохранить wire-совместимость legacy channel names 1:1.
- `MUST` иметь registry-driven подключение каналов, без разрозненных inline IPC регистраций.
- `MUST` сохранить рабочими `desktop:get-state` и `desktop:send-logs` без регрессий.
- `SHOULD` сохранить platform-aware behavior (darwin/win/linux) через deterministic mocks/tests.
- `SHOULD` держать серверный skeleton минимальным: transport + validation + deterministic stubs.

## 5. Acceptance Criteria

- `MUST` core channels проходят happy path + error path тесты.
- `MUST` main->renderer события доставляются и корректно отписываются.
- `MUST` regression tests для текущего desktop runtime остаются зелеными.
- `MUST` `POST /desktop/messages` принимает валидный typed envelope и отклоняет невалидный deterministic ошибкой.
- `MUST` `GET /desktop/messages/stream` отдает typed SSE события в стабильном формате.
- `MUST` тесты подтверждают reconnect/failure path bridge без raw exceptions.
- `MUST` добавление нового channel/message требует только:
  - тип в `shared/ipc.ts`,
  - handler registration,
  - тест.

## 6. Dependencies

- Depends on: `feature.018.desktop-ipc-foundation-and-registry.md`.
- Settings/system subset coordination:
  - `feature.022.desktop-settings-contract-implementation.md` is the primary implementation task for Section 7 of `DESKTOP_SETTINGS_CONTRACT.md`.
  - This task MUST avoid duplicating settings-specific implementation tracked in `feature.022`.
- Deeplink subset coordination:
  - `feature.023.desktop-deeplink-protocol-implementation.md` is the primary implementation task for `DESKTOP_DEEPLINK_PROTOCOL.md`.
  - This task MUST avoid duplicating deeplink-specific routing/trust logic tracked in `feature.023`.
- Works with:
  - `feature.021.desktop-ipc-contract-verification.md` for inventory/contract sync tests.
  - `feature.027.agent-runtime-lifecycle-and-stub-services.md` and `feature.028.desktop-chat-window-streaming-loaders-tool-log.md` as downstream consumers of message skeleton.

## 7. Interface Changes

- Shared types:
  - `ClientToServerMessage` envelope,
  - `ServerToClientMessage` envelope,
  - deterministic response/error shape for message dispatch.
- Server API additions:
  - `POST /desktop/messages`,
  - `GET /desktop/messages/stream`.
- Desktop main additions:
  - server message bridge service to push server events into typed main->renderer event path.

## 8. Implementation Plan

1. Закрыть core IPC handlers в `src/desktop/main/ipc/handlers/core.ts` с input validation и deterministic errors.
2. Подключить registry в `main/index.ts` и убрать дублирующие inline регистрации IPC.
3. Добавить typed message envelopes в `shared/ipc.ts` и thin transport wrappers в preload/shared API.
4. Добавить минимальный server transport skeleton:
   - HTTP message ingest endpoint,
   - SSE stream endpoint,
   - deterministic stub dispatcher.
5. Реализовать desktop main bridge:
   - отправка client messages в server endpoint,
   - подписка на SSE stream,
   - forwarding server events в main->renderer bus.
6. Зафиксировать тесты на core IPC, bridge reliability, и regression текущих каналов.

## 9. Test Scenarios

- `MUST` core channel tests:
  - window lifecycle commands (happy/error),
  - filesystem/shell utilities (happy/error),
  - runtime compatibility RPC.
- `MUST` event tests:
  - subscribe/unsubscribe,
  - deferred delivery around `react-ready`.
- `MUST` server skeleton tests:
  - valid/invalid message envelope for `POST /desktop/messages`,
  - SSE frame shape and reconnect behavior.
- `MUST` contract alignment tests:
  - registry key presence for implemented core channels,
  - no raw thrown errors crossing preload boundary.
