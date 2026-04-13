# Agent Operating Policy (Advisor Strategy)

## Purpose
This repository uses a **cost-efficient advisor workflow**:
- A cheaper primary executor handles most tasks.
- A stronger advisor model is used only for bottlenecks, ambiguity, or high-impact decisions.

The goal is to reduce token/cost usage **without sacrificing reliability**.

## Default Execution Mode
The primary executor should handle, by default:
- repository inspection
- file search and log reading
- small code edits
- straightforward bug fixes
- simple refactors
- repetitive implementation work
- running tests and basic verification

## Model Routing Policy
- Default execution model is fixed to **gpt-5.3-codex**.
- Escalate to **gpt-5.4** only when one or more of the following are true:
  - the same issue failed after 2 or more attempts
  - root cause is still unclear
  - architecture branching or broad side effects are expected
- Delegate simple tasks to **gpt-5.2** or **gpt-5.4-mini**:
  - exploration / grep / log summarization
  - repetitive substitutions / boilerplate edits
  - simple data cleanup

## Escalation Triggers (Advisor Model)
Escalate only if one or more conditions are true:
- the same issue remains unresolved after 2 attempts
- root cause is still unclear
- multiple architecture options have meaningful tradeoffs
- the change may have broad side effects
- integration or migration risk is high
- parallel findings conflict
- the task requires deeper reasoning than routine execution

## Task and Escalation Docs
- At task start, use **TASK_TEMPLATE.md** to keep scope and success criteria explicit.
- At escalation time, use **ESCALATION_NOTE.md** to send a compact decision-focused summary.

## Advisor Request Format (Narrow Scope)
When escalating, ask for guidance only (not full execution) unless absolutely necessary.
Advisor output should include:
- top root-cause hypotheses
- next best diagnostic step
- preferred design direction
- main risks and constraints
- compact execution plan

After advisor guidance, return implementation to the primary executor.

## Reasoning Effort Policy
- Default reasoning effort: **low to medium** for routine tasks.
- Increase to **high** only for:
  - architectural decisions
  - risky migrations
  - unclear root causes after repeated failures
- Drop back to low/medium once the strategy is clear and work becomes routine.

## Context and Token Budget Rules
- Minimize unnecessary context transfer.
- Summarize findings before escalation; avoid pasting large raw logs unless required.
- Keep advisor prompts compact and decision-focused.
- Do not re-escalate the same question without new evidence.
- Prefer targeted patches over broad rewrites.
- Read only the file sections needed for the current step.
- Avoid repeated full-file dumps when focused search/context is enough.
- Keep read scope minimal and only pull required sections.
- Use lower models in parallel for exploration; reserve higher models for decisions.
- Never send raw long logs to higher models when a concise summary is sufficient.

## Reliability Guardrails
- Do not skip validation for high-risk changes.
- For risky edits, run the smallest relevant verification first, then expand only if needed.
- If confidence is low, escalate for direction before broad code changes.

## Expected Behavior
- Optimize total cost efficiency across the full task, not single-step quality.
- Use the stronger model as a strategic reviewer/advisor, not a default worker.
- Keep execution momentum with the cheaper model once direction is clear.
