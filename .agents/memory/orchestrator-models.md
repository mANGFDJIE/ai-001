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
Set to 8192 for both orchestration calls and streaming. 4096 is too short for full application code generation.
