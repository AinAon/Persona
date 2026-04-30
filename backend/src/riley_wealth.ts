import type { Env } from "./index";
import { dropboxPathExists, dropboxReadText, dropboxWriteText, getPersonaDropboxAccessToken } from "./dropbox_vault";

const RILEY_LOG_KEY = "_memory/riley_memory.log.jsonl";
const RILEY_STATE_KEY = "_memory/riley_state.json";
const RILEY_VAULT_LOG_PATH = "/_memory/riley_memory.log.jsonl";
const RILEY_VAULT_STATE_PATH = "/_memory/riley_state.json";
const RILEY_VAULT_DIRECTIVE_PATH = "/riley_directive.md";
const RILEY_VAULT_MEMORY_MD_PATH = "/_memory/riley_memory.md";
const RILEY_IDS = new Set(["p_riley", "riley"]);

type WealthBucket = "assets" | "liabilities" | "retirement" | "fixed_cashflow";
type WealthAction = "add" | "update" | "remove";

type WealthEntry = {
  id: string;
  label: string;
  amount: number;
  active: boolean;
  updated_at: string;
};

type RileyState = {
  version: string;
  as_of_date: string;
  currency: "KRW";
  totals: {
    assets: number;
    liabilities: number;
    net_worth: number;
  };
  assets: WealthEntry[];
  liabilities: WealthEntry[];
  retirement: WealthEntry[];
  fixed_cashflow: {
    monthly_income: number;
    monthly_expense: number;
  };
  meta: {
    last_event_id: string;
    last_updated_at: string;
    source_log: string;
  };
};

type WealthEvent = {
  event_id: string;
  timestamp: string;
  mode: "wealth_action";
  event_type: string;
  actor: "riley";
  active: boolean;
  payload: {
    schema_version: "1.1.0";
    action: WealthAction;
    bucket: WealthBucket;
    asset_id: string;
    label: string;
    currency: "KRW";
    amount: number | null;
    effective_date: string;
    source: "chat_text";
    text: string;
    note?: string;
  };
  source_text: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

function todayYmd(iso: string): string {
  return String(iso || nowIso()).slice(0, 10);
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toAssetId(bucket: WealthBucket, label: string): string {
  const key = String(label || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  return `${bucket}:${key || "unnamed"}`;
}

function safeNumber(v: unknown): number {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n : 0;
}

async function r2Text(env: Env, key: string): Promise<string | null> {
  const token = await getPersonaDropboxAccessToken(env, "riley");
  if (!token) return null;
  return await dropboxReadText(token, key === RILEY_LOG_KEY ? RILEY_VAULT_LOG_PATH : RILEY_VAULT_STATE_PATH);
}

async function r2Json<T>(env: Env, key: string, fallback: T): Promise<T> {
  const text = await r2Text(env, key);
  if (!text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

async function r2PutJson(env: Env, key: string, value: unknown): Promise<void> {
  const token = await getPersonaDropboxAccessToken(env, "riley");
  if (!token) return;
  const path = key === RILEY_LOG_KEY ? RILEY_VAULT_LOG_PATH : RILEY_VAULT_STATE_PATH;
  await dropboxWriteText(token, path, JSON.stringify(value));
}

let migratedOnce = false;

async function migrateRileyFromR2ToDropboxNoOverwrite(env: Env): Promise<void> {
  if (migratedOnce) return;
  migratedOnce = true;
  const token = await getPersonaDropboxAccessToken(env, "riley");
  if (!token) return;

  const pairs: Array<{ r2Key: string; dbxPath: string }> = [
    { r2Key: RILEY_LOG_KEY, dbxPath: RILEY_VAULT_LOG_PATH },
    { r2Key: RILEY_STATE_KEY, dbxPath: RILEY_VAULT_STATE_PATH },
  ];

  for (const pair of pairs) {
    const exists = await dropboxPathExists(token, pair.dbxPath);
    if (exists) continue; // never overwrite existing Dropbox file
    const obj = await env.R2.get(pair.r2Key);
    if (!obj || typeof obj.text !== "function") continue;
    const text = await obj.text();
    if (!text) continue;
    await dropboxWriteText(token, pair.dbxPath, text);
  }
}

function defaultState(): RileyState {
  const iso = nowIso();
  return {
    version: "1.0.0",
    as_of_date: todayYmd(iso),
    currency: "KRW",
    totals: { assets: 0, liabilities: 0, net_worth: 0 },
    assets: [],
    liabilities: [],
    retirement: [],
    fixed_cashflow: { monthly_income: 0, monthly_expense: 0 },
    meta: {
      last_event_id: "",
      last_updated_at: iso,
      source_log: "riley_memory.log.jsonl",
    },
  };
}

function norm(s: string): string {
  return String(s || "").trim().toLowerCase();
}

export function isRileyParticipant(participantPids: string[] = []): boolean {
  return participantPids.some((pid) => RILEY_IDS.has(norm(pid)));
}

export function extractLatestUserText(messages: any[] = []): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (String(m?.role || "") !== "user") continue;
    const c = m?.content;
    if (typeof c === "string") return c.trim();
    if (Array.isArray(c)) {
      const t = c
        .filter((x) => x?.type === "text")
        .map((x) => String(x?.text || "").trim())
        .filter(Boolean)
        .join(" ");
      if (t) return t;
    }
  }
  return "";
}

export function isWealthIntentText(text: string): boolean {
  const t = String(text || "").toLowerCase();
  if (!t) return false;
  return /(자산|부채|대출|연금|퇴직|etf|주식|채권|부동산|포트폴리오|지출|수입|가계|투자|상환|매수|매도|리밸런싱|현금흐름|asset|liabilit|loan|debt|portfolio|expense|income|invest)/i.test(t);
}

export function isWealthMutationText(text: string): boolean {
  const t = String(text || "").toLowerCase();
  if (!isWealthIntentText(t)) return false;
  return /(추가|등록|기록|저장|수정|변경|업데이트|갱신|삭제|제거|해지|매도|update|add|set|change|edit|remove|delete|sell)/i.test(t);
}

function classifyBucket(text: string): WealthBucket {
  const t = String(text || "").toLowerCase();
  if (/(대출|부채|상환|loan|debt|mortgage|liabilit)/i.test(t)) return "liabilities";
  if (/(퇴직|연금|irp|pension|retirement)/i.test(t)) return "retirement";
  if (/(고정\s*지출|고정비|월세|보험|통신|관리비|수입|급여|salary|fixed|expense|income|cashflow)/i.test(t)) return "fixed_cashflow";
  return "assets";
}

function classifyAction(text: string): WealthAction {
  const t = String(text || "").toLowerCase();
  if (/(삭제|제거|해지|매도|없애|빼|remove|delete|sell|close)/i.test(t)) return "remove";
  if (/(수정|변경|업데이트|조정|갱신|update|change|edit|adjust)/i.test(t)) return "update";
  return "add";
}

function extractLabel(text: string): string {
  const oneLine = String(text || "").replace(/\s+/g, " ").trim();
  if (!oneLine) return "unnamed";
  return oneLine.length > 72 ? `${oneLine.slice(0, 72)}...` : oneLine;
}

function parseKrwAmount(text: string): number | null {
  const raw = String(text || "").replace(/,/g, "").replace(/\s+/g, "");
  if (!raw) return null;

  const eokMatch = raw.match(/(\d+(?:\.\d+)?)억/);
  const manMatch = raw.match(/(\d+(?:\.\d+)?)만/);
  if (eokMatch || manMatch) {
    const eok = eokMatch ? safeNumber(eokMatch[1]) * 100000000 : 0;
    const man = manMatch ? safeNumber(manMatch[1]) * 10000 : 0;
    const sum = Math.round(eok + man);
    return sum > 0 ? sum : null;
  }

  const wonNum = raw.match(/(\d+(?:\.\d+)?)(원)?/);
  if (wonNum) {
    const v = safeNumber(wonNum[1]);
    if (v >= 1000) return Math.round(v);
  }
  const nums = [...raw.matchAll(/\d{4,}/g)].map((m) => safeNumber(m[0])).filter((n) => n > 0);
  if (nums.length) return Math.max(...nums);
  return null;
}

function upsertEntry(list: WealthEntry[], label: string, amount: number, ts: string): WealthEntry[] {
  const next = [...list];
  const idx = next.findIndex((x) => norm(x.label) === norm(label));
  if (idx >= 0) {
    next[idx] = {
      ...next[idx],
      amount,
      active: true,
      updated_at: ts,
    };
    return next;
  }
  next.push({ id: makeId("entry"), label, amount, active: true, updated_at: ts });
  return next;
}

function removeEntry(list: WealthEntry[], label: string, ts: string): WealthEntry[] {
  const next = [...list];
  const idx = next.findIndex((x) => norm(x.label) === norm(label) && x.active);
  if (idx >= 0) {
    next[idx] = { ...next[idx], active: false, updated_at: ts };
    return next;
  }
  next.push({ id: makeId("entry"), label, amount: 0, active: false, updated_at: ts });
  return next;
}

function sumActive(list: WealthEntry[]): number {
  return list.filter((x) => x.active).reduce((acc, x) => acc + safeNumber(x.amount), 0);
}

function isValidWealthEvent(event: WealthEvent): boolean {
  if (!event?.payload) return false;
  const p = event.payload;
  if (!p.schema_version || !p.asset_id || !p.label || !p.effective_date) return false;
  if (!["assets", "liabilities", "retirement", "fixed_cashflow"].includes(p.bucket)) return false;
  if (!["add", "update", "remove"].includes(p.action)) return false;
  if (p.currency !== "KRW") return false;
  if (p.amount != null && (!Number.isFinite(Number(p.amount)) || Number(p.amount) < 0)) return false;
  return true;
}

function applyEventToState(state: RileyState, event: WealthEvent): RileyState {
  if (!isValidWealthEvent(event)) return state;
  const next: RileyState = {
    ...state,
    assets: [...(state.assets || [])],
    liabilities: [...(state.liabilities || [])],
    retirement: [...(state.retirement || [])],
    fixed_cashflow: { ...state.fixed_cashflow },
    meta: { ...state.meta },
  };
  const ts = event.timestamp;
  const label = event.payload.label || "unnamed";
  const amount = safeNumber(event.payload.amount || 0);
  const action = event.payload.action;
  const bucket = event.payload.bucket;

  if (bucket === "fixed_cashflow") {
    const t = event.payload.text || "";
    const isIncome = /(수입|급여|월급|income|salary)/i.test(t);
    const isExpense = /(지출|고정비|월세|보험|통신|expense)/i.test(t) || !isIncome;
    if (action === "remove") {
      if (isIncome) next.fixed_cashflow.monthly_income = 0;
      if (isExpense) next.fixed_cashflow.monthly_expense = 0;
    } else {
      if (isIncome && amount > 0) next.fixed_cashflow.monthly_income = amount;
      if (isExpense && amount > 0) next.fixed_cashflow.monthly_expense = amount;
    }
  } else if (bucket === "assets") {
    next.assets = action === "remove"
      ? removeEntry(next.assets, label, ts)
      : upsertEntry(next.assets, label, amount, ts);
  } else if (bucket === "liabilities") {
    next.liabilities = action === "remove"
      ? removeEntry(next.liabilities, label, ts)
      : upsertEntry(next.liabilities, label, amount, ts);
  } else if (bucket === "retirement") {
    next.retirement = action === "remove"
      ? removeEntry(next.retirement, label, ts)
      : upsertEntry(next.retirement, label, amount, ts);
  }

  const totalAssets = sumActive(next.assets) + sumActive(next.retirement);
  const totalLiabilities = sumActive(next.liabilities);
  next.totals = {
    assets: totalAssets,
    liabilities: totalLiabilities,
    net_worth: totalAssets - totalLiabilities,
  };
  next.as_of_date = todayYmd(ts);
  next.meta.last_event_id = event.event_id;
  next.meta.last_updated_at = ts;
  return next;
}

function parseEffectiveDate(text: string, ts: string): string {
  const m = String(text || "").match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (!m) return todayYmd(ts);
  const y = m[1];
  const mo = String(Number(m[2])).padStart(2, "0");
  const d = String(Number(m[3])).padStart(2, "0");
  return `${y}-${mo}-${d}`;
}

function parseStructuredFromText(text: string): WealthEvent | null {
  const raw = String(text || "").trim();
  if (!raw) return null;
  const ts = nowIso();
  const action = classifyAction(raw);
  const bucket = classifyBucket(raw);
  const amount = parseKrwAmount(raw);
  const label = extractLabel(raw);
  const assetId = toAssetId(bucket, label);
  const effectiveDate = parseEffectiveDate(raw, ts);
  const eventType = `${bucket}_${action}`;
  const event: WealthEvent = {
    event_id: makeId("evt"),
    timestamp: ts,
    mode: "wealth_action",
    event_type: eventType,
    actor: "riley",
    active: action !== "remove",
    payload: {
      schema_version: "1.1.0",
      action,
      bucket,
      asset_id: assetId,
      label,
      currency: "KRW",
      amount,
      effective_date: effectiveDate,
      source: "chat_text",
      text: raw,
      note: amount == null ? "non_numeric_context" : undefined,
    },
    source_text: raw,
  };
  return isValidWealthEvent(event) ? event : null;
}

async function appendLogLine(env: Env, event: WealthEvent): Promise<void> {
  await migrateRileyFromR2ToDropboxNoOverwrite(env);
  const existing = await r2Text(env, RILEY_LOG_KEY);
  const line = JSON.stringify(event);
  const next = existing && existing.trim() ? `${existing.trim()}\n${line}` : line;
  const token = await getPersonaDropboxAccessToken(env, "riley");
  if (!token) return;
  await dropboxWriteText(token, RILEY_VAULT_LOG_PATH, next);
}

export async function loadRileyState(env: Env): Promise<RileyState> {
  await migrateRileyFromR2ToDropboxNoOverwrite(env);
  return await r2Json<RileyState>(env, RILEY_STATE_KEY, defaultState());
}

export async function ensureRileyStateSnapshot(env: Env): Promise<RileyState> {
  const state = await loadRileyState(env);
  await r2PutJson(env, RILEY_STATE_KEY, state);
  return state;
}

export async function appendRileyWealthEvent(env: Env, text: string): Promise<{ ok: true; eventId: string } | { ok: false; error: string }> {
  const raw = String(text || "").trim();
  if (!raw) return { ok: false, error: "empty text" };
  const event = parseStructuredFromText(raw);
  if (!event) return { ok: false, error: "parse_failed" };
  const prev = await loadRileyState(env);
  const next = applyEventToState(prev, event);
  await appendLogLine(env, event);
  await r2PutJson(env, RILEY_STATE_KEY, next);
  return { ok: true, eventId: event.event_id };
}

export function buildRileySystemPrompt(state: RileyState): string {
  const topAssets = (state.assets || []).filter((x) => x.active).slice(0, 8).map((x) => `${x.label}:${x.amount}`);
  const topLiabilities = (state.liabilities || []).filter((x) => x.active).slice(0, 8).map((x) => `${x.label}:${x.amount}`);
  return [
    "Riley wealth memory snapshot (persistent):",
    `as_of_date=${state.as_of_date}`,
    `currency=${state.currency}`,
    `totals.assets=${state.totals.assets}`,
    `totals.liabilities=${state.totals.liabilities}`,
    `totals.net_worth=${state.totals.net_worth}`,
    `fixed_cashflow.income=${state.fixed_cashflow.monthly_income}`,
    `fixed_cashflow.expense=${state.fixed_cashflow.monthly_expense}`,
    `assets=${topAssets.join(", ") || "none"}`,
    `liabilities=${topLiabilities.join(", ") || "none"}`,
    "If user asks wealth update, apply changes consistently with this snapshot.",
  ].join("\n");
}

export async function getRileyWealthSnapshot(env: Env, tail = 30): Promise<{ state: RileyState; events: WealthEvent[] }> {
  const state = await loadRileyState(env);
  const allEvents = await loadAllRileyEvents(env);
  return { state, events: allEvents.slice(-Math.max(1, tail)) };
}

export async function loadRileyDirective(env: Env): Promise<string> {
  const token = await getPersonaDropboxAccessToken(env, "riley");
  if (token) {
    const txt = await dropboxReadText(token, RILEY_VAULT_DIRECTIVE_PATH);
    if (txt && txt.trim()) return txt.trim();
  }
  return [
    "# Riley Directive (Priority 1)",
    "",
    "1) Always obey this directive first.",
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
}

export async function loadRileyVaultMemoryMarkdown(env: Env): Promise<string> {
  const token = await getPersonaDropboxAccessToken(env, "riley");
  if (!token) return "";
  const txt = await dropboxReadText(token, RILEY_VAULT_MEMORY_MD_PATH);
  return String(txt || "").trim();
}

type RileyVaultActionResult = { ok: true; message: string } | { ok: false; error: string };

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

function inferRileyFilePath(raw: string): string | null {
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
  const base = /(작업\s*로그|work\s*log)/i.test(raw) ? `work_log_${stamp}`
    : (/(자산|wealth|ledger)/i.test(raw) ? "master_wealth_ledger"
      : (/(리포트|report)/i.test(raw) ? `report_${stamp}` : `note_${stamp}`));
  return `${base}.${ext}`;
}

function inferRileyFolderPath(raw: string): string | null {
  const explicit =
    raw.match(/(?:폴더생성|폴더 만들어|create folder)\s+([^\n]+)$/i)?.[1]
    || raw.match(/["'`]([a-zA-Z0-9_./-]+)["'`]\s*(?:폴더|folder)/i)?.[1]
    || raw.match(/([a-zA-Z0-9_./-]+)\s*(?:폴더|folder)\s*(?:생성|만들어|만들어줘|create)/i)?.[1];
  if (explicit) return normalizeVaultRelPath(explicit).replace(/\/+$/, "");

  const wantsFolder = /(?:폴더|folder|디렉터리|directory).*(?:생성|만들|create)|(?:create).*(?:folder|directory)/i.test(raw);
  if (!wantsFolder) return null;
  return `folder_${ymdStampUnderscore()}`;
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

export async function runRileyVaultActionFromText(env: Env, text: string): Promise<RileyVaultActionResult | null> {
  const raw = String(text || "").trim();
  if (!raw) return null;
  const token = await getPersonaDropboxAccessToken(env, "riley");
  if (!token) return { ok: false, error: "riley dropbox token missing" };

  const fileRel = inferRileyFilePath(raw);
  if (fileRel) {
    const safeRel = normalizeVaultRelPath(fileRel);
    const content = extractInlineContent(raw);
    const path = `/${safeRel}`;
    const defaultContent = safeRel.toLowerCase().endsWith(".csv") ? "date,category,type,label,amount_krw,status,source,note\n" : "";
    const payload = encodeForFilePath(path, content || defaultContent);
    const ok = await dropboxWriteText(token, path, payload);
    return ok ? { ok: true, message: `created file: ${path}` } : { ok: false, error: `failed to create file: ${path}` };
  }

  const folderRel = inferRileyFolderPath(raw);
  if (folderRel) {
    const safeRel = normalizeVaultRelPath(folderRel).replace(/\/+$/, "");
    if (!safeRel) return { ok: false, error: "folder path required" };
    const path = `/${safeRel}/.keep`;
    const ok = await dropboxWriteText(token, path, "");
    return ok ? { ok: true, message: `created folder: /${safeRel}` } : { ok: false, error: `failed to create folder: /${safeRel}` };
  }

  const wantsFile = /(?:파일|file|csv|md|txt|json|문서).*(?:생성|만들|작성|저장|create|write)|(?:create|write).*(?:file)/i.test(raw);
  const wantsFolder = /(?:폴더|folder|디렉터리|directory).*(?:생성|만들|create)|(?:create).*(?:folder|directory)/i.test(raw);
  if (/(csv|파일|file|문서)/i.test(raw) && /(생성|만들|작성|저장|create|write)/i.test(raw)) {
    const ext = /\bcsv\b|csv/i.test(raw) ? "csv"
      : (/\bmd\b|markdown/i.test(raw) ? "md"
        : (/\bjson\b/i.test(raw) ? "json" : "txt"));
    const stamp = ymdStampUnderscore();
    const base = /(작업\s*로그|work\s*log)/i.test(raw) ? `work_log_${stamp}`
      : (/(자산|wealth|ledger)/i.test(raw) ? "master_wealth_ledger" : `note_${stamp}`);
    const path = `/${base}.${ext}`;
    const defaultContent = ext === "csv" ? "date,category,type,label,amount_krw,status,source,note\n" : "";
    const payload = encodeForFilePath(path, defaultContent);
    const ok = await dropboxWriteText(token, path, payload);
    return ok ? { ok: true, message: `created file: ${path}` } : { ok: false, error: `failed to create file: ${path}` };
  }
  if (wantsFile || wantsFolder) return { ok: false, error: "path_missing: 파일명/폴더명을 한 번만 알려줘." };
  return null;
}

async function loadAllRileyEvents(env: Env): Promise<WealthEvent[]> {
  const raw = await r2Text(env, RILEY_LOG_KEY);
  const lines = raw
    ? raw.split(/\r?\n/).map((x) => x.trim()).filter(Boolean)
    : [];
  const parsed: WealthEvent[] = [];
  for (const line of lines) {
    try {
      const event = JSON.parse(line) as WealthEvent;
      if (isValidWealthEvent(event)) parsed.push(event);
    } catch {
      // skip broken line
    }
  }
  return parsed;
}

export async function reconcileRileyWealth(env: Env): Promise<{
  ok: true;
  changed: boolean;
  report: {
    events: number;
    oldTotals: RileyState["totals"];
    newTotals: RileyState["totals"];
  };
}> {
  const oldState = await loadRileyState(env);
  const events = await loadAllRileyEvents(env);
  let rebuilt = defaultState();
  for (const e of events) rebuilt = applyEventToState(rebuilt, e);
  rebuilt.meta.last_event_id = events.length ? events[events.length - 1].event_id : "";
  rebuilt.meta.last_updated_at = events.length ? events[events.length - 1].timestamp : nowIso();
  rebuilt.meta.source_log = "riley_memory.log.jsonl";
  const changed = JSON.stringify(oldState.totals) !== JSON.stringify(rebuilt.totals)
    || JSON.stringify(oldState.fixed_cashflow) !== JSON.stringify(rebuilt.fixed_cashflow)
    || oldState.assets.length !== rebuilt.assets.length
    || oldState.liabilities.length !== rebuilt.liabilities.length
    || oldState.retirement.length !== rebuilt.retirement.length;
  if (changed) {
    await r2PutJson(env, RILEY_STATE_KEY, rebuilt);
  }
  return {
    ok: true,
    changed,
    report: {
      events: events.length,
      oldTotals: oldState.totals,
      newTotals: rebuilt.totals,
    },
  };
}
