---
name: Imported project setup
description: Lessons from setting up a project imported from a zip archive.
---

# Imported project setup

When a project is imported from a zip, `node_modules` is usually not included. If the run workflow is `node server.js`, it fails with `MODULE_NOT_FOUND` until `npm install` is run.

**Why:** Zip imports do not preserve installed dependencies, only source code and lock files.

**How to apply:** After a zip import, immediately run `npm install` (or the equivalent for the project's package manager) before testing the run workflow. If the project will be used by others, record this step in `replit.md`.
