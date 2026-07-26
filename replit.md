# User preferences

## Язык и стиль общения
- Общение: **русский**
- Экономность: максимально беречь кредиты и токены — делать хорошо сразу, выполнять задачу целиком, можно медленно

- Сохранение в репозиторий: после **любого** изменения кода/конфигов документации — коммитить и пушить в `https://github.com/mANGFDJIE/ai-001`.

Это правило действует на сессию от 26 июля 2026.

## Правило сессии 26 июля 2026 (повтор)
- Язык общения: **русский**.
- **Максимальная экономия кредитов и токенов**: делать хорошо сразу, задачу целиком, можно медленно.

## Проект

# Agent UI (VseGPT)

AI-агент с чатом, подключённый к **VseGPT.ru** (OpenAI-совместимый API). Все выбранные модели — vision: умеют видеть картинки и генерировать код/вёрстку.

## Стек

- **Backend:** Node.js + Express (`server.js`), порт 5000 — прокси к VseGPT, файлы агента, конфиг
- **Frontend:** Vanilla HTML/CSS/JS в `public/`
- **LLM провайдер:** VseGPT (`https://api.vsegpt.ru/v1`) — OpenAI-совместимый API
- **Sync слой:** Supabase Postgres (опционально)
- **Локальный fallback:** `localStorage` + `workspace/preview/`

## Запуск

1. Локально: `npm install` + `npm start` (или воркфлоу «Start application»).
2. Откройте URL в браузере.

Если Supabase не настроен, всё работает локально. Sync слой автоматически включается, когда сервер видит необходимые переменные окружения.

> **Важно:** секреты (`SUPABASE_SERVICE_KEY`, `SUPABASE_ANON_KEY`, `SUPABASE_URL`, `OPENAI_API_KEY`) должны храниться только в **Replit Secrets**, а не в файлах проекта. В `.replit` они не должны быть указаны.

## Переменные окружения

| Переменная | Нужна | Зачем |
|---|---|---|
| `SESSION_SECRET` | да (установлена) | зарезервировано |
| `OPENAI_API_KEY` | да (установлен) | ключ vsegpt.ru |
| `VSEGPTRU` | fallback | ключ vsegpt.ru на случай пустого `OPENAI_API_KEY` |
| `OPENAI_BASE_URL` | опционально | базовый URL провайдера; по умолчанию `https://api.vsegpt.ru/v1` |
| `SUPABASE_URL` | для sync | URL проекта Supabase |
| `SUPABASE_ANON_KEY` | для client config | публичный anon-ключ, если он нужен клиенту |
| `SUPABASE_SERVICE_KEY` | для server sync | серверный ключ хранится только в Replit Secrets |

Supabase не включается автоматически из файлов проекта. Для синхронизации добавьте значения через Replit Secrets; без них используется локальное хранилище.

## Поведение Supabase sync

Sync идёт через **серверный proxy** (`/api/sync/*` в `server.js`), а не из браузера. Сервер использует `SUPABASE_SERVICE_KEY` (admin), в браузер никакой ключ не уходит — только anon публичное значение для других нужд.

| Действие в UI | Локально | Через серверный endpoint → Supabase |
|---|---|---|
| Отправить сообщение | `localStorage` (мгновенно) | `POST /api/sync/chat` → INSERT в `chat_messages` |
| Загрузить историю | все сообщения из localStorage | `POST /api/sync/chat/list` → SELECT с лимитом |
| Скачать модель | WebLLM кэш в браузере | `POST /api/sync/model` → UPSERT в `chat_model_state` |
| Агент создал/изменил файл | запись в `workspace/preview/` | `POST /api/sync/file` → UPSERT в `workspace_files` |
| Ctrl+L (очистка) | `localStorage.chat_history` очищен | `SupabaseSync.clearSession()` сбрасывает session_id |

Все сетевые ошибки глотаются (fire-and-forget). При первом PGRST205 (схема не применена) sync тихо отключается до конца сессии.

## Что нужно сделать вам один раз

Откройте **https://supabase.com/dashboard/project/selfmhgevtpibmodairg/sql** и выполните SQL из файла `supabase/schema.sql`. После этого все sync-операции автоматически заработают — без правки кода.

**Почему это не автоматизировано из бота:** прямой TCP к Postgres (порт 5432) закрыт фаерволом Replit-песочницы; pooler `aws-0-*.pooler.supabase.com:6543` вашего проекта не резолвится DNS из песочницы; Management API `api.supabase.com/v1/projects/{ref}/database/query` принимает только Personal Access Token (PAT), не service_role. Никакого секрета от JWT-ключей у меня нет — только пароль БД из вашего дашборда.

## Модели — статический ростер VseGPT

С 26 июля 2026 ростер моделей **захардкожен** в `public/app.js`. Серверный авто-скан `/v1/models` отключён, чтобы не тратить кредиты на периодические запросы к API.

Мульти-AI отключён — выбранная модель отвечает напрямую.

| Модель | ID | Цена за 1K (prompt / completion) | Назначение |
|---|---|---|---|
| **V0 — Llama 3.2 11B Vision** | `vis-meta-llama/llama-3.2-11b-vision-instruct` | 0.055₽ / 0.055₽ | UI по скриншоту / макету |
| **Copilot — GPT-4o mini** | `vis-openai/gpt-4o-mini` | 0.037₽ / 0.15₽ | OpenAI coding assistant |
| **Replit Agent — Llama 4 Scout** | `vis-meta-llama/llama-4-scout` | 0.05₽ / 0.16₽ | быстрый open-source vision-кодер |
| **Claude 3 Haiku Vision** | `vis-anthropic/claude-3-haiku` | 0.066₽ / 0.30₽ | аналог Claude |
| **GPT-OSS 20B (Free)** | `openai/gpt-oss-20b` | 0.014₽ / 0.06₽ | открытая модель OpenAI, tools |
| **Gemma 4 31B (Free)** | `google/gemma-4-31b-it` | 0.045₽ / 0.13₽ | Google, vision+tools+structured |
| **North Mini Code (Free)** | `cohere/command-r7b-12-2024` | 0.01₽ / 0.025₽ | от Cohere, заточена под код |
| **Qwen 3 32B (≤0.07₽)** | `qwen/qwen3-32b` | 0.015₽ / 0.055₽ | аналог Qwen 3.5 Plus — флагман, 32B |
| **Qwen 3 14B (0.045₽)** | `qwen/qwen3-14b` | 0.012₽ / 0.033₽ | Qwen 3 средняя — код/анализ |
| **Mistral Small 3.2 (0.06₽)** | `mistralai/mistral-small-3.2-24b-instruct` | 0.015₽ / 0.045₽ | аналог Mistral Medium 3.5 — tools |
| **Gemini Flash 1.5 (0.067₽)** | `google/gemini-flash-1.5` | 0.017₽ / 0.05₽ | аналог Gemini 3.5 Flash — старшее поколение |
| **Gemini Flash 1.5 8B (0.055₽)** | `google/gemini-flash-1.5-8b` | 0.015₽ / 0.04₽ | Gemini Flash 1.5 малая, tools |
| **Llama 3 8B (0.07₽)** | `meta-llama/llama-3-8b-instruct` | 0.035₽ / 0.035₽ | аналог Llama 3.3/3.1 — ровно 0.07₽/1K |
| **Llama 3.2 3B (0.03₽)** | `meta-llama/llama-3.2-3b-instruct` | 0.015₽ / 0.015₽ | аналог Llama 3.1 8B — малая, дешёвая |
| **Perplexity Small (Free)** | `perplexity/latest-small-online` | 0₽ / 0₽ | бесплатно! Веб-поиск |
| **Perplexity Large (Free)** | `perplexity/latest-large-online` | 0₽ / 0₽ | бесплатно! Веб-поиск |
| **Nova Lite (0.06₽)** | `amazon/nova-lite-v1` | 0.02₽ / 0.04₽ | Amazon Nova Lite, tools |
| **Nova Micro (0.042₽)** | `amazon/nova-micro-v1` | 0.012₽ / 0.03₽ | Amazon Nova Micro, tools |

Все модели отсортированы по стоимости (дешёвые выше). Ростер обновляется из каталога VseGPT при старте.

Бюджет на один запрос: **0.1₽** (`BUDGET_RUB` в `public/app.js`). Минимальная цена vision-запроса в VseGPT ~0.09₽, поэтому лимит в настройках VseGPT должен быть **не меньше 0.1₽** (https://vsegpt.ru/User/SettingsModels → «Лимит: 1 запрос не должен стоить больше, чем X рублей»).
