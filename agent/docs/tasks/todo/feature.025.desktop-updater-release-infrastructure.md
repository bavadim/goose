---
ID: 25
Title: [INFRA][svc:new:desktop-release-pipeline] Desktop updater, Build and release infrastructure via GitHub
Complexity: high
Category: INFRA
Primary Module: .github/workflows/desktop-release.yml
Server Impact: none
---

# [INFRA][svc:new:desktop-release-pipeline] Desktop updater, Build and release infrastructure via GitHub

## 1. Executive Summary

**Abstract:**
Построить серверную инфраструктуру доставки обновлений: CI/CD сборка desktop-билдов и публикация в GitHub Releases, пригодная для in-app updater. Основной принцип — максимально простой и стабильный release pipeline.

**Objectives (SMART):**
- **Specific:** Настроить GitHub Actions workflow для matrix build + release publish.
- **Measurable:** Релизный pipeline публикует валидные артефакты по платформам и updater видит их.
- **Achievable:** Основано на текущем `electron-builder` packaging.
- **Relevant:** Без release infrastructure updater runtime не сможет доставлять апдейты.
- **Time-bound:** Один инженерный цикл.

## 2. Context & Problem Statement

### Current State

- Пакетирование выполняется локально командами `desktop:make:*`.
- CI/workflow для публикации релизов отсутствует.
- Build store должен быть на GitHub сервисах.

### The "Why"

Updater требует предсказуемого источника релизов и детерминированной схемы публикации. Без CI/CD релизы нестабильны и зависят от ручных действий.

### In Scope

- GitHub Actions release workflow (matrix build: macOS, Windows, Linux).
- Публикация артефактов в GitHub Releases (stable channel).
- Release naming/version conventions для updater discovery.
- Best-effort signing hooks (через secrets, без hard-block MVP).
- Проверка полноты опубликованных артефактов.

### Out of Scope

- Multi-channel rollout (beta/nightly/canary).
- Обязательная подпись как gate релиза.
- Отдельная внешняя release инфраструктура вне GitHub.

## 3. Proposed Technical Solution

### Architecture Overview

1. Добавить workflow в `.github/workflows/desktop-release.yml`:
   - trigger: tag/release event,
   - matrix build,
   - run tests/build,
   - package artifacts,
   - publish to GitHub Release.
2. Добавить release manifest/metadata validation step.
3. Добавить optional signing steps gated by available secrets.
4. Добавить smoke check that updater feed metadata is consumable.

### Interface Changes

- Runtime API не меняется.
- Добавляется CI/CD contract для updater delivery.

### Project Code Reference

- `package.json` (`desktop:make:*`, `build` config)
- `docs/requirements/UPDATER_PRD.md` (to be created/approved)
- `docs/requirements/DESKTOP_IPC_CONTRACT.md` (updater channels)

## 4. Requirements

- `MUST` добавить GitHub Actions workflow для desktop release matrix.
- `MUST` публиковать релизные артефакты в GitHub Releases.
- `MUST` использовать stable-only release channel.
- `MUST` обеспечить совместимость артефактной схемы с in-app updater.
- `MUST` поддержать best-effort signing integration.
- `MUST` не падать детерминированно из-за отсутствия signing secrets в MVP режиме.
- `SHOULD` валидировать release artifacts list перед publish completion.
- `SHOULD` сохранять workflow компактным и читаемым.

## 5. Acceptance Criteria

- `MUST` release workflow запускается и завершает publish в GitHub Releases.
- `MUST` релиз содержит артефакты для macOS/Windows/Linux.
- `MUST` схема тегов/версий детерминирована и документирована.
- `MUST` updater runtime (feature.024) может обнаружить опубликованный релиз.
- `MUST` `npm run test` и packaging checks интегрированы в release pipeline.

## 6. Dependencies

- Works with:
  - `feature.024.desktop-updater-app-infrastructure.md`
- Blocks full updater rollout until complete.
