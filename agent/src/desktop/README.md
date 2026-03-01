# Desktop Architecture

## Purpose
`src/desktop` содержит desktop-клиент (Electron) и его UI.

Цели текущей архитектуры:
- desktop-клиент владеет настройками и секретами;
- backend (`server.js`) запускается только из desktop main-процесса;
- backend получает конфиг и секреты только через env при старте;
- UI использует единый UI kit через общий barrel export.

## Layers

### 1) Main Process
`src/desktop/main/index.ts`

Ответственность:
- bootstrapping Electron;
- создание директорий приложения (`root/config/logs/cache`);
- запуск и остановка backend sidecar-процесса;
- health-check backend;
- возврат runtime-состояния в renderer через IPC `desktop:get-state`.

### 2) Settings/Secrets Service
`src/desktop/main/settings/store.ts`

`SettingsStore` — единая точка входа для:
- пользовательских настроек (`DesktopConfigStore`);
- секретов (`DesktopSecretStore`);
- построения env-снимка для backend.

Ключевая идея:
- API единый (`SettingsStore`),
- физические backend'ы хранения разные и специализированные.

### 3) Secret Storage Internals
`src/desktop/main/settings/secrets/*`

Компоненты:
- `store.ts`: per-key secret storage;
- `crypto.ts`: secure backend через Electron `safeStorage`;
- fallback в `secrets.env`, если secure backend недоступен;
- `env-map.ts`: детерминированное преобразование ключей секретов в env-переменные;
- `audit.ts`: metadata-only аудит без plaintext значений.

### 4) Config Storage Internals
`src/desktop/main/settings/config-store.ts`

Хранит и нормализует `AppConfig` через `electron-store`, поддерживает legacy migration (`settings.json`, `renderer-prefs.json`) при инициализации.

### 5) Preload Bridge
`src/desktop/preload/index.ts`

Экспортирует безопасный `window.desktopApi`.
Сейчас публичный IPC-поверхностный контракт минимален: `getState()`.

### 6) Renderer
`src/desktop/renderer/*`

- `main.tsx`: entrypoint React;
- `ui/desktopApp.tsx`: shell приложения и runtime-статус backend;
- renderer не имеет доступа к plaintext секретам.

### 7) Notifications Service
`src/desktop/main/notifications/service.ts`

`NotificationService` отвечает за системные (OS) всплывающие уведомления:
- канал: только OS notifications (Electron `Notification`);
- триггеры: critical runtime events (`preflight failed`, `backend ready`, `backend start failed`);
- anti-spam: dedup одинаковых событий в окне 30 секунд;
- payload безопасный: без plaintext секретов и без сырых ошибок.

### 8) Shared and Domain Types
- `src/desktop/shared/api.ts` — runtime API между preload и renderer.
- `src/desktop/main/settings/config.ts` и `src/desktop/main/settings/settings.ts` — доменные типы и нормализация настроек.

## Runtime Data Flow
1. Main запускается и выполняет preflight.
2. Создается `SettingsStore`.
3. `SettingsStore.buildServerEnv(...)` собирает env из:
- app dirs;
- пользовательских настроек;
- mapped secrets.
4. Main запускает backend (`server.js`) с этим env.
5. Main проверяет `/status` backend.
6. Main отправляет OS-нотификации по critical runtime событиям (через `NotificationService`).
7. Renderer получает состояние через `desktop:get-state`.

## Settings and Secrets Model

### Settings
- Источник правды: desktop side.
- Формат: `AppConfig` (`desktop` + `rendererPrefs`).
- Нормализация: `normalizeAppConfig`, `normalizeSettings`.

### Secrets
- Модель: per-key.
- Primary backend: secure storage (`safeStorage`).
- Fallback backend: `secrets.env`.
- В renderer значения секретов не передаются.
- В backend секреты попадают только через env snapshot.

## UI Kit
`src/desktop/renderer/ui/components/index.ts`

Единый public barrel для UI primitives:
- Button, Card, Dialog, DropdownMenu, Input, ScrollArea,
- Sheet, Sidebar, Skeleton, Switch, Tabs, Tooltip.

Правило:
- новые базовые UI-компоненты экспортируются через этот barrel;
- feature-UI импортирует компоненты из единой точки, а не из отдельных файлов.

## Non-Goals (Current)
- Нет отдельного server-side API для управления desktop settings/secrets.
- Нет передачи plaintext секретов между процессами UI.
- Нет удаленного backend режима: desktop всегда поднимает локальный backend.
- Нет in-app toast/центра уведомлений в renderer (только OS notifications).

## Key Files Map
- Main runtime: `src/desktop/main/index.ts`
- Settings service: `src/desktop/main/settings/store.ts`
- Notifications service: `src/desktop/main/notifications/service.ts`
- Secret internals: `src/desktop/main/settings/secrets/*`
- Config internals: `src/desktop/main/settings/config-store.ts`
- Preload bridge: `src/desktop/preload/index.ts`
- Renderer shell: `src/desktop/renderer/ui/desktopApp.tsx`
- UI kit barrel: `src/desktop/renderer/ui/components/index.ts`
