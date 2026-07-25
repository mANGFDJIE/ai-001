# Как работает Supabase-интеграция в проекте

Краткая инструкция по всему стеку «облачной синхронизации», который прикручен к локальной WebLLM-агенте.

## 1. Общая схема (кто кого вызывает)

```
Браузер (UI + WebLLM)
   │  fetch('/api/...')         ← обычные HTTP-запросы, никаких SDK внутри
   ▼
Сервер (Node.js + Express, server.js, порт 5000)
   │  supabaseAdminEnabled()    ← проверяет наличие env vars
   │  service_role JWT          ← admin-токен, держится только на сервере
   ▼
Supabase REST API (PostgREST)
   ▼
PostgreSQL (4 таблицы в схеме public)
```

Браузер **никогда** не подключается к Supabase напрямую и не знает service_role. В JS-коде страницы (всё, что отправляется в браузер) нет ни anon-ключа с правами на запись, ни тем более service-ключа.

## 2. Что грузится на сервере и откуда это берётся

| Слой | Файл | Размер | Что делает |
|---|---|---|---|
| Express + sync endpoints | `server.js` | ~7 КБ | раздаёт UI, проксирует sync-запросы к Supabase |
| Auto-bootstrap таблиц | `supabase/bootstrap.js` | ~2 КБ | при старте пытается применить SQL через прямой TCP к Postgres; помечен однократной попыткой за процесс |
| Миграция | `supabase/schema.sql` | 70 строк | DDL: 4 таблицы + RLS-политики; идемпотентен (`IF NOT EXISTS`) |
| node_modules | `node_modules/pg` + `@supabase/supabase-js` | ~10 МБ | `pg` нужен только bootstrap’у, `supabase-js` сейчас не используется (REST идёт через `fetch`) |

`SUPABASE_SERVICE_KEY` используется **только с сервера**; **никогда не отдаётся в HTML/JS** и **никогда не отправляется в браузер**. Это единственное место, где можно делать что угодно: миновать RLS, читать/писать чужие строки.

## 3. Переменные окружения (env vars)

Задаются через Replit Secrets (иконка с замком слева). Установлены в проекте:

| Имя | Что это | Где используется |
|---|---|---|
| `SUPABASE_URL` | `https://selfmhgevtpibmodairg.supabase.co` | базовый URL для всех REST-вызовов |
| `SUPABASE_ANON_KEY` | JWT с `role:anon` | **сейчас не используется** (раньше был в браузере, теперь весь sync через сервер) |
| `SUPABASE_SERVICE_KEY` | `sb_secret_...` (admin) | только в `server.js`. Проксирует все `/api/sync/*` |

Дополнительно есть `SUPABASE_DB_URL` — раньше планировался для прямого TCP-bootstrap, но порт 5432 закрыт с Replit-песочницы, и pooler для selfmhgevtpibmodairg не резолвится DNS, поэтому этот путь не работает. Схема применяется через SQL Editor в дашборде.

## 4. Что за что отвечает в `server.js`

```
GET   /api/config                  → отдаёт браузеру { mode:'webllm', source:'browser' }
                                     (раньше включал anonKey — убран из соображений минимализма)
POST  /api/sync/session            → создаёт запись в chat_sessions, возвращает session_id
POST  /api/sync/chat               → INSERT в chat_messages
POST  /api/sync/chat/list          → SELECT последних N сообщений сессии
POST  /api/sync/model              → UPSERT в chat_model_state (какая модель скачана, когда использовалась)
POST  /api/sync/file               → UPSERT в workspace_files (бэкап файла, который агент создал/изменил)
GET   /api/supabase-status         → диагностика: { admin:true|false, applied:true|false, project, errors }
POST  /api/apply-code              → также сохраняет файлы агента в workspace/preview/, теперь и в Supabase
```

Когда `SUPABASE_URL` или `SUPABASE_SERVICE_KEY` не заданы, `supabaseAdminEnabled()` → `false`. В этом случае endpoints возвращают **503**, и браузер автоматически падает на localStorage.

## 5. Браузерная сторона: `public/supabase-sync.js`

Один файл, самодостаточный. Загружается `<script defer>` рядом с `app.js`. Не подтягивает никаких SDK (раньше через `https://esm.sh/@supabase/supabase-js@2.49.1` подгружал — теперь просто `fetch('/api/...')`).

Рабочий объект `window.SupabaseSync` со следующими методами:

| Метод | HTTP endpoint | Когда вызывается в `app.js` |
|---|---|---|
| `init()` | GET `/api/supabase-status` | один раз при загрузке `loadConfig()` |
| `ensureSession()` | POST `/api/sync/session` | перед каждым `pushMessage`, кэширует session_id в localStorage |
| `pushMessage(role, content, meta)` | POST `/api/sync/chat` | после каждого `appendUserMsg` и после каждого `finalizeStreaming` |
| `loadHistory(limit)` | POST `/api/sync/chat/list` | при `loadMessages()` — поверх localStorage |
| `markModelLoaded(id, label, vram)` | POST `/api/sync/model` | после загрузки модели в режиме «Авто» |
| `backupFile(path, content)` | POST `/api/sync/file` | после `applyCodeChanges`, для каждого применённого файла |
| `clearSession()` | — | при нажатии Ctrl+L |

Каждый метод **fire-and-forget** (`.catch(()=>{})`), одна ошибка не блокирует UI.

Важно: при первом **PGRST205** (схема не применена) sync тихо отключается до конца сессии, не пытаясь долбиться бесконечно. Как только SQL из `supabase/schema.sql` применён в дашборде — следующий запрос начнёт писать.

## 6. Что в `supabase/schema.sql`

Четыре таблицы, связанные по принципу "по одному `device_id` на браузер":

```
chat_sessions            id, device_id, title, created_at, updated_at
                          (одна сессия = один пользовательский «диалог»)
chat_messages            id, session_id → chat_sessions.id ON DELETE CASCADE,
                          role CHAR(user|assistant|system), content, model, task, complexity
chat_model_state         PK model_id, device_id, label, vram_gb, last_used
                          (какие модели скачаны в этом браузере)
workspace_files          PK(device_id, path), content, updated_at
                          (бэкап всего, что агент создал в workspace/preview/)
```

Плюс:
- RLS включена (`enable row level security` на всех 4).
- Политики открытые (`using (true)`) — потому что мы идентифицируем устройство через `device_id` в строке, а не через `auth.uid()`. Для продового приложения стоит ужесточить.

## 7. Что НЕ делает Supabase-интеграция

- **Не хранит ML-веса моделей.** Модели скачиваются с HuggingFace CDN браузером через WebLLM один раз и кэшируются в IndexedDB/Disk. Supabase не подходит для этого ни по формату, ни по ширине канала (ограничения TVM-runtime).
- **Не выполняет инференс.** Всё считает браузер на вашем GPU. Сервер — только статика + sync-API.
- **Не заменяет локальный кэш.** Первый источник правды остаётся `workspace/preview/` для файлов и `localStorage` для чата. Supabase — зеркало.

## 8. Диагностика — что смотреть

```
curl http://127.0.0.1:5000/api/supabase-status
```

Возвращает:

| Поле | Значение |
|---|---|
| `admin` | `true` = есть и `SUPABASE_URL`, и `SUPABASE_SERVICE_KEY`; `false` = sync отключён |
| `project` | URL проекта Supabase (или `null`) |
| `applied` | `true` = bootstrap руками подключился и применил schema; сейчас всегда `false` (прямой TCP недоступен) |
| `tried` | `true` = bootstrap делал попытку в этой сессии |
| `errors` | текст последней ошибки bootstrap, если был |

В браузере: DevTools → Console. Здоровые сообщения — без `[warn] session create failed` и без `PGRST205`. Если видите PGRST205 — схема не применена, sync отключится сам.

## 9. Как расширить (если нужно)

| Хочу | Что править |
|---|---|
| Добавить новое поле в сообщение (например, `tokens_used`) | ALTER TABLE в дашборде → `app.js` `saveMessages` → `client.js` `pushMessage` → `server.js` `/api/sync/chat` |
| Ужесточить RLS | поменять `using (true)` на `using (device_id = current_setting('request.jwt.claims',true)::json->>'device_id')` и прокинуть `device_id` как JWT-claim через `supabase.auth.admin.createUser()` |
| Переезд на другой проект | поменять `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` + применить `schema.sql` в новом проекте |
| Сбросить всю историю | `DELETE FROM chat_messages WHERE device_id='<ваш uuid>'` в SQL Editor, либо `Ctrl+L` в UI |

## 10. Где что лежит в репозитории

```
public/
  supabase-sync.js       ← браузерный клиент sync (3.7 КБ)
  app.js                 ← вызовы SupabaseSync в saveMessages/loadHistory/applyCodeChanges
  index.html             ← <script defer src="supabase-sync.js"> рядом с app.js

server.js                ← /api/sync/{session,chat,chat/list,model,file}, /api/supabase-status
supabase/
  schema.sql             ← 4 таблицы + RLS (70 строк)
  bootstrap.js           ← однократная попытка auto-apply через pg (сейчас недостижимо)
SUPABASE.md              ← этот файл
replit.md                ← общий README проекта
```

Архитектура: «локальный браузерный агент + опциональное облачное зеркало для истории».
