---
ID: 19
Title: [CLIENT][svc:new:ipc-core] Desktop IPC, Core channels implementation
Complexity: high
Category: CLIENT
Primary Module: src/desktop/main/ipc/handlers/core.ts
Server Impact: none
---

# [CLIENT][svc:new:ipc-core] Desktop IPC, Core channels implementation

## 1. Executive Summary

Реализовать реальные core IPC-каналы, необходимые для базовой совместимости и переносимых фич: window lifecycle, filesystem operations, shell/network utility и базовые runtime events.

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

## 3. Out of Scope

- Полная updater-логика.
- Полная recipe trust бизнес-семантика.

## 4. Requirements

- `MUST` валидировать URL/path/boolean payload.
- `MUST` возвращать deterministic errors вместо raw throw.
- `MUST` не утекать секретами в ошибки и логи.
- `SHOULD` сохранить platform-aware behavior (darwin/win/linux) через deterministic mocks/tests.

## 5. Acceptance Criteria

- `MUST` core channels проходят happy path + error path тесты.
- `MUST` main->renderer события доставляются и корректно отписываются.
- `MUST` regression tests для текущего desktop runtime остаются зелеными.

## 6. Dependencies

- Depends on: `feature.018.desktop-ipc-foundation-and-registry.md`.
- Settings/system subset coordination:
  - `feature.022.desktop-settings-contract-implementation.md` is the primary implementation task for Section 7 of `DESKTOP_SETTINGS_CONTRACT.md`.
  - This task MUST avoid duplicating settings-specific implementation tracked in `feature.022`.
- Deeplink subset coordination:
  - `feature.023.desktop-deeplink-protocol-implementation.md` is the primary implementation task for `DESKTOP_DEEPLINK_PROTOCOL.md`.
  - This task MUST avoid duplicating deeplink-specific routing/trust logic tracked in `feature.023`.
