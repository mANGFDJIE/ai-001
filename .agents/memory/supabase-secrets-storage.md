---
name: Supabase secrets storage
description: Where Supabase credentials must be stored in a Replit project.
---

# Supabase secrets storage

Supabase credentials (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`) must be stored as **Replit Secrets**, not in `.replit`, `replit.md`, source files, or any committed file. The service role key in particular must never leave the server.

**Why:** Storing service keys in project files exposes admin-level access to anyone who can read the repo or the `.replit` config. Replit Secrets are the only safe place for these values.

**How to apply:** If credentials are found in `.replit` or source, remove them and use `requestSecrets` to ask the user for the real values. Document in `replit.md` that secrets are required via Replit Secrets.
