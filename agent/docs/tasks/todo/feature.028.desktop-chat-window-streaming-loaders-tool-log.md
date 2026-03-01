---
ID: 28
Title: [CLIENT][svc:new:desktop-chat-shell] Desktop chat window, Implement goose-like streaming UI with loaders and tool-call log
Complexity: high
Category: CLIENT
Primary Module: src/desktop/renderer/chat/chat-page.tsx
Server Impact: orchestrator-only
---

# [CLIENT][svc:new:desktop-chat-shell] Desktop chat window, Implement goose-like streaming UI with loaders and tool-call log

## 1. Executive Summary

**Abstract:**
Нужно внедрить в desktop-клиент чат-окно в стиле Goose: потоковый ответ, loader-состояния и расширенный лог вызовов инструментов. Задача клиентская: дорабатываем desktop IPC/gateway слой при необходимости, но не меняем server runtime.

**Objectives (SMART):**
- **Specific:** Реализовать router-based chat shell и streaming chat UX в `src/desktop/renderer`.
- **Measurable:** Чат получает SSE-события, показывает loader states и tool-call log с deterministic статусами.
- **Achievable:** Выполняется поверх локального backend, через `window.desktopApi` IPC-first контракт.
- **Relevant:** Ключевой пользовательский интерфейсный слой для миграции UX из Goose.
- **Time-bound:** Один инженерный цикл после стабилизации зависимых задач.

## 2. Context & Problem Statement

### Current State

- Текущий `DesktopApp` — минимальный экран статуса backend.
- В renderer нет chat shell, нет stream state machine, нет tool-call timeline.
- В `DesktopApi` сейчас только `getState` и `sendLogs`.
- В оригинале Goose chat UX строится вокруг `useChatStream`, `BaseChat`, `ProgressiveMessageList`, `ToolCallWithResponse`, `LoadingGoose`.

### The "Why"

Без полноценного chat UX невозможно использовать агентский цикл в desktop-приложении даже при готовом backend и IPC-каркасе.

### In Scope

- Router shell в renderer (chat route как основной entry).
- IPC-first chat gateway через `window.desktopApi`.
- Session-aware stream обработка `/reply` событий в клиенте.
- Exact state model и loader mapping (goose-like):
  - `idle`, `loadingConversation`, `thinking`, `streaming`, `waitingForUserInput`, `compacting`, `error`.
- Extended tool-call log:
  - request/response/status,
  - progress/notification entries,
  - expandable arguments/details.
- Unit/integration/e2e тесты клиентского chat UX.

### Out of Scope

- Изменение server runtime/маршрутов.
- Полная продуктовая parity по recipes/deeplinks/modals/analytics.
- Полноценный tool approval UX (в этой задаче только отображение состояния).

## 3. Proposed Technical Solution

### Architecture Overview

1. Расширить typed `DesktopApi` chat-методами (shared + preload + main proxy layer).
2. Добавить `main` gateway-модуль для HTTP/SSE проксирования backend stream в renderer IPC events.
3. В renderer добавить chat domain:
   - state store/reducer,
   - `useChatStream` hook,
   - message normalization,
   - tool log derivation.
4. Построить UI-слой:
   - `ChatPage`,
   - `ChatInput`,
   - `MessageList`,
   - `LoadingIndicator`,
   - `ToolCallLog`.
5. Интегрировать route `/chat` как основной экран приложения.

### Interface Changes

- `src/desktop/shared/api.ts` расширяется typed chat surface:
  - session lifecycle wrappers,
  - stream start/abort,
  - stream event subscription.
- `src/desktop/preload/index.ts` экспортирует безопасные chat wrappers только через `window.desktopApi`.
- `src/desktop/main/index.ts` регистрирует chat IPC handlers и stream relay.

### Project Code Reference

- Current desktop runtime:
  - `src/desktop/renderer/ui/desktopApp.tsx`
  - `src/desktop/preload/index.ts`
  - `src/desktop/shared/api.ts`
  - `src/desktop/main/index.ts`
- Original UX references:
  - `../ui/desktop/src/hooks/useChatStream.ts`
  - `../ui/desktop/src/components/BaseChat.tsx`
  - `../ui/desktop/src/components/ProgressiveMessageList.tsx`
  - `../ui/desktop/src/components/ToolCallWithResponse.tsx`
  - `../ui/desktop/src/components/LoadingGoose.tsx`

## 4. Requirements

- `MUST` реализовать renderer chat shell с router-based entry (`/chat`).
- `MUST` использовать только IPC-first взаимодействие (`window.desktopApi`) без прямого renderer->backend fetch.
- `MUST` поддержать session-aware streaming response flow для `/reply`.
- `MUST` реализовать exact chat state model с loader UI для каждого состояния.
- `MUST` реализовать extended tool-call log со статусами `pending|running|success|error|cancelled|waitingApproval`.
- `MUST` детерминированно обрабатывать malformed/partial stream events без краша UI.
- `MUST` не использовать `any` в chat публичных типах и IPC API.
- `SHOULD` держать chat код отдельным модулем (`renderer/chat/*`), не раздувая `desktopApp.tsx`.
- `SHOULD` переиспользовать существующий UI kit из `renderer/ui/components`.

## 5. Acceptance Criteria

- `MUST` chat route открывается и показывает рабочий input + message list.
- `MUST` при submit сообщения UI переходит в streaming-состояния и корректно возвращается в `idle` по finish.
- `MUST` loader текст/индикатор соответствует каждому состоянию state machine.
- `MUST` tool-call log показывает request/response/progress и финальный status.
- `MUST` abort stream сценарий обрабатывается без зависания UI.
- `MUST` unit/integration тесты покрывают stream parser, state transitions и tool-log aggregation.
- `MUST` e2e smoke тест подтверждает базовый chat submit+stream flow.
- `MUST` `npm run test` проходит.

## 6. Dependencies

### Blocked By (MUST before start)

- `feature.018.desktop-ipc-foundation-and-registry.md`
  - Нужен typed IPC каркас и единый error envelope.
- `feature.019.desktop-ipc-core-channels.md`
  - Нужны core команды/events desktop runtime (`react-ready`, window/chat events).
- `feature.027.agent-runtime-lifecycle-and-stub-services.md`
  - Нужен session-aware `/agent/*` + `/reply` runtime skeleton в сервере, иначе будет переделка chat lifecycle клиента.

### Strongly Recommended Before/Parallel

- `feature.021.desktop-ipc-contract-verification.md`
  - Стабилизирует IPC surface и предотвращает churn в chat API тестах.
- `feature.023.desktop-deeplink-protocol-implementation.md`
  - Уменьшает риск переделки event wiring (`set-initial-message`, `open-shared-session`) при интеграции deeplink flow в чат.

### Coordination

- Coordinates with: `feature.026.server-send-logs-runtime-pipeline.md` (общий `/reply` stream path, но независимый функциональный scope).
