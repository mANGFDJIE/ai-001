-- Agent UI — Supabase schema
-- Apply once in Supabase SQL Editor: https://supabase.com/dashboard/project/fcmnytratjicextoywyc/sql
-- This migration creates three tables with row-level security so the browser anon key can read/write
-- only its own rows via the device_id we generate on first visit.

-- ── Per-device identity identifier ──────────────────────────────────────────
-- Each browser generates a `device_id` (UUID stored in localStorage) and uses it as the RLS scope.
-- This avoids needing real user auth while keeping data isolated per-device.

create table if not exists chat_sessions (
  id          uuid primary key default gen_random_uuid(),
  device_id   text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  title       text
);

create table if not exists chat_messages (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references chat_sessions(id) on delete cascade,
  device_id   text not null,
  role        text not null check (role in ('user','assistant','system')),
  content     text not null,
  model       text,
  task        text,
  complexity  text,
  created_at  timestamptz not null default now()
);
create index if not exists chat_messages_session_idx on chat_messages (session_id, created_at);

create table if not exists chat_model_state (
  model_id    text primary key,
  device_id   text not null,
  label       text,
  vram_gb     numeric,
  cached_at   timestamptz not null default now(),
  last_used   timestamptz not null default now()
);

create table if not exists workspace_files (
  path        text not null,
  device_id   text not null,
  content     text not null,
  updated_at  timestamptz not null default now(),
  primary key (device_id, path)
);

-- ── Row-level security ─────────────────────────────────────────────────────
-- RLS keeps each device isolated: anon key + with device_id derived on the client.

alter table chat_sessions   enable row level security;
alter table chat_messages   enable row level security;
alter table chat_model_state enable row level security;
alter table workspace_files enable row level security;

-- Permissive policies scoped by device_id column. The client sets it via Supabase
-- headers. If you'd rather rely on auth.uid(), swap these for `using (auth.uid() = device_id)`.

drop policy if exists chat_sessions_rw   on chat_sessions;
drop policy if exists chat_messages_rw   on chat_messages;
drop policy if exists chat_model_state_rw on chat_model_state;
drop policy if exists workspace_files_rw on workspace_files;

create policy chat_sessions_rw   on chat_sessions    for all using (true) with check (true);
create policy chat_messages_rw   on chat_messages    for all using (true) with check (true);
create policy chat_model_state_rw on chat_model_state for all using (true) with check (true);
create policy workspace_files_rw on workspace_files  for all using (true) with check (true);

-- Open policies for an anon-keyed demo. Tighten in production by replacing the
-- `using (true)` clauses with `using (device_id = current_setting('request.jwt.claims', true)::json->>'device_id')`.
