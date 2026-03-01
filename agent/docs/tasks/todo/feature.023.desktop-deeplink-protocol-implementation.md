---
ID: 23
Title: [CLIENT][svc:new:deeplink-runtime] Desktop deeplink, Implement DESKTOP_DEEPLINK_PROTOCOL with modular runtime
Complexity: high
Category: CLIENT
Primary Module: src/desktop/main/deeplink/router.ts
Server Impact: none
---

# [CLIENT][svc:new:deeplink-runtime] Desktop deeplink, Implement DESKTOP_DEEPLINK_PROTOCOL with modular runtime

## 1. Executive Summary

**Abstract:**  
Реализовать `docs/requirements/DESKTOP_DEEPLINK_PROTOCOL.md` в текущем desktop runtime с приоритетом на модульность и компактность. Внешне протокол должен быть совместим с оригиналом, но внутренняя реализация может быть собственной.

**Objectives (SMART):**
- **Specific:** Внедрить полный deeplink runtime (routes + entrypoints + dispatch + trust model).
- **Measurable:** Все RFC route/entry semantics покрыты unit/integration тестами.
- **Achievable:** Реализуется поверх текущего `src/desktop/main` с выделением компактного deeplink-модуля.
- **Relevant:** Блокирует перенос пользовательских сценариев extension/session/recipe links.
- **Time-bound:** Один инженерный цикл после foundation IPC.

## 2. Context & Problem Statement

### Current State

- RFC `DESKTOP_DEEPLINK_PROTOCOL.md` подготовлен.
- В текущем `src/desktop` deeplink runtime отсутствует.
- В `feature.019` присутствует пересечение по event dispatch, но нет отдельного deeplink implementation stream.

### The "Why"

Без deeplink runtime невозможно поддержать compatibility flow для внешних расширений, shared sessions и recipe/bot launch сценариев.

### In Scope

- Полный runtime для deeplink RFC:
  - routes: `extension`, `sessions`, `recipe`, `bot`,
  - entrypoints: startup args, second-instance, macOS `open-url`, macOS `open-file/open-files`,
  - deferred dispatch до renderer-ready.
- Внешние расширения:
  - поддержка `stdio` и `streamable_http`,
  - strict modal parity по outcome-классам (`blocked`, `untrusted`, `trusted`),
  - mandatory allowlist gate с static local allowlist.
- Main -> renderer dispatch:
  - `add-extension`,
  - `open-shared-session`,
  - `set-initial-message` (где применимо по flow).
- Тесты и обновление compatibility статусов.

### Out of Scope

- Remote allowlist загрузка как обязательная часть (может быть отдельной задачей).
- Изменение протокола URI (должна сохраняться совместимость).
- Полная реализация всех остальных IPC-доменов вне deeplink scope.

## 3. Proposed Technical Solution

### Architecture Overview

1. Выделить deeplink runtime из `main/index.ts` в компактные модули:
   - `main/deeplink/protocol.ts` — parsing + validation + typed payloads,
   - `main/deeplink/extensions.ts` — transport mapping + trust/allowlist checks,
   - `main/deeplink/router.ts` — entrypoint normalization и route dispatch,
   - `main/deeplink/state.ts` — pending link queue + renderer-ready tracking.
2. `main/index.ts` оставить orchestration entrypoint:
   - registration of protocol handlers/events,
   - delegation в deeplink router.
3. Integrate with IPC foundation (`feature.018`) for typed events and deterministic errors.

### Interface Changes

- Добавить typed deeplink types в shared IPC layer (по мере необходимости):
  - route parsing result,
  - deep link error codes,
  - extension trust outcome.
- Сохранить legacy wire event names:
  - `add-extension`,
  - `open-shared-session`,
  - `set-initial-message`.

### Project Code Reference

- RFC: `docs/requirements/DESKTOP_DEEPLINK_PROTOCOL.md`
- Current runtime:
  - `src/desktop/main/index.ts`
  - `src/desktop/preload/index.ts`
  - `src/desktop/shared/api.ts`
- Original behavior:
  - `../ui/desktop/src/main.ts`
  - `../ui/desktop/src/components/settings/extensions/deeplink.ts`
  - `../ui/desktop/src/components/ExtensionInstallModal.tsx`
  - `../ui/desktop/src/sessionLinks.ts`

## 4. Requirements

- `MUST` реализовать все route и entrypoint semantics из `DESKTOP_DEEPLINK_PROTOCOL.md`.
- `MUST` поддержать `extension` deeplink для `stdio` и `streamable_http`.
- `MUST` enforce trust gate с deterministic outcomes:
  - `allowed`,
  - `untrusted_confirm_required`,
  - `blocked`.
- `MUST` использовать static local allowlist в первой реализации.
- `MUST` блокировать `npx` с `-c` как security risk.
- `MUST` обеспечить deferred delivery pending deep links до `react-ready`.
- `MUST` dispatch событий в renderer с legacy wire names.
- `MUST` не допускать crash на malformed deeplink payload.
- `MUST` не утекать секретами в deeplink errors/logs.
- `SHOULD` держать deeplink runtime в отдельных модулях, а не в монолитном `main/index.ts`.
- `SHOULD` сохранить deterministic behavior по платформам (darwin/win/linux).

## 5. Acceptance Criteria

- `MUST` unit tests покрывают parsing/validation/error taxonomy для всех route.
- `MUST` integration tests покрывают startup args, second-instance relay, open-url/open-file entry flows.
- `MUST` extension deeplink tests подтверждают trust outcomes и allowlist enforcement.
- `MUST` pending deeplink queue корректно flush после `react-ready`.
- `MUST` renderer получает корректные события (`add-extension`, `open-shared-session`) без дубликатов.
- `MUST` `npm run test` проходит.

## 6. Dependencies

- Depends on: `feature.018.desktop-ipc-foundation-and-registry.md`.
- Coordinates with:
  - `feature.019.desktop-ipc-core-channels.md` (event surface overlap),
  - `feature.021.desktop-ipc-contract-verification.md` (contract coverage + matrix sync).
