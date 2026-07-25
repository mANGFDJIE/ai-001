# Дневник работы — 25 июля 2026

Документ описывает состояние проекта после сегодняшней сессии: что сделано, как
теперь работает, какие модели активны и почему.

## 1. Что реально работает (после правок)

Все LLM-запросы из UI идут через OpenAI-совместимый прокси `vsegpt.ru`:

```
client (app.js)
  → POST /api/chat/openai → server.js → https://api.vsegpt.ru/v1
                             ↑ ключ OPENAI_API_KEY (fallback VSEGPTRU)
```

- Ключ хранится только в **Replit Secrets**: `OPENAI_API_KEY`, `VSEGPTRU`
  (последний — fallback на случай, если `OPENAI_API_KEY` пуст).
- `SESSION_SECRET` резерв.
- Других секретов (Supabase, OpenRouter, Groq, Ollama) сейчас не требуется —
  каналы отключены.

`server.js` отдаёт статику с `Cache-Control: no-store`, поэтому после правок
`app.js` хватает hard refresh в браузере.

## 2. Архитектура чат-флоу

Прямой путь (любой модели из featured picker):

```
sendMessage() → SSE-стрим к выбранной модели → extract code → apply code → done
```

Оркестраторский путь (⭐ Авто / ⭐ Мульти-агент):

```
sendMessage() → runOrchestrator()
                  ├─ router:  deepseek/deepseek-chat
                  ├─ decision JSON: {direct | delegate | multi}
                  ├─ direct   → return router ответа
                  ├─ delegate → один эксперт с LLM_SYSTEM_PROMPT
                  └─ multi    → Promise.all 2–3 экспертов
                                → write files из каждого эксперта
                                → синтез через router (с инструкцией сохранять // file:)
                → sendMessage tail: extractCodeChanges → applyCodeChanges
```

Любая ветка заканчивается общим хвостом в `sendMessage` (≈ строка 1242 в
`public/app.js`), который:

1. достаёт все `````блоки кода````` из ответа (с fallback по lang);
2. шлёт их в `POST /api/apply-code` → сервер пишет в `WORKSPACE_DIR`;
3. параллельно бэкапит в `SupabaseSync.backupFile`, если Supabase включён.

## 3. Извлечение файлов из ответа

`extractCodeChanges` в `public/app.js` (~ строка 711) делает три попытки по
убыванию уверенности:

1. **Явный маркер** на первой строке: `// file: path`, `# file: path`,
   `<!-- file: path -->`.
2. **Неявный хинт** в первой строке: что-то вроде `file: index.html`
   без `//`.
3. **Авто-имя по `lang`** + эвристика: `html`→`index.html`, `css`→`styles.css`,
   `js`→`script.js`, `vue`→`App.vue`, … Несколько HTML-блоков получают
   `index2.html`, `index3.html`.

Эта эвристика закрыла проблему «Claude дал чистый блок ```html``` без
маркера и в проводник ничего не попало».

## 4. Полный список сегодняшних изменений

### `server.js`
- `Cache-Control: no-store` на всю статику (старый `app.js` не кэшируется).
- SSE-обёртка 4xx апстрима → `data: {"error":...}` + `[DONE]`, чтобы
  парсер в браузере не падал тихо.
- `res.flushHeaders()` сразу после `Content-Type: text/event-stream` —
  стрим виден с первого байта.
- Прокси-роут `GET /api/models` — каталог апстрима для отладки.
- `OPENAI_API_KEY || VSEGPTRU` в одном месте.
- `POST /api/chat/local` возвращает 503 с человеческим текстом, если
  `process.env.ENABLE_LOCAL_LLM !== '1'`. Иначе Replit-контейнер подыхал
  при импорте Transformers.js.

### `public/app.js`
- `extractCodeChanges` — трёхуровневый fallback пути (см. выше).
- `callOpenAI` теперь читает и `delta.content`, и `delta.reasoning_content`.
  Это исправляет пустой ответ от DeepSeek-V4 / GPT-5 thinking, где модель
  тратит токены на скрытое reasoning и `content` приходит пустым.
- `runOrchestrator` — четыре улучшения:
  1. `routerModel = 'deepseek/deepseek-chat'` (был `gpt-5-mini` — тот
     жёг все токены на encrypted reasoning и не выдавал JSON).
  2. `coding:true` пометка на сильных кодеров (`claude-sonnet-4.6`, …
     `deepseek-v4-flash-thinking`, `deepseek-coder`).
  3. system-prompt маршрутизатора явно говорит: «Если задача про
     код/UI/дебаг/архитектуру — выбирай модели с меткой coding.» В списке
     моделей теперь проставляется `(coding)`/`(mid)`/`(light)`
     справа от id.
  4. multi-ветка дополнительно: до синтеза прогоняет каждый экспертный
     ответ через `extractCodeChanges`, файлы записываются **до** синтеза,
     потому что синтезатор иногда теряет маркеры.
  5. system-prompt синтезатора дополнен инструкцией «ОБЯЗАТЕЛЬНО сохраняй
     блоки кода с пометкой `// file:` / `<!-- file: -->` КАК ЕСТЬ».
- Модельный пикер: ⭐ Топ-модели стали одной секцией, «Остальные»
  убраны. Default = `⭐ Авто` (оркестратор).
- `modelPresets['orchestrator']` и `modelPresets['multi']` — обновлены
  описания, чтобы отражать реальный маршрутизатор (DeepSeek Chat) и
  актуальный набор экспертов.

### `public/style.css`
- `.dropdown-section-label` — пунктир сверху + uppercase + серая подпись.
  Сейчас используется только для «⭐ Топ-модели».

### `public/webllm-chat.js`
- `MODELS = []`, `PRESETS = {}` — каталог пуст. WebLLM отключён;
  в пикере соответствующих пресетов нет.

## 5. Модели — текущее состояние

### Маршрутизатор / синтезатор
`deepseek/deepseek-chat` — V3-чат, не тратит токены на скрытое
reasoning, стабильно отдаёт JSON в нужном формате.

### Coding-эксперты (`coding:true` в `ORCHESTRATOR_MODELS`)
| id | для чего |
|---|---|
| `anthropic/claude-sonnet-4.6-thinking-high` | топовый кодер/агент, длинный контекст |
| `deepseek/deepseek-v4-flash-thinking` | кодер + chain-of-thought |
| `deepseek/deepseek-coder` | специализированный кодер, длинный контекст |

### Reasoning / light
| id | для чего |
|---|---|
| `deepseek/deepseek-r1` | многошаговые планы и рассуждения |
| `anthropic/claude-3-haiku` | лёгкая литературная |

### ⭐ Featured в пикере (ранжированы по качеству на коде)
1. `claude-sonnet-4.6-thinking-high`
2. `deepseek-v4-flash-thinking`
3. `claude-sonnet-4.5`
4. `claude-sonnet-4`
5. `deepseek-coder`
6. `deepseek-r1`

### Что в пикере **не** должно быть
> ❌ — заблокированы тарифом vsegpt (не «выбрали», а реально вернули
> ошибку `Subscription plans: https://vsegpt.ru/Docs/Tariffs` или
> `Temporarily disabled due to OpenAI blocking` при тестах):

- `openai/o3` и `openai/o3-mini` (OpenAI провайдер временно отключил)
- `openai/o4-mini` / `openai/o4-mini-high`
- `openai/gpt-5` / `openai/gpt-5.4-pro-high`
- `anthropic/claude-opus-4.6` / `claude-opus-4.6-thinking`
- `deepseek/deepseek-v4-pro-thinking` / `deepseek-v3.2-alt-thinking`

При апгрейде подписки можно будет вернуть обратно в featured.

### Как выбирает маршрутизатор

`runOrchestrator` шлёт в `deepseek/deepseek-chat` такой system-prompt:

```
Ты лёгкий маршрутизатор (deepseek/deepseek-chat). Реши, что делать.
Контекст: пользователь часто разрабатывает современные приложения
(код, UI, дебаг, архитектура). Для таких задач выбирай модели с меткой coding.

Действия — верни ТОЛЬКО один JSON-объект:
1) {"action":"direct","answer":"…"} — простая задача.
2) {"action":"delegate","model":"<id>"} — задача среднего уровня.
   (multi тоже возможен; см. orchestratorPrompt(mode))
Список id:
- anthropic/claude-sonnet-4.6-thinking-high (coding)
- …
```

JSON парсится regex'ом `\{[\s\S]*?\}` и сверяется с `ORCHESTRATOR_MODELS`.
Если id неизвестен — возвращаем прямой ответ маршрутизатора (fallback).

## 6. Секреты и запуск

- `OPENAI_API_KEY` (основной ключ vsegpt).
- `VSEGPTRU` (дубль, fallback если первый пуст).
- `SESSION_SECRET` (зарезервировано).

Workflow: `node server.js` → Express на 5000.

`npm install` ничего экзотического не требует (базовые Express и т.п.).

## 7. Часто используемые команды (отладка)

```bash
# синтаксис фронта
node --check public/app.js

# живой smoke прокси
curl -s -m 5 http://127.0.0.1:5000/api/config
# → {"hasOpenAI":true,"openaiBaseURL":"https://api.vsegpt.ru/v1",...}

# ручная запись файла
curl -X POST -H 'Content-Type: application/json' \
  -d '{"changes":[{"path":"test/a.html","content":"<h1>hi</h1>","lang":"html"}]}' \
  http://127.0.0.1:5000/api/apply-code
# → {"applied":["test/a.html"],"errors":[],"count":1}

# каталог провайдерских моделей
curl -s http://127.0.0.1:5000/api/models | head -c 600
```

## 8. Tip по Replit-проводнику

После того, как ⭐ Авто/Мульти-агент пишет файлы через `/api/apply-code`,
Replit-дерево **не всегда обновляется само**. Если «Нет файлов для
отображения» — щёлкни один раз по списку (это Replit UI-баг, не наш).
Файлы физически в `WORKSPACE_DIR` (см. `server.js`).

## 9. Что НЕ трогать без причины

- `workspace/preview/` — runtime-папка с `/preview/<file>` алиасом.
- `attached_assets/` — то, что пользователь прикладывал через Replit
  uploads. Архивные артефакты сессии.
- `server/server/llm/` — локальный LLM (Transformers.js). Отключён,
  активируется только с `ENABLE_LOCAL_LLM=1` (нужен RAM ≥ 1.5 GB).
- `replit.md` — общий README + User Preferences; не дублировать правила
  там и в этом файле.

## 10. Контрольные точки для отката

Если что-то сильно ломается — в checkpoint Replit хранится история
проекта. Полный список файлов ниже; в чекпоинтах они лежат вместе с
`node_modules` (Replit сохраняет полностью).

```
/  (root)
├── server.js          # Express: /api/* + статика
├── replit.md          # README + user prefs (НЕ трогать)
├── WORK-LOG.md        # ЭТОТ ФАЙЛ
├── package.json
├── package-lock.json
├── public/            # UI: index.html, app.js, style.css,
│   │                  #       webllm-chat.js (модели = []),
│   │                  #       web-llm.js (бандл ~6 МБ)
│   └── workspace/     # (прочее)
├── server/            # server-side LLM helpers (отключены)
├── supabase/          # sync-слой (отключён в этой сессии)
├── workspace/         # файлы агента, появляются во время сессии
│   └── preview/       # runtime-папка
├── screenshots/       # скриншоты тестовых прогонов
└── attached_assets/   # что юзер загружал через UI
```
