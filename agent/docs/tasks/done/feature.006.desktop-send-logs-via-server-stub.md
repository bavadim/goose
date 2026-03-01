---
ID: 6
Title: Desktop diagnostics, Add send-logs flow with server-side stub
Complexity: medium
---

# Desktop diagnostics, Add send-logs flow with server-side stub

## 1. Executive Summary

**Abstract:**  
Нужен минимальный пользовательский сценарий отправки логов из desktop-приложения: пункт в нативном меню и серверная заглушка команды отправки логов. Команда должна передаваться через существующий контракт сообщений Desktop↔Server (см. `docs/requirements/GOOSE_CORE_REQUIREMENTS.md`, `POST /reply`), без внедрения отдельного transport-слоя.

**Objectives (SMART):**
- **Specific:** Добавить задачу на реализацию пункта `Send Logs` и server-side stub для запуска отправки логов по команде.
- **Measurable:** Описан детальный контракт вызова, блокеры, допущения и критерии приемки.
- **Achievable:** Реализуется в текущем Electron + TypeScript стеке с локальными изменениями.
- **Relevant:** Поддерживает диагностику и поддержку пользователей без внедрения внешних сервисов.
- **Time-bound:** Один этап разработки после разблокировки зависимостей.

## 2. Context & Problem Statement

### Current State

- Backend всегда поднимается из desktop main (`src/desktop/main/index.ts`) и получает env через `SettingsStore.buildServerEnv(...)`.
- Есть `SettingsStore` как единая точка доступа к настройкам/секретам и app dirs (`root/config/logs/cache`).
- Есть `NotificationService` для OS-уведомлений по критическим runtime событиям.
- Контракт сообщений Desktop↔Server уже существует, и команды должны идти через `POST /reply`.
- Пользовательского действия `Send Logs` и явного runtime-потока отправки логов пока нет.

### The "Why"

Нужна серверная заглушка обработки команды отправки логов, чтобы запускать поток диагностики через уже существующий message-контракт и не блокировать пользовательскую поддержку.

### In Scope

- Добавить в desktop приложение пользовательский trigger `Help -> Send Logs`.
- Добавить server-side stub команды отправки логов внутри существующего `/reply` message-потока.
- Доработать desktop main orchestration для запуска команды `Send Logs` с учетом актуального backend lifecycle.
- Доработать `NotificationService` под события отправки логов (без утечки секретов).
- Зафиксировать `TODO`-точку для замены stub на полноценную бизнес-реализацию отправки логов.
- Определить минимальный контракт успеха/ошибки для вызова.

### Out of Scope

- Реализация полноценного чата.
- Полная система хранения секретов (в этой задаче только допущение готовности).
- Редизайн существующих требований OpenAPI.

## 3. Proposed Technical Solution

### Architecture Overview

1. Desktop main добавляет нативный пункт меню `Help -> Send Logs`.
2. Действие меню использует уже запущенный локальный backend (`backendUrl` из состояния main), без отдельного side-transport.
3. Команда отправляется через существующий Desktop↔Server message-контракт (`POST /reply`).
4. Серверная заглушка распознает команду и запускает временный runtime-flow отправки логов.
5. `NotificationService` показывает пользователю безопасный статус отправки (success/failure).
6. В коде stub остается явный `TODO` на замену временной реализации полноценной бизнес-логикой.

### Interface Changes

- Desktop API (IPC) получает метод ручного запуска отправки логов из renderer (если trigger нужен не только из нативного меню).
- Сервер получает временный handler команды отправки логов внутри существующего message-потока и унифицированный ответ:
  - `ok: boolean`
  - `message: string`
  - `artifactPath?: string`
  - `remotePath?: string`

Дополнительно:
- `NotificationService` расширяется кодами событий диагностики:
  - `diagnostics.send_logs.succeeded`
  - `diagnostics.send_logs.failed`

### Project Code Reference

- Desktop main orchestration:
  - `src/desktop/main/index.ts`
- Desktop settings/secrets/env source:
  - `src/desktop/main/settings/store.ts`
- Desktop notifications:
  - `src/desktop/main/notifications/service.ts`
- Preload/shared API:
  - `src/desktop/preload/index.ts`
  - `src/desktop/shared/api.ts`
- Сервер:
  - `src/server/app.ts`
  - `src/server/index.ts`
- Контракт сообщений:
  - `docs/requirements/GOOSE_CORE_REQUIREMENTS.md`
  - `docs/requirements/GOOSE_SERVER_OPENAPI.json` (`POST /reply`)

### Dependencies / Blockers

Задача блокируется до завершения:
- `реализовать поддержку всплывающих подсказок`
- `реализовать хранение ключей приложения`
- `поддержка сохранения конфигурации`

### Assumptions

Для реализации этой задачи считаем, что:
- всплывающие подсказки уже работают,
- хранение ключей приложения уже работает (client-managed per-key secrets),
- сохранение конфигурации уже работает.
- backend получает секреты только через env при запуске из desktop main.
- отправка логов инициируется desktop-клиентом, но server stub выполняет команду в рамках существующего server runtime.

## 4. Requirements

- `MUST` зафиксировать статус задачи как blocked указанными зависимостями до их завершения.
- `MUST` добавить пользовательский trigger `Send Logs` в нативное desktop-меню.
- `MUST` использовать уже существующий lifecycle локального backend из `src/desktop/main/index.ts`; отдельный backend transport для send-logs не допускается.
- `MUST` отправлять команду `Send Logs` через существующий Desktop↔Server контракт сообщений (`POST /reply`), без отдельного command-bus.
- `MUST` реализовать server-side заглушку, которая распознает команду в message-потоке и запускает отправку логов на заданную команду.
- `MUST` оставить в server-side заглушке явный `TODO`, указывающий место замены временной реализации на полноценную бизнес-реализацию отправки логов.
- `MUST` вернуть детерминированный результат вызова с полями `ok` и `message`.
- `MUST` расширить `NotificationService` событиями результата send-logs и показывать только безопасные сообщения.
- `MUST` использовать `SettingsStore` как источник app dirs/env для пути логов; дублирующее вычисление путей вне `SettingsStore` не допускается.
- `SHOULD` возвращать `artifactPath` и `remotePath` при успешной отправке.
- `SHOULD` не раскрывать секреты/ключи в сообщениях ошибки.
- `MAY` логировать технические детали сбоя во внутренний лог без утечки чувствительных данных.
- `WON'T` внедрять чатовый интерфейс в рамках этой задачи.

## 5. Acceptance Criteria

- `MUST` задача содержит явный список блокеров в формате, пригодном для трекинга в `docs/tasks`.
- `MUST` в спецификации задачи явно указано допущение о работоспособности подсказок, ключей и конфигурации.
- `MUST` описано использование существующего message-контракта Desktop↔Server (`POST /reply`) для передачи команды отправки логов.
- `MUST` описан серверный stub-обработчик отправки логов как временное решение внутри message-потока.
- `MUST` зафиксирована `TODO`-точка для будущей замены stub-реализации на полноценную бизнес-реализацию.
- `MUST` описан контракт результата вызова (`ok`, `message`) и поведение при ошибках.
- `MUST` в задаче явно зафиксирована интеграция с `SettingsStore` и `NotificationService`, включая список требуемых доработок сервисов.

## Implementation Notes

- Реализован menu trigger `Help -> Send Logs` и IPC метод `desktop:send-logs`.
- Добавлен desktop API `sendLogs()` в preload/shared контракт.
- Реализован server-side stub в `/reply` для команды `/send-logs` с детерминированным SSE payload и `TODO` на реальную отправку.
- `NotificationService` расширен событиями `diagnostics.send_logs.succeeded|failed`.
- Добавлены requirement-oriented тесты:
  - `tests/desktop.send-logs.test.ts`
  - `tests/server.test.ts`
  - `tests/desktop.notifications.test.ts`
