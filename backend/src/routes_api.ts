import type { CorsHeaders, Env } from "./index";
import {
  deleteMemory,
  extractAndStoreMemories,
  getMemoryMeta,
  listMemories,
  normalizeScopeOwner,
  optimizeMemories,
  rebuildMemoriesFromSession,
  parseScope,
  setMemoryLock,
  setMemoryText,
  upsertMemory,
} from "./memory";
import { getAveryWorklogSnapshot, reconcileAveryWorklog, resetAveryWorklogRuntime } from "./avery_worklog";
import { getRileyWealthSnapshot, reconcileRileyWealth, resetRileyWealthRuntime } from "./riley_wealth";
import { getPersonaPolicy } from "./persona_policy";
import { getPromotionCandidates } from "./persona_promotion";
import { buildPersonaVaultV2MigrationPlan, getPersonaVaultV2Inventory, getPersonaVaultV2Status, seedPersonaVaultV2, type VaultV2Persona } from "./persona_vault_v2";
import { buildPersonaVaultPath, dropboxDeletePath, dropboxListFolder, dropboxMovePath, dropboxPathExists, dropboxReadBytes, dropboxReadText, dropboxWriteBytes, dropboxWriteBytesWithDetail, dropboxWriteText, dropboxWriteTextWithDetail, getPersonaDropboxAccessToken } from "./dropbox_vault";
import { loadPersonaUserProfile, normalizeUserId, savePersonaUserProfile } from "./persona_memory_profile";
import { getRileySheetsStatus, loadRileySheetsContext } from "./google_sheets";

type SessionMeta = {
  id: string;
  updatedAt: number;
  lastMessageAt: number;
  lastPreview: string;
  participantPids: string[];
  roomName: string;
  responseMode: string;
  worldContext: string;
  userOverride: unknown;
  userProfileMode: string;
  overrideModel: string | null;
};

type DeletedSessionMeta = SessionMeta & {
  deletedAt: number;
};

type RecoverableSessionMeta = DeletedSessionMeta & {
  source: "deleted_index" | "deleted_dropbox" | "orphan_session_dropbox";
};

const SESSION_INDEX_KEY = "session_index";
const DELETED_SESSION_INDEX_KEY = "deleted_session_index";
const SESSION_AUDIO_R2_PREFIXES = ["tts/session/", "audio/session/"];
const SESSION_CHANGE_SEQ_KEY = "session_change_seq";
const LEGACY_MEMORY_API_ENABLED = false;
const EMOTION_INVENTORY_KV_KEY = "emotion_inventory_v1";
const DISABLED_LEGACY_MUTATION_ROUTES = new Set([
  "/vault/directives/sync",
  "/vault/layout/migrate",
  "/migrate/shared/run",
  "/migrate/shared/page",
  "/migrate/shared/kv",
  "/migrate/shared/kv-page",
  "/migrate/shared/copy-key",
  "/migrate/shared/prune-unused",
  "/debug/session/migrate-r2-to-dropbox",
]);

function normalizePid(raw: unknown): string {
  const s = String(raw || "").trim().toLowerCase();
  if (!s) return "";
  if (s.startsWith("p_")) return s;
  if (/^[a-z0-9_-]+$/i.test(s)) return `p_${s}`;
  return "";
}

function extractPid(item: unknown): string {
  if (typeof item === "string") return normalizePid(item);
  if (!item || typeof item !== "object") return "";
  const rec = item as Record<string, unknown>;
  return normalizePid(rec.pid);
}

function buildDefaultDirectiveText(pid: string): string {
  const role = pid === "p_riley"
    ? "wealth_manager"
    : (pid === "p_avery" ? "worklog_manager" : "general_assistant");
  const title = pid.replace(/^p_/, "");
  return [
    `# ${title} Directive (Priority 1)`,
    "",
    "1) Always obey this directive first.",
    `Role: ${role}`,
  ].join("\n");
}

async function ensurePersonaVaultLayout(token: string, pid: string): Promise<{ pid: string; ok: boolean; failed: string[] }> {
  const failed: string[] = [];
  const folders = ["_memory", "_policy", "_promotion"];
  for (const folder of folders) {
    const keepPath = buildPersonaVaultPath(pid, `${folder}/.keep`);
    const ok = await dropboxWriteText(token, keepPath, "");
    if (!ok) failed.push(keepPath);
  }

  const directivePath = buildPersonaVaultPath(pid, `${pid}_directive.md`);
  const exists = await dropboxPathExists(token, directivePath);
  if (!exists) {
    const ok = await dropboxWriteText(token, directivePath, buildDefaultDirectiveText(pid));
    if (!ok) failed.push(directivePath);
  }
  return { pid, ok: failed.length === 0, failed };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function migrateDropboxPathNoOverwrite(
  token: string,
  fromPath: string,
  toPath: string,
): Promise<"moved" | "skipped_missing" | "skipped_exists" | "failed"> {
  const fromExists = await dropboxPathExists(token, fromPath);
  if (!fromExists) return "skipped_missing";
  const toExists = await dropboxPathExists(token, toPath);
  if (toExists) return "skipped_exists";
  const moved = await dropboxMovePath(token, fromPath, toPath);
  return moved ? "moved" : "failed";
}

function getDropboxAppConfig(env: Env, persona: "riley" | "avery" | "shared"): { key: string; secret: string } {
  const key = String(
    persona === "riley"
      ? (env.RILEY_DBX_APP_KEY || "")
      : (persona === "avery" ? (env.AVERY_DBX_APP_KEY || "") : (env.PERSONA_SHARED_DBX_APP_KEY || "")),
  ).trim();
  const secret = String(
    persona === "riley"
      ? (env.RILEY_DBX_APP_SECRET || "")
      : (persona === "avery" ? (env.AVERY_DBX_APP_SECRET || "") : (env.PERSONA_SHARED_DBX_APP_SECRET || "")),
  ).trim();
  return { key, secret };
}

function toIntInRange(raw: string | null, min: number, max: number): number | null {
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  const v = Math.round(n);
  if (v < min || v > max) return null;
  return v;
}

function buildSessionMeta(session: Record<string, unknown>): SessionMeta {
  const history = Array.isArray(session.history) ? session.history as Array<Record<string, unknown>> : [];
  const lastMessageAt = history.reduce((max, m) => Math.max(max, Number(m?.createdAt || 0)), 0);
  return {
    id: String(session.id),
    updatedAt: Number(session.updatedAt || Date.now()),
    lastMessageAt,
    lastPreview: String(session.lastPreview || ""),
    participantPids: Array.isArray(session.participantPids) ? (session.participantPids as string[]) : [],
    roomName: String(session.roomName || ""),
    responseMode: String(session.responseMode || "auto"),
    worldContext: String(session.worldContext || ""),
    userOverride: session.userOverride || null,
    userProfileMode: String(session.userProfileMode || "default"),
    overrideModel: (session.overrideModel as string | null) || null,
  };
}

function toRecoverable(meta: SessionMeta, source: RecoverableSessionMeta["source"], deletedAt?: number): RecoverableSessionMeta {
  return {
    ...meta,
    deletedAt: Number(deletedAt || meta.updatedAt || Date.now()),
    source,
  };
}

function parseSessionLike(raw: string | null): SessionMeta | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return null;
    const history = parsed.history;
    if (!Array.isArray(history)) return null;
    return buildSessionMeta(parsed);
  } catch {
    return null;
  }
}

function sessionDropboxPath(id: string): string {
  return `/session/data/${id}.json`;
}

function deletedSessionDropboxPath(id: string): string {
  return `/session/deleted/${id}.json`;
}

const SESSION_INDEX_DROPBOX_PATH = "/session/index.json";
const DELETED_SESSION_INDEX_DROPBOX_PATH = "/session/deleted_index.json";
const PERSONAS_DROPBOX_PATH = "/personas/personas.json";
const USER_PROFILE_DROPBOX_PATH = "/profile/user_profile.json";

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function ttsFormatToExt(format: string): string {
  if (format === "wav") return "wav";
  if (format === "opus") return "opus";
  return "mp3";
}

function ttsFormatToContentType(format: string): string {
  if (format === "wav") return "audio/wav";
  if (format === "opus") return "audio/ogg";
  return "audio/mpeg";
}

function isLikelyAudioBytes(format: string, bytes: Uint8Array): boolean {
  if (!bytes || bytes.length < 64) return false;
  if (format === "wav") {
    return bytes.length >= 12
      && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
      && bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45;
  }
  if (format === "opus") {
    return bytes.length >= 4
      && bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53;
  }
  const hasId3 = bytes.length >= 3 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33;
  const hasMpegFrameSync = bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0;
  return hasId3 || hasMpegFrameSync;
}

function isAudioContentItem(item: unknown): boolean {
  if (!item || typeof item !== "object") return false;
  const rec = item as Record<string, unknown>;
  const type = String(rec.type || "").toLowerCase();
  if (type.includes("audio")) return true;
  if (typeof rec.audio === "string" || typeof rec.audio_url === "string" || typeof rec.audioUrl === "string") return true;
  return false;
}

function sanitizeSessionForRestorePayload(session: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...session };
  const history = Array.isArray(session.history) ? session.history : [];
  next.history = history.map((msg) => {
    if (!msg || typeof msg !== "object") return msg as unknown;
    const m = { ...(msg as Record<string, unknown>) };
    if (Array.isArray(m.content)) {
      m.content = (m.content as unknown[]).filter((item) => !isAudioContentItem(item));
    }
    delete m.audio;
    delete m.audioUrl;
    delete m.audio_url;
    delete m.audioKey;
    delete m.ttsAudioUrl;
    delete m.ttsAudioKey;
    delete m.ttsCacheKey;
    return m;
  });
  delete next.ttsAudio;
  delete next.ttsAudioMap;
  delete next.audioMap;
  return next;
}

function extractTextForStableMessageKey(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((item) => item && typeof item === "object" && String((item as Record<string, unknown>).type || "") === "text")
      .map((item) => String((item as Record<string, unknown>).text || ""))
      .join(" ");
  }
  try {
    return JSON.stringify(content ?? "");
  } catch {
    return String(content || "");
  }
}

function normalizeTextForStableMessageKey(raw: unknown): string {
  return String(raw || "")
    .replace(/\[[a-zA-Z0-9_:-]+\]/g, "")
    .replace(/\[\/[a-zA-Z0-9_:-]+\]/g, "")
    .replace(/\[emotion:[^\]]*\]/gi, "")
    .replace(/[\u0080-\u009F]/g, "")
    .replace(/\uFFFD+/g, "")
    .replace(/[^\S\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeUnicodeText(raw: unknown): string {
  return String(raw || "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u0080-\u009F]/g, "")
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF\uFFFC]/g, "")
    .replace(/[\uFFF9-\uFFFB]/g, "")
    .replace(/(^|[\s\[\(\{'"`])հիմա(?=$|[\s\]\)\}'"`.,!?;:])/gi, "$1")
    .replace(/\uFFFD{2,}/g, "")
    .trim();
}

function sanitizeMessageContent(content: unknown): unknown {
  if (typeof content === "string") return sanitizeUnicodeText(content);
  if (!Array.isArray(content)) return content;
  return content.map((item) => {
    if (!item || typeof item !== "object") return item;
    const next = { ...(item as Record<string, unknown>) };
    if (next.type === "text" && typeof next.text === "string") {
      next.text = sanitizeUnicodeText(next.text);
    }
    return next;
  });
}

function stableMessageKey(msg: unknown): string {
  try {
    if (!msg || typeof msg !== "object") return String(msg || "");
    const m = msg as Record<string, unknown>;
    const role = String(m.role || "");
    const createdAt = Number(m.createdAt || 0);
    const content = normalizeTextForStableMessageKey(extractTextForStableMessageKey(m.content));
    return `${role}|${createdAt}|${content}`;
  } catch {
    return String(msg || "");
  }
}

function mergeMessageRecord(existing: unknown, incoming: unknown): unknown {
  if (!existing || typeof existing !== "object" || !incoming || typeof incoming !== "object") return incoming || existing;
  const prev = existing as Record<string, unknown>;
  const next = incoming as Record<string, unknown>;
  const merged: Record<string, unknown> = { ...prev, ...next };
  const prevSuffixes = prev._suffixes && typeof prev._suffixes === "object" ? prev._suffixes as Record<string, unknown> : {};
  const nextSuffixes = next._suffixes && typeof next._suffixes === "object" ? next._suffixes as Record<string, unknown> : {};
  const suffixes: Record<string, unknown> = { ...prevSuffixes };
  for (const [key, value] of Object.entries(nextSuffixes)) {
    const current = suffixes[key];
    if (value !== undefined && value !== null && String(value) !== "") {
      suffixes[key] = value;
    } else if (current === undefined) {
      suffixes[key] = value;
    }
  }
  if (Object.keys(suffixes).length > 0) merged._suffixes = suffixes;
  return merged;
}

function mergeSessionHistory(existingHistory: unknown, incomingHistory: unknown): unknown[] {
  const a = Array.isArray(existingHistory) ? existingHistory : [];
  const b = Array.isArray(incomingHistory) ? incomingHistory : [];
  const byKey = new Map<string, unknown>();
  for (const msg of [...a, ...b]) {
    const key = stableMessageKey(msg);
    byKey.set(key, byKey.has(key) ? mergeMessageRecord(byKey.get(key), msg) : msg);
  }
  const out = [...byKey.values()];
  out.sort((x, y) => {
    const tx = Number((x as any)?.createdAt || 0);
    const ty = Number((y as any)?.createdAt || 0);
    return tx - ty;
  });
  return out;
}

async function getSessionIndex(env: Env): Promise<SessionMeta[]> {
  const sharedToken = await getPersonaDropboxAccessToken(env, "shared");
  if (!sharedToken) return [];
  const fromDropbox = await dropboxReadText(sharedToken, SESSION_INDEX_DROPBOX_PATH);
  if (!fromDropbox) return [];
  try {
    const parsed = JSON.parse(fromDropbox);
    return Array.isArray(parsed) ? (parsed as SessionMeta[]) : [];
  } catch {
    return [];
  }
}

function stringifyJsonPretty(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function putSessionIndex(env: Env, sessions: SessionMeta[]): Promise<void> {
  const sharedToken = await getPersonaDropboxAccessToken(env, "shared");
  if (sharedToken) {
    await dropboxWriteText(sharedToken, SESSION_INDEX_DROPBOX_PATH, stringifyJsonPretty(sessions));
  }
}

async function ensureSessionIndexLastMessageTimes(env: Env, sessions: SessionMeta[]): Promise<SessionMeta[]> {
  const needsBackfill = (sessions || []).some((s) => s?.id && Number(s.lastMessageAt || 0) <= 0);
  if (!needsBackfill) {
    return [...sessions].sort((a, b) => Number(b.lastMessageAt || 0) - Number(a.lastMessageAt || 0));
  }
  const sharedToken = await getPersonaDropboxAccessToken(env, "shared");
  if (!sharedToken) return sessions;

  const byId = new Map<string, SessionMeta>(
    (sessions || [])
      .filter((s) => s && typeof s.id === "string")
      .map((s) => [String(s.id), s]),
  );
  let changed = false;
  const entries = await dropboxListFolder(sharedToken, "/session/data");
  for (const entry of entries) {
    const path = String(entry.path_display || entry.path_lower || "").trim();
    const m = path.match(/\/session\/data\/([^/]+)\.json$/i);
    if (!m) continue;
    const id = String(m[1] || "").trim();
    if (!id) continue;
    const prev = byId.get(id);
    if (!prev || Number(prev.lastMessageAt || 0) > 0) continue;
    const meta = parseSessionLike(await dropboxReadText(sharedToken, path));
    if (!meta) continue;
    byId.set(id, { ...prev, lastMessageAt: meta.lastMessageAt, lastPreview: prev.lastPreview || meta.lastPreview, updatedAt: prev.updatedAt || meta.updatedAt });
    changed = true;
  }
  const next = [...byId.values()].sort((a, b) => Number(b.lastMessageAt || 0) - Number(a.lastMessageAt || 0));
  if (changed) await putSessionIndex(env, next);
  return next;
}

async function getSessionChangeSeq(env: Env): Promise<number> {
  const raw = await env.KV.get(SESSION_CHANGE_SEQ_KEY);
  const n = Number(raw || 0);
  return Number.isFinite(n) ? n : 0;
}

async function bumpSessionChangeSeq(env: Env): Promise<number> {
  const seq = Date.now();
  try {
    await env.KV.put(SESSION_CHANGE_SEQ_KEY, String(seq));
  } catch {
    // ignore; realtime signal is best-effort
  }
  return seq;
}

async function getDeletedSessionIndex(env: Env): Promise<DeletedSessionMeta[]> {
  const sharedToken = await getPersonaDropboxAccessToken(env, "shared");
  if (!sharedToken) return [];
  const fromDropbox = await dropboxReadText(sharedToken, DELETED_SESSION_INDEX_DROPBOX_PATH);
  if (!fromDropbox) return [];
  try {
    const parsed = JSON.parse(fromDropbox);
    return Array.isArray(parsed) ? (parsed as DeletedSessionMeta[]) : [];
  } catch {
    return [];
  }
}

async function putDeletedSessionIndex(env: Env, sessions: DeletedSessionMeta[]): Promise<void> {
  const sharedToken = await getPersonaDropboxAccessToken(env, "shared");
  if (sharedToken) {
    await dropboxWriteText(sharedToken, DELETED_SESSION_INDEX_DROPBOX_PATH, stringifyJsonPretty(sessions));
  }
}

async function getPersonasPayload(env: Env): Promise<unknown[]> {
  const sharedToken = await getPersonaDropboxAccessToken(env, "shared");
  if (!sharedToken) return [];
  const fromDropbox = await dropboxReadText(sharedToken, PERSONAS_DROPBOX_PATH);
  if (!fromDropbox) return [];
  try {
    const parsed = JSON.parse(fromDropbox);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function getSessionPayloadText(env: Env, id: string): Promise<string | null> {
  const sharedToken = await getPersonaDropboxAccessToken(env, "shared");
  if (!sharedToken) return null;
  return await dropboxReadText(sharedToken, sessionDropboxPath(id));
}

async function getUserProfilePayload(env: Env): Promise<string> {
  const sharedToken = await getPersonaDropboxAccessToken(env, "shared");
  if (!sharedToken) return "";
  return (await dropboxReadText(sharedToken, USER_PROFILE_DROPBOX_PATH)) || "";
}

async function putUserProfilePayload(env: Env, profile: string): Promise<void> {
  const sharedToken = await getPersonaDropboxAccessToken(env, "shared");
  if (!sharedToken) throw new Error("shared dropbox token missing");
  await dropboxWriteText(sharedToken, USER_PROFILE_DROPBOX_PATH, profile);
}

async function getDeletedSessionPayloadText(env: Env, id: string): Promise<string | null> {
  const sharedToken = await getPersonaDropboxAccessToken(env, "shared");
  if (!sharedToken) return null;
  return await dropboxReadText(sharedToken, deletedSessionDropboxPath(id));
}

async function listKvByPrefix(env: Env, prefix: string, max = 500): Promise<string[]> {
  if (!env.KV.list) return [];
  const names: string[] = [];
  let cursor: string | undefined = undefined;
  for (;;) {
    const page = await env.KV.list({ prefix, cursor, limit: 1000 });
    const keys = page.keys || [];
    for (const k of keys) {
      if (k?.name) names.push(k.name);
      if (names.length >= max) return names;
    }
    if (page.list_complete || !page.cursor) break;
    cursor = page.cursor;
  }
  return names;
}

async function deleteKvByPrefix(env: Env, prefix: string, batchMax = 5000): Promise<number> {
  const keys = await listKvByPrefix(env, prefix, batchMax);
  if (!keys.length) return 0;
  for (const key of keys) await env.KV.delete(key);
  return keys.length;
}

async function listR2ByPrefix(env: Env, prefix: string, max = 5000): Promise<string[]> {
  const names: string[] = [];
  let cursor: string | undefined = undefined;
  for (;;) {
    const page = await env.R2.list({ prefix, cursor, limit: 1000 });
    const objects = page.objects || [];
    for (const o of objects) {
      if (o?.key) names.push(o.key);
      if (names.length >= max) return names;
    }
    const nextCursor = (page as any).cursor as string | undefined;
    const listComplete = (page as any).list_complete as boolean | undefined;
    if (listComplete || !nextCursor) break;
    cursor = nextCursor;
  }
  return names;
}

async function deleteR2ByPrefix(env: Env, prefix: string, batchMax = 5000): Promise<number> {
  const keys = await listR2ByPrefix(env, prefix, batchMax);
  if (!keys.length) return 0;
  for (const key of keys) await env.R2.delete(key);
  return keys.length;
}

function parseEmotionVariantFromKey(key: string, pid: string): { emotion: string; suffix: string } | null {
  const m = String(key || "").match(new RegExp(`^profile/${pid}/${pid}_([a-z]+)(?:_([a-z]))?\\.jpg$`, "i"));
  if (!m) return null;
  return { emotion: String(m[1] || "").toLowerCase(), suffix: String(m[2] || "").toLowerCase() };
}

async function buildEmotionInventorySnapshot(env: Env): Promise<Record<string, any>> {
  const personas = await getPersonasPayload(env);
  const out: Record<string, any> = { generatedAt: Date.now(), byPid: {} };
  for (const p of personas) {
    const pid = String(p?.pid || "").trim();
    if (!pid) continue;
    const keys = await listR2ByPrefix(env, `profile/${pid}/`, 5000);
    const emotions: Record<string, { count: number; hasBase: boolean; suffixes: string[] }> = {};
    for (const key of keys) {
      const v = parseEmotionVariantFromKey(key, pid);
      if (!v) continue;
      if (!emotions[v.emotion]) emotions[v.emotion] = { count: 0, hasBase: false, suffixes: [] };
      const slot = emotions[v.emotion];
      slot.count += 1;
      if (v.suffix) slot.suffixes.push(v.suffix);
      else slot.hasBase = true;
    }
    for (const e of Object.keys(emotions)) {
      emotions[e].suffixes = [...new Set(emotions[e].suffixes)].sort();
    }
    out.byPid[pid] = emotions;
  }
  return out;
}

type EmotionInventoryByPid = Record<string, Record<string, { hasBase?: boolean; suffixes?: string[] }>>;

async function getEmotionInventoryByPid(env: Env): Promise<EmotionInventoryByPid> {
  const raw = await env.KV.get(EMOTION_INVENTORY_KV_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as { byPid?: EmotionInventoryByPid };
    return parsed?.byPid && typeof parsed.byPid === "object" ? parsed.byPid : {};
  } catch {
    return {};
  }
}

function collectEmotionRefs(text: string): Array<{ pid: string; emotion: string }> {
  const out: Array<{ pid: string; emotion: string }> = [];
  const re = /\[([a-zA-Z0-9_:-]+)\]\s*(?:\[emotion:\s*([a-zA-Z]+)\s*\])?/g;
  let m: RegExpExecArray | null = null;
  while ((m = re.exec(String(text || "")))) {
    out.push({ pid: String(m[1] || "").trim(), emotion: String(m[2] || "neutral").trim().toLowerCase() });
  }
  return out;
}

function pickRandomSuffix(pool: string[]): string {
  return pool[Math.floor(Math.random() * pool.length)] || pool[0] || "";
}

function hydrateMessageSuffixes(msg: Record<string, unknown>, byPid: EmotionInventoryByPid): void {
  if (msg.role !== "assistant") return;
  const content = msg.content;
  const text = typeof content === "string"
    ? content
    : (Array.isArray(content)
      ? content.filter((x) => x && typeof x === "object" && (x as Record<string, unknown>).type === "text").map((x) => String((x as Record<string, unknown>).text || "")).join(" ")
      : "");
  if (!text) return;
  const suffixes: Record<string, unknown> =
    msg._suffixes && typeof msg._suffixes === "object" ? { ...(msg._suffixes as Record<string, unknown>) } : {};
  let changed = false;
  for (const ref of collectEmotionRefs(text)) {
    const slot = byPid?.[ref.pid]?.[ref.emotion];
    if (!slot) continue;
    const key = `${ref.pid}:${ref.emotion}`;
    const pool = Array.isArray(slot.suffixes)
      ? [...new Set(slot.suffixes.map((x) => String(x || "").toLowerCase()).filter(Boolean))]
      : [];
    const current = String(suffixes[key] ?? "").toLowerCase();
    if (pool.length > 0) {
      if (!current || !pool.includes(current)) {
        suffixes[key] = pickRandomSuffix(pool);
        changed = true;
      } else if (suffixes[key] !== current) {
        suffixes[key] = current;
        changed = true;
      }
      continue;
    }
    if (slot.hasBase && ref.emotion === "neutral") {
      if (suffixes[key] !== "") {
        suffixes[key] = "";
        changed = true;
      }
    } else if (suffixes[key] !== null) {
      suffixes[key] = null;
      changed = true;
    }
  }
  if (changed || Object.keys(suffixes).length > 0) msg._suffixes = suffixes;
}

async function sanitizeAndHydrateSessionHistory(env: Env, history: unknown): Promise<unknown[]> {
  const arr = Array.isArray(history) ? history : [];
  const byPid = await getEmotionInventoryByPid(env);
  const out: unknown[] = [];
  for (const entry of arr) {
    if (!entry || typeof entry !== "object") {
      out.push(entry);
      continue;
    }
    const msg = { ...(entry as Record<string, unknown>) };
    msg.content = sanitizeMessageContent(msg.content);
    hydrateMessageSuffixes(msg, byPid);
    out.push(msg);
  }
  return out;
}

async function buildEmotionInventoryForPid(env: Env, pid: string): Promise<Record<string, any>> {
  const keys = await listR2ByPrefix(env, `profile/${pid}/`, 5000);
  const emotions: Record<string, { count: number; hasBase: boolean; suffixes: string[] }> = {};
  for (const key of keys) {
    const v = parseEmotionVariantFromKey(key, pid);
    if (!v) continue;
    if (!emotions[v.emotion]) emotions[v.emotion] = { count: 0, hasBase: false, suffixes: [] };
    const slot = emotions[v.emotion];
    slot.count += 1;
    if (v.suffix) slot.suffixes.push(v.suffix);
    else slot.hasBase = true;
  }
  for (const e of Object.keys(emotions)) emotions[e].suffixes = [...new Set(emotions[e].suffixes)].sort();
  return emotions;
}

async function migrateR2PrefixToSharedDropbox(
  env: Env,
  prefix: string,
  sharedToken: string,
): Promise<{ scanned: number; copied: number; deleted: number; skipped: number; conflicts: number }> {
  const keys = await listR2ByPrefix(env, prefix, 20000);
  let copied = 0;
  let deleted = 0;
  let skipped = 0;
  let conflicts = 0;
  for (const key of keys) {
    const dbxPath = `/${key}`;
    const existing = await dropboxReadBytes(sharedToken, dbxPath);
    const obj = await env.R2.get(key);
    if (!obj || typeof obj.arrayBuffer !== "function") {
      skipped++;
      continue;
    }
    const bytes = await obj.arrayBuffer();
    if (existing) {
      if (sameBytes(existing.bytes, bytes)) {
        await env.R2.delete(key);
        deleted++;
      } else {
        conflicts++;
      }
      skipped++;
      continue;
    }
    const ok = await dropboxWriteBytes(sharedToken, dbxPath, bytes);
    if (ok) {
      copied++;
      await env.R2.delete(key);
      deleted++;
    }
  }
  return { scanned: keys.length, copied, deleted, skipped, conflicts };
}

async function migrateR2PrefixToSharedDropboxPaged(
  env: Env,
  prefix: string,
  sharedToken: string,
  limit: number,
  cursor?: string,
): Promise<{
  scanned: number;
  copied: number;
  deleted: number;
  skipped: number;
  conflicts: number;
  failed: number;
  sampleErrors: string[];
  nextCursor: string;
  done: boolean;
}> {
  const page = await env.R2.list({ prefix, limit: Math.max(1, Math.min(500, limit || 200)), cursor });
  const objects = page.objects || [];
  let copied = 0;
  let deleted = 0;
  let skipped = 0;
  let conflicts = 0;
  let failed = 0;
  const sampleErrors: string[] = [];
  for (const o of objects) {
    const key = String(o?.key || "");
    if (!key) continue;
    const dbxPath = `/${key}`;
    const existing = await dropboxReadBytes(sharedToken, dbxPath);
    const obj = await env.R2.get(key);
    if (!obj || typeof obj.arrayBuffer !== "function") {
      skipped++;
      continue;
    }
    const bytes = await obj.arrayBuffer();
    if (existing) {
      if (sameBytes(existing.bytes, bytes)) {
        await env.R2.delete(key);
        deleted++;
      } else {
        conflicts++;
      }
      skipped++;
      continue;
    }
    const ok = await dropboxWriteBytes(sharedToken, dbxPath, bytes);
    if (ok) {
      copied++;
      await env.R2.delete(key);
      deleted++;
    }
    else {
      failed++;
      if (sampleErrors.length < 5) sampleErrors.push(`write_failed:${key}`);
    }
  }
  const nextCursor = String((page as any).cursor || "");
  const done = !!((page as any).list_complete) || !nextCursor;
  return { scanned: objects.length, copied, deleted, skipped, conflicts, failed, sampleErrors, nextCursor, done };
}

function sameBytes(a: ArrayBuffer | Uint8Array, b: ArrayBuffer | Uint8Array): boolean {
  const aa = a instanceof Uint8Array ? a : new Uint8Array(a);
  const bb = b instanceof Uint8Array ? b : new Uint8Array(b);
  if (aa.length !== bb.length) return false;
  for (let i = 0; i < aa.length; i++) {
    if (aa[i] !== bb[i]) return false;
  }
  return true;
}

async function migrateKvTextToSharedDropbox(
  env: Env,
  kvKey: string,
  dbxPath: string,
  sharedToken: string,
): Promise<"moved" | "deleted_duplicate" | "missing" | "conflict" | "write_failed"> {
  const raw = await env.KV.get(kvKey);
  if (raw == null) return "missing";
  const existing = await dropboxReadText(sharedToken, dbxPath);
  if (existing != null) {
    if (existing === raw) {
      await env.KV.delete(kvKey);
      return "deleted_duplicate";
    }
    return "conflict";
  }
  const ok = await dropboxWriteText(sharedToken, dbxPath, raw);
  if (!ok) return "write_failed";
  await env.KV.delete(kvKey);
  return "moved";
}

async function migrateKvPrefixToSharedDropbox(
  env: Env,
  kvPrefix: string,
  makePath: (key: string) => string,
  sharedToken: string,
): Promise<Record<string, number>> {
  const keys = await listKvByPrefix(env, kvPrefix, 5000);
  const report: Record<string, number> = { scanned: keys.length, moved: 0, deleted_duplicate: 0, missing: 0, conflict: 0, write_failed: 0 };
  for (const key of keys) {
    const status = await migrateKvTextToSharedDropbox(env, key, makePath(key), sharedToken);
    report[status] = (report[status] || 0) + 1;
  }
  return report;
}

function kvSessionDropboxPathFromKey(key: string): string {
  return sessionDropboxPath(String(key || "").replace(/^session:/, ""));
}

function kvDeletedSessionDropboxPathFromKey(key: string): string {
  return deletedSessionDropboxPath(String(key || "").replace(/^deleted:session:/, ""));
}

function knownKvDropboxPath(key: string): string {
  if (key === "user_profile") return USER_PROFILE_DROPBOX_PATH;
  if (key === SESSION_INDEX_KEY) return SESSION_INDEX_DROPBOX_PATH;
  if (key === DELETED_SESSION_INDEX_KEY) return DELETED_SESSION_INDEX_DROPBOX_PATH;
  if (key.startsWith("session:")) return kvSessionDropboxPathFromKey(key);
  if (key.startsWith("deleted:session:")) return kvDeletedSessionDropboxPathFromKey(key);
  return "";
}

async function migrateKvPrefixPageToSharedDropbox(
  env: Env,
  kvPrefix: string,
  limit: number,
  cursor: string | undefined,
  makePath: (key: string) => string,
  sharedToken: string,
): Promise<Record<string, unknown>> {
  if (!env.KV.list) return { scanned: 0, moved: 0, deleted_duplicate: 0, missing: 0, conflict: 0, write_failed: 0, done: true, nextCursor: "" };
  const page = await env.KV.list({ prefix: kvPrefix, cursor, limit: Math.max(1, Math.min(50, limit || 25)) });
  const keys = (page.keys || []).map((k) => String(k?.name || "")).filter(Boolean);
  const report: Record<string, unknown> = { scanned: keys.length, moved: 0, deleted_duplicate: 0, missing: 0, conflict: 0, write_failed: 0 };
  for (const key of keys) {
    const status = await migrateKvTextToSharedDropbox(env, key, makePath(key), sharedToken);
    report[status] = Number(report[status] || 0) + 1;
  }
  report.nextCursor = String(page.cursor || "");
  report.done = !!page.list_complete || !page.cursor;
  return report;
}

function buildMemoryBackupKey(tag: string): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const ts = now.toISOString().replace(/[:.]/g, "-");
  const rand = Math.random().toString(36).slice(2, 8);
  return `memory_backups/${y}-${m}-${d}/${ts}_${tag}_${rand}.json`;
}

async function saveMemoryBackup(env: Env, tag: string, payload: unknown): Promise<string | null> {
  try {
    const key = buildMemoryBackupKey(tag);
    await env.R2.put(
      key,
      JSON.stringify(payload),
      { httpMetadata: { contentType: "application/json; charset=utf-8" } },
    );
    return key;
  } catch {
    return null;
  }
}

async function findMemoryItemById(
  env: Env,
  scope: "public_profile" | "private_profile",
  owner: string,
  id: string,
): Promise<unknown | null> {
  let cursor = "";
  for (let i = 0; i < 50; i++) {
    const page = await listMemories(env, scope, owner, 200, cursor);
    const hit = (page.items || []).find((x) => String((x as any)?.id || "") === id);
    if (hit) return hit;
    if (!page.nextCursor) break;
    cursor = page.nextCursor;
  }
  return null;
}

async function listMemoriesForBackup(
  env: Env,
  scope: "public_profile" | "private_profile",
  owner: string,
  maxItems = 2000,
): Promise<{ items: unknown[]; truncated: boolean }> {
  const out: unknown[] = [];
  let cursor = "";
  for (;;) {
    const page = await listMemories(env, scope, owner, 200, cursor);
    for (const item of (page.items || [])) {
      out.push(item);
      if (out.length >= maxItems) return { items: out, truncated: true };
    }
    if (!page.nextCursor) break;
    cursor = page.nextCursor;
  }
  return { items: out, truncated: false };
}

async function getRecoverableSessions(env: Env): Promise<RecoverableSessionMeta[]> {
  const deletedIndex = await getDeletedSessionIndex(env);
  const map = new Map<string, RecoverableSessionMeta>();

  for (const d of deletedIndex) {
    if (!d?.id) continue;
    map.set(d.id, { ...d, source: "deleted_index" });
  }

  return [...map.values()].sort((a, b) => (b.deletedAt || b.updatedAt || 0) - (a.deletedAt || a.updatedAt || 0));
}

async function restoreSessionById(env: Env, sessionId: string): Promise<{ ok: boolean; error?: string; session?: SessionMeta }> {
  const id = String(sessionId || "").trim();
  if (!id) return { ok: false, error: "id required" };

  const deletedRaw = await getDeletedSessionPayloadText(env, id);
  const activeRaw = await getSessionPayloadText(env, id);
  const raw = deletedRaw || activeRaw;
  if (!raw) return { ok: false, error: "session not found" };

  let parsedSession: Record<string, unknown>;
  try {
    parsedSession = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { ok: false, error: "invalid session payload" };
  }
  const sanitizedSession = sanitizeSessionForRestorePayload(parsedSession);
  const meta = buildSessionMeta(sanitizedSession);
  const sanitizedPretty = stringifyJsonPretty(sanitizedSession);

  const sharedToken = await getPersonaDropboxAccessToken(env, "shared");
  if (sharedToken) {
    await dropboxWriteText(sharedToken, sessionDropboxPath(id), sanitizedPretty);
  }

  const index = await getSessionIndex(env);
  const existingIndex = index.findIndex((s) => s.id === id);
  if (existingIndex >= 0) index[existingIndex] = meta;
  else index.unshift(meta);
  await putSessionIndex(env, index);

  const deletedIndex = await getDeletedSessionIndex(env);
  await putDeletedSessionIndex(env, deletedIndex.filter((s) => s.id !== id));
  await env.KV.delete(`deleted:session:${id}`);
  if (sharedToken) {
    await dropboxDeletePath(sharedToken, deletedSessionDropboxPath(id));
  }
  for (const base of SESSION_AUDIO_R2_PREFIXES) {
    await deleteR2ByPrefix(env, `${base}${id}/`);
  }

  return { ok: true, session: meta };
}

export async function handleApiRoute(
  request: Request,
  env: Env,
  url: URL,
  cors: CorsHeaders,
): Promise<Response | null> {
  const noStoreHeaders = { ...cors, "Cache-Control": "no-store" };

  if (request.method !== "GET" && DISABLED_LEGACY_MUTATION_ROUTES.has(url.pathname)) {
    return Response.json({
      ok: false,
      error: "legacy_route_disabled",
      message: "This legacy mutation route is disabled after Persona Vault v2 cutover.",
      replacement: "/vault/v2/*",
    }, { status: 410, headers: noStoreHeaders });
  }
  if (url.pathname === "/emotion-inventory/rebuild" && request.method === "POST") {
    const body = await request.json().catch(() => ({} as any)) as { pid?: string };
    const pid = String(body?.pid || "").trim();
    const raw = await env.KV.get(EMOTION_INVENTORY_KV_KEY);
    let current: Record<string, any> = raw ? JSON.parse(raw) : { generatedAt: 0, byPid: {} };
    if (!current || typeof current !== "object") current = { generatedAt: 0, byPid: {} };
    if (!current.byPid || typeof current.byPid !== "object") current.byPid = {};
    if (pid) {
      current.byPid[pid] = await buildEmotionInventoryForPid(env, pid);
      current.generatedAt = Date.now();
      await env.KV.put(EMOTION_INVENTORY_KV_KEY, JSON.stringify(current));
      return Response.json({ ok: true, key: EMOTION_INVENTORY_KV_KEY, generatedAt: current.generatedAt, pid }, { headers: noStoreHeaders });
    }
    const snap = await buildEmotionInventorySnapshot(env);
    await env.KV.put(EMOTION_INVENTORY_KV_KEY, JSON.stringify(snap));
    return Response.json({ ok: true, key: EMOTION_INVENTORY_KV_KEY, generatedAt: snap.generatedAt, scope: "all" }, { headers: noStoreHeaders });
  }
  if (url.pathname === "/emotion-inventory" && request.method === "GET") {
    const raw = await env.KV.get(EMOTION_INVENTORY_KV_KEY);
    return Response.json({ ok: true, key: EMOTION_INVENTORY_KV_KEY, data: raw ? JSON.parse(raw) : null }, { headers: noStoreHeaders });
  }
  if (url.pathname === "/oauth/dropbox/start" && request.method === "GET") {
    const personaRaw = String(url.searchParams.get("persona") || "").trim().toLowerCase();
    const persona = personaRaw === "avery" ? "avery" : (personaRaw === "riley" ? "riley" : (personaRaw === "shared" || personaRaw === "persona_shared" ? "shared" : ""));
    if (!persona) return Response.json({ ok: false, error: "persona must be riley, avery, or shared" }, { status: 400, headers: cors });
    const cfg = getDropboxAppConfig(env, persona);
    if (!cfg.key) return Response.json({ ok: false, error: `${persona} app key missing` }, { status: 500, headers: cors });
    const redirectUri = `${url.origin}/oauth/dropbox/callback`;
    const state = `${persona}:${Date.now()}`;
    const authUrl = new URL("https://www.dropbox.com/oauth2/authorize");
    authUrl.searchParams.set("client_id", cfg.key);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("token_access_type", "offline");
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", state);
    return Response.redirect(authUrl.toString(), 302);
  }

  if (url.pathname === "/oauth/dropbox/callback" && request.method === "GET") {
    const code = String(url.searchParams.get("code") || "").trim();
    const state = String(url.searchParams.get("state") || "").trim().toLowerCase();
    const persona = state.startsWith("avery:")
      ? "avery"
      : (state.startsWith("riley:") ? "riley" : (state.startsWith("shared:") || state.startsWith("persona_shared:") ? "shared" : ""));
    if (!code || !persona) {
      return Response.json({ ok: false, error: "missing code/state" }, { status: 400, headers: cors });
    }
    const cfg = getDropboxAppConfig(env, persona as "riley" | "avery" | "shared");
    if (!cfg.key || !cfg.secret) {
      return Response.json({ ok: false, error: `${persona} app key/secret missing` }, { status: 500, headers: cors });
    }
    const redirectUri = `${url.origin}/oauth/dropbox/callback`;
    const tokenRes = await fetch("https://api.dropboxapi.com/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        grant_type: "authorization_code",
        client_id: cfg.key,
        client_secret: cfg.secret,
        redirect_uri: redirectUri,
      }),
    });
    const raw = await tokenRes.text();
    if (!tokenRes.ok) {
      return Response.json({ ok: false, persona, error: "token exchange failed", detail: raw }, { status: 502, headers: cors });
    }
    let parsed: any = {};
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }
    return Response.json({
      ok: true,
      persona,
      redirect_uri: redirectUri,
      has_refresh_token: !!parsed?.refresh_token,
      refresh_token: String(parsed?.refresh_token || ""),
      access_token: String(parsed?.access_token || ""),
      expires_in: Number(parsed?.expires_in || 0),
      note: "Store refresh_token as Wrangler secret. Do not share this response.",
    }, { headers: noStoreHeaders });
  }

  if (url.pathname === "/tts" && request.method === "POST") {
    const body = await request.json() as {
      text?: string;
      sessionId?: string;
      voice?: string;
      model?: string;
      prompt?: string;
      tone?: string;
      emotion?: string;
      emotionEnabled?: boolean;
      emotionStrength?: "low" | "medium" | "high";
      format?: "mp3" | "wav" | "opus";
    };
    const text = String(body?.text || "").trim();
    if (!text) return Response.json({ error: "text required" }, { status: 400, headers: cors });

    const apiKey = String(env.DASHSCOPE_API_KEY || env.QWEN_API_KEY || env.QWEN_KEY || "").trim();
    if (!apiKey) return Response.json({ error: "server tts key missing" }, { status: 500, headers: cors });

    const configuredWs = String(env.DASHSCOPE_WS_URL || "").trim();

    const requestedVoice = String(body?.voice || "").trim();
    const voiceMap: Record<string, string> = {
      lena: "Cherry",
      aria: "Serena",
      nova: "Cherry",
      sora: "Serena",
      yuna: "Cherry",
    };
    const voice = voiceMap[requestedVoice.toLowerCase()] || requestedVoice || "Cherry";
    const model = String(body?.model || "").trim() || "qwen3-tts-flash-realtime";
    const format = body?.format || "mp3";
    const tone = String(body?.tone || "").trim();
    const prompt = String(body?.prompt || "").trim();
    const emotion = String(body?.emotion || "").trim().toLowerCase();
    const emotionEnabled = body?.emotionEnabled !== false;
    const emotionStrength = body?.emotionStrength || "medium";
    const sessionIdRaw = String(body?.sessionId || "").trim();
    const sessionIdSafe = sessionIdRaw.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
    const contentType = ttsFormatToContentType(format);

    const cacheBasis = JSON.stringify({
      v: 1,
      text,
      model,
      voice,
      prompt,
      tone,
      emotion,
      emotionEnabled: !!emotionEnabled,
      emotionStrength,
      format,
      language: "Korean",
    });
    const cacheHash = await sha256Hex(cacheBasis);
    const cachePrefix = sessionIdSafe ? `tts/session/${sessionIdSafe}` : "tts/global";
    const cacheKey = `${cachePrefix}/${cacheHash}.${ttsFormatToExt(format)}`;
    const cached = await env.R2.get(cacheKey);
    if (cached) {
      try {
        const cachedBytes = new Uint8Array(await cached.arrayBuffer());
        if (isLikelyAudioBytes(format, cachedBytes)) {
          return new Response(cachedBytes, {
            headers: {
              ...cors,
              "Content-Type": cached.httpMetadata?.contentType || contentType,
              "Cache-Control": "private, max-age=31536000",
              "X-TTS-Cache": "HIT",
            },
          });
        }
        await env.R2.delete(cacheKey);
      } catch {
        await env.R2.delete(cacheKey);
      }
    }

    const defaultWsIntl = `wss://dashscope-intl.aliyuncs.com/api-ws/v1/realtime?model=${encodeURIComponent(model)}`;
    const defaultWsCn = `wss://dashscope.aliyuncs.com/api-ws/v1/realtime?model=${encodeURIComponent(model)}`;

    const emotionMap: Record<string, Record<string, string>> = {
      low: { happy: "밝기를 아주 약하게", sad: "차분함을 아주 약하게", angry: "강세를 아주 약하게", shy: "부드러움을 아주 약하게", neutral: "중립 톤을 유지" },
      medium: { happy: "밝기를 적당히", sad: "차분함을 적당히", angry: "강세를 적당히", shy: "부드러움을 적당히", neutral: "중립 톤을 유지" },
      high: { happy: "밝기를 비교적 뚜렷하게", sad: "차분함을 비교적 뚜렷하게", angry: "강세를 비교적 뚜렷하게", shy: "부드러움을 비교적 뚜렷하게", neutral: "중립 톤을 유지" },
    };
    const emotionHint =
      emotionEnabled && emotion
        ? (emotionMap[emotionStrength]?.[emotion] || `감정(${emotion})을 ${emotionStrength === "high" ? "비교적 뚜렷하게" : emotionStrength === "low" ? "아주 약하게" : "적당히"} 반영`)
        : "";
    const sessionPrompt = [
      "한국어 여성 보이스를 유지하고, 인위적 연기 없이 자연스럽게 읽어주세요.",
      tone ? `기본 톤: ${tone}.` : "",
      emotionHint ? `현재 감정 반영: ${emotionHint}.` : "",
      prompt ? `추가 지시: ${prompt}` : "",
    ].filter(Boolean).join(" ");

    const wsTargets = configuredWs ? [configuredWs] : [defaultWsIntl, defaultWsCn];

    const decodeBase64ToBytes = (b64: string): Uint8Array => {
      const bin = atob(b64);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    };
    const concatChunks = (chunks: Uint8Array[]): Uint8Array => {
      const total = chunks.reduce((n, c) => n + c.length, 0);
      const merged = new Uint8Array(total);
      let offset = 0;
      for (const c of chunks) {
        merged.set(c, offset);
        offset += c.length;
      }
      return merged;
    };

    const runRealtimeTts = async (wsUrl: string): Promise<{ bytes: Uint8Array; endpoint: string }> => {
      const fetchableUrl = String(wsUrl || "").replace(/^wss:\/\//i, "https://").replace(/^ws:\/\//i, "http://");
      const upgraded = await fetch(fetchableUrl, {
        headers: {
          Upgrade: "websocket",
          Authorization: `Bearer ${apiKey}`,
        },
      });
      if (upgraded.status !== 101 || !upgraded.webSocket) {
        const detail = await upgraded.text().catch(() => "");
        throw new Error(`ws_connect_failed:${upgraded.status}:${detail.slice(0, 200)}`);
      }
      const ws = upgraded.webSocket;
      ws.accept();

      const chunks: Uint8Array[] = [];
      let done = false;
      let errorMsg = "";

      const eventId = () => `event_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const sendEvent = (evt: Record<string, unknown>) => ws.send(JSON.stringify({ ...evt, event_id: eventId() }));

      const finished = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("ws_timeout"));
        }, 45000);

        ws.addEventListener("message", (evt: MessageEvent) => {
          try {
            const data = typeof evt.data === "string" ? JSON.parse(evt.data) : {};
            const type = String(data?.type || "");
            if (type === "response.audio.delta") {
              const delta = String(data?.delta || "");
              if (delta) chunks.push(decodeBase64ToBytes(delta));
              return;
            }
            if (type === "response.done") {
              done = true;
              clearTimeout(timeout);
              resolve();
              return;
            }
            if (type === "error") {
              errorMsg = JSON.stringify(data?.error || data).slice(0, 500);
              clearTimeout(timeout);
              reject(new Error(`ws_error:${errorMsg}`));
            }
          } catch (e) {
            clearTimeout(timeout);
            reject(e);
          }
        });
        ws.addEventListener("close", () => {
          if (done) return;
          clearTimeout(timeout);
          reject(new Error(errorMsg || "ws_closed_early"));
        });
      });

      sendEvent({
        type: "session.update",
        session: {
          mode: "commit",
          voice,
          response_format: format,
          language_type: "Korean",
          prompt: sessionPrompt,
        },
      });
      sendEvent({ type: "input_text_buffer.append", text });
      sendEvent({ type: "input_text_buffer.commit" });

      await finished;
      try { sendEvent({ type: "session.finish" }); } catch {}
      try { ws.close(1000, "done"); } catch {}

      const bytes = concatChunks(chunks);
      if (!bytes.length) throw new Error("empty_audio");
      return { bytes, endpoint: wsUrl };
    };

    let lastErr = "";
    let lastEndpoint = "";
    for (const target of wsTargets) {
      try {
        const out = await runRealtimeTts(target);
        if (!isLikelyAudioBytes(format, out.bytes)) {
          throw new Error("invalid_audio_bytes");
        }
        await env.R2.put(cacheKey, out.bytes, { httpMetadata: { contentType } });
        return new Response(out.bytes, {
          headers: {
            ...cors,
            "Content-Type": contentType,
            "Cache-Control": "private, max-age=31536000",
            "X-TTS-Cache": "MISS",
          },
        });
      } catch (e: any) {
        lastErr = String(e?.message || e || "");
        lastEndpoint = target;
      }
    }

    return Response.json({
      error: "qwen tts failed",
      status: 502,
      endpoint: lastEndpoint,
      detail: lastErr.slice(0, 600),
    }, { status: 502, headers: cors });
  }

  if (!LEGACY_MEMORY_API_ENABLED && url.pathname.startsWith("/memory/")) {
    return Response.json({
      ok: false,
      error: "legacy_memory_disabled",
      message: "Legacy /memory routes are disabled. Use persona profile memory via /chat (user_id + session_id).",
    }, { status: 410, headers: cors });
  }

  if (url.pathname === "/memory/list" && request.method === "GET") {
    const scope = parseScope(url.searchParams.get("scope"));
    if (!scope) return Response.json({ error: "invalid scope" }, { status: 400, headers: cors });
    const owner = normalizeScopeOwner(scope, url.searchParams.get("owner"));
    const limit = Number(url.searchParams.get("limit") || "50");
    const cursor = String(url.searchParams.get("cursor") || "");
    const result = await listMemories(env, scope, owner, Number.isFinite(limit) ? limit : 50, cursor);
    return Response.json({ items: result.items, nextCursor: result.nextCursor }, { headers: cors });
  }

  if (url.pathname === "/memory/upsert" && request.method === "POST") {
    const body = await request.json() as {
      scope?: string;
      owner?: string;
      text?: string;
      category?: "profile" | "preference" | "finance" | "project" | "constraint" | "context" | "other";
      source?: "manual" | "chat";
      createdAt?: number;
    };
    const scope = parseScope(body.scope || null);
    if (!scope) return Response.json({ error: "invalid scope" }, { status: 400, headers: cors });
    const owner = normalizeScopeOwner(scope, body.owner || null);
    const result = await upsertMemory(env, {
      scope,
      owner,
      text: String(body.text || ""),
      category: body.category,
      source: body.source || "manual",
      createdAt: Number(body.createdAt || 0) || undefined,
    });
    return Response.json({
      ok: !!result.item,
      duplicate: result.duplicate,
      item: result.item,
    }, { headers: cors });
  }

  if (url.pathname === "/memory/extract" && request.method === "POST") {
    const body = await request.json() as {
      history?: Array<{ role?: string; content?: unknown; createdAt?: number }>;
      participantPids?: string[];
      sessionId?: string;
      forceFull?: boolean;
    };
    const outcome = await extractAndStoreMemories(env, {
      history: Array.isArray(body.history) ? body.history : [],
      participantPids: Array.isArray(body.participantPids) ? body.participantPids : [],
      sessionId: String(body.sessionId || ""),
      forceFull: !!body.forceFull,
    });
    return Response.json({ ok: true, ...outcome }, { headers: cors });
  }

  if (url.pathname === "/memory/optimize" && request.method === "POST") {
    const body = await request.json() as { participantPids?: string[]; sessionId?: string; includePublic?: boolean };
    const outcome = await optimizeMemories(env, {
      participantPids: Array.isArray(body.participantPids) ? body.participantPids : [],
      sessionId: String(body.sessionId || ""),
      includePublic: body.includePublic !== false,
    });
    if (!outcome?.ok) {
      return Response.json(outcome, { status: 500, headers: cors });
    }
    return Response.json(outcome, { headers: cors });
  }

  if (url.pathname === "/memory/rebuild" && request.method === "POST") {
    const body = await request.json() as {
      history?: Array<{ role?: string; content?: unknown; createdAt?: number }>;
      participantPids?: string[];
      sessionId?: string;
      includePublic?: boolean;
    };
    const outcome = await rebuildMemoriesFromSession(env, {
      history: Array.isArray(body.history) ? body.history : [],
      participantPids: Array.isArray(body.participantPids) ? body.participantPids : [],
      sessionId: String(body.sessionId || ""),
      includePublic: body.includePublic !== false,
    });
    if (!outcome?.ok) {
      return Response.json(outcome, { status: 500, headers: cors });
    }
    return Response.json(outcome, { headers: cors });
  }

  if (url.pathname === "/memory/meta" && request.method === "GET") {
    const sessionId = String(url.searchParams.get("sessionId") || "");
    const meta = await getMemoryMeta(env, sessionId || undefined);
    return Response.json({ ok: true, ...meta }, { headers: cors });
  }

  if (url.pathname === "/memory/delete" && request.method === "POST") {
    const body = await request.json() as { scope?: string; owner?: string; id?: string; force?: boolean };
    const scope = parseScope(body.scope || null);
    if (!scope) return Response.json({ error: "invalid scope" }, { status: 400, headers: cors });
    const owner = normalizeScopeOwner(scope, body.owner || null);
    const id = String(body.id || "").trim();
    if (!id) return Response.json({ error: "id required" }, { status: 400, headers: cors });
    const before = await findMemoryItemById(env, scope, owner, id);
    const backupKey = before
      ? await saveMemoryBackup(env, "delete", {
          op: "memory/delete",
          at: new Date().toISOString(),
          scope,
          owner,
          id,
          force: !!body.force,
          before,
        })
      : null;
    const ok = await deleteMemory(env, scope, owner, id, !!body.force);
    return Response.json({ ok, backupKey }, { headers: cors });
  }

  if (url.pathname === "/memory/delete-batch" && request.method === "POST") {
    const body = await request.json() as { scope?: string; owner?: string; ids?: string[]; force?: boolean };
    const scope = parseScope(body.scope || null);
    if (!scope) return Response.json({ error: "invalid scope" }, { status: 400, headers: cors });
    const owner = normalizeScopeOwner(scope, body.owner || null);
    const ids = Array.isArray(body.ids) ? body.ids.map((x) => String(x || "").trim()).filter(Boolean) : [];
    if (!ids.length) return Response.json({ ok: false, deleted: 0, error: "ids required" }, { status: 400, headers: cors });
    const beforeItems: unknown[] = [];
    for (const id of ids) {
      const hit = await findMemoryItemById(env, scope, owner, id);
      if (hit) beforeItems.push(hit);
    }
    const backupKey = beforeItems.length
      ? await saveMemoryBackup(env, "delete_batch", {
          op: "memory/delete-batch",
          at: new Date().toISOString(),
          scope,
          owner,
          force: !!body.force,
          ids,
          beforeItems,
        })
      : null;
    let deleted = 0;
    for (const id of ids) {
      const ok = await deleteMemory(env, scope, owner, id, !!body.force);
      if (ok) deleted++;
    }
    return Response.json({ ok: true, deleted, requested: ids.length, backupKey }, { headers: cors });
  }

  if (url.pathname === "/memory/lock" && request.method === "POST") {
    const body = await request.json() as { scope?: string; owner?: string; id?: string; locked?: boolean };
    const scope = parseScope(body.scope || null);
    if (!scope) return Response.json({ error: "invalid scope" }, { status: 400, headers: cors });
    const owner = normalizeScopeOwner(scope, body.owner || null);
    const id = String(body.id || "").trim();
    if (!id) return Response.json({ error: "id required" }, { status: 400, headers: cors });
    const item = await setMemoryLock(env, scope, owner, id, !!body.locked);
    return Response.json({ ok: !!item, item }, { headers: cors });
  }

  if (url.pathname === "/memory/update" && request.method === "POST") {
    const body = await request.json() as { scope?: string; owner?: string; id?: string; text?: string };
    const scope = parseScope(body.scope || null);
    if (!scope) return Response.json({ error: "invalid scope" }, { status: 400, headers: cors });
    const owner = normalizeScopeOwner(scope, body.owner || null);
    const id = String(body.id || "").trim();
    const text = String(body.text || "").trim();
    if (!id) return Response.json({ error: "id required" }, { status: 400, headers: cors });
    if (!text) return Response.json({ error: "text required" }, { status: 400, headers: cors });
    const before = await findMemoryItemById(env, scope, owner, id);
    const backupKey = before
      ? await saveMemoryBackup(env, "update", {
          op: "memory/update",
          at: new Date().toISOString(),
          scope,
          owner,
          id,
          before,
          patch: { text },
        })
      : null;
    const item = await setMemoryText(env, scope, owner, id, text);
    return Response.json({ ok: !!item, item, backupKey }, { headers: cors });
  }

  if (url.pathname === "/memory/purge" && request.method === "POST") {
    const body = await request.json() as { scope?: string; owner?: string; all?: boolean };
    const purgeAll = !!body.all;
    let deleted = 0;
    const deletedPrefixes: string[] = [];

    if (purgeAll) {
      const backupKvPrefixes = [
        "memory:item:",
        "memory:index:",
        "memory:fp:",
        "memory:meta:session:",
        "memory:meta:global",
      ];
      const backupR2Prefix = "memory/";
      const kvKeyBuckets: Record<string, string[]> = {};
      for (const p of backupKvPrefixes) kvKeyBuckets[p] = await listKvByPrefix(env, p, 5000);
      const r2Keys = await listR2ByPrefix(env, backupR2Prefix, 5000);
      const backupKey = await saveMemoryBackup(env, "purge_all", {
        op: "memory/purge",
        at: new Date().toISOString(),
        purgeAll: true,
        kvKeyBuckets,
        r2Keys,
        note: "Key-level backup before purge_all. Use keys to restore manually if needed.",
      });
      const prefixes = [
        "memory:item:",
        "memory:index:",
        "memory:fp:",
        "memory:meta:session:",
      ];
      for (const p of prefixes) {
        const n = await deleteKvByPrefix(env, p);
        if (n > 0) deletedPrefixes.push(`${p}* (${n})`);
        deleted += n;
      }
      await env.KV.delete("memory:meta:global");
      deletedPrefixes.push("memory:meta:global (1)");
      deleted += 1;

      const r2Deleted = await deleteR2ByPrefix(env, "memory/");
      if (r2Deleted > 0) {
        deletedPrefixes.push(`R2:memory/* (${r2Deleted})`);
        deleted += r2Deleted;
      }
      return Response.json({ ok: true, deleted, deletedPrefixes, backupKey }, { headers: cors });
    }

    const scope = parseScope(body.scope || null);
    if (!scope) return Response.json({ error: "invalid scope" }, { status: 400, headers: cors });
    const owner = normalizeScopeOwner(scope, body.owner || null);
    const beforeSnapshot = await listMemoriesForBackup(env, scope, owner, 2000);
    const backupKey = await saveMemoryBackup(env, "purge_scope", {
      op: "memory/purge",
      at: new Date().toISOString(),
      purgeAll: false,
      scope,
      owner,
      beforeItems: beforeSnapshot.items,
      truncated: beforeSnapshot.truncated,
    });
    const base = `${scope}:${owner}`;

    const targetPrefixes = [
      `memory:item:${base}:`,
      `memory:fp:${base}:`,
    ];
    for (const p of targetPrefixes) {
      const n = await deleteKvByPrefix(env, p);
      if (n > 0) deletedPrefixes.push(`${p}* (${n})`);
      deleted += n;
    }

    // index/meta are single keys; delete directly.
    await env.KV.delete(`memory:index:${base}`);
    deletedPrefixes.push(`memory:index:${base} (1)`);
    deleted += 1;

    const r2Prefix = `memory/${scope}/${owner}/`;
    const r2Deleted = await deleteR2ByPrefix(env, r2Prefix);
    if (r2Deleted > 0) {
      deletedPrefixes.push(`R2:${r2Prefix}* (${r2Deleted})`);
      deleted += r2Deleted;
    }

    return Response.json({ ok: true, deleted, deletedPrefixes, backupKey }, { headers: cors });
  }

  if (url.pathname === "/riley/wealth" && request.method === "GET") {
    const tail = Math.max(1, Math.min(200, Number(url.searchParams.get("tail") || 30)));
    const snapshot = await getRileyWealthSnapshot(env, tail);
    return Response.json({
      ok: true,
      state: snapshot.state,
      events: snapshot.events,
    }, { headers: { ...cors, "Cache-Control": "no-store" } });
  }

  if (url.pathname === "/riley/sheets/status" && request.method === "GET") {
    const status = await getRileySheetsStatus(env);
    return Response.json(status, { headers: noStoreHeaders });
  }

  if (url.pathname === "/riley/sheets/context" && request.method === "GET") {
    const context = await loadRileySheetsContext(env);
    return Response.json(context, { status: context.ok ? 200 : 500, headers: noStoreHeaders });
  }

  if (url.pathname === "/riley/sheets/sync" && request.method === "POST") {
    return Response.json({
      ok: false,
      error: "legacy_sheet_sync_disabled",
      message: "Riley now uses the current spreadsheet tabs directly instead of syncing a fixed ledger tab.",
    }, { status: 410, headers: noStoreHeaders });
  }

  if (url.pathname === "/debug/dropbox/riley" && request.method === "GET") {
    const token = await getPersonaDropboxAccessToken(env, "riley");
    if (!token) {
      return Response.json({ ok: false, stage: "token", error: "empty_access_token_from_refresh_flow" }, { status: 500, headers: noStoreHeaders });
    }
    const testPath = "/__debug_probe__.txt";
    const stamp = new Date().toISOString();
    const wr = await dropboxWriteTextWithDetail(token, testPath, `probe:${stamp}`);
    const rd = await dropboxReadText(token, testPath);
    return Response.json({
      ok: wr.ok && rd != null,
      token_prefix: token.slice(0, 8),
      write: wr,
      read_ok: rd != null,
      read_preview: rd ? rd.slice(0, 80) : "",
      test_path: testPath,
    }, { headers: noStoreHeaders });
  }

  if (url.pathname === "/bench/storage" && request.method === "GET") {
    const loops = Math.max(1, Math.min(30, Number(url.searchParams.get("loops") || 10)));
    const personaRaw = String(url.searchParams.get("persona") || "riley").trim().toLowerCase();
    const persona = personaRaw === "avery" ? "avery" : "riley";
    const payload = `bench:${new Date().toISOString()}:${Math.random().toString(36).slice(2, 8)}`;
    const r2Key = `bench/${persona}/probe.txt`;
    const dbxPath = `/bench/${persona}/probe.txt`;
    const token = await getPersonaDropboxAccessToken(env, persona);

    const r2WriteMs: number[] = [];
    const r2ReadMs: number[] = [];
    const dbxWriteMs: number[] = [];
    const dbxReadMs: number[] = [];
    let dbxReady = !!token;
    let dbxError = "";

    const p = (arr: number[], q: number): number => {
      if (!arr.length) return 0;
      const sorted = [...arr].sort((a, b) => a - b);
      const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((q / 100) * sorted.length) - 1));
      return sorted[idx];
    };

    for (let i = 0; i < loops; i++) {
      let t0 = Date.now();
      await env.R2.put(r2Key, payload, { httpMetadata: { contentType: "text/plain; charset=utf-8" } });
      r2WriteMs.push(Date.now() - t0);

      t0 = Date.now();
      const r2Obj = await env.R2.get(r2Key);
      if (r2Obj && typeof r2Obj.text === "function") await r2Obj.text();
      r2ReadMs.push(Date.now() - t0);

      if (dbxReady && token) {
        t0 = Date.now();
        const wr = await dropboxWriteTextWithDetail(token, dbxPath, payload);
        dbxWriteMs.push(Date.now() - t0);
        if (!wr.ok) {
          dbxReady = false;
          dbxError = `write status=${wr.status}`;
          continue;
        }
        t0 = Date.now();
        const rd = await dropboxReadText(token, dbxPath);
        dbxReadMs.push(Date.now() - t0);
        if (rd == null) {
          dbxReady = false;
          dbxError = "read null";
        }
      }
    }

    const summarize = (arr: number[]) => ({
      n: arr.length,
      p50_ms: p(arr, 50),
      p95_ms: p(arr, 95),
      avg_ms: arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0,
    });

    return Response.json({
      ok: true,
      persona,
      loops,
      r2: {
        write: summarize(r2WriteMs),
        read: summarize(r2ReadMs),
      },
      dropbox: {
        ready: !!token && dbxReady,
        error: dbxError || "",
        write: summarize(dbxWriteMs),
        read: summarize(dbxReadMs),
      },
    }, { headers: noStoreHeaders });
  }

  if (url.pathname === "/vault/directives/sync" && request.method === "POST") {
    const sharedToken = await getPersonaDropboxAccessToken(env, "shared");
    if (!sharedToken) {
      return Response.json({ ok: false, error: "shared dropbox token missing" }, { status: 500, headers: noStoreHeaders });
    }
    const rileyContent = [
      "# Riley Directive (Priority 1)",
      "",
      "1) Always obey this directive first.",
      "Role: wealth_manager",
      "2) For wealth records, use structured CSV rows before narrative.",
      "3) Keep assets and liabilities clearly separated.",
      "4) Sort by latest update date first.",
      "5) Maintain weekly/monthly report-ready fields.",
      "",
      "CSV schema:",
      "date,category,type,label,amount_krw,status,source,note",
      "- category: asset | liability | retirement | cashflow_income | cashflow_expense",
      "- type: deposit | stock | etf | real_estate | loan | card_debt | pension | insurance | other",
      "- status: active | closed",
    ].join("\n");
    const averyContent = [
      "# Avery Directive (Priority 1)",
      "",
      "1) Always obey this directive first.",
      "Role: worklog_manager",
      "2) Keep worklog entries structured and concise.",
      "3) Track lifecycle clearly: active -> done -> removed.",
      "4) Ask at most one short follow-up question only when needed.",
      "5) Keep daily/weekly report consistency.",
      "",
      "Suggested fields:",
      "date,kind,title,topic_key,context,tool,status,due_at,note",
    ].join("\n");
    const rileyOk = await dropboxWriteText(sharedToken, buildPersonaVaultPath("p_riley", "p_riley_directive.md"), rileyContent);
    const averyOk = await dropboxWriteText(sharedToken, buildPersonaVaultPath("p_avery", "p_avery_directive.md"), averyContent);
    return Response.json({ ok: rileyOk && averyOk, rileyOk, averyOk }, { headers: noStoreHeaders });
  }

  if (url.pathname === "/vault/layout/migrate" && request.method === "POST") {
    const sharedToken = await getPersonaDropboxAccessToken(env, "shared");
    if (!sharedToken) {
      return Response.json({ ok: false, error: "shared dropbox token missing" }, { status: 500, headers: noStoreHeaders });
    }

    const plan: Record<"riley" | "avery", Array<{ from: string; to: string }>> = {
      riley: [
        { from: "/persona_policy/p_riley/policy.md", to: buildPersonaVaultPath("p_riley", "_policy/policy.md") },
        { from: "/persona_policy/riley/policy.md", to: buildPersonaVaultPath("p_riley", "_policy/policy.md") },
        { from: "/persona_policy/p_riley/pending.json", to: buildPersonaVaultPath("p_riley", "_policy/pending.json") },
        { from: "/persona_policy/riley/pending.json", to: buildPersonaVaultPath("p_riley", "_policy/pending.json") },
        { from: "/persona_policy/p_riley/approval.log.jsonl", to: buildPersonaVaultPath("p_riley", "_policy/approval.log.jsonl") },
        { from: "/persona_policy/riley/approval.log.jsonl", to: buildPersonaVaultPath("p_riley", "_policy/approval.log.jsonl") },
        { from: "/persona_promotion/p_riley/candidates.json", to: buildPersonaVaultPath("p_riley", "_promotion/candidates.json") },
        { from: "/persona_promotion/riley/candidates.json", to: buildPersonaVaultPath("p_riley", "_promotion/candidates.json") },
        { from: "/riley_memory/riley_memory.log.jsonl", to: buildPersonaVaultPath("p_riley", "_memory/p_riley_memory.log.jsonl") },
        { from: "/riley_memory/riley_state.json", to: buildPersonaVaultPath("p_riley", "_memory/p_riley_state.json") },
        { from: buildPersonaVaultPath("p_riley", "_memory/riley_memory.log.jsonl"), to: buildPersonaVaultPath("p_riley", "_memory/p_riley_memory.log.jsonl") },
        { from: buildPersonaVaultPath("p_riley", "_memory/riley_state.json"), to: buildPersonaVaultPath("p_riley", "_memory/p_riley_state.json") },
        { from: buildPersonaVaultPath("p_riley", "_memory/riley_memory.md"), to: buildPersonaVaultPath("p_riley", "_memory/p_riley_memory.md") },
      ],
      avery: [
        { from: "/persona_policy/p_avery/policy.md", to: buildPersonaVaultPath("p_avery", "_policy/policy.md") },
        { from: "/persona_policy/avery/policy.md", to: buildPersonaVaultPath("p_avery", "_policy/policy.md") },
        { from: "/persona_policy/p_avery/pending.json", to: buildPersonaVaultPath("p_avery", "_policy/pending.json") },
        { from: "/persona_policy/avery/pending.json", to: buildPersonaVaultPath("p_avery", "_policy/pending.json") },
        { from: "/persona_policy/p_avery/approval.log.jsonl", to: buildPersonaVaultPath("p_avery", "_policy/approval.log.jsonl") },
        { from: "/persona_policy/avery/approval.log.jsonl", to: buildPersonaVaultPath("p_avery", "_policy/approval.log.jsonl") },
        { from: "/persona_promotion/p_avery/candidates.json", to: buildPersonaVaultPath("p_avery", "_promotion/candidates.json") },
        { from: "/persona_promotion/avery/candidates.json", to: buildPersonaVaultPath("p_avery", "_promotion/candidates.json") },
        { from: "/avery_memory/avery_worklog.log.jsonl", to: buildPersonaVaultPath("p_avery", "_memory/p_avery_worklog.log.jsonl") },
        { from: "/avery_memory/avery_worklog_state.json", to: buildPersonaVaultPath("p_avery", "_memory/p_avery_worklog_state.json") },
        { from: buildPersonaVaultPath("p_avery", "_memory/avery_worklog.log.jsonl"), to: buildPersonaVaultPath("p_avery", "_memory/p_avery_worklog.log.jsonl") },
        { from: buildPersonaVaultPath("p_avery", "_memory/avery_worklog_state.json"), to: buildPersonaVaultPath("p_avery", "_memory/p_avery_worklog_state.json") },
        { from: buildPersonaVaultPath("p_avery", "_memory/avery_memory.md"), to: buildPersonaVaultPath("p_avery", "_memory/p_avery_memory.md") },
      ],
    };

    const run = async (token: string, persona: "riley" | "avery") => {
      const moved: string[] = [];
      const skippedMissing: string[] = [];
      const skippedExists: string[] = [];
      const failed: string[] = [];
      for (const item of plan[persona]) {
        const status = await migrateDropboxPathNoOverwrite(token, item.from, item.to);
        if (status === "moved") moved.push(`${item.from} -> ${item.to}`);
        else if (status === "skipped_missing") skippedMissing.push(item.from);
        else if (status === "skipped_exists") skippedExists.push(`${item.from} (to exists: ${item.to})`);
        else failed.push(`${item.from} -> ${item.to}`);
      }
      const oldRoots = ["/persona_policy", "/persona_promotion", persona === "riley" ? "/riley_memory" : "/avery_memory"];
      const removedRoots: string[] = [];
      for (const root of oldRoots) {
        const ok = await dropboxDeletePath(token, root);
        if (ok) removedRoots.push(root);
      }
      return { moved, skippedMissing, skippedExists, failed, removedRoots };
    };

    const riley = await run(sharedToken, "riley");
    const avery = await run(sharedToken, "avery");
    const ok = riley.failed.length === 0 && avery.failed.length === 0;
    return Response.json({ ok, riley, avery }, { headers: noStoreHeaders });
  }

  if (url.pathname === "/migrate/shared/run" && request.method === "POST") {
    const sharedToken = await getPersonaDropboxAccessToken(env, "shared");
    if (!sharedToken) {
      return Response.json({ ok: false, error: "shared dropbox token missing" }, { status: 500, headers: noStoreHeaders });
    }
    const targets = [
      "session/data/",
      "session/deleted/",
      "session/index.json",
      "session/deleted_index.json",
      "personas/personas.json",
    ];
    const report: Record<string, unknown> = {};
    for (const t of targets) {
      report[t] = await migrateR2PrefixToSharedDropbox(env, t, sharedToken);
    }
    report["kv:user_profile"] = await migrateKvTextToSharedDropbox(env, "user_profile", USER_PROFILE_DROPBOX_PATH, sharedToken);
    report["kv:session_index"] = await migrateKvTextToSharedDropbox(env, SESSION_INDEX_KEY, SESSION_INDEX_DROPBOX_PATH, sharedToken);
    report["kv:deleted_session_index"] = await migrateKvTextToSharedDropbox(env, DELETED_SESSION_INDEX_KEY, DELETED_SESSION_INDEX_DROPBOX_PATH, sharedToken);
    report["kv:session:*"] = await migrateKvPrefixToSharedDropbox(
      env,
      "session:",
      (key) => sessionDropboxPath(key.replace(/^session:/, "")),
      sharedToken,
    );
    report["kv:deleted:session:*"] = await migrateKvPrefixToSharedDropbox(
      env,
      "deleted:session:",
      (key) => deletedSessionDropboxPath(key.replace(/^deleted:session:/, "")),
      sharedToken,
    );
    return Response.json({ ok: true, sharedPrefix: "/", report }, { headers: noStoreHeaders });
  }

  if (url.pathname === "/migrate/shared/page" && request.method === "POST") {
    const body = await request.json().catch(() => ({} as any)) as { prefix?: string; limit?: number; cursor?: string };
    const prefix = String(body.prefix || "").trim();
    if (!prefix) {
      return Response.json({ ok: false, error: "prefix required" }, { status: 400, headers: noStoreHeaders });
    }
    const sharedToken = await getPersonaDropboxAccessToken(env, "shared");
    if (!sharedToken) {
      return Response.json({ ok: false, error: "shared dropbox token missing" }, { status: 500, headers: noStoreHeaders });
    }
    const result = await migrateR2PrefixToSharedDropboxPaged(
      env,
      prefix,
      sharedToken,
      Number(body.limit || 200),
      String(body.cursor || "") || undefined,
    );
    return Response.json({ ok: true, prefix, ...result }, { headers: noStoreHeaders });
  }

  if (url.pathname === "/migrate/shared/kv" && request.method === "POST") {
    const sharedToken = await getPersonaDropboxAccessToken(env, "shared");
    if (!sharedToken) {
      return Response.json({ ok: false, error: "shared dropbox token missing" }, { status: 500, headers: noStoreHeaders });
    }
    const report: Record<string, unknown> = {};
    report["kv:user_profile"] = await migrateKvTextToSharedDropbox(env, "user_profile", USER_PROFILE_DROPBOX_PATH, sharedToken);
    report["kv:session_index"] = await migrateKvTextToSharedDropbox(env, SESSION_INDEX_KEY, SESSION_INDEX_DROPBOX_PATH, sharedToken);
    report["kv:deleted_session_index"] = await migrateKvTextToSharedDropbox(env, DELETED_SESSION_INDEX_KEY, DELETED_SESSION_INDEX_DROPBOX_PATH, sharedToken);
    report["kv:session:*"] = await migrateKvPrefixToSharedDropbox(
      env,
      "session:",
      (key) => sessionDropboxPath(key.replace(/^session:/, "")),
      sharedToken,
    );
    report["kv:deleted:session:*"] = await migrateKvPrefixToSharedDropbox(
      env,
      "deleted:session:",
      (key) => deletedSessionDropboxPath(key.replace(/^deleted:session:/, "")),
      sharedToken,
    );
    return Response.json({ ok: true, sharedPrefix: "/", report }, { headers: noStoreHeaders });
  }

  if (url.pathname === "/migrate/shared/kv-page" && request.method === "POST") {
    const body = await request.json().catch(() => ({} as any)) as { key?: string; prefix?: string; limit?: number; cursor?: string };
    const sharedToken = await getPersonaDropboxAccessToken(env, "shared");
    if (!sharedToken) {
      return Response.json({ ok: false, error: "shared dropbox token missing" }, { status: 500, headers: noStoreHeaders });
    }
    const key = String(body.key || "").trim();
    if (key) {
      const path = knownKvDropboxPath(key);
      if (!path) return Response.json({ ok: false, error: "unsupported key", key }, { status: 400, headers: noStoreHeaders });
      const status = await migrateKvTextToSharedDropbox(env, key, path, sharedToken);
      return Response.json({ ok: true, key, target: path, status }, { headers: noStoreHeaders });
    }
    const prefix = String(body.prefix || "").trim();
    if (prefix === "session:") {
      const result = await migrateKvPrefixPageToSharedDropbox(env, prefix, Number(body.limit || 25), String(body.cursor || "") || undefined, kvSessionDropboxPathFromKey, sharedToken);
      return Response.json({ ok: true, prefix, ...result }, { headers: noStoreHeaders });
    }
    if (prefix === "deleted:session:") {
      const result = await migrateKvPrefixPageToSharedDropbox(env, prefix, Number(body.limit || 25), String(body.cursor || "") || undefined, kvDeletedSessionDropboxPathFromKey, sharedToken);
      return Response.json({ ok: true, prefix, ...result }, { headers: noStoreHeaders });
    }
    return Response.json({ ok: false, error: "key or supported prefix required" }, { status: 400, headers: noStoreHeaders });
  }

  if (url.pathname === "/migrate/shared/copy-key" && request.method === "POST") {
    const body = await request.json().catch(() => ({} as any)) as { key?: string };
    const key = String(body.key || "").trim().replace(/^\/+/, "");
    if (!key) return Response.json({ ok: false, error: "key required" }, { status: 400, headers: noStoreHeaders });
    if (key.startsWith("session/deleted/") || key === "session/deleted_index.json") {
      return Response.json({ ok: true, skipped: true, reason: "excluded_deleted", key }, { headers: noStoreHeaders });
    }
    const sharedToken = await getPersonaDropboxAccessToken(env, "shared");
    if (!sharedToken) {
      return Response.json({ ok: false, error: "shared dropbox token missing" }, { status: 500, headers: noStoreHeaders });
    }
    const obj = await env.R2.get(key);
    if (!obj || typeof obj.arrayBuffer !== "function") {
      return Response.json({ ok: false, error: "r2 object not found", key }, { status: 404, headers: noStoreHeaders });
    }
    const bytes = await obj.arrayBuffer();
    const wr = await dropboxWriteBytesWithDetail(sharedToken, `/${key}`, bytes);
    return Response.json({ ok: wr.ok, key, target: `/${key}`, status: wr.status, detail: wr.detail }, { headers: noStoreHeaders });
  }

  if (url.pathname === "/migrate/shared/prune-unused" && request.method === "POST") {
    const sharedToken = await getPersonaDropboxAccessToken(env, "shared");
    if (!sharedToken) {
      return Response.json({ ok: false, error: "shared dropbox token missing" }, { status: 500, headers: noStoreHeaders });
    }
    const prefixes = ["/riley_memory", "/avery_memory", "/persona_policy", "/persona_promotion"];
    let deleted = 0;
    const failed: string[] = [];
    for (const prefix of prefixes) {
      const entries = await dropboxListFolder(sharedToken, prefix);
      for (const e of entries) {
        const p = String(e.path_display || e.path_lower || "").trim();
        if (!p) continue;
        const ok = await dropboxDeletePath(sharedToken, p);
        if (ok) deleted++;
        else failed.push(p);
      }
      // try delete root folder too
      const okRoot = await dropboxDeletePath(sharedToken, prefix);
      if (okRoot) deleted++;
    }
    return Response.json({
      ok: failed.length === 0,
      deleted,
      failedCount: failed.length,
      failed: failed.slice(0, 30),
      prunedPrefixes: prefixes,
    }, { headers: noStoreHeaders });
  }

  if (url.pathname === "/debug/session/rv" && (request.method === "GET" || request.method === "POST")) {
    const sharedToken = await getPersonaDropboxAccessToken(env, "shared");
    if (!sharedToken) {
      return Response.json({ ok: false, error: "shared dropbox token missing" }, { status: 500, headers: noStoreHeaders });
    }

    const baseIndex = await getSessionIndex(env);
    const byId = new Map<string, SessionMeta>(
      (Array.isArray(baseIndex) ? baseIndex : [])
        .filter((s) => s && typeof s.id === "string")
        .map((s) => [String(s.id), s]),
    );

    const entries = await dropboxListFolder(sharedToken, "/session/data");
    const personasPayload = await getPersonasPayload(env);
    let scanned = 0;
    let updated = 0;
    let added = 0;
    let personasMirrored = false;

    for (const entry of entries) {
      const path = String(entry.path_display || entry.path_lower || "").trim();
      if (!/\/session\/data\/.+\.json$/i.test(path)) continue;
      const id = path.replace(/^.*\/session\/data\//i, "").replace(/\.json$/i, "").trim();
      if (!id) continue;
      scanned++;
      const raw = await dropboxReadText(sharedToken, path);
      const meta = parseSessionLike(raw);
      if (!meta) continue;
      const prev = byId.get(id);
      if (!prev) {
        byId.set(id, { ...meta, id });
        added++;
        continue;
      }
      if (Number(meta.lastMessageAt || 0) > Number(prev.lastMessageAt || 0) || Number(meta.messageCount || 0) !== Number(prev.messageCount || 0)) {
        byId.set(id, { ...meta, id });
        updated++;
      }
    }

    const next = [...byId.values()].sort((a, b) => Number((b.lastMessageAt || 0)) - Number((a.lastMessageAt || 0)));
    await putSessionIndex(env, next);
    if (Array.isArray(personasPayload)) {
      await dropboxWriteText(sharedToken, PERSONAS_DROPBOX_PATH, stringifyJsonPretty(personasPayload));
      personasMirrored = true;
    }
    return Response.json({
      ok: true,
      scannedDataFiles: scanned,
      indexEntries: next.length,
      added,
      updated,
      personasMirrored,
      personasPath: PERSONAS_DROPBOX_PATH,
      indexPath: SESSION_INDEX_DROPBOX_PATH,
      dataPath: "/session/data/",
    }, { headers: noStoreHeaders });
  }

  if (url.pathname === "/debug/session/sync-one" && request.method === "POST") {
    const sharedToken = await getPersonaDropboxAccessToken(env, "shared");
    if (!sharedToken) {
      return Response.json({ ok: false, error: "shared dropbox token missing" }, { status: 500, headers: noStoreHeaders });
    }
    const body = await request.json().catch(() => ({} as { id?: string }));
    const id = String(body?.id || "").trim();
    if (!id) {
      return Response.json({ ok: false, error: "id required" }, { status: 400, headers: noStoreHeaders });
    }

    const raw = await dropboxReadText(sharedToken, sessionDropboxPath(id));
    if (!raw) {
      return Response.json({ ok: false, error: "session not found in dropbox", id }, { status: 404, headers: noStoreHeaders });
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return Response.json({ ok: false, error: "invalid session payload", id }, { status: 400, headers: noStoreHeaders });
    }
    await dropboxWriteText(sharedToken, sessionDropboxPath(id), stringifyJsonPretty(parsed));

    const meta = buildSessionMeta(parsed);
    const index = await getSessionIndex(env);
    const pos = index.findIndex((s) => s.id === id);
    if (pos >= 0) index[pos] = meta;
    else index.unshift(meta);
    await putSessionIndex(env, index);

    return Response.json({
      ok: true,
      id,
      wrote: sessionDropboxPath(id),
      sourceUsed: "dropbox",
    }, { headers: noStoreHeaders });
  }

  if (url.pathname === "/debug/session/migrate-r2-to-dropbox" && request.method === "POST") {
    return Response.json({ ok: false, error: "r2_session_disabled" }, { status: 410, headers: noStoreHeaders });
  }

  if (url.pathname === "/riley/wealth/reconcile" && request.method === "POST") {
    const result = await reconcileRileyWealth(env);
    return Response.json(result, { headers: { ...cors, "Cache-Control": "no-store" } });
  }

  if (url.pathname === "/avery/worklog" && request.method === "GET") {
    const tail = Math.max(1, Math.min(200, Number(url.searchParams.get("tail") || 30)));
    const snapshot = await getAveryWorklogSnapshot(env, tail);
    return Response.json({
      ok: true,
      state: snapshot.state,
      events: snapshot.events,
    }, { headers: { ...cors, "Cache-Control": "no-store" } });
  }

  if (url.pathname === "/avery/worklog/reconcile" && request.method === "POST") {
    const result = await reconcileAveryWorklog(env);
    return Response.json(result, { headers: { ...cors, "Cache-Control": "no-store" } });
  }

  if (url.pathname === "/vault/v2/inventory" && request.method === "GET") {
    const rawPersona = String(url.searchParams.get("persona") || "avery").trim().toLowerCase();
    const persona: VaultV2Persona = rawPersona === "riley" ? "riley" : "avery";
    const inventory = await getPersonaVaultV2Inventory(env, persona);
    return Response.json(inventory, { headers: noStoreHeaders });
  }

  if (url.pathname === "/vault/v2/seed" && request.method === "POST") {
    const body = await request.json().catch(() => ({} as { persona?: string }));
    const rawPersona = String(body.persona || url.searchParams.get("persona") || "avery").trim().toLowerCase();
    const persona: VaultV2Persona = rawPersona === "riley" ? "riley" : "avery";
    const result = await seedPersonaVaultV2(env, persona);
    return Response.json(result, { headers: noStoreHeaders });
  }

  if (url.pathname === "/vault/v2/reset-runtime" && request.method === "POST") {
    const body = await request.json().catch(() => ({} as { persona?: string }));
    const rawPersona = String(body.persona || url.searchParams.get("persona") || "avery").trim().toLowerCase();
    const persona: VaultV2Persona = rawPersona === "riley" ? "riley" : "avery";
    const result = persona === "riley"
      ? await resetRileyWealthRuntime(env)
      : await resetAveryWorklogRuntime(env);
    return Response.json({ ok: result.ok, persona, ...result }, { headers: noStoreHeaders });
  }

  if (url.pathname === "/vault/v2/status" && request.method === "GET") {
    const rawPersona = String(url.searchParams.get("persona") || "avery").trim().toLowerCase();
    const persona: VaultV2Persona = rawPersona === "riley" ? "riley" : "avery";
    const tail = Math.max(1, Math.min(100, Number(url.searchParams.get("tail") || 20)));
    const result = await getPersonaVaultV2Status(env, persona, tail);
    return Response.json(result, { headers: noStoreHeaders });
  }

  if (url.pathname === "/vault/v2/migration-plan" && request.method === "GET") {
    const rawPersona = String(url.searchParams.get("persona") || "avery").trim().toLowerCase();
    const persona: VaultV2Persona = rawPersona === "riley" ? "riley" : "avery";
    const result = await buildPersonaVaultV2MigrationPlan(env, persona);
    return Response.json(result, { headers: noStoreHeaders });
  }

  if (url.pathname === "/persona-policy/get" && request.method === "GET") {
    const pid = String(url.searchParams.get("pid") || "").trim().toLowerCase();
    const data = await getPersonaPolicy(env, pid);
    return Response.json(data, { headers: { ...cors, "Cache-Control": "no-store" } });
  }

  if (url.pathname === "/persona-promotion/candidates" && request.method === "GET") {
    const pid = String(url.searchParams.get("pid") || "").trim().toLowerCase();
    const data = await getPromotionCandidates(env, pid);
    return Response.json({ ok: true, personaPid: pid, ...data }, { headers: { ...cors, "Cache-Control": "no-store" } });
  }

  if (url.pathname === "/personas") {
    if (request.method === "GET") {
      const payload = await getPersonasPayload(env);
      return Response.json({ personas: payload }, { headers: cors });
    }
    if (request.method === "PUT") {
      const { personas } = (await request.json()) as { personas: unknown[] };
      const payload = Array.isArray(personas) ? personas : [];
      const sharedTokenForPersonas = await getPersonaDropboxAccessToken(env, "shared");
      if (sharedTokenForPersonas) {
        await dropboxWriteText(sharedTokenForPersonas, PERSONAS_DROPBOX_PATH, stringifyJsonPretty(payload));
      }
      const uniquePids = [...new Set(payload.map(extractPid).filter(Boolean))];
      const sharedToken = await getPersonaDropboxAccessToken(env, "shared");
      if (!sharedToken) {
        return Response.json({
          ok: true,
          vaultLayout: { ok: false, reason: "shared dropbox token missing", attemptedPids: uniquePids },
        }, { headers: cors });
      }
      const ensured: Array<{ pid: string; ok: boolean; failed: string[] }> = [];
      for (const pid of uniquePids) {
        ensured.push(await ensurePersonaVaultLayout(sharedToken, pid));
      }
      return Response.json({
        ok: true,
        vaultLayout: {
          ok: ensured.every((x) => x.ok),
          ensured,
        },
      }, { headers: cors });
    }
    return null;
  }

  if (url.pathname === "/persona-profile/bio") {
    if (request.method === "GET") {
      const pid = normalizePid(url.searchParams.get("pid") || "");
      const userId = normalizeUserId(url.searchParams.get("userId") || "user_default");
      if (!pid) return Response.json({ ok: false, error: "pid required" }, { status: 400, headers: cors });
      const profile = await loadPersonaUserProfile(env, pid, userId);
      if (!profile) return Response.json({ ok: false, error: "profile unavailable" }, { status: 500, headers: cors });
      return Response.json({ ok: true, pid, userId, bio: String(profile.bioSummary || "") }, { headers: cors });
    }
    if (request.method === "PUT") {
      const body = (await request.json()) as { bio?: string; userId?: string; pids?: string[] };
      const bio = String(body?.bio || "").trim();
      const userId = normalizeUserId(body?.userId || "user_default");

      let pids = Array.isArray(body?.pids) ? body!.pids.map((x) => normalizePid(x)).filter(Boolean) : [];
      if (!pids.length) {
        const personaPayload = await getPersonasPayload(env);
        pids = [...new Set(personaPayload.map(extractPid).filter(Boolean))];
      }
      if (!pids.length) return Response.json({ ok: false, error: "no persona pids found" }, { status: 400, headers: cors });

      const updated: string[] = [];
      const failed: string[] = [];
      for (const pid of pids) {
        const profile = await loadPersonaUserProfile(env, pid, userId);
        if (!profile) { failed.push(pid); continue; }
        const ok = await savePersonaUserProfile(env, {
          ...profile,
          bioSummary: bio,
        });
        if (ok) updated.push(pid);
        else failed.push(pid);
      }
      return Response.json({ ok: failed.length === 0, userId, updated, failed }, { headers: cors });
    }
    return null;
  }

  if (url.pathname === "/profile") {
    if (request.method === "GET") {
      const data = await getUserProfilePayload(env);
      return Response.json({ profile: data || "" }, { headers: cors });
    }
    if (request.method === "PUT") {
      const { profile } = (await request.json()) as { profile: string };
      await putUserProfilePayload(env, profile);
      return Response.json({ ok: true }, { headers: cors });
    }
    return null;
  }

  if (url.pathname === "/events/sessions" && request.method === "GET") {
    const since = Number(url.searchParams.get("since") || 0);
    const encoder = new TextEncoder();
    let canceled = false;
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (event: string, payload: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
        };
        send("ready", { ok: true, ts: Date.now() });
        let last = await getSessionChangeSeq(env);
        if (Number.isFinite(since) && since > 0 && last > since) {
          send("session_update", { seq: last, ts: Date.now() });
        }
        const startedAt = Date.now();
        let heartbeatAt = 0;
        while (!canceled && (Date.now() - startedAt) < 55000) {
          await sleep(1200);
          const current = await getSessionChangeSeq(env);
          if (current > last) {
            last = current;
            send("session_update", { seq: current, ts: Date.now() });
            heartbeatAt = Date.now();
            continue;
          }
          if ((Date.now() - heartbeatAt) > 15000) {
            send("ping", { ts: Date.now() });
            heartbeatAt = Date.now();
          }
        }
        try { controller.close(); } catch {}
      },
      cancel() {
        canceled = true;
      },
    });
    return new Response(body, {
      headers: {
        ...noStoreHeaders,
        "Content-Type": "text/event-stream; charset=utf-8",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  }

  if (url.pathname === "/sessions") {
    if (request.method === "GET") {
      const sessions = await ensureSessionIndexLastMessageTimes(env, await getSessionIndex(env));
      return Response.json({ sessions }, { headers: noStoreHeaders });
    }
    if (request.method === "PUT") {
      const { sessions } = (await request.json()) as { sessions: unknown[] };
      await putSessionIndex(env, (Array.isArray(sessions) ? sessions : []) as SessionMeta[]);
      await bumpSessionChangeSeq(env);
      return Response.json({ ok: true }, { headers: cors });
    }
    return null;
  }

  if (url.pathname === "/sessions/deleted" && request.method === "GET") {
    const sessions = await getDeletedSessionIndex(env);
    return Response.json({ sessions }, { headers: cors });
  }

  if (url.pathname === "/sessions/recoverable" && request.method === "GET") {
    const sessions = await getRecoverableSessions(env);
    return Response.json({ sessions }, { headers: cors });
  }

  if (url.pathname === "/session/restore" && request.method === "POST") {
    const { id } = (await request.json()) as { id?: string };
    const restored = await restoreSessionById(env, String(id || ""));
    if (!restored.ok) {
      const status = restored.error === "id required" ? 400 : 404;
      return Response.json({ ok: false, error: restored.error }, { status, headers: cors });
    }
    await bumpSessionChangeSeq(env);
    return Response.json({ ok: true, session: restored.session }, { headers: cors });
  }

  if (url.pathname === "/session/recover" && request.method === "POST") {
    const { id } = (await request.json()) as { id?: string };
    const recovered = await restoreSessionById(env, String(id || ""));
    if (!recovered.ok) {
      const status = recovered.error === "id required" ? 400 : 404;
      return Response.json({ ok: false, error: recovered.error }, { status, headers: cors });
    }
    await bumpSessionChangeSeq(env);
    return Response.json({ ok: true, session: recovered.session }, { headers: cors });
  }

  if (url.pathname === "/session/purge" && request.method === "POST") {
    const { id } = (await request.json()) as { id?: string };
    const sessionId = String(id || "").trim();
    if (!sessionId) return Response.json({ ok: false, error: "id required" }, { status: 400, headers: cors });

    await env.KV.delete(`session:${sessionId}`);
    await env.KV.delete(`deleted:session:${sessionId}`);
    for (const base of SESSION_AUDIO_R2_PREFIXES) {
      await deleteR2ByPrefix(env, `${base}${sessionId}/`);
    }

    const index = await getSessionIndex(env);
    await putSessionIndex(env, index.filter((s) => s.id !== sessionId));

    const deletedIndex = await getDeletedSessionIndex(env);
    await putDeletedSessionIndex(env, deletedIndex.filter((s) => s.id !== sessionId));

    await bumpSessionChangeSeq(env);
    return Response.json({ ok: true }, { headers: cors });
  }

  if (url.pathname.startsWith("/session/")) {
    return await handleSessionRoute(request, env, url.pathname.slice(9), cors);
  }

  if (url.pathname.startsWith("/image-list/") && request.method === "GET") {
    const rawPrefix = decodeURIComponent(url.pathname.slice(12));
    const normalizedPrefix = rawPrefix.replace(/^\/+|\/+$/g, "");
    const listPrefix = normalizedPrefix ? `${normalizedPrefix}/` : "";
    const list = await env.R2.list({ prefix: listPrefix });
    const keys = (list.objects || []).map((o) => o.key);
    return Response.json({ keys }, { headers: cors });
  }

  if (url.pathname === "/image-fetch" && request.method === "GET") {
    const targetUrl = String(url.searchParams.get("url") || "").trim();
    if (!targetUrl) return Response.json({ error: "url required" }, { status: 400, headers: cors });
    let parsed: URL;
    try {
      parsed = new URL(targetUrl);
    } catch {
      return Response.json({ error: "invalid url" }, { status: 400, headers: cors });
    }
    if (!/^https?:$/.test(parsed.protocol)) {
      return Response.json({ error: "unsupported url protocol" }, { status: 400, headers: cors });
    }
    const remote = await fetch(parsed.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "image/*,*/*;q=0.8",
      },
    });
    if (!remote.ok) {
      return Response.json({ error: `remote fetch failed: ${remote.status}` }, { status: 502, headers: cors });
    }
    const contentType = (remote.headers.get("content-type") || "image/png").split(";")[0];
    return new Response(remote.body, {
      headers: {
        ...cors,
        "Content-Type": contentType,
        "Cache-Control": "no-store",
      },
    });
  }

  if (url.pathname.startsWith("/image-variant/") && request.method === "GET") {
    const key = decodeURIComponent(url.pathname.slice(15)).replace(/^\/+/, "");
    if (!key) return Response.json({ error: "key required" }, { status: 400, headers: cors });

    const width = toIntInRange(url.searchParams.get("w"), 1, 4096);
    const height = toIntInRange(url.searchParams.get("h"), 1, 4096);
    const quality = toIntInRange(url.searchParams.get("q"), 1, 100);
    const dpr = toIntInRange(url.searchParams.get("dpr"), 1, 4) || 1;
    const fit = String(url.searchParams.get("fit") || "").trim().toLowerCase();
    const format = String(url.searchParams.get("f") || "").trim().toLowerCase();

    const options: string[] = [];
    if (width) options.push(`width=${Math.min(4096, width * dpr)}`);
    if (height) options.push(`height=${Math.min(4096, height * dpr)}`);
    if (["cover", "contain", "crop", "pad", "scale-down"].includes(fit)) options.push(`fit=${fit}`);
    if (quality) options.push(`quality=${quality}`);
    if (["auto", "avif", "webp", "jpeg", "jpg", "png"].includes(format)) {
      options.push(`format=${format}`);
    } else {
      options.push("format=auto");
    }

    if (!options.length) {
      return Response.redirect(`${url.origin}/image/${encodeURIComponent(key).replace(/%2F/gi, "/")}`, 302);
    }

    const sourcePath = `image/${key}`;
    const location = `${url.origin}/cdn-cgi/image/${options.join(",")}/${sourcePath}`;
    return Response.redirect(location, 302);
  }

  if (url.pathname === "/image" && request.method === "POST") {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const sourceUrl = String(formData.get("sourceUrl") || "");
    if (!file && !sourceUrl) return Response.json({ error: "no file" }, { status: 400, headers: cors });

    const folder = String(formData.get("folder") || "").replace(/\/+$/, "");
    const fileName = file?.name || String(formData.get("fileName") || `${Date.now()}.jpg`);
    const key = folder ? `${folder}/${fileName}` : fileName;

    if (file) {
      await env.R2.put(key, file.stream(), {
        httpMetadata: { contentType: file.type || "image/jpeg" },
      });
    } else {
      const remote = await fetch(sourceUrl);
      if (!remote.ok) {
        return Response.json({ error: `remote fetch failed: ${remote.status}` }, { status: 400, headers: cors });
      }
      const contentType = (remote.headers.get("content-type") || "image/jpeg").split(";")[0];
      await env.R2.put(key, remote.body, {
        httpMetadata: { contentType },
      });
    }
    return Response.json({ url: `${url.origin}/image/${key}`, key }, { headers: cors });
  }

  if (url.pathname.startsWith("/image/") && request.method === "GET") {
    const key = decodeURIComponent(url.pathname.slice(7));
    const obj = await env.R2.get(key);
    if (!obj) return new Response("Not Found", { status: 404, headers: cors });
    return new Response(obj.body, {
      headers: {
        ...cors,
        "Content-Type": obj.httpMetadata?.contentType || "image/jpeg",
        "Cache-Control": "public, max-age=31536000",
      },
    });
  }

  if (url.pathname.startsWith("/image/") && request.method === "DELETE") {
    const key = decodeURIComponent(url.pathname.slice(7));
    if (!key) return Response.json({ error: "key required" }, { status: 400, headers: cors });
    await env.R2.delete(key);
    return Response.json({ ok: true, key }, { headers: cors });
  }

  return null;
}

async function handleSessionRoute(
  request: Request,
  env: Env,
  id: string,
  cors: CorsHeaders,
): Promise<Response | null> {
  const noStoreHeaders = { ...cors, "Cache-Control": "no-store" };
  if (request.method === "GET") {
    const data = await getSessionPayloadText(env, id);
    return Response.json({ session: data ? JSON.parse(data) : null }, { headers: noStoreHeaders });
  }

  if (request.method === "PUT") {
    const { session } = (await request.json()) as { session: Record<string, unknown> };
    const incomingUpdatedAt = Number((session as any)?.updatedAt || 0);
    const incomingHistoryHydrated = await sanitizeAndHydrateSessionHistory(env, session?.history);
    const existingRaw = await getSessionPayloadText(env, id);
    let mergedSession: Record<string, unknown> = { ...(session || {}) };
    if (existingRaw) {
      try {
        const existing = JSON.parse(existingRaw) as Record<string, unknown>;
        const mergedHistory = mergeSessionHistory(existing?.history, incomingHistoryHydrated);
        const existingUpdatedAt = Number(existing?.updatedAt || 0);
        mergedSession = {
          ...existing,
          ...session,
          history: mergedHistory,
          updatedAt: Math.max(existingUpdatedAt, incomingUpdatedAt, Date.now()),
        };
      } catch {
        // ignore parse failure and proceed with incoming payload
      }
    } else {
      mergedSession.history = incomingHistoryHydrated;
    }
    const payload = JSON.stringify(mergedSession);
    const payloadPretty = stringifyJsonPretty(mergedSession);
    const sharedToken = await getPersonaDropboxAccessToken(env, "shared");
    if (sharedToken) {
      await dropboxWriteText(sharedToken, sessionDropboxPath(id), payloadPretty);
    }

    const index = await getSessionIndex(env);
    const meta: SessionMeta = buildSessionMeta(mergedSession);

    const existingIndex = index.findIndex((s) => s.id === id);
    if (existingIndex >= 0) index[existingIndex] = meta;
    else index.unshift(meta);

    await putSessionIndex(env, index);
    await bumpSessionChangeSeq(env);
    return Response.json({ ok: true }, { headers: cors });
  }

  if (request.method === "DELETE") {
    const sharedToken = await getPersonaDropboxAccessToken(env, "shared");
    const existingRaw = await getSessionPayloadText(env, id);
    if (existingRaw) {
      try {
        const session = JSON.parse(existingRaw) as Record<string, unknown>;
        const meta = buildSessionMeta(session);
        const deletedMeta: DeletedSessionMeta = { ...meta, deletedAt: Date.now() };
        if (sharedToken) {
          await dropboxWriteText(sharedToken, deletedSessionDropboxPath(id), existingRaw);
        }
        const deletedIndex = await getDeletedSessionIndex(env);
        const nextDeleted = [deletedMeta, ...deletedIndex.filter((s) => s.id !== id)].slice(0, 200);
        await putDeletedSessionIndex(env, nextDeleted);
      } catch {
        // ignore archival parse failure and continue hard-delete path
      }
    }

    if (sharedToken) {
      await dropboxDeletePath(sharedToken, sessionDropboxPath(id));
    }
    await env.KV.delete(`session:${id}`);
    for (const base of SESSION_AUDIO_R2_PREFIXES) {
      await deleteR2ByPrefix(env, `${base}${id}/`);
    }
    let index = await getSessionIndex(env);
    index = index.filter((s) => s.id !== id);
    await putSessionIndex(env, index);
    await bumpSessionChangeSeq(env);
    return Response.json({ ok: true }, { headers: cors });
  }

  return null;
}
