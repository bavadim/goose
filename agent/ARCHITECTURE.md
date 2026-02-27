# Goose Agent Runtime
Техническое описание ядра агентского цикла и сервисов (tools/extensions) для разработчиков Goose.

## 0) Ментальная модель

Goose — это **замкнутый агентский цикл** вокруг `Conversation` в `SessionManager`.

- **Источник истины**: `SessionManager` хранит `Session` и `Conversation` (история сообщений, extension data, мета).
- **Ядро**: `Agent` выполняет turn loop (reply → provider → tools → provider → …).
- **Сервисы**: функциональность подключается как инструменты (tools), поставляемые расширениями (platform / MCP / frontend).

Ключевые файлы:
- Ядро цикла: `crates/goose/src/agents/agent.rs`
- Исполнение tools + approval/frontend waiting: `crates/goose/src/agents/tool_execution.rs`
- Инспекции: `crates/goose/src/tool_inspection.rs`, `crates/goose/src/permission/*`, `crates/goose/src/security/*`, `crates/goose/src/tool_monitor.rs`
- Extensions runtime: `crates/goose/src/agents/extension_manager.rs`
- MCP client: `crates/goose/src/agents/mcp_client.rs`
- Модель сообщений: `crates/goose/src/conversation/message.rs`

## 1) Компоненты системы

### 1.1 Клиенты
- **CLI**: вызывает ядро напрямую, рендерит поток `AgentEvent`.
- **Frontend (Desktop UI + goosed)**: UI посылает запросы на `goosed` (HTTP/SSE), который проксирует в core и стримит события обратно.

### 1.2 Core
- **SessionManager**: load/save session + conversation + extension data.
- **Agent**: turn loop и оркестрация.
- **Provider**: форматирование запроса под LLM, streaming decode/parse ответа.
- **Tool routing / execution**: special-tools в core, затем dispatch к владельцу (frontend/platform/MCP).

### 1.3 Extensions
Расширения — источники инструментов (tools). В Goose они бывают:
- platform (in-process),
- builtin (MCP servers из комплекта),
- stdio (локальный MCP subprocess),
- streamable_http (удалённый MCP),
- inline_python (код+deps, исполняется как локальный tool server),
- frontend (tools исполняет клиент).

## 2) Поток управления: замкнутый цикл

Цикл всегда идёт через `SessionManager` и `Provider`.

1) **Client → Agent::reply**
   - Артефакт: `Message` (user) или `Message` с `ActionRequired(ElicitationResponse)`.
   - Агент сохраняет вход: `SessionManager::add_message(...)`.

2) **Agent::reply → SessionManager**
   - Артефакт: `Session` + `Conversation`.
   - Агент загружает состояние: `SessionManager::get_session(...)`.

3) **Agent::reply_internal → Provider**
   - Артефакты: `system_prompt`, `Conversation.messages`, `tools (schemas)`.
   - Провайдер стримит ответ; агент парсит и эмитит `AgentEvent::Message(Message)`.

4) **Ветка: если assistant message содержит ToolRequest**
   - Агент отделяет frontend tool requests от остальных (categorize).
   - Агент прогоняет инспекции: `ToolInspectionManager::inspect_tools(...)`.
   - Агент применяет permission policy: `process_inspection_results_with_permission_inspector(...)`.
   - Если нужен user approval:
     - агент эмитит `ActionRequired: ToolConfirmation` как `Message`,
     - затем **блокируется** на ожидании ответа (`confirmation_rx.recv().await`).
   - Для разрешённых запросов:
     - агент вызывает `dispatch_tool_call(...)`,
     - получает `CallToolResult`/notifications,
     - формирует `ToolResponse` и пишет его в `SessionManager`,
     - затем делает следующий вызов к `Provider` с обновлённой `Conversation`.

5) **Если ToolRequest нет**
   - текущий `reply` завершается: клиент показывает финальный ответ и ждёт следующий user input.

## 3) Модель данных: Conversation / Message / Content

### 3.1 Conversation
`Conversation` = список `Message` в порядке времени.

### 3.2 Message
`Message` имеет:
- `role` (`user` | `assistant`)
- `content: Vec<MessageContent>`
- метаданные/видимость (например `user_only()` для сообщений, показываемых только пользователю).

### 3.3 MessageContent: полный список вариантов

`MessageContent` (serde `"type"`) бывает:

- `Text(TextContent)`
- `Image(ImageContent)`
- `ToolRequest(ToolRequest)`
- `ToolResponse(ToolResponse)`
- `ToolConfirmationRequest(ToolConfirmationRequest)`
- `ActionRequired(ActionRequired)`
- `FrontendToolRequest(FrontendToolRequest)`
- `Thinking(ThinkingContent)`
- `RedactedThinking(RedactedThinkingContent)`
- `SystemNotification(SystemNotificationContent)`
- `Reasoning(ReasoningContent)`

#### ToolRequest
Поля:
- `id: String`
- `tool_call: ToolResult<CallToolRequestParams>` (имя + arguments)
- `metadata: Option<ProviderMetadata>`
- `tool_meta: Option<ProviderMetadata>` (в `_meta`)

#### ToolResponse
Поля:
- `id: String`
- `tool_result: ToolResult<CallToolResult>`
- `metadata: Option<ProviderMetadata>`

#### ActionRequired
`ActionRequiredData`:
- `ToolConfirmation { id, tool_name, arguments, prompt }`
- `Elicitation { id, message, requested_schema }`
- `ElicitationResponse { id, user_data }`

#### FrontendToolRequest
Поля:
- `id: String`
- `tool_call: ToolResult<CallToolRequestParams>`

#### SystemNotificationType
Варианты:
- `ThinkingMessage`
- `InlineMessage`
- `CreditsExhausted`

## 4) Контракт стрима: AgentEvent

`Agent` стримит наружу следующие события:

- `AgentEvent::Message(Message)`
  - Любые сообщения для рендера/учёта: текст ассистента, `ActionRequired`, `FrontendToolRequest`, tool response messages, system notifications.

- `AgentEvent::McpNotification((String, ServerNotification))`
  - Нотификации от MCP-сервера во время выполнения инструмента (progress/logging/…),
  - сопровождаются идентификатором (например extension id / request correlation).

- `AgentEvent::ModelChange { model: String, mode: String }`
  - Смена модели/режима (например lead/worker).

- `AgentEvent::HistoryReplaced(Conversation)`
  - Полная замена истории (например после compaction или команд, меняющих историю).
  - Клиент должен пересинхронизировать локальную историю.

## 5) Ядро: turn loop по реальным функциям

### 5.1 Точки входа
- `Agent::reply(...)` — внешний entrypoint для одного пользовательского “ответа”.
- `Agent::reply_internal(...)` — основная петля (provider → tools → provider).

### 5.2 Модель программирования

`Agent::reply` возвращает **асинхронный Stream**, который может:
- **стримить** сообщения и события,
- **останавливаться на await** (ожидание подтверждения, ожидание результата frontend tool, ожидание elicitation),
- продолжаться после поступления внешнего события (confirmation/tool_result/elicitation_response).

### 5.3 Псевдокод (по фактическим функциям)

```text
Agent::reply(input_message, session_id, session_config) -> Stream<AgentEvent>

  // 0) Ingress: ответ на Elicitation НЕ запускает LLM-цикл
  if input_message contains ActionRequired(ElicitationResponse { id, user_data }):
      ActionRequiredManager::submit_response(id, user_data)
      SessionManager::add_message(session_id, input_message)
      return empty stream

  // 1) Команды (могут short-circuit)
  cmd_outcome = execute_command(input_message, session_id, session_config)
  match cmd_outcome:
    case ShortCircuit { events_to_emit, messages_to_persist, maybe_history_replaced }:
        persist(messages_to_persist)
        emit(events_to_emit)
        if maybe_history_replaced:
            emit AgentEvent::HistoryReplaced(updated_conversation)
        return stream closed
    case Continue:
        pass

  // 2) Persist user input
  SessionManager::add_message(session_id, input_message)

  // 3) Load session + conversation
  session = SessionManager::get_session(session_id, include_messages=true)
  conversation = session.conversation

  // 4) Auto-compaction (может заменить историю)
  if should_auto_compact(conversation, session_config, provider):
      compacted = compact_messages(provider, conversation, session_config)
      SessionManager::replace_conversation(session_id, compacted)
      emit AgentEvent::HistoryReplaced(compacted)
      conversation = compacted

  // 5) Main loop
  return Agent::reply_internal(conversation, session, session_config)



Agent::reply_internal(conversation, session, session_config) -> Stream<AgentEvent>

  // A) Подготовка контекста (system prompt, tool catalog, режимы)
  ctx = prepare_reply_context(session_id, session_config, conversation)
  system_prompt = ctx.system_prompt
  goose_mode    = ctx.goose_mode
  tools_state   = ctx.tools_state   // включает tool catalog + mapping владельцев + frontend tools
  final_output  = FinalOutputTool::new()

  turn = 0
  while turn < session_config.max_turns:
    turn += 1

    // 1) Normalize conversation (перед каждым запросом к провайдеру)
    conversation = fix_conversation(conversation, system_prompt)

    // 2) Refresh tools/prompt if needed
    if tools_state.needs_refresh:
        tools_state = prepare_tools_and_prompt(session_id, session_config, conversation)

    // 3) Inject MOIM (опционально)
    conversation_for_provider =
        moim::inject_moim_if_applicable(session_id, conversation, tools_state.extension_manager)

    // 4) Provider call (streaming)
    provider_stream =
        stream_response_from_provider(provider,
                                      system_prompt,
                                      conversation_for_provider.messages,
                                      tools_state.tool_schemas)

    // 5) Decode provider stream -> assistant message
    assistant_msg = decode_provider_stream(provider_stream)

    // 6) Emit + persist assistant message
    emit AgentEvent::Message(assistant_msg)
    SessionManager::add_message(session_id, assistant_msg)
    conversation += assistant_msg

    // 7) Extract tool requests from assistant message
    tool_requests = extract_tool_requests(assistant_msg)

    // 8) Final condition: нет tools -> закончить текущий reply
    if tool_requests.is_empty():
        return stream closed

    // 9) Split frontend tool requests vs остальные
    (frontend_requests, remaining_requests) =
        categorize_tool_requests(tool_requests, tools_state.frontend_tool_names)

    // 10) Chat mode: tools запрещены -> отвечаем “skipped” и продолжаем,
    //     чтобы модель могла отреагировать на невозможность tools
    if goose_mode == Chat:
        skipped_responses = build_skipped_tool_responses(remaining_requests + frontend_requests)
        persist_and_append(skipped_responses)
        continue while-loop

    // 11) Inspect + permission policy (для НЕ-frontend tool requests)
    inspection_results =
        ToolInspectionManager::inspect_tools(remaining_requests,
                                             conversation.messages,
                                             goose_mode)

    permission_result =
        ToolInspectionManager::process_inspection_results_with_permission_inspector(
            remaining_requests,
            inspection_results,
            session_config.permission_manager)

    // permission_result разбивает remaining_requests на:
    //   - approved: можно выполнять сразу
    //   - denied: сразу отказ (DECLINED / инспекционный deny)
    //   - needs_approval: нужно спросить пользователя

    // 12) Denied: записать ToolResponse и продолжать
    denied_responses = build_denied_tool_responses(permission_result.denied, inspection_results)
    persist_and_append(denied_responses)

    // 13) Needs approval: спросить пользователя и ЗАБЛОКИРОВАТЬСЯ до ответа
    //     (это await внутри stream; не “фон”)
    for req in permission_result.needs_approval:
        confirmation_msg = build_tool_confirmation_action_required(req, inspection_results)
        emit AgentEvent::Message(confirmation_msg)
        SessionManager::add_message(session_id, confirmation_msg)
        conversation += confirmation_msg

        user_decision = wait_confirmation(req.id)  // confirmation_rx.recv().await

        match user_decision:
          case AllowOnce:
              permission_result.approved += req
          case AlwaysAllow:
              update_permission_store(req.tool_name, AlwaysAllow)
              permission_result.approved += req
          case DenyOnce:
              deny_msg = build_declined_tool_response(req)
              persist_and_append([deny_msg])
          case AlwaysDeny:
              update_permission_store(req.tool_name, AlwaysDeny)
              deny_msg = build_declined_tool_response(req)
              persist_and_append([deny_msg])
          case Cancel:
              cancel_msg = build_declined_tool_response(req)
              persist_and_append([cancel_msg])

    // 14) Frontend tool requests: отправить в UI и ждать результатов
    //     (тоже блокировка stream на tool_result_rx.recv().await)
    for req in frontend_requests:
        frontend_req_msg = build_frontend_tool_request_message(req)
        emit AgentEvent::Message(frontend_req_msg)
        SessionManager::add_message(session_id, frontend_req_msg)
        conversation += frontend_req_msg

        frontend_result = wait_frontend_tool_result(req.id)  // tool_result_rx.recv().await
        frontend_resp_msg = build_tool_response(req.id, frontend_result)
        persist_and_append([frontend_resp_msg])

    // 15) Execute approved tools (MCP/platform/…): можно параллельно
    //     Во время ожидания:
    //       - прокидываем MCP notifications
    //       - прокидываем Elicitation requests (если MCP server вызвал elicitation/create)
    //     По завершению каждого tool:
    //       - пишем ToolResponse
    in_flight = []
    for req in permission_result.approved:
        in_flight += spawn_tool_call(req)  // dispatch_tool_call(req) + notification subscription

    while in_flight not empty:
        // 15.1) Drain elicitation messages (если пришли)
        for msg in ActionRequiredManager::drain_requests_as_messages():
            emit AgentEvent::Message(msg)
            SessionManager::add_message(session_id, msg)
            conversation += msg

        // 15.2) Forward MCP notifications
        for (req_id, notification) in poll_tool_notifications(in_flight):
            emit AgentEvent::McpNotification((req_id, notification))

        // 15.3) Collect finished tool results
        for finished in poll_finished_tools(in_flight):
            resp_msg = build_tool_response(finished.req_id, finished.result)
            emit AgentEvent::Message(resp_msg)           // если принято стримить tool responses
            SessionManager::add_message(session_id, resp_msg)
            conversation += resp_msg

            if finished.result indicates tools/extension state changed:
                tools_state.needs_refresh = true

            remove finished from in_flight

    // 16) Next iteration: Provider увидит tool responses в conversation
    continue while-loop

  // 17) Safety stop
  emit AgentEvent::Message(build_max_turns_reached_message())
  return stream closed



Helper: persist_and_append(messages):
  for m in messages:
    SessionManager::add_message(session_id, m)
    conversation += m
```

## 6) Tool routing: кто исполняет tool call

### 6.1 Special tools внутри core

`Agent::dispatch_tool_call` сначала проверяет “ядровые” инструменты:

* schedule management tool (platform-level),
* `final_output` (FinalOutputTool).

### 6.2 Frontend tools

Если tool принадлежит frontend:

* agent **не исполняет** его сам,
* agent эмитит `FrontendToolRequest`,
* затем ждёт результат по каналу `tool_result_rx`.

### 6.3 Остальные tools: ExtensionManager

Если tool не special и не frontend:

* `Agent::dispatch_tool_call` → `ExtensionManager::dispatch_tool_call(...)`,
* дальше исполнение идёт через MCP client (list_tools/call_tool) или platform extension (см. GOOSE_CORE_REQUIREMENTS.md,требования к mcp).

## 7) Инспекторы: Security / Permission / Repetition

Инспекции — часть стандартного шага обработки tool requests **между парсингом ответа провайдера и фактическим вызовом tools**.

### 7.1 Общий интерфейс инспектора

Инспекторы реализуют `ToolInspector` и возвращают список `InspectionResult`.

`InspectionResult`:

* `tool_request_id`
* `action: InspectionAction`
* `reason`
* `confidence`
* `inspector_name`
* `finding_id: Option<String>`

`InspectionAction`:

* `Allow`
* `Deny`
* `RequireApproval(Option<String>)` (опциональный user-facing prompt)

### 7.2 Порядок применения

`Agent::create_tool_inspection_manager()` добавляет инспекторы в порядке:

1. `SecurityInspector`
2. `PermissionInspector`
3. `RepetitionInspector`

### 7.3 Как результаты влияют на решения

`PermissionInspector` задаёт baseline (allow/deny/ask). Остальные инспекторы могут ужесточить:

* `Deny` → окончательный deny,
* `RequireApproval` → перевод allow → needs approval,
* `Allow` не отменяет deny/approval от других.

## 8) SecurityInspector

### 8.1 Назначение

Проверяет tool calls на признаки prompt-injection / command-injection и прочие risk patterns.

### 8.2 Как работает

* Берёт `tool_requests` + историю сообщений.
* Вызывает `SecurityManager::analyze_tool_requests(...)`.
* Если детектировано “malicious” и политика требует user check:

  * возвращает `RequireApproval(Some("Security Alert ... Finding ID ..."))`.
* Иначе возвращает `Allow`.

### 8.3 Эффект на цикл

`RequireApproval` запускает approval flow:

* агент шлёт `ActionRequired: ToolConfirmation` как `Message`,
* затем **ждёт** подтверждение пользователя (см. §11).

## 9) PermissionInspector

### 9.1 Назначение

Реализует модель автономности (GooseMode) и пользовательские tool permissions.

### 9.2 Входы

* `GooseMode` (`Chat` / `Auto` / `Approve` / `SmartApprove`)
* `permission_manager` (user-defined правила)
* множества `readonly_tools` и `regular_tools` (pre-approved списки)

### 9.3 Правила

* `Chat`: tools не выполняются (tool calls пропускаются/заменяются на “skipped” результаты).
* `Auto`: всё allow.
* `Approve`/`SmartApprove`:

  1. если есть user-defined правило для tool → применить (`AlwaysAllow` / `NeverAllow` / `AskBefore`)
  2. иначе если tool в `readonly_tools` или `regular_tools` → allow
  3. иначе если tool связан с управлением расширениями → require approval с явным prompt
  4. иначе → require approval

## 10) RepetitionInspector

### 10.1 Назначение

Защита от бесконечных повторов одинакового tool call (имя + те же arguments).

### 10.2 Как работает

* Считает повторения через `ToolMonitor`.
* При превышении `max_repetitions` возвращает `Deny` (например с `finding_id = "REP-001"`).

## 11) Approval и блокировка цикла

### 11.1 ToolConfirmation: протокол core ↔ client

Когда tool требует approval, агент формирует assistant message с:

* `ActionRequiredData::ToolConfirmation { id, tool_name, arguments, prompt }`

Клиент обязан:

* показать prompt,
* собрать решение пользователя,
* отправить подтверждение обратно в core (по каналу/endpoint, который маппится на `confirmation_rx`).

### 11.2 Как блокируется цикл

`Agent::handle_approval_tool_requests(...)`:

1. `yield` сообщение `ActionRequired: ToolConfirmation`,
2. затем делает `confirmation_rx.recv().await` пока не придёт подтверждение с нужным `req_id`,
3. после подтверждения:

   * allow → вызывает `dispatch_tool_call`,
   * deny → пишет `ToolResponse(DECLINED)` (и при “AlwaysDeny” сохраняет правило).

Это не “фон”: это await внутри стрима.

## 12) Frontend tools (интерфейс)

Frontend tools — инструменты, которые **исполняет клиент**, а core только:

* объявляет tool schemas в каталоге,
* выдаёт `FrontendToolRequest`,
* ждёт `ToolResponse` от клиента.

### 12.1 Протокол сообщений

Core → Client:

* `MessageContent::FrontendToolRequest { id, tool_call }`

Client → Core:

* результат должен быть доставлен в core так, чтобы `tool_result_rx.recv().await` получил tool result для `id`.

### 12.2 Эффект на цикл

`Agent::handle_frontend_tool_request(...)`:

1. `yield` `FrontendToolRequest`,
2. блокируется на `tool_result_rx.recv().await`,
3. пишет `ToolResponse` в историю и продолжает цикл.

## 13) Elicitation (MCP): запрос структурированных данных у пользователя

### 13.1 Что такое Elicitation

**Elicitation** — это механизм MCP, позволяющий MCP-серверу (extension) во время выполнения tool call запросить у пользователя дополнительную информацию (human-in-the-loop), когда:

* не хватает параметров,
* нужно явное согласие/выбор,
* требуется ввод, который не стоит пытаться “угадать” LLM.

Это **блокирующий шаг**: выполнение tool call приостанавливается до ответа пользователя или таймаута.

### 13.2 MCP протокол: request/response и типы данных

#### Request: `elicitation/create`

В MCP запрос на elicitation бывает в одном из режимов:

1. **Form mode (in-band форма)**

   * Сервер передаёт:

     * `message: string` (что показать пользователю)
     * `requestedSchema: object` (ограниченный JSON Schema)
   * `requestedSchema` ограничен:

     * top-level объект `type:"object"`
     * `properties` только плоские поля (без вложенных объектов)
     * типы полей — примитивы и простые enum-ы

   Типы полей (концептуально):

   * string (опц. формат: uri/email/date/date-time, min/max length)
   * number/integer (minimum/maximum)
   * boolean
   * enum (single/multi select)

2. **URL mode (out-of-band)**

   * Сервер передаёт:

     * `mode: "url"`
     * `message: string`
     * `url: string`
     * `elicitationId: string` (opaque id сервера)
   * Предполагается, что пользователь совершит действие по URL (например OAuth), а сервер дальше сам продолжит (иногда без передачи данных обратно через content).

#### Result: `ElicitResult`

Клиент возвращает:

* `action: "accept" | "decline" | "cancel"`
* `content?: object` (только если `accept` и был form mode)

  * значения: string/number/boolean/(иногда string[] для multi-select)

### 13.3 Как Goose маппит MCP Elicitation на свой цикл

#### Server → Goose (внутри MCP client)

Goose реализует callback `create_elicitation` в MCP клиенте (`GooseClient`).

Поведение Goose:

1. При получении `create_elicitation`:

   * **form**: `requestedSchema` сериализуется в JSON (`serde_json::Value`)
   * **url**: Goose упаковывает как JSON `{ "url": "<...>" }` (для UI)
2. Goose вызывает:

   * `ActionRequiredManager::request_and_wait(message, schema_value, timeout=300s)`
3. Goose ждёт ответ пользователя и затем возвращает результат MCP-серверу.

Текущая практическая семантика в Goose:

* успех → возвращается `Accept` с `content = user_data`,
* таймаут/ошибка → возвращается error (а не `Decline/Cancel`).

(Это важно учитывать авторам MCP серверов: “decline/cancel” как нормальный путь может не прийти, вместо этого будет ошибка.)

### 13.4 Внутренний протокол Goose ↔ Client (UI/CLI)

#### Запрос Elicitation (core → client)

Goose создаёт assistant message с:

* `MessageContent::ActionRequired(Elicitation { id, message, requested_schema })`

Где:

* `id`: uuid запроса (корреляция)
* `message`: строка для UI
* `requested_schema`: JSON:

  * form mode: schema объекта (type/object/properties/required/…)
  * url mode: `{ "url": "..." }`

Доставка в UI:

* `ActionRequiredManager` кладёт запрос в очередь.
* `Agent::reply_internal` периодически вызывает `drain_elicitation_messages()` и эмитит их как `AgentEvent::Message`.

#### Ответ Elicitation (client → core)

Клиент отправляет **user message** с:

* `ActionRequiredData::ElicitationResponse { id, user_data }`

Где:

* `id`: тот же id, который пришёл в запросе
* `user_data`: JSON object с введёнными значениями (для form), либо данные/маркер для url flow (если продукт так решит)

Обработка в core:

* `Agent::reply` при получении `ElicitationResponse`:

  * вызывает `ActionRequiredManager::submit_response(id, user_data)`,
  * сохраняет user message в `SessionManager`,
  * **не запускает** полноценный provider/tool цикл (возвращает пустой stream).

То есть “пробуждение” происходит так:

* основной `reply_internal` заблокирован внутри tool execution (ожидает `request_and_wait`),
* отдельный вход (от клиента) доставляет `ElicitationResponse` и будит ожидающий oneshot.

### 13.5 Требования к поддержке со стороны клиента

Клиент (Desktop UI / CLI / интегратор) должен уметь:

1. **Рендерить Elicitation**

   * показать `message`
   * интерпретировать `requested_schema`:

     * если это JSON Schema form → построить форму
     * если это `{ "url": "..." }` → показать ссылку/открыть браузер

2. **Собрать данные**

   * form mode: собрать значения по ключам `properties`
   * желательно валидировать:

     * required fields
     * типы (string/number/bool/enum)
     * ограничения (min/max)

3. **Отправить ответ**

   * отправить user message с `ElicitationResponse { id, user_data }`

4. **Поддержать несколько параллельных запросов**

   * ответы должны коррелироваться по `id`, а не “по порядку”.

5. **Учитывать таймаут**

   * по умолчанию ожидание в Goose ~300s; после этого tool call получит ошибку.

### 13.6 Требования к поддержке со стороны MCP сервера (extension)

MCP сервер должен:

1. **Использовать elicitation осознанно**

   * это блокирует выполнение инструмента и требует участия пользователя.

2. **Генерировать schema в рамках ограничений**

   * плоский объект, примитивные типы, без вложенных структур.

3. **Корректно обрабатывать ошибки/таймауты**

   * в текущей реализации Goose это основной способ “отказа”.

4. **В URL mode не ожидать обязательного `content`**

   * сервер должен строить flow так, чтобы он мог продолжить по собственным каналам (например после OAuth callback).

## 14) Расширения: интерфейсы и типы

### 14.1 Общий контракт инструментов

Независимо от типа расширения, инструменты в итоге сводятся к:

* `list_tools` → каталог `Vec<Tool>`
* `call_tool(name, arguments)` → `CallToolResult`
* notifications (опционально) → `ServerNotification`

В рантайме это объединяется интерфейсом MCP-клиента (`McpClientTrait`) и/или platform extension интерфейсом.

## 15) Типы расширений (без legacy SSE)

Ниже — каждый тип, зачем он нужен, интерфейс и характерные нюансы.

### 15.1 Platform (in-process)

**Зачем:** инструменты, которым нужен прямой доступ к core контексту (session manager, extension manager, внутренние сервисы).

**Интерфейс:** реализуется через platform extension trait (см. `platform_extensions/mod.rs`) и вызывается напрямую из процесса агента.

**Нюансы:**

* могут возвращать “platform notifications” через meta, которые UI может отобразить как отдельные события.

**Пример применения:** системные инструменты управления задачами/подагентами/внутренним состоянием.

### 15.2 Builtin (bundled MCP)

**Зачем:** поставляемые вместе с Goose MCP серверы (из `goose-mcp`), чтобы иметь “из коробки” инструменты без внешних установок.

**Интерфейс:** MCP (`list_tools`, `call_tool`, notifications).

**Нюансы:**

* могут запускаться in-process duplex или через контейнер (в зависимости от режима рантайма).

### 15.3 Stdio (локальный MCP subprocess)

**Зачем:** запуск внешнего MCP сервера как процесса (node/python/go/…), общение по stdio.

**Интерфейс:** MCP поверх stdio transport.

**Нюансы:**

* конфиг поддерживает `cmd/args/envs/env_keys/timeout`.
* есть запреты на переопределение опасных env vars.

**Пример:**

* локальный tool server для работы с репозиторием/командами/SDK, если не хочется HTTP.

### 15.4 Streamable HTTP (удалённый MCP endpoint)

**Зачем:** подключить удалённый MCP сервис (shared tools, корпоративные gateways, облачные интеграции).

**Интерфейс:** MCP поверх Streamable HTTP transport.

**Нюансы:**

* headers/envs поддерживают подстановку из окружения.
* возможны auth-required/OAuth flows (в зависимости от реализации клиента/сервера).

### 15.5 Inline Python

**Зачем:** быстрый способ определить MCP-инструменты как “код + зависимости” без отдельного сервера/репозитория.

**Интерфейс:** фактически исполняется как локальный tool server, но определяется как отдельный config type.

**Нюансы:**

* удобно для recipes/конфигов, но всё равно требует управляемого запуска и sandboxing дисциплины.

### 15.6 Frontend

**Зачем:** инструменты, которые должны выполняться в окружении клиента (UI), где core не имеет доступа к нужным API/интерактивности.

**Интерфейс:** tool schemas поставляются через config (`tools: Vec<Tool>`), исполнение через:

* `FrontendToolRequest` → ожидание результата → `ToolResponse`.

**Нюансы:**

* клиент обязан реализовать выполнение и доставку результата, иначе цикл будет ждать.

## 16) MCP интеграция: что реально используется

### 16.1 Базовые операции

* `list_tools` (discovery)
* `call_tool` (execution)
* notifications (stream) через `subscribe`

### 16.2 Server-initiated callbacks (важные для расширений)

* **Sampling**: сервер может попросить client вызвать LLM (`create_message`), Goose проксирует через Provider.
* **Elicitation**: сервер может запросить ввод у пользователя (`create_elicitation`), Goose проксирует через ActionRequiredManager (см. §13).

## 17) Практические инварианты (важно для разработки)

1. **Conversation-first**

   * Любая “реальность” цикла должна отражаться в `Conversation` через `Message`/`ToolResponse`.
   * Если не записали — провайдер это не увидит.

2. **Blocking points — нормальны**

   * approval, frontend-tools, elicitation — это await внутри стрима. Это не “фоновый воркер”.

3. **Инспекторы — часть стандартного цикла**

   * security/permission/repetition — не “слой”, а гейт перед исполнением tool calls.

4. **HistoryReplaced обязателен при замене истории**

   * иначе клиенты будут отображать устаревшую историю.