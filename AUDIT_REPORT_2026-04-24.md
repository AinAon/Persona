# Audit Report 2026-04-24

## Scope
- Static repository audit only. App/server was not started.
- Safe cleanup was allowed and done on branch `codex/audit-cleanup`.

## Cleanup Done
- Removed tracked `backend/node_modules/`.
  - Reason: generated dependency artifact; reproducible from `backend/package-lock.json`.
- Removed tracked `source/backup_20260418_115326/`.
  - Reason: dated backup copy, no current code reference found.
- Added `.gitignore`.
  - Blocks `node_modules/`, `.wrangler/`, `dist/`, `build/`, and `*.log`.

## Validation
- `git diff --cached --check`: passed before commit.
- `git ls-files backend/node_modules`: 0 after cleanup.
- `git ls-files source/backup_20260418_115326`: 0 after cleanup.
- `npm audit`: 6 dev dependency vulnerabilities found.
  - Main path: `wrangler` / `miniflare` / `undici` / `vite`.
  - `npm audit fix --force` would jump to `wrangler@4.84.1`, so it was not applied automatically.

## High Priority Findings
- Backend has no visible auth guard on write/delete routes.
  - Affected routes include `/personas`, `/profile`, `/sessions`, `/session/*`, `/image`, `/image/*`, `/memory/*`.
  - Risk: anyone who can reach Worker URL may write/delete app data.
- `/image-fetch` is an open HTTP(S) fetch proxy.
  - Risk: bandwidth abuse, SSRF-style internal/protected target probing if runtime/network permits.
  - Recommended: allowlist known image hosts or require signed requests.
- `/image-list/*` exposes R2 key names by arbitrary prefix.
  - Risk: data inventory leakage.
  - Recommended: restrict prefixes and require auth for non-public buckets.
- Frontend uses `marked.parse()` and many `innerHTML` paths.
  - Risk: XSS if untrusted model/user content bypasses escaping.
  - Recommended default: `DOMPurify` after markdown rendering.

## Medium Priority Findings
- `js/app.js` has unreachable startup code after an early `return`.
  - Current block includes cache warmup and duplicate persona sync comments.
  - Not deleted yet because it may be fallback/rollback logic.
- `js/ui.js` contains legacy unreachable upload code after `return` in `handleMultiImageUpload()` and `handleFileSelect()`.
  - Likely safe to remove after confirming current upload pipeline covers all cases.
- `copyImageToClipboard()` is defined twice in `js/ui.js`.
  - Later definition overrides earlier one.
  - Decide whether URL fallback should exist, then delete inactive version.
- `WORKER_URL` is hardcoded in `js/data.js` and `emotion-manager.html`.
  - Recommended: central config or environment substitution.
- `emotion-manager.html` has direct destructive R2 delete calls.
  - Recommended: server-side auth and audit logging before broader use.

## Efficiency Issues
- Startup does multiple cache/index/persona/archive comparisons and several `no-store` fetches.
  - Improve with one `/bootstrap` endpoint returning personas, session index, archive manifest signatures, and memory meta.
- Frontend is large vanilla JS split but still monolithic, especially `js/ui.js`.
  - Recommended: split by feature after tests exist: chat, persona editor, archive, memory, image popup.
- R2 image listing is repeated by prefix.
  - Recommended: server-maintained manifest with ETag/signature and paginated delta fetch.
- Image/thumb cache pipeline is custom and complex.
  - Library-first path: keep canvas resize custom only if requirements remain simple; otherwise evaluate `browser-image-compression` or `pica`.

## UX Friction
- Initial loading can block and relies on hidden long-press recovery.
  - Add visible "continue offline" / "retry sync" actions.
- Destructive actions use browser `confirm()`.
  - Replace with consistent modal showing target, count, and undo/recover availability.
- Emotion manager opens as separate page.
  - Better: in-app route/modal with same state and return path.
- Memory controls are dense and mixed language.
  - Separate "view/edit memory" from "optimize/rebuild" actions.
- File attachment support is incomplete beyond images.
  - Existing TODO recommends Uppy/FilePond, pdf.js, Readability + DOMPurify, mammoth.

## Recommended Next Work
1. Add auth/signed request guard to Worker write/delete routes.
2. Add DOMPurify to markdown rendering.
3. Replace open `/image-fetch` with allowlisted proxy or signed endpoint.
4. Remove confirmed unreachable frontend blocks.
5. Add minimal tests for session save/delete/recover and memory upsert/delete.
6. Plan controlled `wrangler`/`vitest-pool-workers` upgrade to clear dev dependency advisories.
