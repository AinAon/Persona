# Persona Vault v2

## Goal

Make each persona operate from one canonical vault with an enforced index, strict tool results, and evidence-backed replies.

## Scope

- Keep the existing Persona UI.
- Start with Avery, then copy the proven structure to Riley.
- Keep Dropbox as the storage backend.
- Do not split Dropbox apps until the vault/index/runtime behavior is stable.

## Canonical Root

- Avery: `/_vault/p_avery`
- Riley: `/_vault/p_riley`

## Canonical Files

- `_index.json`: required table of contents for every active vault file.
- `_directive.md`: current persona directive injected into the system prompt.
- `_state.json`: compact current state used for prompt injection.
- `_evidence.log.jsonl`: append-only operation evidence.

## Canonical Folders

- `worklogs/`: dated worklog files and reports.
- `logs/`: runtime/action logs.
- `attachments/`: screenshots, images, and uploaded files owned by the persona.
- `archive/`: imported or deprecated files not used unless explicitly restored.

## Rules

- A file is active only when it is present in `_index.json`.
- A persona may not claim it created, edited, deleted, or read a file without a successful operation result.
- New writes must update `_index.json` and append `_evidence.log.jsonl`.
- Existing scattered files are not part of active runtime unless the v2 index explicitly includes them.
- Migration planning is dry-run/read-only first. Legacy data may be ignored instead of migrated when reset is approved.

## Current Increment

1. Add read-only inventory for Avery/Riley vault paths.
2. Use inventory output to classify canonical, legacy, duplicate, attachment, and unknown files.
3. Cut runtime storage over to v2 canonical files.
4. Add strict index/write enforcement after inventory is verified.
