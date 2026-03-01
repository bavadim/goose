---
ID: 3
Title: Desktop compatibility, Produce complete DESKTOP_IPC_CONTRACT RFC
Complexity: medium
---

# Desktop compatibility, Produce complete DESKTOP_IPC_CONTRACT RFC

## 1. Executive Summary

**Abstract:**  
To preserve full user-facing compatibility with `../ui/desktop`, we need a formal, exhaustive IPC contract RFC. Current implementation exposes only a minimal IPC subset (`desktop:get-state`, `settings:get/save/reset`), while original Goose desktop uses a broad IPC surface for window control, OS integrations, updates, file operations, and renderer events.

**Objectives (SMART):**
- **Specific:** Create `docs/requirements/DESKTOP_IPC_CONTRACT.md` as a complete, normative IPC contract.
- **Measurable:** Every IPC channel/event used in original desktop preload/main is cataloged with types and status.
- **Achievable:** Source data is available in `../ui/desktop/src/preload.ts` and `../ui/desktop/src/main.ts`.
- **Relevant:** IPC is a platform-wide dependency for all desktop features.
- **Time-bound:** Single planning/documentation iteration.

## 2. Context & Problem Statement

### Current State

- Current project IPC API is intentionally minimal and not parity-complete.
- No unified contract document exists for desktop IPC.
- Feature migration without a contract-first baseline risks incompatible behavior and hidden gaps.

### The "Why"

IPC is the critical boundary between renderer and privileged main process. Without a complete RFC, migration work will be inconsistent, difficult to test, and prone to regressions/security issues.

### In Scope

- Build an exhaustive IPC inventory from original desktop:
  - `ipcRenderer.invoke` / `ipcMain.handle` channels,
  - `ipcRenderer.send` / `ipcMain.on` command channels,
  - main->renderer event channels consumed via `window.electron.on`.
- Define canonical contract entries with:
  - direction,
  - request/response types,
  - error envelope,
  - security notes.
- Define naming/versioning/deprecation policy for migration.
- Add gap matrix: original channel -> current status in this repo.

### Out of Scope

- Implementing missing channels in code.
- Deep-link protocol RFC details.
- Settings semantics RFC details.

## 3. Proposed Technical Solution

### Architecture Overview

Author `DESKTOP_IPC_CONTRACT.md` as the single normative source for desktop IPC compatibility.

The RFC must include:
1. Taxonomy:
   - `rpc` (request/response),
   - `command` (fire-and-forget),
   - `event` (main->renderer push).
2. Canonical ID model (target naming):
   - `rpc:<domain>.<method>`
   - `cmd:<domain>.<action>`
   - `event:<domain>.<name>`
3. Legacy mapping:
   - existing original channel names remain explicitly mapped.
4. Error model:
   - stable envelope with deterministic error codes.

### Interface Changes

No runtime interface changes in this task.  
This is a requirements RFC and migration baseline only.

### Project Code Reference

- Original source of truth:
  - `../ui/desktop/src/preload.ts`
  - `../ui/desktop/src/main.ts`
  - `../ui/desktop/src/App.tsx` (event consumers)
  - `../ui/desktop/src/utils/autoUpdater.ts` (event producers)
- Current implementation:
  - `src/desktop/preload/index.ts`
  - `src/desktop/main/index.ts`
  - `src/desktop/shared/api.ts`

## 4. Requirements

- `MUST` create `docs/requirements/DESKTOP_IPC_CONTRACT.md`.
- `MUST` include full IPC method and event inventory from original desktop source files.
- `MUST` define, for each contract item:
  - legacy channel name,
  - canonical target ID,
  - direction,
  - input type,
  - output type (if applicable),
  - error codes.
- `MUST` define and document a normalized IPC error envelope:
  - `code`, `message`, optional `details`, optional `retryable`.
- `MUST` include explicit security requirements for privileged operations (filesystem, external open, OS controls).
- `MUST` include gap matrix with statuses:
  - `implemented`,
  - `partial`,
  - `missing`,
  - `incompatible`.
- `SHOULD` include per-channel validation requirements at IPC boundary.
- `SHOULD` include deprecation/alias rules for legacy channels during migration.
- `MAY` include phased migration groups by domain (settings, window, updater, files, events).

## 5. Acceptance Criteria

- `MUST` RFC contains all original `ipcRenderer.invoke` channels defined in original preload.
- `MUST` RFC contains all original `ipcRenderer.send` command channels defined in original preload.
- `MUST` RFC contains all `ipcMain.handle` and `ipcMain.on` channels in original main.
- `MUST` RFC contains all known main->renderer event channels used by renderer (`window.electron.on` consumers).
- `MUST` each listed channel has explicit type contract and error behavior (no `TBD`).
- `MUST` gap matrix maps each legacy channel to current implementation status in this repository.

## Implementation Notes

- Создан нормативный RFC:
  - `docs/requirements/DESKTOP_IPC_CONTRACT.md`
- В RFC зафиксированы:
  - полный inventory legacy IPC (`invoke/handle`, `send/on`, main->renderer events),
  - canonical ID model (`rpc/cmd/event`),
  - normalized IPC error envelope,
  - security requirements на IPC boundary,
  - gap matrix `implemented/partial/missing/incompatible` относительно `src/desktop`.
- Покрытие inventory сверено с исходниками:
  - `../ui/desktop/src/preload.ts`
  - `../ui/desktop/src/main.ts`
  - `../ui/desktop/src/utils/autoUpdater.ts`
  - `../ui/desktop/src/utils/recipeHash.ts`
- `MUST` RFC uses normative requirement language (`MUST/SHOULD/MAY`) consistently.
- `MUST` RFC is actionable: implementation can start without additional design decisions on IPC structure.
