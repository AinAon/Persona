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
- Escalate to **gpt-5.5** only when one or more of the following are true:
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

## Library-First Rule
- Prefer proven libraries over custom implementation.
- Before proposing custom patterns, first identify and present widely adopted, low-incident implementation patterns (for memory, chat, state, data flow, and similar core areas), even when they are not tied to a specific library.
- If such a standard pattern exists, treat it as the default recommendation and explicitly state it first before alternatives.
- For high-variance browser/device areas (drag-and-drop, virtual scroll, editor, markdown rendering, image processing, animation, gesture, form validation), do not choose custom code by default.
- Choose custom implementation only when requirements are very simple or library adoption cost is not justified.
- For new features and bug fixes, first evaluate replacing with an existing proven library and propose that path first when feasible.
- Especially avoid hand-rolled solutions for mobile touch/selection/scroll/drag/input interactions.
- Library selection criteria: stability, adoption, maintenance health, bundle impact, and vanilla JS fit.

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

## Root Cause Communication Protocol (Mandatory)
- When a user reports a problem, do **not** present a guessed root cause as final.
- First produce hypotheses, then run a quick validation step before reporting causes.
- For simple checks, use **gpt-5.4-mini** for fast verification.
- For complex/high-impact issues, verify directly with code/log/runtime evidence before concluding.
- After verification, report only high-probability causes with brief evidence and confidence.
- If evidence is weak, explicitly label it as tentative and request one targeted follow-up check.

## Cache Change Safety Rule
- Do not introduce force cache-busting/no-store logic as a default fix unless there is evidence that stale cache is the root cause.
- In image-loading paths, treat cache behavior as a stability-sensitive area; prefer preserving existing cache contract first.
- If cache behavior must be changed, document expected side effects and add a rollback path.

## Mandatory Line For Small Models
Always append the following sentence block when delegating to a smaller model:
- Only modify the specified section.
- Do NOT rewrite the entire file.
- Preserve encoding (UTF-8) and formatting.
- Do NOT refactor unrelated code.

## Strict Edit Safety Rules (Mandatory)
- NEVER rewrite the entire file.
- Modify ONLY the specified lines.
- Preserve all existing text exactly (including Unicode/Korean).
- Do NOT normalize encoding or formatting.
- Do NOT refactor.
- Do NOT reformat.
- Do NOT clean up code.

File encoding must remain UTF-8.

## Terminal Encoding Guard (Mandatory)
- At the start of Windows terminal work, force UTF-8 console code page (`chcp 65001 >nul`) before search/read/edit commands.
- In PowerShell, explicitly set UTF-8 for console I/O when possible (`[Console]::InputEncoding` / `[Console]::OutputEncoding`).
- Never rely on default encoding for file reads/writes; always specify encoding explicitly (for example, `Get-Content -Encoding UTF8`).
- Treat BOM-less UTF-8 as a high-risk misread case on legacy shells; verify encoding before concluding text is corrupted.
- If terminal output and editor view differ, trust byte-level verification first and report the discrepancy before any edit.

## Communication Before Edits (Mandatory)
- Do NOT make code changes silently.
- Always announce intended edits before modifying files.

## File Rewrite Prohibition (Mandatory)
- Never use whole-file rewrite methods for existing files (`Set-Content`, full-file regex replace, here-string overwrite, or equivalent).
- Never perform operations that rewrite large unchanged regions just to edit a few lines.
- For existing files, use line-targeted patching only (`apply_patch` with minimal hunks).
- If a patch cannot be applied safely, stop and ask before attempting any fallback that rewrites the file.
- After each edit, immediately verify diff scope is minimal; if diff is wide, revert and re-apply with a smaller patch.

## Partial-Request Execution Rule (Mandatory)
- When the user requests a partial/small change, execute only the requested scope immediately.
- Do NOT start broad repository-wide inspection, cleanup, refactor, reformat, or normalization during partial requests.
- If a full-file audit/cleanup is needed, schedule and run it separately as an explicit dedicated task.
- For partial requests, prioritize fast, minimal-line patches over general codebase improvements.
