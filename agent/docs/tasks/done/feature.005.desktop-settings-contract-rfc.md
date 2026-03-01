---
ID: 5
Title: Desktop compatibility, Produce complete DESKTOP_SETTINGS_CONTRACT RFC
Complexity: medium
---

# Desktop compatibility, Produce complete DESKTOP_SETTINGS_CONTRACT RFC

## 1. Executive Summary

**Abstract:**  
To preserve user-facing settings during migration from `../ui/desktop` while simplifying implementation, the project needs a single normative settings RFC focused on behavioral compatibility: canonical keys, defaults, validation, lifecycle, and migration mapping. Storage backend details (localStorage/electron-store/file) are implementation details and MUST NOT be normative.

**Objectives (SMART):**
- **Specific:** Produce `docs/requirements/DESKTOP_SETTINGS_CONTRACT.md`.
- **Measurable:** Every settings key and behavior from original desktop is documented with types, defaults, persistence rules, and error handling.
- **Achievable:** Source behavior is available in original `settings` utilities, `main/preload`, and settings UI modules.
- **Relevant:** Settings behavior drives runtime UX, platform integration, and migration safety.
- **Time-bound:** One documentation-focused task iteration.

## 2. Context & Problem Statement

### Current State

- Settings behavior is distributed across:
  - file-backed settings in main process,
  - renderer localStorage settings,
  - env/appConfig forced values,
  - platform-specific toggles and shortcut handling.
- The current fork already has a consolidated `SettingsStore`.
- No dedicated settings compatibility RFC exists.

### The "Why"

Without a formal contract, migration can drift in defaults, persistence, validation, and platform behavior. This causes user-visible incompatibilities and hard-to-debug regressions.

### In Scope

- Define full desktop settings domain model:
  - canonical user-facing settings model,
  - runtime system toggles,
  - legacy localStorage/file inputs as migration sources,
  - env/appConfig-forced settings.
- Define full type schema, defaults, and validation semantics.
- Define backend-agnostic store contract and apply-time behavior.
- Define settings-related IPC contract and error semantics.
- Define platform-specific behavior (macOS/Linux/Windows).
- Define backward compatibility and migration rules.
- Include strict parity gap matrix vs current implementation.

### Out of Scope

- Implementing settings runtime changes in code.
- Rewriting server `/config/*` API contracts (reference only where needed).
- Non-settings feature behavior (deeplinks, IPC general contract, etc.).

## 3. Proposed Technical Solution

### Architecture Overview

Create `docs/requirements/DESKTOP_SETTINGS_CONTRACT.md` as a normative contract with these sections:
1. Purpose and compatibility target.
2. Canonical settings model and ownership.
3. Type schemas and defaults.
4. Store contract (backend-agnostic) and lifecycle semantics.
5. IPC/API boundaries for settings operations.
6. Legacy migration inputs and mapping rules.
7. Platform-specific behavior.
8. Gap matrix.
9. Conformance checklist.

### Interface Changes

No runtime interfaces are changed by this task.  
Deliverable is requirements/specification only.

### Project Code Reference

- Original behavior:
  - `../ui/desktop/src/utils/settings.ts`
  - `../ui/desktop/src/main.ts`
  - `../ui/desktop/src/preload.ts`
  - `../ui/desktop/src/components/settings/**`
- Current implementation baseline:
  - `src/desktop/main/settings/settings.ts`
  - `src/desktop/main/settings/config.ts`
  - `src/desktop/main/settings/config-store.ts`
  - `src/desktop/main/settings/store.ts`
  - `src/desktop/main/index.ts`
  - `src/desktop/preload/index.ts`

## 4. Requirements

- `MUST` create `docs/requirements/DESKTOP_SETTINGS_CONTRACT.md`.
- `MUST` define canonical settings categories and source-of-truth ownership:
  - canonical persisted settings model,
  - runtime system toggles,
  - legacy migration sources (including localStorage and legacy files),
  - env/appConfig overrides.
- `MUST` define normative schemas and defaults for persisted settings, including:
  - `showMenuBarIcon`,
  - `showDockIcon`,
  - `enableWakelock`,
  - `spellcheckEnabled`,
  - `sessionSharingConfig`,
  - `responseStyle`,
  - `showPricing`.
- `MUST` define broad localStorage inventory from original desktop and classify each key as:
  - canonical setting,
  - legacy migration-only input,
  - non-settings UI state (out of normative scope).
- `MUST` define validation and normalization rules for each settings field.
- `MUST` define read/write/apply lifecycle semantics (when and how values are loaded/applied).
- `MUST` define backend-agnostic settings store guarantees and `MUST NOT` require a specific storage backend implementation.
- `MUST` define settings-related IPC boundaries, request/response shapes, and error envelope expectations.
- `MUST` define platform-specific behavior and constraints (macOS/Linux/Windows).
- `MUST` include parity gap matrix:
  - original behavior reference,
  - required behavior,
  - current status (`implemented`, `partial`, `missing`, `incompatible`, `excluded`),
  - migration note.
- `MUST` explicitly mark excluded settings domains for this RFC:
  - `externalGoosed`,
  - keyboard shortcuts,
  - telemetry settings.
- `SHOULD` define deterministic behavior for unknown fields and malformed stored values.
- `SHOULD` include restart-required vs immediate-apply semantics per setting.
- `MAY` include phased migration grouping by settings category.

## 5. Acceptance Criteria

- `MUST` RFC contains complete settings inventory from referenced original files.
- `MUST` each canonical settings key has explicit type, default, validation behavior, and apply-time behavior.
- `MUST` RFC defines store contract without coupling requirements to localStorage/electron-store/file.
- `MUST` legacy localStorage and legacy file keys are documented with deterministic migration/fallback behavior.
- `MUST` settings-related IPC behavior is defined with deterministic error outcomes.
- `MUST` platform-specific behavior differences are explicitly documented.
- `MUST` parity gap matrix has no uncategorized settings behavior entries.
- `MUST` excluded domains are explicitly listed with rationale and compatibility note.
- `MUST` RFC uses normative requirement language (`MUST/SHOULD/MAY`) and testable statements.

## Implementation Notes

- Modified files:
  - `docs/requirements/DESKTOP_SETTINGS_CONTRACT.md`
  - `docs/tasks/todo/feature.005.desktop-settings-contract-rfc.md`
- Latest commit hash at close time: `78812d2c6`
