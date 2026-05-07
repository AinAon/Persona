import type { Env } from "./index";
import {
  buildPersonaVaultPath,
  dropboxDeletePath,
  dropboxListFolder,
  dropboxPathExists,
  dropboxReadText,
  dropboxWriteText,
  getPersonaDropboxAccessToken,
  type Persona,
} from "./dropbox_vault";

export type PersonaRuntimeConfig = {
  pid: string;
  tokenPersona: Persona;
  role: string;
  directiveFile: string;
  defaultDirectiveLines: string[];
  defaultCsvHeader: string;
  namingHints?: {
    worklogKeyword?: RegExp;
    reportKeyword?: RegExp;
    ledgerKeyword?: RegExp;
    worklogBase?: string;
    reportBase?: string;
    ledgerBase?: string;
    noteBase?: string;
  };
};

export type PersonaVaultActionResult =
  | { ok: true; message: string; evidenceId: string; path: string; action: VaultActionKind }
  | { ok: false; error: string };

type VaultActionKind = "create_file" | "create_folder" | "delete_path" | "read_file" | "update_file";

type VaultIndexFile = {
  version: number;
  persona?: string;
  pid?: string;
  root?: string;
  generated_at?: string;
  updated_at?: string;
  active_files?: Array<{ path: string; kind: string; reason: string; updated_at?: string }>;
  inactive_candidates?: Array<{ path: string; bucket: string; reason: string; updated_at?: string }>;
};

export type { PersonaRuntimeConfig as PersonaRuntimeConfigForVault };

type VaultMutationEvidence = {
  id: string;
  timestamp: string;
  pid: string;
  persona: string;
  action: VaultActionKind;
  path: string;
  user_text: string;
};

function ymdStampUnderscore(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}_${m}_${day}`;
}

function normalizeVaultRelPath(input: string): string {
  return String(input || "")
    .trim()
    .replace(/^\/+/, "")
    .replace(/\\/g, "/")
    .replace(/\/{2,}/g, "/");
}

function nowIso(): string {
  return new Date().toISOString();
}

function personaNameFromPid(pid: string): string {
  return String(pid || "").replace(/^p_/, "") || "persona";
}

function makeEvidenceId(action: string): string {
  return `vault_ev_${action}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function defaultIndex(cfg: PersonaRuntimeConfig): VaultIndexFile {
  const root = buildPersonaVaultPath(cfg.pid);
  const now = nowIso();
  return {
    version: 2,
    persona: personaNameFromPid(cfg.pid),
    pid: cfg.pid,
    root,
    generated_at: now,
    updated_at: now,
    active_files: [],
    inactive_candidates: [],
  };
}

async function loadVaultIndex(token: string, cfg: PersonaRuntimeConfig): Promise<VaultIndexFile> {
  const path = buildPersonaVaultPath(cfg.pid, "_index.json");
  const txt = await dropboxReadText(token, path);
  if (!txt) return defaultIndex(cfg);
  try {
    const parsed = JSON.parse(txt) as VaultIndexFile;
    return {
      ...defaultIndex(cfg),
      ...parsed,
      active_files: Array.isArray(parsed.active_files) ? parsed.active_files : [],
      inactive_candidates: Array.isArray(parsed.inactive_candidates) ? parsed.inactive_candidates : [],
    };
  } catch {
    const idx = defaultIndex(cfg);
    idx.inactive_candidates = [{ path, bucket: "invalid_index_backup_needed", reason: "existing_index_json_parse_failed", updated_at: nowIso() }];
    return idx;
  }
}

async function recordVaultMutation(
  token: string,
  cfg: PersonaRuntimeConfig,
  action: VaultActionKind,
  path: string,
  userText: string,
): Promise<{ ok: boolean; evidenceId: string }> {
  const now = nowIso();
  const evidenceId = makeEvidenceId(action);
  const evidence: VaultMutationEvidence = {
    id: evidenceId,
    timestamp: now,
    pid: cfg.pid,
    persona: personaNameFromPid(cfg.pid),
    action,
    path,
    user_text: String(userText || "").slice(0, 1000),
  };
  const evidenceJson = JSON.stringify(evidence);
  const evidenceItemPath = buildPersonaVaultPath(cfg.pid, `logs/evidence/${evidenceId}.json`);
  const evidenceItemOk = await dropboxWriteText(token, evidenceItemPath, `${JSON.stringify(evidence, null, 2)}\n`);
  if (!evidenceItemOk) return { ok: false, evidenceId };

  const evidencePath = buildPersonaVaultPath(cfg.pid, "_evidence.log.jsonl");
  const previousEvidence = await dropboxReadText(token, evidencePath);
  let indexOk = true;
  if (action !== "read_file") {
    const index = await loadVaultIndex(token, cfg);
    const rebuilt = await rebuildIndexFromEvidenceFiles(token, cfg, index);
    rebuilt.updated_at = now;
    indexOk = await dropboxWriteText(token, buildPersonaVaultPath(cfg.pid, "_index.json"), `${JSON.stringify(rebuilt, null, 2)}\n`);
  }
  const evidenceLogOk = await dropboxWriteText(token, evidencePath, `${previousEvidence || ""}${previousEvidence && !previousEvidence.endsWith("\n") ? "\n" : ""}${evidenceJson}\n`);
  return { ok: indexOk && evidenceLogOk, evidenceId };
}

async function loadEvidenceFiles(token: string, cfg: PersonaRuntimeConfig): Promise<VaultMutationEvidence[]> {
  const entries = await dropboxListFolder(token, buildPersonaVaultPath(cfg.pid, "logs/evidence"));
  const paths = entries
    .map((entry) => String(entry.path_display || entry.path_lower || "").trim())
    .filter((path) => /\.json$/i.test(path))
    .sort();
  const out: VaultMutationEvidence[] = [];
  for (const path of paths.slice(-500)) {
    const txt = await dropboxReadText(token, path);
    if (!txt) continue;
    try {
      const ev = JSON.parse(txt) as VaultMutationEvidence;
      if (ev?.id && ev?.path && ev?.action) out.push(ev);
    } catch {
      // skip invalid evidence file
    }
  }
  return out.sort((a, b) => String(a.timestamp || "").localeCompare(String(b.timestamp || "")));
}

async function rebuildIndexFromEvidenceFiles(token: string, cfg: PersonaRuntimeConfig, base: VaultIndexFile): Promise<VaultIndexFile> {
  const activeByPath = new Map<string, { path: string; kind: string; reason: string; updated_at?: string }>();
  const inactiveByPath = new Map<string, { path: string; bucket: string; reason: string; updated_at?: string }>();
  for (const item of base.active_files || []) {
    if (item?.path) activeByPath.set(item.path.toLowerCase(), item);
  }
  for (const item of base.inactive_candidates || []) {
    if (item?.path) inactiveByPath.set(item.path.toLowerCase(), item);
  }

  const evidence = await loadEvidenceFiles(token, cfg);
  for (const ev of evidence) {
    const key = ev.path.toLowerCase();
    activeByPath.delete(key);
    inactiveByPath.delete(key);
    if (ev.action === "delete_path") {
      inactiveByPath.set(key, { path: ev.path, bucket: "deleted_by_vault_action", reason: ev.id, updated_at: ev.timestamp });
    } else if (ev.action !== "read_file") {
      activeByPath.set(key, { path: ev.path, kind: ev.action === "create_folder" ? "folder" : "file", reason: ev.id, updated_at: ev.timestamp });
    }
  }

  return {
    ...base,
    active_files: [...activeByPath.values()].sort((a, b) => a.path.localeCompare(b.path)),
    inactive_candidates: [...inactiveByPath.values()].sort((a, b) => a.path.localeCompare(b.path)),
  };
}

export async function recordPersonaVaultMutation(
  env: Env,
  cfg: PersonaRuntimeConfig,
  action: VaultActionKind,
  path: string,
  userText: string,
): Promise<{ ok: boolean; evidenceId: string; error?: string }> {
  const token = await getPersonaDropboxAccessToken(env, cfg.tokenPersona);
  if (!token) return { ok: false, evidenceId: "", error: `${cfg.pid} dropbox token missing` };
  const rec = await recordVaultMutation(token, cfg, action, path, userText);
  return rec.ok ? rec : { ...rec, error: `failed to update index/evidence: ${path}` };
}

function extractInlineContent(raw: string): string {
  const marked = raw.match(/:{3}([\s\S]*)$/);
  if (marked) return String(marked[1] || "").trim();
  const lines = raw.split(/\r?\n/);
  if (lines.length >= 2) return lines.slice(1).join("\n").trim();
  return "";
}

function encodeForFilePath(path: string, content: string): string {
  const out = String(content || "");
  if (!/\.csv$/i.test(path)) return out;
  return out.startsWith("\uFEFF") ? out : `\uFEFF${out}`;
}

function normalizeFilePayload(path: string, content: string, defaultCsvHeader: string): string {
  const ext = String(path || "").toLowerCase();
  const raw = String(content || "");

  if (ext.endsWith(".json")) {
    if (!raw.trim()) return "{\n}\n";
    try {
      const parsed = JSON.parse(raw);
      return `${JSON.stringify(parsed, null, 2)}\n`;
    } catch {
      return raw.endsWith("\n") ? raw : `${raw}\n`;
    }
  }

  if (ext.endsWith(".csv")) {
    const base = raw.trim() ? raw : `${defaultCsvHeader}\n`;
    const csv = base.endsWith("\n") ? base : `${base}\n`;
    return encodeForFilePath(path, csv);
  }

  if (!raw) return "";
  return raw.endsWith("\n") ? raw : `${raw}\n`;
}

function inferDeletePath(raw: string): string | null {
  const deleteIntent = /(삭제|제거|지워|지워줘|delete|remove)\b/i.test(raw);
  if (!deleteIntent) return null;
  const explicit =
    raw.match(/(?:삭제|제거|delete|remove)\s+(?:파일|폴더|file|folder)?\s*["'`]([^"'`]+)["'`]/i)?.[1]
    || raw.match(/(?:삭제|제거|delete|remove)\s+(?:파일|폴더|file|folder)?\s*([a-zA-Z0-9_./-]+\.(?:csv|md|txt|json))/i)?.[1]
    || raw.match(/(?:삭제|제거|delete|remove)\s+(?:파일|폴더|file|folder)?\s*([a-zA-Z0-9_./-]{2,160})\s*$/i)?.[1];
  if (!explicit) return "";
  return normalizeVaultRelPath(explicit).replace(/\/+$/, "");
}

function inferReadPath(raw: string): string | null {
  const wantsRead = /(읽어|열어|확인|보여|내용|read|open|show|view|check)/i.test(raw);
  if (!wantsRead) return null;
  const explicit =
    raw.match(/["'`]([a-zA-Z0-9_./-]+\.(?:csv|md|txt|json|jsonl))["'`]/i)?.[1]
    || raw.match(/([a-zA-Z0-9_./-]+\.(?:csv|md|txt|json|jsonl))/i)?.[1];
  if (!explicit) return "";
  return normalizeVaultRelPath(explicit);
}

function inferUpdatePath(raw: string): string | null {
  const wantsUpdate = /(수정|변경|업데이트|덮어|고쳐|update|edit|overwrite|change)/i.test(raw);
  if (!wantsUpdate) return null;
  const explicit =
    raw.match(/(?:수정|변경|업데이트|update|edit|overwrite)\s+(?:파일|file)?\s*["'`]([^"'`]+\.(?:csv|md|txt|json|jsonl))["'`]/i)?.[1]
    || raw.match(/["'`]([a-zA-Z0-9_./-]+\.(?:csv|md|txt|json|jsonl))["'`]/i)?.[1]
    || raw.match(/([a-zA-Z0-9_./-]+\.(?:csv|md|txt|json|jsonl))/i)?.[1];
  if (!explicit) return "";
  return normalizeVaultRelPath(explicit);
}

function inferFilePath(raw: string, cfg: PersonaRuntimeConfig): string | null {
  const explicit =
    raw.match(/(?:파일생성|파일 만들어|create file)\s+([^\n:]+)(?:::{1,3}([\s\S]*))?/i)?.[1]
    || raw.match(/["'`]([a-zA-Z0-9_./-]+\.(?:csv|md|txt|json))["'`]/i)?.[1]
    || raw.match(/([a-zA-Z0-9_./-]+\.(?:csv|md|txt|json))/i)?.[1];
  if (explicit) return normalizeVaultRelPath(explicit);

  const wantsFile = /(?:파일|file|csv|md|txt|json).*(?:생성|만들|작성|저장|create|write)|(?:create|write).*(?:file)|\.(?:csv|md|txt|json)\b/i.test(raw);
  if (!wantsFile) return null;

  const ext = /\bcsv\b|csv/i.test(raw) ? "csv"
    : (/\bmd\b|markdown/i.test(raw) ? "md"
      : (/\bjson\b/i.test(raw) ? "json" : "txt"));
  const stamp = ymdStampUnderscore();

  const hints = cfg.namingHints || {};
  const worklogKeyword = hints.worklogKeyword || /(작업\s*로그|work\s*log)/i;
  const reportKeyword = hints.reportKeyword || /(리포트|report)/i;
  const ledgerKeyword = hints.ledgerKeyword || /(자산|wealth|ledger)/i;
  const worklogBase = hints.worklogBase || "work_log";
  const reportBase = hints.reportBase || "report";
  const ledgerBase = hints.ledgerBase || "master_wealth_ledger";
  const noteBase = hints.noteBase || "note";

  const base = worklogKeyword.test(raw) ? `${worklogBase}_${stamp}`
    : (ledgerKeyword.test(raw) ? ledgerBase
      : (reportKeyword.test(raw) ? `${reportBase}_${stamp}` : `${noteBase}_${stamp}`));
  return `${base}.${ext}`;
}

function inferFolderPath(raw: string): string | null {
  const explicit =
    raw.match(/(?:폴더생성|폴더 만들어|create folder)\s+([^\n]+)$/i)?.[1]
    || raw.match(/["'`]([a-zA-Z0-9_./-]+)["'`]\s*(?:폴더|folder)/i)?.[1]
    || raw.match(/([a-zA-Z0-9_./-]+)\s*(?:폴더|folder)\s*(?:생성|만들어|만들어줘|create)/i)?.[1];
  if (explicit) return normalizeVaultRelPath(explicit).replace(/\/+$/, "");

  const wantsFolder = /(?:폴더|folder|디렉터리|directory).*(?:생성|만들|create)|(?:create).*(?:folder|directory)/i.test(raw);
  if (!wantsFolder) return null;
  return `folder_${ymdStampUnderscore()}`;
}

export async function loadPersonaDirective(env: Env, cfg: PersonaRuntimeConfig): Promise<string> {
  const token = await getPersonaDropboxAccessToken(env, cfg.tokenPersona);
  if (token) {
    const v2Path = buildPersonaVaultPath(cfg.pid, "_directive.md");
    const v2Txt = await dropboxReadText(token, v2Path);
    if (v2Txt && v2Txt.trim()) return v2Txt.trim();
    const path = buildPersonaVaultPath(cfg.pid, cfg.directiveFile);
    const txt = await dropboxReadText(token, path);
    if (txt && txt.trim()) return txt.trim();
  }
  return cfg.defaultDirectiveLines.join("\n");
}

export async function runPersonaVaultActionFromText(
  env: Env,
  cfg: PersonaRuntimeConfig,
  text: string,
): Promise<PersonaVaultActionResult | null> {
  const raw = String(text || "").trim();
  if (!raw) return null;
  const token = await getPersonaDropboxAccessToken(env, cfg.tokenPersona);
  if (!token) return { ok: false, error: `${cfg.pid} dropbox token missing` };

  const updateRel = inferUpdatePath(raw);
  if (updateRel !== null) {
    if (!updateRel) return { ok: false, error: "path_missing: 수정할 파일명을 한 번만 알려줘." };
    const path = buildPersonaVaultPath(cfg.pid, updateRel);
    const content = extractInlineContent(raw);
    if (!content) return { ok: false, error: "content_missing: 수정할 내용을 ::: 뒤에 넣어줘." };
    const payload = normalizeFilePayload(path, content, cfg.defaultCsvHeader);
    const ok = await dropboxWriteText(token, path, payload);
    if (!ok) return { ok: false, error: `failed to update file: ${path}` };
    const rec = await recordVaultMutation(token, cfg, "update_file", path, raw);
    if (!rec.ok) return { ok: false, error: `updated file but failed to update index/evidence: ${path}` };
    return { ok: true, message: `updated file: ${path}; evidence_id: ${rec.evidenceId}`, evidenceId: rec.evidenceId, path, action: "update_file" };
  }

  const readRel = inferReadPath(raw);
  if (readRel !== null) {
    if (!readRel) return { ok: false, error: "path_missing: 읽을 파일명을 한 번만 알려줘." };
    const path = buildPersonaVaultPath(cfg.pid, readRel);
    const content = await dropboxReadText(token, path);
    if (content == null) return { ok: false, error: `file not found: ${path}` };
    const rec = await recordVaultMutation(token, cfg, "read_file", path, raw);
    if (!rec.ok) return { ok: false, error: `read file but failed to write evidence: ${path}` };
    const preview = String(content || "").slice(0, 2000);
    return { ok: true, message: `read file: ${path}; evidence_id: ${rec.evidenceId}; content_preview: ${preview}`, evidenceId: rec.evidenceId, path, action: "read_file" };
  }

  const deleteRel = inferDeletePath(raw);
  if (deleteRel !== null) {
    if (!deleteRel) return { ok: false, error: "path_missing: 삭제할 파일/폴더명을 한 번만 알려줘." };
    const path = buildPersonaVaultPath(cfg.pid, deleteRel);
    const ok = await dropboxDeletePath(token, path);
    if (!ok && await dropboxPathExists(token, path)) return { ok: false, error: `failed to delete path: ${path}` };
    const rec = await recordVaultMutation(token, cfg, "delete_path", path, raw);
    if (!rec.ok) return { ok: false, error: `deleted path but failed to update index/evidence: ${path}` };
    return { ok: true, message: `deleted path: ${path}; evidence_id: ${rec.evidenceId}`, evidenceId: rec.evidenceId, path, action: "delete_path" };
  }

  const fileRel = inferFilePath(raw, cfg);
  if (fileRel) {
    const safeRel = normalizeVaultRelPath(fileRel);
    const content = extractInlineContent(raw);
    const path = buildPersonaVaultPath(cfg.pid, safeRel);
    const payload = normalizeFilePayload(path, content, cfg.defaultCsvHeader);
    const ok = await dropboxWriteText(token, path, payload);
    if (!ok) return { ok: false, error: `failed to create file: ${path}` };
    const rec = await recordVaultMutation(token, cfg, "create_file", path, raw);
    if (!rec.ok) return { ok: false, error: `created file but failed to update index/evidence: ${path}` };
    return { ok: true, message: `created file: ${path}; evidence_id: ${rec.evidenceId}`, evidenceId: rec.evidenceId, path, action: "create_file" };
  }

  const folderRel = inferFolderPath(raw);
  if (folderRel) {
    const safeRel = normalizeVaultRelPath(folderRel).replace(/\/+$/, "");
    if (!safeRel) return { ok: false, error: "folder path required" };
    const folderPath = buildPersonaVaultPath(cfg.pid, safeRel);
    const ok = await dropboxWriteText(token, `${folderPath}/.keep`, "");
    if (!ok) return { ok: false, error: `failed to create folder: ${folderPath}` };
    const rec = await recordVaultMutation(token, cfg, "create_folder", folderPath, raw);
    if (!rec.ok) return { ok: false, error: `created folder but failed to update index/evidence: ${folderPath}` };
    return { ok: true, message: `created folder: ${folderPath}; evidence_id: ${rec.evidenceId}`, evidenceId: rec.evidenceId, path: folderPath, action: "create_folder" };
  }

  const wantsFile = /(?:파일|file|csv|md|txt|json|문서).*(?:생성|만들|작성|저장|create|write)|(?:create|write).*(?:file)/i.test(raw);
  const wantsFolder = /(?:폴더|folder|디렉터리|directory).*(?:생성|만들|create)|(?:create).*(?:folder|directory)/i.test(raw);
  if (wantsFile || wantsFolder) return { ok: false, error: "path_missing: 파일명/폴더명을 한 번만 알려줘." };
  return null;
}
