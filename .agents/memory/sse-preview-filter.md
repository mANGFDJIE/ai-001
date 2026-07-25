---
name: SSE preview reload filter
description: Only reload preview iframe when actual renderable code changes, not on every file write.
---

## Problem
`/api/workspace/events` fires for every file write (including `attached/` image uploads). Calling `hardReloadIframe` on every event causes unnecessary flicker and loses the iframe scroll state.

## Solution
In `subscribeWorkspace()` in `app.js`, filter the `files` SSE event: only call `reloadPreview()` if at least one changed file is a renderable code/markup type (`.html`, `.css`, `.js`, `.jsx`, `.ts`, `.tsx`, `.svg`, `.json`) and is NOT in `attached/` directory. Also clear `_fileCache` on every change so the source viewer shows fresh content.

**Why:** Attached images, selection HTML snippets, and other non-code files should not trigger preview reload.
**How to apply:** Keep the `hasCodeChange` predicate in sync if new renderable extensions are added.
