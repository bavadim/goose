# DESKTOP IPC CONTRACT

Version: 1.0  
Status: Normative  
Language conventions: The key words MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY are to be interpreted as described in RFC 2119.

## 1. Purpose

This document defines the normative IPC contract for Goose desktop compatibility.
It is the source of truth for renderer-main process communication and migration parity from `../ui/desktop` to this repository.

## 2. Scope

In scope:
- Renderer -> Main IPC RPC channels (`ipcRenderer.invoke` / `ipcMain.handle`).
- Renderer -> Main command channels (`ipcRenderer.send` / `ipcMain.on`).
- Main -> Renderer event channels (`webContents.send` consumed in renderer).
- IPC error model and security requirements.
- Compatibility gap matrix to current implementation (`src/desktop`).

Out of scope:
- Server HTTP API contracts.
- Deep link URI grammar (covered by `DESKTOP_DEEPLINK_PROTOCOL.md`).
- Settings semantic model details (covered by `DESKTOP_SETTINGS_CONTRACT.md`).

## 3. Contract Taxonomy

### 3.1 Channel classes

- `rpc`: request-response channels (`invoke/handle`).
- `cmd`: fire-and-forget channels (`send/on`).
- `event`: main -> renderer pushed events (`webContents.send`).

### 3.2 Canonical ID scheme

Legacy names are preserved for compatibility, but canonical IDs MUST be used in this RFC.

- RPC: `rpc:<domain>.<method>`
- Command: `cmd:<domain>.<action>`
- Event: `event:<domain>.<name>`

Examples:
- `rpc:desktop.getSettings`
- `cmd:window.createChat`
- `event:updater.state`

## 4. IPC Error Envelope

All RPC channels SHOULD converge to this envelope at the preload boundary:

```ts
export type IpcError = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  retryable?: boolean;
};
```

Normative error codes:
- `IPC_INVALID_INPUT`
- `IPC_UNAUTHORIZED`
- `IPC_UNSUPPORTED_PLATFORM`
- `IPC_NOT_FOUND`
- `IPC_IO_ERROR`
- `IPC_INTERNAL`

Channels returning bare booleans/nullable values in legacy behavior MAY be wrapped in this envelope by compatibility adapters.

## 5. Security Requirements

- Privileged channels (`filesystem`, `shell`, `window`, `updater`) MUST validate inputs.
- URL-oriented channels MUST block dangerous protocols and allow only explicit allowlists.
- File-system channels MUST normalize and validate paths.
- IPC MUST NOT expose plaintext secrets to renderer unless explicitly required by legacy compatibility.
- Error payloads MUST NOT leak secrets/tokens.

## 6. Legacy IPC Inventory (Normative)

Legend:
- Direction: `R->M` (renderer to main), `M->R` (main to renderer).
- Status: `implemented`, `partial`, `missing`, `incompatible` (current repo state).

### 6.1 RPC Channels (`invoke/handle`)

| Legacy channel | Canonical ID | Direction | Request type | Response type | Original source | Current status |
|---|---|---|---|---|---|---|
| `directory-chooser` | `rpc:desktop.chooseDirectory` | R->M | `void` | `OpenDialogReturnValue` | preload.ts, main.ts | missing |
| `show-message-box` | `rpc:ui.showMessageBox` | R->M | `MessageBoxOptions` | `MessageBoxReturnValue` | preload.ts, main.ts | missing |
| `show-save-dialog` | `rpc:ui.showSaveDialog` | R->M | `SaveDialogOptions` | `SaveDialogReturnValue` | preload.ts, main.ts | missing |
| `fetch-metadata` | `rpc:network.fetchMetadata` | R->M | `{ url: string }` | `string` | preload.ts, main.ts | missing |
| `check-ollama` | `rpc:system.checkOllama` | R->M | `void` | `boolean` | preload.ts, main.ts | missing |
| `select-file-or-directory` | `rpc:filesystem.selectPath` | R->M | `{ defaultPath?: string }` | `string \| null` | preload.ts, main.ts | missing |
| `get-binary-path` | `rpc:system.getBinaryPath` | R->M | `{ binaryName: string }` | `string` | preload.ts | missing |
| `read-file` | `rpc:filesystem.readFile` | R->M | `{ filePath: string }` | `{ file: string; filePath: string; error: string \| null; found: boolean }` | preload.ts, main.ts | missing |
| `write-file` | `rpc:filesystem.writeFile` | R->M | `{ filePath: string; content: string }` | `boolean` | preload.ts, main.ts | missing |
| `ensure-directory` | `rpc:filesystem.ensureDirectory` | R->M | `{ dirPath: string }` | `boolean` | preload.ts, main.ts | missing |
| `list-files` | `rpc:filesystem.listFiles` | R->M | `{ dirPath: string; extension?: string }` | `string[]` | preload.ts, main.ts | missing |
| `get-allowed-extensions` | `rpc:filesystem.getAllowedExtensions` | R->M | `void` | `string[]` | preload.ts, main.ts | missing |
| `set-menu-bar-icon` | `rpc:desktop.setMenuBarIcon` | R->M | `{ show: boolean }` | `boolean` | preload.ts, main.ts | missing |
| `get-menu-bar-icon-state` | `rpc:desktop.getMenuBarIconState` | R->M | `void` | `boolean` | preload.ts, main.ts | missing |
| `set-dock-icon` | `rpc:desktop.setDockIcon` | R->M | `{ show: boolean }` | `boolean` | preload.ts, main.ts | missing |
| `get-dock-icon-state` | `rpc:desktop.getDockIconState` | R->M | `void` | `boolean` | preload.ts, main.ts | missing |
| `get-settings` | `rpc:desktop.getSettings` | R->M | `void` | `Settings` | preload.ts, main.ts | missing |
| `save-settings` | `rpc:desktop.saveSettings` | R->M | `Settings` | `boolean` | preload.ts, main.ts | missing |
| `get-secret-key` | `rpc:desktop.getSecretKey` | R->M | `void` | `string` | preload.ts, main.ts | missing |
| `get-goosed-host-port` | `rpc:desktop.getGoosedHostPort` | R->M | `void` | `string \| null` | preload.ts, main.ts | missing |
| `set-wakelock` | `rpc:desktop.setWakelock` | R->M | `{ enable: boolean }` | `boolean` | preload.ts, main.ts | missing |
| `get-wakelock-state` | `rpc:desktop.getWakelockState` | R->M | `void` | `boolean` | preload.ts, main.ts | missing |
| `set-spellcheck` | `rpc:desktop.setSpellcheck` | R->M | `{ enable: boolean }` | `boolean` | preload.ts, main.ts | missing |
| `get-spellcheck-state` | `rpc:desktop.getSpellcheckState` | R->M | `void` | `boolean` | preload.ts, main.ts | missing |
| `open-notifications-settings` | `rpc:desktop.openNotificationSettings` | R->M | `void` | `boolean` | preload.ts, main.ts | missing |
| `open-external` | `rpc:shell.openExternal` | R->M | `{ url: string }` | `void` | preload.ts, main.ts | missing |
| `check-for-updates` | `rpc:updater.check` | R->M | `void` | `{ updateInfo: unknown; error: string \| null }` | preload.ts, autoUpdater.ts | missing |
| `download-update` | `rpc:updater.download` | R->M | `void` | `{ success: boolean; error: string \| null }` | preload.ts, autoUpdater.ts | missing |
| `install-update` | `rpc:updater.install` | R->M | `void` | `void` | preload.ts, autoUpdater.ts | missing |
| `get-update-state` | `rpc:updater.getState` | R->M | `void` | `{ updateAvailable: boolean; latestVersion?: string } \| null` | preload.ts, autoUpdater.ts | missing |
| `is-using-github-fallback` | `rpc:updater.isUsingFallback` | R->M | `void` | `boolean` | preload.ts, autoUpdater.ts | missing |
| `has-accepted-recipe-before` | `rpc:recipe.hasAcceptedHash` | R->M | `Recipe` | `boolean` | preload.ts, recipeHash.ts | missing |
| `record-recipe-hash` | `rpc:recipe.recordHash` | R->M | `Recipe` | `boolean` | preload.ts, recipeHash.ts | missing |
| `open-directory-in-explorer` | `rpc:filesystem.openDirectoryInExplorer` | R->M | `{ path: string }` | `boolean` | preload.ts, main.ts | missing |
| `add-recent-dir` | `rpc:desktop.addRecentDir` | R->M | `{ dir: string }` | `boolean \| void` | preload.ts, main.ts | missing |
| `get-current-version` | `rpc:updater.getCurrentVersion` | R->M | `void` | `string` | autoUpdater.ts | missing |
| `desktop:get-state` | `rpc:desktop.getState` | R->M | `void` | `DesktopState` | src/desktop preload/main | implemented |
| `desktop:send-logs` | `rpc:desktop.sendLogs` | R->M | `void` | `SendLogsResult` | src/desktop preload/main | implemented |

### 6.2 Command Channels (`send/on` and `sendSync`)

| Legacy channel | Canonical ID | Direction | Payload | Behavior | Original source | Current status |
|---|---|---|---|---|---|---|
| `react-ready` | `cmd:renderer.ready` | R->M | `void` | Signals renderer readiness for deferred events/deeplinks | preload.ts, main.ts | missing |
| `hide-window` | `cmd:window.hide` | R->M | `void` | Hide current window | preload.ts | missing |
| `create-chat-window` | `cmd:window.createChat` | R->M | `query?, dir?, version?, resumeSessionId?, viewType?, recipeDeeplink?` | Create/focus chat window and optionally pass initial message | preload.ts, main.ts | missing |
| `logInfo` | `cmd:log.info` | R->M | `string` | Renderer log forwarding | preload.ts, main.ts | missing |
| `notify` | `cmd:desktop.notify` | R->M | `{ title: string; body: string }` | Show system notification | preload.ts, main.ts | missing |
| `open-in-chrome` | `cmd:shell.openInChrome` | R->M | `{ url: string }` | Open URL in browser | preload.ts, main.ts | missing |
| `reload-app` | `cmd:window.reload` | R->M | `void` | Reload sender window | preload.ts, main.ts | missing |
| `broadcast-theme-change` | `cmd:theme.broadcastChange` | R->M | `{ mode: string; useSystemTheme: boolean; theme: string }` | Relay theme change to other windows | preload.ts, main.ts | missing |
| `restart-app` | `cmd:app.restart` | R->M | `void` | Relaunch app and exit current process | preload.ts, main.ts | missing |
| `close-window` | `cmd:window.close` | R->M | `void` | Close sender/focused window | preload.ts, main.ts, recipeHash.ts | missing |
| `get-app-version` (`sendSync`) | `cmd:app.getVersionSync` | R->M | `void` | Sync app version retrieval (`event.returnValue`) | preload.ts, main.ts | missing |

### 6.3 Main -> Renderer Events

| Legacy event | Canonical ID | Direction | Payload | Renderer consumers | Original source | Current status |
|---|---|---|---|---|---|---|
| `add-extension` | `event:deeplink.addExtension` | M->R | `string (deeplink URL)` | `ExtensionInstallModal.tsx` | main.ts | missing |
| `open-shared-session` | `event:deeplink.openSharedSession` | M->R | `string (deeplink URL)` | `App.tsx` | main.ts | missing |
| `set-initial-message` | `event:chat.setInitialMessage` | M->R | `string` | `App.tsx` | main.ts | missing |
| `fatal-error` | `event:runtime.fatalError` | M->R | `string` | `App.tsx` | main.ts | missing |
| `mouse-back-button-clicked` | `event:input.mouseBack` | M->R | `void` | `BackButton.tsx` | main.ts | missing |
| `theme-changed` | `event:theme.changed` | M->R | `{ mode: string; useSystemTheme: boolean; theme: string }` | `ThemeContext.tsx` | main.ts | missing |
| `updater-event` | `event:updater.state` | M->R | `{ event: string; data?: unknown }` | `UpdateSection.tsx` | autoUpdater.ts | missing |
| `set-view` | `event:view.set` | M->R | `view: string, tab?: string` | `App.tsx` | main.ts, autoUpdater.ts | missing |
| `new-chat` | `event:chat.new` | M->R | `void` | `App.tsx` | main.ts | missing |
| `focus-input` | `event:chat.focusInput` | M->R | `void` | `App.tsx` | main.ts | missing |
| `find-command` | `event:search.open` | M->R | `void` | `SearchView.tsx` | main.ts | missing |
| `find-next` | `event:search.next` | M->R | `void` | `SearchView.tsx` | main.ts | missing |
| `find-previous` | `event:search.previous` | M->R | `void` | `SearchView.tsx` | main.ts | missing |
| `use-selection-find` | `event:search.useSelection` | M->R | `void` | `SearchView.tsx` | main.ts | missing |

## 7. Current Implementation Gap Matrix

### 7.1 Summary

- Legacy RPC channels discovered: 37 (plus 2 new channels in current implementation).
- Legacy command channels discovered: 11.
- Legacy main->renderer events discovered: 14.
- Implemented in current repo: 2 (`desktop:get-state`, `desktop:send-logs`).

### 7.2 Status model

- `implemented`: contract is available and behavior-compatible.
- `partial`: channel exists but payload/error/semantics diverge.
- `missing`: no channel.
- `incompatible`: channel replaced with different semantics.

### 7.3 High-priority migration groups

1. Core renderer lifecycle and window control:
- `react-ready`, `create-chat-window`, `close-window`, `set-initial-message`, `focus-input`, `set-view`.

2. Desktop settings/system controls:
- `get-settings`, `save-settings`, `set/get-menu-bar-icon`, `set/get-dock-icon`, `set/get-wakelock`, `set/get-spellcheck`, `open-notifications-settings`.

3. Filesystem and shell boundary:
- `read-file`, `write-file`, `ensure-directory`, `list-files`, `directory-chooser`, `open-external`, `open-directory-in-explorer`.

4. Updater surface:
- `check-for-updates`, `download-update`, `install-update`, `updater-event`, `get-update-state`, `is-using-github-fallback`.

5. Deep-link delivery events:
- `add-extension`, `open-shared-session`.

## 8. Validation Rules at IPC Boundary

- All URL payloads MUST be parsed via `URL` and protocol-validated.
- All filesystem payloads MUST be string-typed, normalized, and checked for allowed scope.
- Boolean toggles MUST reject non-boolean payloads with `IPC_INVALID_INPUT`.
- Channels returning union payloads SHOULD include deterministic discriminators.

## 9. Legacy Alias and Deprecation Rules

- Legacy channel names MUST remain accepted until feature parity is complete.
- Canonical IDs are RFC-only identifiers and SHOULD be mapped 1:1 to legacy names by adapters.
- Breaking rename/removal MUST follow a two-stage deprecation:
  1. alias + warning,
  2. removal after compatibility release.

## 10. Conformance Checklist

A desktop IPC implementation is conformant to this RFC only if all checks pass:

1. All channels in Sections 6.1, 6.2, 6.3 are either implemented or explicitly marked unsupported with deterministic error.
2. RPC boundary uses normalized error envelope.
3. Privileged channels enforce validation and security constraints.
4. Renderer event contracts are typed and deterministic.
5. Gap matrix status is maintained when channels are added/changed.

## 11. Source References

Original Goose desktop:
- `../ui/desktop/src/preload.ts`
- `../ui/desktop/src/main.ts`
- `../ui/desktop/src/utils/autoUpdater.ts`
- `../ui/desktop/src/utils/recipeHash.ts`
- `../ui/desktop/src/App.tsx`
- `../ui/desktop/src/components/ExtensionInstallModal.tsx`
- `../ui/desktop/src/components/conversation/SearchView.tsx`
- `../ui/desktop/src/components/ui/BackButton.tsx`
- `../ui/desktop/src/contexts/ThemeContext.tsx`

Current implementation:
- `src/desktop/preload/index.ts`
- `src/desktop/main/index.ts`
- `src/desktop/shared/api.ts`
