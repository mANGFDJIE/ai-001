---
name: .replit edits
description: How to safely modify the .replit configuration file.
---

# `.replit` edits

Direct `WriteFile` or `Edit` on `.replit` is rejected by the environment. To update `.replit`:

1. Write the full updated TOML to a temporary file inside the workspace (e.g. `/home/runner/workspace/.replit.new`).
2. Call `verifyAndReplaceDotReplit({ tempFilePath: '/home/runner/workspace/.replit.new' })` in CodeExecution.
3. The replacement is validated before being applied.

**Why:** Replit validates `.replit` schema and workflow definitions; a direct write could corrupt the project configuration.

**How to apply:** Any workflow/port/Nix change that requires editing `.replit` must go through `verifyAndReplaceDotReplit`.
