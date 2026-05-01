import type { Env } from "./index";
import {
  buildPersonaVaultPath,
  dropboxDeletePath,
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
  memoryMarkdownFile: string;
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

export type PersonaVaultActionResult = { ok: true; message: string } | { ok: false; error: string };

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
  const path = buildPersonaVaultPath(cfg.pid, cfg.directiveFile);
  if (token) {
    const txt = await dropboxReadText(token, path);
    if (txt && txt.trim()) return txt.trim();
  }
  return cfg.defaultDirectiveLines.join("\n");
}

export async function loadPersonaMemoryMarkdown(env: Env, cfg: PersonaRuntimeConfig): Promise<string> {
  const token = await getPersonaDropboxAccessToken(env, cfg.tokenPersona);
  if (!token) return "";
  const path = buildPersonaVaultPath(cfg.pid, `_memory/${cfg.memoryMarkdownFile}`);
  const txt = await dropboxReadText(token, path);
  return String(txt || "").trim();
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

  const deleteRel = inferDeletePath(raw);
  if (deleteRel !== null) {
    if (!deleteRel) return { ok: false, error: "path_missing: 삭제할 파일/폴더명을 한 번만 알려줘." };
    const path = buildPersonaVaultPath(cfg.pid, deleteRel);
    const ok = await dropboxDeletePath(token, path);
    return ok ? { ok: true, message: `deleted path: ${path}` } : { ok: false, error: `failed to delete path: ${path}` };
  }

  const fileRel = inferFilePath(raw, cfg);
  if (fileRel) {
    const safeRel = normalizeVaultRelPath(fileRel);
    const content = extractInlineContent(raw);
    const path = buildPersonaVaultPath(cfg.pid, safeRel);
    const defaultContent = safeRel.toLowerCase().endsWith(".csv") ? `${cfg.defaultCsvHeader}\n` : "";
    const payload = encodeForFilePath(path, content || defaultContent);
    const ok = await dropboxWriteText(token, path, payload);
    return ok ? { ok: true, message: `created file: ${path}` } : { ok: false, error: `failed to create file: ${path}` };
  }

  const folderRel = inferFolderPath(raw);
  if (folderRel) {
    const safeRel = normalizeVaultRelPath(folderRel).replace(/\/+$/, "");
    if (!safeRel) return { ok: false, error: "folder path required" };
    const path = buildPersonaVaultPath(cfg.pid, `${safeRel}/.keep`);
    const ok = await dropboxWriteText(token, path, "");
    return ok ? { ok: true, message: `created folder: /${safeRel}` } : { ok: false, error: `failed to create folder: /${safeRel}` };
  }

  const wantsFile = /(?:파일|file|csv|md|txt|json|문서).*(?:생성|만들|작성|저장|create|write)|(?:create|write).*(?:file)/i.test(raw);
  const wantsFolder = /(?:폴더|folder|디렉터리|directory).*(?:생성|만들|create)|(?:create).*(?:folder|directory)/i.test(raw);
  if (wantsFile || wantsFolder) return { ok: false, error: "path_missing: 파일명/폴더명을 한 번만 알려줘." };
  return null;
}
