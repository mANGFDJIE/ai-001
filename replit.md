# User preferences

## Язык и стиль общения
- Общение: **русский**
- Экономность: максимально беречь кредиты и токены — делать хорошо сразу, выполнять задачу целиком, можно медленно

Это правило действует на сессию от 25 июля 2026.

## Проект

# Agent UI (локальные + API модели)

AI-агент с чатом на **трёх провайдерах**: WebLLM (браузер, WebGPU), локальный сервер (Transformers.js, CPU), и OpenAI-совместимые API (DeepSeek, OpenAI, OpenRouter). Никаких платных подписок — модели под ваш сценарий.

## Стек

- **Backend:** Node.js + Express (`server.js`), порт 5000 — прокси API, файлы агента, конфиг
- **Frontend:** Vanilla HTML/CSS/JS в `public/`
- **LLM провайдеры:**
  - [WebLLM](https://github.com/mlc-ai/web-llm) — 29 open-source моделей в браузере (нужен WebGPU)
  - Transformers.js — серверный CPU-инференс (без WebGPU)
  - OpenAI-совместимый прокси — DeepSeek / GPT / OpenRouter
- **Sync слой:** Supabase Postgres (опционально)
- **Локальный fallback:** `localStorage` + `workspace/preview/`

## Запуск

1. **Один раз в Supabase SQL Editor:** открыть https://supabase.com/dashboard/project/fcmnytratjicextoywyc/sql, вставить содержимое `supabase/schema.sql`, нажать **Run**. Создастся 4 таблицы с RLS.
2. Локально: `npm install` + `npm start` (или воркфлоу «Start application»).
3. Откройте URL в **Chrome 113+ или Edge 113+** — модели требуют WebGPU.

Если Supabase не настроен, всё работает локально (только в браузере). Sync слой автоматически включается, когда сервер видит необходимые переменные окружения.

> **Важно:** секреты (`SUPABASE_SERVICE_KEY`, `SUPABASE_ANON_KEY`, `SUPABASE_URL`) должны храниться только в **Replit Secrets**, а не в файлах проекта. В `.replit` они не должны быть указаны.

## Переменные окружения

| Переменная | Нужна | Зачем |
|---|---|---|
| `SESSION_SECRET` | да (установлена) | зарезервировано |
| `OPENAI_API_KEY` | да (для прокси главный) | ключ vsegpt.ru / OpenAI-совместимого провайдера |
| `VSEGPTRU` | fallback | ключ vsegpt.ru на случай пустого `OPENAI_API_KEY` |
| `SUPABASE_URL` | для sync | URL проекта Supabase |
| `SUPABASE_ANON_KEY` | для client config | публичный anon-ключ, если он нужен клиенту |
| `SUPABASE_SERVICE_KEY` | для server sync | серверный ключ хранится только в Replit Secrets |
| ~~`OPENROUTER_API_KEY`~~ | нет | больше не нужна |
| ~~`GROQ_API_KEY`~~ | нет | больше не нужна |
| ~~`OLLAMA_HOST`~~ | нет | больше не нужна |

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

## Каталог моделей — 29 штук

Все модели имеют **открытые веса** (Apache 2.0 / MIT / Qwen License / Llama Community License) и опубликованы MLC-AI в формате для браузера.

### Reasoning / DeepSeek-R1 (дистилляции)

| Модель | Размер |
|---|---|
| DeepSeek-R1-Distill-Qwen-32B | ~17 ГБ |
| DeepSeek-R1-Distill-Qwen-14B | ~9 ГБ |
| DeepSeek-R1-Distill-Llama-8B | ~5 ГБ |

### Универсалы нового поколения

| Модель | Размер | Год |
|---|---|---|
| **Qwen3.5 9B** / 4B | 2.8–5.5 ГБ | Apr 2026 |
| Qwen3 32B / 14B / 8B / 4B / 1.7B | 1.3–18 ГБ | 2025 |
| Llama 3.1 8B / 3.2 3B / 3.2 1B | 0.9–5 ГБ | Meta |
| Gemma 3 12B / 4B | 2.8–7.5 ГБ | Google 2025 |
| Mistral 7B v0.3 / Ministral 3B | 2.2–4.5 ГБ | Mistral AI |
