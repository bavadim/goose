---
ID: 4
Title: Desktop compatibility, Produce complete DESKTOP_DEEPLINK_PROTOCOL RFC
Complexity: medium
---

# Desktop compatibility, Produce complete DESKTOP_DEEPLINK_PROTOCOL RFC

## 1. Executive Summary

**Abstract:**  
To support full user-facing compatibility with `../ui/desktop`, the project needs a formal deep link and app launch protocol specification. The RFC must define all `goose://` routes and all launch entry points that affect deep link behavior.

**Objectives (SMART):**
- **Specific:** Produce `docs/requirements/DESKTOP_DEEPLINK_PROTOCOL.md` with complete, normative protocol behavior.
- **Measurable:** Every original deep link entry path and host route is documented with typed payloads, routing, and errors.
- **Achievable:** Protocol behavior is discoverable from original desktop code and tests.
- **Relevant:** Deep links control extension install, shared sessions, recipe/bot startup, and launch routing.
- **Time-bound:** Single documentation-focused iteration.

## 2. Context & Problem Statement

### Current State

- No dedicated deep link protocol RFC exists in current requirements.
- Original desktop implements deep link behavior across multiple launch paths:
  - startup args (`process.argv`),
  - single-instance relay,
  - macOS `open-url`,
  - macOS `open-file/open-files`.
- Behavior is distributed across main process and renderer helpers.

### The "Why"

Without a normative protocol spec, migration will likely diverge in routing semantics, error handling, and security checks. This creates user-visible incompatibilities and hard-to-debug platform regressions.

### In Scope

- Define `goose://` protocol grammar and typed payload model.
- Define full launch entry protocol:
  - Windows/Linux startup arg handling,
  - Windows/Linux second-instance handling,
  - macOS `open-url`,
  - macOS `open-file/open-files`.
- Define routing/dispatch semantics:
  - create window vs reuse/focus existing,
  - defer-until-renderer-ready behavior,
  - renderer event dispatch expectations.
- Define validation/security rules for deep link payloads.
- Define deterministic error classes and expected behavior.
- Include strict-parity gap matrix versus current implementation.

### Out of Scope

- Implementing deep link runtime code in this task.
- Generic external URL policy beyond behavior needed to define launch protocol.
- Settings contract and IPC contract details outside deep link interactions.

## 3. Proposed Technical Solution

### Architecture Overview

Author `DESKTOP_DEEPLINK_PROTOCOL.md` as a normative RFC with strict parity target.

The RFC MUST contain:
1. Protocol surfaces (`goose://` + app launch entry points).
2. URI grammar and typed objects for each host route.
3. Routing and window management semantics by platform/entry point.
4. Validation and security checks.
5. Error taxonomy and deterministic outcomes.
6. Compatibility gap matrix and conformance checklist.

### Interface Changes

No code interface changes in this task.  
Deliverable is specification and compatibility baseline only.

### Project Code Reference

- `../ui/desktop/src/main.ts`
- `../ui/desktop/src/components/settings/extensions/deeplink.ts`
- `../ui/desktop/src/recipe/index.ts`
- `../ui/desktop/src/sessionLinks.ts`
- `../ui/desktop/src/App.tsx`
- `../ui/desktop/src/utils/autoUpdater.ts`

## 4. Requirements

- `MUST` create `docs/requirements/DESKTOP_DEEPLINK_PROTOCOL.md`.
- `MUST` specify strict compatibility target with original desktop behavior.
- `MUST` define supported `goose://` host routes:
  - `extension`,
  - `sessions`,
  - `recipe`,
  - `bot`.
- `MUST` define launch entry paths and differences:
  - startup argument path,
  - second-instance path,
  - macOS `open-url`,
  - macOS `open-file/open-files`.
- `MUST` define typed payload/parameter schema for each route, including required vs optional fields.
- `MUST` define route-specific validation and security checks, including command allowlist behavior for extension deep links.
- `MUST` define route-specific dispatch behavior:
  - renderer events (`add-extension`, `open-shared-session`, `set-initial-message`),
  - new-window vs existing-window behavior.
- `MUST` define deterministic deep link error codes and expected handling behavior.
- `MUST` include a parity gap matrix:
  - original behavior reference,
  - required behavior statement,
  - current status (`implemented`, `partial`, `missing`, `incompatible`),
  - migration note.
- `SHOULD` include grammar examples for every supported route.
- `SHOULD` include alias/deprecation policy for any future canonicalization.
- `MAY` include phased migration grouping for implementation order.

## 5. Acceptance Criteria

- `MUST` RFC includes complete inventory of deep link and launch entry behaviors from original code references.
- `MUST` every supported deep link route has explicit:
  - payload schema,
  - validation rules,
  - dispatch behavior,
  - failure behavior.
- `MUST` extension deep link rules include documented command and argument security constraints.
- `MUST` session share deep link rules include token validation behavior.
- `MUST` recipe/bot deep link rules include config decoding and parameter extraction behavior.
- `MUST` launch entry handling differences (platform + lifecycle timing) are explicitly documented.
- `MUST` gap matrix maps each original behavior to current project status with no uncategorized entries.
- `MUST` requirement language is normative and testable (`MUST/SHOULD/MAY`) without narrative-only statements.

## Implementation Notes

- RFC deliverable completed in `docs/requirements/DESKTOP_DEEPLINK_PROTOCOL.md`.
- Remaining runtime implementation scope is tracked in `docs/tasks/todo/feature.023.desktop-deeplink-protocol-implementation.md`.
- Task moved from `todo` to `done` during backlog grooming to remove RFC duplication in active queue.
