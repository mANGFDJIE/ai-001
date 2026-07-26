---
name: Orchestrator model list
description: Rules for ORCHESTRATOR_MODELS ordering, PRETTY/STRENGTHS maps, and system prompt tuning.
---

## Ordering: cheapest first
`ORCHESTRATOR_MODELS` is ordered by `cost` ascending. The router picks the cheapest model that satisfies task constraints (coding, vision, reasoning). On `isBudgetOrModelError`, it falls back to the next more expensive model.

## PRETTY and STRENGTHS maps must be 1:1
Every model ID in `ORCHESTRATOR_MODELS` must have exactly one entry in `PRETTY` (display name) and `STRENGTHS` (one-line capability description). Duplicate keys in `PRETTY` (e.g. `'deepseek/deepseek-coder'` mapped three times) cause the last value to win silently, showing wrong names in Active Model header.

**How to apply:** When adding/removing a model in `ORCHESTRATOR_MODELS`, update both `PRETTY` and `STRENGTHS` in `updateOrchestratorActiveModel()` in lockstep.

## max_tokens
Do not use a fixed large completion limit with VseGPT: its soft per-query price check includes the requested completion size. Calculate a conservative limit from the actual serialized prompt and model price, with a server-side cap as a final guard.

**Why:** A fixed `8192` request was rejected before generation when the account limit was `0.07₽`, even for otherwise valid short prompts.

**How to apply:** Keep the client budget calculation and server proxy cap in sync when changing model pricing, prompt size, or orchestration flow.
