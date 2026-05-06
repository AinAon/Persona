# Agent Operating Policy (Advisor Strategy)

## Purpose

This repository uses a **cost-efficient advisor workflow**:

- A cheaper primary executor handles most routine tasks.
- A stronger advisor model is used only for bottlenecks, ambiguity, repeated failure, or high-impact decisions.

The goal is to reduce token/cost usage **without sacrificing reliability or user trust**.

The agent should not optimize only for the smallest possible patch.  
It should optimize for verified root cause, controlled scope, low unnecessary token usage, and safe changes.

---

## Default Execution Mode

The primary executor should handle, by default:

- repository inspection
- focused file search and log reading
- small code edits
- straightforward bug fixes
- simple refactors
- repetitive implementation work
- running tests and basic verification

Small local edits are preferred when the surrounding structure is healthy.

If repeated small edits make the code more fragile, stop and propose a structural fix before editing.

---

## Model Routing Policy

- Default execution model is fixed to **gpt-5.3-codex**.
- Escalate to **gpt-5.5** only when one or more of the following are true:
  - the same issue failed after 2 or more attempts
  - root cause is still unclear after focused validation
  - architecture branching or broad side effects are expected
  - existing user data, storage, schema, cache, or persistence behavior may be affected
- Delegate simple tasks to **gpt-5.2** or **gpt-5.4-mini**:
  - exploration / grep / log summarization
  - repetitive substitutions / boilerplate edits
  - simple data cleanup
  - narrow validation checks

Do not escalate just because a task is long.  
Escalate when the decision is risky or the cause is unclear.

---

## Escalation Triggers (Advisor Model)

Escalate only if one or more conditions are true:

- the same issue remains unresolved after 2 attempts
- root cause is still unclear after focused validation
- multiple architecture options have meaningful tradeoffs
- the change may have broad side effects
- integration or migration risk is high
- parallel findings conflict
- existing user data may be affected
- the task requires deeper reasoning than routine execution

Before escalating, summarize:

- what was tried
- what evidence was found
- what remains unclear
- what decision is needed

Do not re-escalate the same question without new evidence.

---

## Task and Escalation Docs

- At task start, use **TASK_TEMPLATE.md** to keep scope and success criteria explicit when the task is non-trivial.
- At escalation time, use **ESCALATION_NOTE.md** to send a compact decision-focused summary.

For very small edits, avoid creating unnecessary process overhead.

---

## Library-First Rule

Prefer proven libraries over custom implementation when the problem area is complex, device-sensitive, or historically error-prone.

Before proposing custom patterns, first identify and present widely adopted, low-incident implementation patterns for:

- memory
- chat
- state
- data flow
- rendering
- storage
- validation

For high-variance browser/device areas, do not choose custom code by default:

- drag-and-drop
- virtual scroll
- editor behavior
- markdown rendering
- image processing
- animation
- gesture handling
- form validation
- mobile touch/selection/scroll/input interactions

Choose custom implementation only when requirements are simple or library adoption cost is not justified.

Library selection criteria:

- stability
- adoption
- maintenance health
- bundle impact
- vanilla JS fit
- integration cost

---

## Advisor Request Format (Narrow Scope)

When escalating, ask for guidance only, not full execution, unless full execution is clearly necessary.

Advisor output should include:

- top root-cause hypotheses
- next best diagnostic step
- preferred design direction
- main risks and constraints
- compact execution plan

After advisor guidance, return implementation to the primary executor.

---

## Reasoning Effort Policy

Default reasoning effort: **low to medium** for routine tasks.

Increase to **high** only for:

- architectural decisions
- risky migrations
- unclear root causes after repeated failures
- storage/cache/persistence changes
- schema changes
- broad side effects
- conflicting evidence

Drop back to low/medium once the strategy is clear and work becomes routine.

---

## Context and Token Budget Rules

Minimize unnecessary context transfer.

Use focused search first.  
Read only the files and sections needed for the current step.

Avoid:

- repeated full-file dumps
- broad repository scans without reason
- pasting large raw logs when a summary is enough
- sending long raw logs to higher models
- generating or rewriting large files without approval

Before doing high-token work, report first if the task requires:

- reading many files
- scanning the whole repository
- large log analysis
- broad architecture review
- rewriting large sections
- comparing many unrelated files

When high-token work is necessary, briefly explain why before proceeding.

---

## Reliability Guardrails

Do not skip validation for high-risk changes.

For risky edits:

1. run the smallest relevant verification first
2. expand verification only if needed
3. report uncertainty if evidence is weak

If confidence is low, escalate for direction before broad code changes.

Do not present guesses as confirmed causes.

---

## Expected Behavior

Optimize total cost efficiency across the full task, not single-step quality.

Use the stronger model as a strategic reviewer/advisor, not a default worker.

Keep execution momentum with the cheaper model once direction is clear.

Move quickly on safe, local, evidence-backed fixes.

Stop before broad, destructive, high-token, or data-affecting work.

---

## Root Cause Communication Protocol

When a user reports a problem, do not present a guessed root cause as final.

First:

1. produce 2-3 plausible hypotheses
2. run the smallest useful validation step
3. report only evidence-backed causes
4. label weak evidence as tentative

For simple checks, use **gpt-5.4-mini** for fast verification.

For complex or high-impact issues, verify directly with code, logs, or runtime evidence before concluding.

If evidence is weak, request one targeted follow-up check instead of continuing to patch blindly.

---

## Patch Verification and Rollback Rule

Before applying a patch, identify the most likely root cause and the smallest verification step that can prove or disprove it.

After applying a patch:

1. run the smallest relevant verification that reproduces the issue or validates the fix
2. if the issue is not resolved, revert the patch before trying another unrelated fix
3. do not stack additional patches on top of an unverified or failed patch
4. preserve useful evidence from the failed attempt in a short note
5. only keep the patch if verification shows that it addressed the root cause or safely improves diagnosis

When reverting, revert only the changes introduced by the failed patch.

Do not discard unrelated user changes, local edits, generated assets, or existing work unless explicitly approved.

If rollback is unsafe because the patch changed user data, storage, schema, cache, or persistence behavior, stop and report the rollback risk before proceeding.

---

## Structural Fix Priority Rule

Do not stack quick patches only to mask symptoms.

If the same or similar issue repeats, stop and evaluate whether the structure is causing recurrence.

Before adding another patch, state:

- validated or tentative root cause
- why the current structure may allow recurrence
- whether a local patch is still safe
- minimum structural change option, if needed
- expected risk

Use temporary patching only when service restoration is urgent.

Do not preserve broken structure just to minimize diff size.

Structural fixes are allowed when repeated local patches increase fragility, but they require user approval before editing.

---

## Cache Change Safety Rule

Do not introduce force cache-busting/no-store logic as a default fix unless there is evidence that stale cache is the root cause.

In image-loading paths, treat cache behavior as stability-sensitive.

Prefer preserving the existing cache contract first.

If cache behavior must be changed, document:

- why the change is needed
- expected side effects
- rollback path

Cache, storage, schema, and persistence changes require user approval before editing.

---

## Mandatory Line For Small Models

When delegating to a smaller model, include a compact safety instruction.

Use this sentence block:

- Only modify the specified section unless a structural issue is explicitly approved.
- Do not rewrite the entire file without approval.
- Preserve encoding (UTF-8), Unicode text, and formatting.
- Do not refactor unrelated code.

---

## Edit Safety Rules

Prefer minimal, targeted edits by default.

Do not rewrite entire files, refactor, reformat, clean up unrelated code, or replace large sections unless the user explicitly approves it.

Preserve all existing text exactly, including Unicode/Korean.

Do not normalize encoding or formatting unless explicitly approved.

Allowed without approval:

- small localized bug fixes
- minimal line-targeted patches
- small additions that do not alter existing behavior
- simple typo fixes
- narrow defensive checks with clear evidence

Requires approval:

- broad cleanup
- structural refactor
- file-wide rewrite
- behavior-changing refactor
- migration
- dependency replacement
- schema changes
- storage changes
- cache changes
- persistence changes
- project-wide search-and-replace
- changes that may invalidate existing user data

File encoding must remain UTF-8.

---

## Terminal Encoding Guard

At the start of Windows terminal work, force UTF-8 console code page before search/read/edit commands:

```cmd
chcp 65001 >nul