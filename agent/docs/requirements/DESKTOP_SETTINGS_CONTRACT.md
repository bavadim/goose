# DESKTOP SETTINGS CONTRACT

Version: 1.0  
Status: Normative  
Language conventions: The key words MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY are to be interpreted as described in RFC 2119.

## 1. Purpose

This document defines the normative desktop settings contract for compatibility migration from `../ui/desktop` into this repository.

Primary goals:
- preserve user-visible settings without data loss,
- simplify implementation by defining behavior, not storage internals,
- provide a single source of truth for migration and conformance testing.

## 2. Scope

In scope:
- canonical user-facing settings model,
- defaults, normalization, validation, and apply-time semantics,
- settings store behavior contract (backend-agnostic),
- settings-related IPC behavior expectations,
- platform-specific behavior rules,
- legacy settings migration mapping and compatibility gap matrix.

Out of scope:
- implementation details of storage backend (`localStorage`, `electron-store`, JSON files, etc.),
- telemetry preferences contract,
- keyboard shortcuts contract,
- `externalGoosed` remote-backend settings contract,
- non-settings UI state semantics.

## 3. Design Principles

1. **Behavior over mechanism**: the contract MUST define observable behavior, not internal persistence technology.
2. **Single canonical model**: runtime behavior MUST rely on one canonical settings snapshot.
3. **Deterministic normalization**: malformed legacy data MUST resolve to stable defaults.
4. **Migration safety**: legacy values MAY be ingested, but runtime MUST use canonical keys.

## 4. Canonical Settings Model (Normative)

Canonical settings are represented by `AppConfig`.

```ts
export type AppConfig = {
  schemaVersion: number;
  desktop: {
    showMenuBarIcon: boolean;
    showDockIcon: boolean;
    spellcheckEnabled: boolean;
    enableWakelock: boolean;
  };
  rendererPrefs: {
    sessionSharingConfig: {
      enabled: boolean;
    };
    responseStyle: "concise" | "balanced" | "detailed";
    showPricing: boolean;
  };
};
```

### 4.1 Defaults (Normative)

- `schemaVersion`: `1`
- `desktop.showMenuBarIcon`: `true`
- `desktop.showDockIcon`: `true`
- `desktop.spellcheckEnabled`: `true`
- `desktop.enableWakelock`: `false`
- `rendererPrefs.sessionSharingConfig.enabled`: `false`
- `rendererPrefs.responseStyle`: `"balanced"`
- `rendererPrefs.showPricing`: `true`

### 4.2 Validation and Normalization (Normative)

- Boolean fields MUST accept only boolean values; non-boolean values MUST fallback to defaults.
- `responseStyle` MUST accept only `concise`, `balanced`, `detailed`; other values MUST fallback to default.
- Missing objects (`desktop`, `rendererPrefs`, nested objects) MUST fallback to defaults recursively.
- Unknown fields in legacy or persisted payloads MUST be ignored by normalization.

## 5. Settings Store Contract (Normative, Backend-Agnostic)

A conformant implementation MUST provide a settings store abstraction with these capabilities:

1. `getConfig(): AppConfig`
- MUST return normalized canonical snapshot.
- MUST be deterministic for identical persisted input.

2. `saveConfig(next: AppConfig): AppConfig`
- MUST normalize and persist canonical snapshot.
- MUST return normalized persisted value.

3. Persistence guarantees
- Saved canonical settings MUST survive app restart.
- Partial or malformed persisted payloads MUST NOT crash settings load path.

4. Storage backend
- Implementation MUST NOT require any specific backend mechanism.
- `localStorage`, file snapshots, and key-value stores MAY be used internally.

## 6. Apply Lifecycle Semantics (Normative)

- Canonical settings MUST be loaded during main-process startup before backend env snapshot is built.
- Canonical settings MUST be source-of-truth for server env projection.
- `desktop.*` toggles SHOULD apply immediately where supported by platform/runtime.
- If a setting cannot be applied immediately on a platform, behavior MUST be deterministic and documented.
- Unknown/malformed incoming values MUST be normalized before apply-time logic.

## 7. Settings IPC Boundary (Normative)

Settings behavior exposed over desktop IPC MUST be deterministic.

Required settings-related channels (legacy names):
- `get-settings`
- `save-settings`
- `set-menu-bar-icon` / `get-menu-bar-icon-state`
- `set-dock-icon` / `get-dock-icon-state`
- `set-wakelock` / `get-wakelock-state`
- `set-spellcheck` / `get-spellcheck-state`
- `open-notifications-settings`

Normative behavior requirements:
- Inputs MUST be validated (especially boolean toggles).
- Errors MUST be deterministic and MUST NOT expose secrets.
- Platform-specific unsupported behavior MUST return stable safe outcome.

## 8. Environment and AppConfig Overrides

- Runtime MAY project canonical settings into environment variables for backend startup.
- Env/appConfig override keys MUST be documented where they affect settings behavior.

Current canonical env projection keys:
- `AGENT_DESKTOP_SHOW_MENU_BAR_ICON`
- `AGENT_DESKTOP_SHOW_DOCK_ICON`
- `AGENT_DESKTOP_SPELLCHECK_ENABLED`
- `AGENT_DESKTOP_WAKELOCK_ENABLED`
- `AGENT_DESKTOP_RESPONSE_STYLE`
- `AGENT_DESKTOP_SESSION_SHARING`
- `AGENT_DESKTOP_SHOW_PRICING`

## 9. Legacy Migration Inputs and Mapping

Legacy inputs are migration sources, not normative runtime storage contracts.

### 9.1 Legacy file mapping (Normative)

| Legacy source | Legacy key | Canonical key | Mapping rule |
|---|---|---|---|
| `settings.json` | `showMenuBarIcon` | `desktop.showMenuBarIcon` | boolean, fallback default |
| `settings.json` | `showDockIcon` | `desktop.showDockIcon` | boolean, fallback default |
| `settings.json` | `spellcheckEnabled` | `desktop.spellcheckEnabled` | boolean, fallback default |
| `settings.json` | `enableWakelock` | `desktop.enableWakelock` | boolean, fallback default |
| `renderer-prefs.json` | `sessionSharingConfig.enabled` | `rendererPrefs.sessionSharingConfig.enabled` | boolean, fallback default |
| `renderer-prefs.json` | `responseStyle` | `rendererPrefs.responseStyle` | enum normalize |
| `renderer-prefs.json` | `showPricing` | `rendererPrefs.showPricing` | boolean, fallback default |

### 9.2 Legacy localStorage inventory and classification

| Legacy localStorage key | Classification | Canonical mapping | Contract status |
|---|---|---|---|
| `session_sharing_config` | migration-only legacy setting | `rendererPrefs.sessionSharingConfig.enabled` (partial field mapping) | SHOULD map where feasible |
| `response_style` | migration-only legacy setting | `rendererPrefs.responseStyle` | SHOULD map where feasible |
| `show_pricing` | migration-only legacy setting | `rendererPrefs.showPricing` | SHOULD map where feasible |
| `theme` | non-settings UI state for this RFC | none | Out of normative scope |
| `use_system_theme` | non-settings UI state for this RFC | none | Out of normative scope |
| `seenAnnouncementIds` | non-settings UI state | none | Out of normative scope |
| `goose-chat-history` | non-settings UI state | none | Out of normative scope |

Normalization for mapped localStorage legacy keys:
- invalid JSON MUST be ignored with fallback defaults,
- unsupported/unknown fields MUST be ignored,
- absent keys MUST NOT block startup or config load.

## 10. Platform-Specific Behavior

- macOS:
  - `set-dock-icon` behavior is applicable.
  - notifications settings opener SHOULD target macOS system settings.
- Linux:
  - notification settings opener MAY depend on desktop environment.
  - absence of supported settings app MUST produce deterministic failure result.
- Windows:
  - notification settings opener SHOULD target system notification settings URI.

For all platforms:
- unsupported operations MUST return deterministic safe outcomes,
- settings reads MUST remain available even when specific apply actions are unsupported.

## 11. Explicit Exclusions for this RFC

These domains are explicitly excluded and MUST NOT be treated as required compatibility in this RFC:
- `externalGoosed` remote backend settings,
- keyboard shortcuts settings,
- telemetry settings.

They MAY be specified in separate RFCs.

## 12. Gap Matrix (Original vs Required vs Current)

Status legend:
- `implemented`: behavior already present and compatible.
- `partial`: behavior exists but differs in shape/coverage.
- `missing`: behavior absent.
- `incompatible`: behavior conflicts with this contract.
- `excluded`: explicitly out of RFC scope.

| Behavior area | Original source | Required by this RFC | Current status |
|---|---|---|---|
| Canonical persisted settings model | `../ui/desktop/src/utils/settings.ts`, `main.ts` | MUST | partial |
| Canonical renderer prefs model | settings UI + localStorage usage | MUST | implemented |
| Backend-agnostic store contract | N/A (new formalization) | MUST | implemented |
| Legacy file migration (`settings.json`, `renderer-prefs.json`) | legacy desktop config files | MUST | implemented |
| LocalStorage migration mapping (`session_sharing_config`, `response_style`, `show_pricing`) | settings/session UI | SHOULD | partial |
| Settings IPC behavior inventory | `preload.ts`, `main.ts` | MUST | missing |
| Platform-specific apply semantics | `main.ts` handlers | MUST | partial |
| `externalGoosed` settings | `utils/settings.ts`, `main.ts` | excluded | excluded |
| Keyboard shortcuts settings | `utils/settings.ts`, settings keyboard UI | excluded | excluded |
| Telemetry settings | settings telemetry UI + config API | excluded | excluded |

## 13. Conformance Checklist

A desktop settings implementation is conformant to this RFC only if all checks pass:

1. Canonical settings keys and defaults from Section 4 are implemented.
2. Normalization behavior from Section 4.2 is deterministic.
3. Store contract guarantees from Section 5 are satisfied.
4. Apply lifecycle semantics from Section 6 are defined and testable.
5. Settings IPC behavior expectations from Section 7 are covered (implemented or explicitly tracked as gap).
6. Legacy migration mapping in Section 9 is fully documented.
7. Platform-specific behavior in Section 10 is documented and deterministic.
8. Excluded domains in Section 11 are not silently mixed into canonical settings scope.

## 14. Source References

Original desktop reference:
- `../ui/desktop/src/utils/settings.ts`
- `../ui/desktop/src/main.ts`
- `../ui/desktop/src/preload.ts`
- `../ui/desktop/src/components/settings/**`
- `../ui/desktop/src/contexts/ThemeContext.tsx`
- `../ui/desktop/src/components/settings/response_styles/ResponseStylesSection.tsx`
- `../ui/desktop/src/components/settings/sessions/SessionSharingSection.tsx`

Current implementation baseline:
- `src/desktop/main/settings/settings.ts`
- `src/desktop/main/settings/config.ts`
- `src/desktop/main/settings/config-store.ts`
- `src/desktop/main/settings/store.ts`
- `src/desktop/main/index.ts`
- `src/desktop/preload/index.ts`
