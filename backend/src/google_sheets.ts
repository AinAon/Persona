import type { Env } from "./index";
import { generateGeminiText } from "./model_gemini";
type ServiceAccountConfig = {
  clientEmail: string;
  privateKey: string;
};

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const MAX_CONTEXT_TABS = 12;
const MAX_CONTEXT_ROWS_PER_TAB = 40;
const MAX_CONTEXT_COLS = 12;

function base64Url(input: ArrayBuffer | string): string {
  const bytes = typeof input === "string"
    ? new TextEncoder().encode(input)
    : new Uint8Array(input);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function parseServiceAccount(env: Env): ServiceAccountConfig | null {
  const rawJson = String(env.GOOGLE_SERVICE_ACCOUNT_JSON || "").trim();
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson) as { client_email?: string; private_key?: string };
      if (parsed.client_email && parsed.private_key) {
        return { clientEmail: parsed.client_email, privateKey: parsed.private_key };
      }
    } catch {
      return null;
    }
  }

  const clientEmail = String(env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "").trim();
  const privateKey = String(env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "").replace(/\\n/g, "\n").trim();
  if (!clientEmail || !privateKey) return null;
  return { clientEmail, privateKey };
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(pem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function getSheetsAccessToken(env: Env): Promise<string> {
  const cfg = parseServiceAccount(env);
  if (!cfg) throw new Error("google_service_account_missing");

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: cfg.clientEmail,
    scope: SHEETS_SCOPE,
    aud: TOKEN_URL,
    exp: now + 3600,
    iat: now,
  };
  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claim))}`;
  const key = await importPrivateKey(cfg.privateKey);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const assertion = `${unsigned}.${base64Url(signature)}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const data = await res.json().catch(() => ({})) as { access_token?: string; error?: string; error_description?: string };
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || `token_failed_${res.status}`);
  }
  return data.access_token;
}

async function sheetsFetch(env: Env, path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getSheetsAccessToken(env);
  return await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}

async function loadSheetTitles(env: Env, spreadsheetId: string): Promise<string[]> {
  const metaRes = await sheetsFetch(env, `${spreadsheetId}?fields=sheets.properties.title`);
  const meta = await metaRes.json().catch(() => ({})) as { sheets?: Array<{ properties?: { title?: string } }>; error?: { message?: string } };
  if (!metaRes.ok) throw new Error(meta.error?.message || `sheet_meta_failed_${metaRes.status}`);
  return (meta.sheets || []).map((s) => String(s.properties?.title || "").trim()).filter(Boolean);
}

async function loadSheetProperties(env: Env, spreadsheetId: string): Promise<Array<{ title: string; sheetId: number; rowCount?: number; columnCount?: number }>> {
  const metaRes = await sheetsFetch(env, `${spreadsheetId}?fields=sheets.properties(sheetId,title,gridProperties(rowCount,columnCount))`);
  const meta = await metaRes.json().catch(() => ({})) as {
    sheets?: Array<{ properties?: { sheetId?: number; title?: string; gridProperties?: { rowCount?: number; columnCount?: number } } }>;
    error?: { message?: string };
  };
  if (!metaRes.ok) throw new Error(meta.error?.message || `sheet_meta_failed_${metaRes.status}`);
  return (meta.sheets || [])
    .map((s) => ({
      title: String(s.properties?.title || "").trim(),
      sheetId: Number(s.properties?.sheetId),
      rowCount: Number(s.properties?.gridProperties?.rowCount),
      columnCount: Number(s.properties?.gridProperties?.columnCount),
    }))
    .filter((s) => s.title && Number.isFinite(s.sheetId));
}

async function loadSpreadsheetTitle(env: Env, spreadsheetId: string): Promise<string> {
  const metaRes = await sheetsFetch(env, `${spreadsheetId}?fields=properties.title`);
  const meta = await metaRes.json().catch(() => ({})) as { properties?: { title?: string }; error?: { message?: string } };
  if (!metaRes.ok) throw new Error(meta.error?.message || `spreadsheet_title_failed_${metaRes.status}`);
  return String(meta.properties?.title || "").trim();
}

async function ensureSheetTab(env: Env, spreadsheetId: string, tab: string): Promise<void> {
  const metaRes = await sheetsFetch(env, `${spreadsheetId}?fields=sheets.properties.title`);
  const meta = await metaRes.json().catch(() => ({})) as { sheets?: Array<{ properties?: { title?: string } }>; error?: { message?: string } };
  if (!metaRes.ok) throw new Error(meta.error?.message || `sheet_meta_failed_${metaRes.status}`);
  const exists = (meta.sheets || []).some((s) => s.properties?.title === tab);
  if (exists) return;

  const addRes = await sheetsFetch(env, `${spreadsheetId}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title: tab } } }] }),
  });
  if (!addRes.ok) {
    const data = await addRes.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(data.error?.message || `sheet_add_failed_${addRes.status}`);
  }
}

function isRileySheetCreateIntent(text: string): boolean {
  return /(?:시트|탭|sheet|tab).*(?:만들|생성|추가|create|add)/i.test(String(text || ""));
}

export async function getRileySheetsStatus(env: Env): Promise<{ ok: boolean; spreadsheetId: string; title?: string; tab: string; configured: boolean; error?: string }> {
  const spreadsheetId = String(env.RILEY_SHEETS_SPREADSHEET_ID || "").trim();
  const configured = !!spreadsheetId && !!parseServiceAccount(env);
  if (!configured) return { ok: false, spreadsheetId, tab: "", configured, error: "sheets_not_configured" };
  const titles = await loadSheetTitles(env, spreadsheetId).catch(() => []);
  const title = await loadSpreadsheetTitle(env, spreadsheetId).catch(() => "");
  return { ok: true, spreadsheetId, title, tab: String(titles[0] || "").trim(), configured };
}

function isSpreadsheetTitleQuestion(text: string): boolean {
  const raw = String(text || "");
  const mentionsDoc = /(스프레드\s*시트|spreadsheet|문서|파일|document|file)/i.test(raw);
  const asksTitle = /(이름|제목|타이틀|title|name)/i.test(raw);
  return mentionsDoc && asksTitle && !/(탭|tab|셀|cell|[A-Z]{1,3}\d+)/i.test(raw);
}

export async function readRileySpreadsheetTitleFromText(env: Env, text: string): Promise<
  | { ok: true; spreadsheetId: string; title: string }
  | { ok: false; error: string; stage?: string }
  | null
> {
  if (!isSpreadsheetTitleQuestion(text)) return null;
  const spreadsheetId = String(env.RILEY_SHEETS_SPREADSHEET_ID || "").trim();
  if (!spreadsheetId) return { ok: false, error: "riley_sheets_spreadsheet_id_missing", stage: "config" };
  try {
    const title = await loadSpreadsheetTitle(env, spreadsheetId);
    return { ok: true, spreadsheetId, title };
  } catch (e: any) {
    return { ok: false, error: e?.message || "spreadsheet_title_failed", stage: "read" };
  }
}

export type RileySheetContext = {
  ok: boolean;
  spreadsheetId: string;
  updatedAt: string;
  tabs: Array<{
    title: string;
    rowCount: number;
    columnCount: number;
    values: string[][];
  }>;
  error?: string;
};

type RileySheetAiAction =
  | { action: "none"; reason?: string }
  | { action: "get_run_logs"; limit?: number }
  | { action: "get_spreadsheet_title" }
  | { action: "list_tabs" }
  | { action: "read_range"; sheet: string; range: string }
  | { action: "write_cell"; sheet: string; cell: string; value: string }
  | { action: "append_row"; sheet: string; values: string[] }
  | { action: "insert_rows"; sheet: string; start_row: number; count?: number }
  | { action: "create_sheet"; title: string }
  | { action: "rename_sheet"; old_title: string; new_title: string };

type RileySheetAiResult =
  | { ok: true; action: string; spreadsheetId: string; message: string; data?: unknown; runId?: string }
  | { ok: false; action?: string; error: string; stage?: string; runId?: string };

type RileySheetRunLog = {
  runId: string;
  at: string;
  userText: string;
  spreadsheetId: string;
  plannerModel: string;
  steps: Array<{ at: string; stage: string; ok: boolean; data?: unknown; error?: string }>;
  final?: RileySheetAiResult;
};

const RILEY_SHEET_RUN_INDEX_KEY = "riley:sheets:runlog:index";
const RILEY_SHEET_RUN_LOG_TTL_SECONDS = 60 * 60 * 24 * 14;
const RILEY_SHEET_RUN_R2_PREFIX = "runtime/riley/sheets/runlog";
const RILEY_SHEET_RUN_R2_INDEX_KEY = `${RILEY_SHEET_RUN_R2_PREFIX}/index.json`;

function createRunLog(userText: string, spreadsheetId: string, plannerModel: string): RileySheetRunLog {
  return {
    runId: `riley_sheet_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    userText: String(userText || ""),
    spreadsheetId,
    plannerModel,
    steps: [],
  };
}

function addRunStep(log: RileySheetRunLog, stage: string, ok: boolean, data?: unknown, error?: string): void {
  log.steps.push({ at: new Date().toISOString(), stage, ok, ...(data === undefined ? {} : { data: compactForLog(data) }), ...(error ? { error } : {}) });
}

function summarizeSheetValues(values: unknown): unknown {
  if (!Array.isArray(values)) return values;
  const rows = values as unknown[][];
  const colCount = rows.reduce((max, row) => Array.isArray(row) ? Math.max(max, row.length) : max, 0);
  return {
    rowCount: rows.length,
    columnCount: colCount,
    preview: rows.slice(0, 5).map((row) => Array.isArray(row) ? row.slice(0, 8).map((v) => String(v ?? "").slice(0, 120)) : row),
  };
}

function compactForLog(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return value.length > 1000 ? `${value.slice(0, 1000)}...` : value;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => compactForLog(item, depth + 1));
  const src = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(src)) {
    if (key === "values") out[key] = summarizeSheetValues(val);
    else if (depth >= 4) out[key] = "[compact]";
    else out[key] = compactForLog(val, depth + 1);
  }
  return out;
}

function compactRunLogForRiley(log: RileySheetRunLog): RileySheetRunLog {
  return {
    ...log,
    userText: log.userText.length > 500 ? `${log.userText.slice(0, 500)}...` : log.userText,
    steps: log.steps.map((step) => ({
      ...step,
      data: step.data === undefined ? undefined : compactForLog(step.data),
    })),
    final: log.final ? compactForLog(log.final) as RileySheetAiResult : undefined,
  };
}

async function saveRunLog(env: Env, log: RileySheetRunLog): Promise<void> {
  try {
    await env.R2.put(`${RILEY_SHEET_RUN_R2_PREFIX}/${log.runId}.json`, JSON.stringify(log), {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
    });
    const indexObj = await env.R2.get(RILEY_SHEET_RUN_R2_INDEX_KEY);
    const raw = indexObj ? await indexObj.text() : null;
    const ids = raw ? JSON.parse(raw) as string[] : [];
    const next = [log.runId, ...ids.filter((id) => id !== log.runId)].slice(0, 50);
    await env.R2.put(RILEY_SHEET_RUN_R2_INDEX_KEY, JSON.stringify(next), {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
    });
    await Promise.all(ids.slice(50).map((id) => env.R2.delete(`${RILEY_SHEET_RUN_R2_PREFIX}/${id}.json`).catch(() => {})));
  } catch {
    // Run logs are diagnostic only. Storage errors must not break sheet execution.
  }
}

async function loadRunLogs(env: Env, limit = 10): Promise<RileySheetRunLog[]> {
  const indexObj = await env.R2.get(RILEY_SHEET_RUN_R2_INDEX_KEY);
  const raw = indexObj ? await indexObj.text() : await env.KV.get(RILEY_SHEET_RUN_INDEX_KEY);
  const ids = raw ? JSON.parse(raw) as string[] : [];
  const selected = ids.slice(0, Math.max(1, Math.min(20, Number(limit || 10))));
  const logs: RileySheetRunLog[] = [];
  for (const id of selected) {
    const obj = await env.R2.get(`${RILEY_SHEET_RUN_R2_PREFIX}/${id}.json`);
    const item = obj ? await obj.text() : await env.KV.get(`riley:sheets:runlog:${id}`);
    if (!item) continue;
    try {
      logs.push(compactRunLogForRiley(JSON.parse(item) as RileySheetRunLog));
    } catch {
      // skip malformed log
    }
  }
  return logs;
}

function extractJsonObject(text: string): any | null {
  const raw = String(text || "").trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = (fenced || raw).trim();
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

function compactSheetContext(ctx: RileySheetContext): string {
  return JSON.stringify({
    spreadsheetId: ctx.spreadsheetId,
    updatedAt: ctx.updatedAt,
    tabs: ctx.tabs.map((tab) => ({
      title: tab.title,
      rowCount: tab.rowCount,
      columnCount: tab.columnCount,
      sampleValues: tab.values.slice(0, 12),
    })),
  }).slice(0, 14000);
}

async function planRileySheetActionWithGemini(env: Env, text: string, apiKey: string, model: string): Promise<RileySheetAiAction | null> {
  if (!apiKey) return null;
  if (!String(model || "").startsWith("gemini")) {
    throw new Error(`riley_sheet_planner_requires_gemini_model:${model || "missing"}`);
  }
  const ctx = await loadRileySheetsContext(env);
  if (!ctx.ok) return { action: "none", reason: ctx.error || "sheets_context_failed" };
  const messages = [
    {
      role: "system",
      content: [
        "You convert Riley user requests into one Google Sheets action JSON.",
        "Return JSON only. No markdown. No prose.",
        "Do not ask for approval. Do not output proposals.",
        "Use current spreadsheet context. Sheet names can be any language and may change.",
        "Allowed schema:",
        "{\"action\":\"none\",\"reason\":\"...\"}",
        "{\"action\":\"get_run_logs\",\"limit\":10}",
        "{\"action\":\"get_spreadsheet_title\"}",
        "{\"action\":\"list_tabs\"}",
        "{\"action\":\"read_range\",\"sheet\":\"tab title\",\"range\":\"A1 or A1:C3 or 1:40\"}",
        "{\"action\":\"write_cell\",\"sheet\":\"tab title\",\"cell\":\"C2\",\"value\":\"text\"}",
        "{\"action\":\"append_row\",\"sheet\":\"tab title\",\"values\":[\"a\",\"b\"]}",
        "{\"action\":\"insert_rows\",\"sheet\":\"tab title\",\"start_row\":1,\"count\":1}",
        "{\"action\":\"create_sheet\",\"title\":\"new tab title\"}",
        "{\"action\":\"rename_sheet\",\"old_title\":\"old tab title\",\"new_title\":\"new tab title\"}",
        "For requests to add/insert a row at the top, first row, before row N, or at row N, use insert_rows, not append_row.",
        "insert_rows.start_row is 1-based. start_row=1 inserts before the current first row.",
        "Use insert_rows for blank row insertion. Use append_row only when the user provides non-empty row values to append.",
        "Use get_run_logs when the user asks Riley to inspect, monitor, debug, or review recent sheet tool runs/logs/errors.",
        "Use action none when the request is not about Google Sheets or sheet tool logs.",
      ].join("\n"),
    },
    {
      role: "user",
      content: JSON.stringify({
        user_request: String(text || ""),
        spreadsheet_context: JSON.parse(compactSheetContext(ctx)),
      }),
    },
  ];
  const out = await generateGeminiText({ model, messages, apiKey });
  const parsed = extractJsonObject(out);
  if (!parsed || typeof parsed !== "object") return null;
  const action = String(parsed.action || "none");
  if (!["none", "get_run_logs", "get_spreadsheet_title", "list_tabs", "read_range", "write_cell", "append_row", "insert_rows", "create_sheet", "rename_sheet"].includes(action)) {
    return { action: "none", reason: "unsupported_action" };
  }
  return parsed as RileySheetAiAction;
}

export async function loadRileySheetsContext(env: Env): Promise<RileySheetContext> {
  const spreadsheetId = String(env.RILEY_SHEETS_SPREADSHEET_ID || "").trim();
  if (!spreadsheetId || !parseServiceAccount(env)) {
    return { ok: false, spreadsheetId, updatedAt: new Date().toISOString(), tabs: [], error: "sheets_not_configured" };
  }

  try {
    const metaRes = await sheetsFetch(env, `${spreadsheetId}?fields=sheets.properties(title,gridProperties(rowCount,columnCount))`);
    const meta = await metaRes.json().catch(() => ({})) as {
      sheets?: Array<{ properties?: { title?: string; gridProperties?: { rowCount?: number; columnCount?: number } } }>;
      error?: { message?: string };
    };
    if (!metaRes.ok) throw new Error(meta.error?.message || `sheet_meta_failed_${metaRes.status}`);

    const tabs: RileySheetContext["tabs"] = [];
    for (const sheet of (meta.sheets || []).slice(0, MAX_CONTEXT_TABS)) {
      const title = String(sheet.properties?.title || "").trim();
      if (!title) continue;
      const rowCount = Number(sheet.properties?.gridProperties?.rowCount || 0);
      const columnCount = Number(sheet.properties?.gridProperties?.columnCount || 0);
      const range = `${title}!1:${MAX_CONTEXT_ROWS_PER_TAB}`;
      const res = await sheetsFetch(env, `${spreadsheetId}/values/${encodeURIComponent(range)}`);
      const data = await res.json().catch(() => ({})) as { values?: string[][]; error?: { message?: string } };
      if (!res.ok) continue;
      const values = (data.values || [])
        .slice(0, MAX_CONTEXT_ROWS_PER_TAB)
        .map((row) => row.slice(0, MAX_CONTEXT_COLS).map((cell) => String(cell || "").slice(0, 500)));
      tabs.push({ title, rowCount, columnCount, values });
    }

    return { ok: true, spreadsheetId, updatedAt: new Date().toISOString(), tabs };
  } catch (e: any) {
    return { ok: false, spreadsheetId, updatedAt: new Date().toISOString(), tabs: [], error: e?.message || "sheets_context_failed" };
  }
}

export function buildRileySheetsContextPrompt(ctx: RileySheetContext): string {
  if (!ctx.ok || !ctx.tabs.length) return "";
  const lines = [
    "Riley Google Sheets workspace context:",
    `spreadsheet_id=${ctx.spreadsheetId}`,
    `synced_at=${ctx.updatedAt}`,
    "Rules:",
    "- Treat every sheet tab as user-editable persistent Riley workspace context.",
    "- Do not assume any fixed tab or header names; use the current spreadsheet tabs and visible row contents.",
    "- This context is loaded from Google Sheets during the current request; do not call it a stale memory snapshot or ask the user to resync.",
    "- For explicit sheet reads or writes, the server executes the Sheets API before Riley replies. Report the returned result, not a future action.",
    "- If Sheet content conflicts with older vault memory, prefer the latest Sheet context unless the user says otherwise.",
  ];
  for (const tab of ctx.tabs) {
    lines.push(`Tab: ${tab.title} rows=${tab.rowCount} cols=${tab.columnCount}`);
    for (const row of tab.values.slice(0, MAX_CONTEXT_ROWS_PER_TAB)) {
      const text = row.map((cell) => String(cell || "").replace(/\s+/g, " ").trim()).join(" | ").trim();
      if (text) lines.push(`- ${text}`);
    }
  }
  return lines.join("\n").slice(0, 12000);
}

function inferTargetTab(text: string, existingTabs: string[]): string {
  const raw = String(text || "");
  const normalizedRaw = raw.toLowerCase().replace(/\s+/g, "");
  const direct = existingTabs
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .find((tab) => normalizedRaw.includes(tab.toLowerCase().replace(/\s+/g, "")));
  if (direct) return direct;
  const quoted = raw.match(/["'`]([^"'`]{1,80})["'`]\s*(?:탭|시트|sheet|tab)/i)?.[1]
    || raw.match(/(?:탭|시트|sheet|tab)\s*["'`]([^"'`]{1,80})["'`]/i)?.[1];
  if (quoted) return quoted.trim();
  return existingTabs[0] || "";
}

function inferSheetWriteContent(text: string): string {
  const raw = String(text || "").trim();
  const quoted = raw.match(/["'“”‘’]([^"'“”‘’]{1,500})["'“”‘’]/)?.[1];
  if (quoted?.trim()) return quoted.trim();
  const marked = raw.match(/:{3}([\s\S]*)$/);
  if (marked?.[1]?.trim()) return marked[1].trim();
  const after = raw.match(/(?:써줘|써|작성해|작성|추가해|추가|기록해|기록|write|append|add)\s*[:：]?\s*([\s\S]+)$/i)?.[1];
  if (after?.trim()) return after.trim();
  return raw;
}

function isRileySheetReadIntent(text: string): boolean {
  const raw = String(text || "");
  const mentionsSheet = /(시트|탭|sheet|tab|spreadsheet|스프레드시트|셀|cell|행|row|열|column|[A-Z]{1,3}\d+)/i.test(raw);
  const wantsRead = /(찾|읽|조회|확인|보여|알려|뭐|무엇|내용|값|비어|read|show|check|view|what|list)/i.test(raw);
  const wantsMutation = /(바꾸|변경|수정|고쳐|rename|update|edit|write|append|add|insert|입력|작성|써)/i.test(raw);
  return mentionsSheet && wantsRead && !wantsMutation;
}

function isSheetTabListIntent(text: string): boolean {
  const raw = String(text || "");
  return /(시트|탭|sheet|tab)/i.test(raw) && /(몇\s*개|개수|이름|목록|list|names?|count)/i.test(raw);
}

function isRileySheetWriteIntent(text: string): boolean {
  const raw = String(text || "");
  const mentionsSheet = /(시트|탭|sheet|tab|spreadsheet|스프레드시트)/i.test(raw);
  const wantsWrite = /(써줘|써|작성|추가|기록|입력|write|append|add|insert|update)/i.test(raw);
  const financeWrite = /(자산|부채|대출|연금|퇴직|etf|주식|채권|부동산|포트폴리오|지출|수입|가계|투자|상환|매수|매도|현금흐름|asset|liabilit|loan|debt|portfolio|expense|income|invest)/i.test(raw)
    && /(추가|등록|기록|저장|수정|변경|업데이트|갱신|삭제|제거|해지|매도|write|append|add|set|change|edit|remove|delete|sell)/i.test(raw);
  return (mentionsSheet && wantsWrite) || financeWrite;
}

function inferA1Range(text: string): string {
  const raw = String(text || "").toUpperCase();
  const range = raw.match(/\b([A-Z]{1,3}\d+\s*:\s*[A-Z]{1,3}\d+)\b/)?.[1];
  if (range) return range.replace(/\s+/g, "");
  const cell = raw.match(/\b([A-Z]{1,3}\d+)\b/)?.[1];
  if (cell) return cell;
  if (/(첫\s*행|첫번째\s*행|first\s*row)/i.test(text)) return "1:1";
  return "1:40";
}

function inferWriteCell(text: string): string {
  const raw = String(text || "").toUpperCase();
  return raw.match(/\b([A-Z]{1,3}\d+)\b/)?.[1] || "";
}

function formatSheetValues(values: string[][]): string {
  return values
    .map((row, i) => {
      const text = row.map((cell) => String(cell || "").replace(/\s+/g, " ").trim()).join(" | ").trim();
      return text ? `${i + 1}. ${text}` : "";
    })
    .filter(Boolean)
    .join("\n");
}

export async function readRileySheetFromText(env: Env, text: string): Promise<
  | { ok: true; spreadsheetId: string; tab: string; range: string; values: string[][]; summary: string }
  | { ok: false; error: string; stage?: string }
  | null
> {
  if (!isRileySheetReadIntent(text)) return null;
  const spreadsheetId = String(env.RILEY_SHEETS_SPREADSHEET_ID || "").trim();
  if (!spreadsheetId) return { ok: false, error: "riley_sheets_spreadsheet_id_missing", stage: "config" };

  try {
    const tabs = await loadSheetTitles(env, spreadsheetId);
    if (isSheetTabListIntent(text)) {
      return {
        ok: true,
        spreadsheetId,
        tab: tabs[0] || "",
        range: "tabs",
        values: tabs.map((title) => [title]),
        summary: `시트 ${tabs.length}개: ${tabs.join(", ") || "(없음)"}`,
      };
    }
    const tab = inferTargetTab(text, tabs);
    if (!tab) return { ok: false, error: "sheet_tab_missing", stage: "config" };
    const range = inferA1Range(text);
    const fullRange = `${tab}!${range}`;
    const res = await sheetsFetch(env, `${spreadsheetId}/values/${encodeURIComponent(fullRange)}`);
    const data = await res.json().catch(() => ({})) as { values?: string[][]; error?: { message?: string } };
    if (!res.ok) throw new Error(data.error?.message || `sheet_read_failed_${res.status}`);
    const values = data.values || [];
    const summary = values.length
      ? formatSheetValues(values)
      : "(빈 범위)";
    return { ok: true, spreadsheetId, tab, range: fullRange, values, summary };
  } catch (e: any) {
    return { ok: false, error: e?.message || "sheet_read_failed", stage: "read" };
  }
}

export async function createRileySheetFromText(env: Env, text: string): Promise<
  | { ok: true; spreadsheetId: string; tab: string; created: boolean }
  | { ok: false; error: string; stage?: string }
  | null
> {
  if (!isRileySheetCreateIntent(text)) return null;
  const spreadsheetId = String(env.RILEY_SHEETS_SPREADSHEET_ID || "").trim();
  if (!spreadsheetId) return { ok: false, error: "riley_sheets_spreadsheet_id_missing", stage: "config" };

  try {
    const tabs = await loadSheetTitles(env, spreadsheetId);
    const tab = inferTargetTab(text, tabs) || String(text.match(/["'“”‘’]?([^"'“”‘’\s,.;:，。]{1,80})["'“”‘’]?\s*(?:를|을)?\s*(?:만들|생성|추가)/)?.[1] || "").trim();
    if (!tab) return { ok: false, error: "sheet_tab_missing", stage: "config" };
    if (tabs.includes(tab)) return { ok: true, spreadsheetId, tab, created: false };
    await ensureSheetTab(env, spreadsheetId, tab);
    return { ok: true, spreadsheetId, tab, created: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || "sheet_create_failed", stage: "create" };
  }
}

export type RileySheetProposalAction =
  | { type: "rename_sheet"; old_title: string; new_title: string }
  | { type: "update_cell"; sheet: string; cell: string; value: string };

export async function executeRileySheetProposalActions(env: Env, actions: RileySheetProposalAction[]): Promise<
  { ok: true; message: string; applied: number }
  | { ok: false; error: string; stage?: string }
> {
  const spreadsheetId = String(env.RILEY_SHEETS_SPREADSHEET_ID || "").trim();
  if (!spreadsheetId) return { ok: false, error: "riley_sheets_spreadsheet_id_missing", stage: "config" };
  let applied = 0;
  const notes: string[] = [];

  try {
    for (const action of actions) {
      if (action.type === "rename_sheet") {
        const oldTitle = String(action.old_title || "").trim();
        const newTitle = String(action.new_title || "").trim();
        if (!oldTitle || !newTitle) return { ok: false, error: "sheet_rename_title_missing", stage: "validate" };
        const props = await loadSheetProperties(env, spreadsheetId);
        const target = props.find((s) => s.title === oldTitle);
        if (!target) return { ok: false, error: `sheet_not_found:${oldTitle}`, stage: "rename" };
        if (props.some((s) => s.title === newTitle)) return { ok: false, error: `sheet_already_exists:${newTitle}`, stage: "rename" };
        const res = await sheetsFetch(env, `${spreadsheetId}:batchUpdate`, {
          method: "POST",
          body: JSON.stringify({
            requests: [{
              updateSheetProperties: {
                properties: { sheetId: target.sheetId, title: newTitle },
                fields: "title",
              },
            }],
          }),
        });
        const data = await res.json().catch(() => ({})) as { error?: { message?: string } };
        if (!res.ok) return { ok: false, error: data.error?.message || `sheet_rename_failed_${res.status}`, stage: "rename" };
        const titlesAfter = await loadSheetTitles(env, spreadsheetId);
        if (!titlesAfter.includes(newTitle)) return { ok: false, error: `sheet_rename_verify_failed:${newTitle}`, stage: "verify" };
        applied++;
        notes.push(`renamed ${oldTitle} -> ${newTitle}`);
      }

      if (action.type === "update_cell") {
        const sheet = String(action.sheet || "").trim();
        const cell = String(action.cell || "").trim().toUpperCase();
        const value = String(action.value || "");
        if (!sheet || !/^[A-Z]{1,3}\d+$/.test(cell)) return { ok: false, error: "sheet_cell_target_missing", stage: "validate" };
        const range = `${sheet}!${cell}`;
        const res = await sheetsFetch(env, `${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`, {
          method: "PUT",
          body: JSON.stringify({ values: [[value]] }),
        });
        const data = await res.json().catch(() => ({})) as { error?: { message?: string } };
        if (!res.ok) return { ok: false, error: data.error?.message || `sheet_update_cell_failed_${res.status}`, stage: "update_cell" };
        const verifyRes = await sheetsFetch(env, `${spreadsheetId}/values/${encodeURIComponent(range)}`);
        const verifyData = await verifyRes.json().catch(() => ({})) as { values?: string[][]; error?: { message?: string } };
        if (!verifyRes.ok) return { ok: false, error: verifyData.error?.message || `sheet_update_cell_verify_read_failed_${verifyRes.status}`, stage: "verify" };
        if (String(verifyData.values?.[0]?.[0] || "") !== value) return { ok: false, error: `sheet_update_cell_verify_failed:${range}`, stage: "verify" };
        applied++;
        notes.push(`updated ${range}`);
      }
    }
    return { ok: true, applied, message: `applied sheet proposal: ${applied} action(s); ${notes.join("; ")}` };
  } catch (e: any) {
    return { ok: false, error: e?.message || "sheet_proposal_failed", stage: "execute" };
  }
}

async function executeRileySheetAiAction(env: Env, action: RileySheetAiAction): Promise<RileySheetAiResult> {
  const spreadsheetId = String(env.RILEY_SHEETS_SPREADSHEET_ID || "").trim();
  if (!spreadsheetId) return { ok: false, action: action.action, error: "riley_sheets_spreadsheet_id_missing", stage: "config" };
  try {
    if (action.action === "none") return { ok: true, action: "none", spreadsheetId, message: action.reason || "no_sheet_action" };
    if (action.action === "get_run_logs") {
      const logs = await loadRunLogs(env, action.limit || 10);
      return { ok: true, action: action.action, spreadsheetId, message: `loaded_sheet_run_logs: ${logs.length}`, data: { logs } };
    }
    if (action.action === "get_spreadsheet_title") {
      const title = await loadSpreadsheetTitle(env, spreadsheetId);
      return { ok: true, action: action.action, spreadsheetId, message: `spreadsheet_title: ${title}`, data: { title } };
    }
    if (action.action === "list_tabs") {
      const tabs = await loadSheetTitles(env, spreadsheetId);
      return { ok: true, action: action.action, spreadsheetId, message: `tabs: ${tabs.join(", ")}`, data: { tabs } };
    }
    if (action.action === "create_sheet") {
      const title = String(action.title || "").trim();
      if (!title) return { ok: false, action: action.action, error: "sheet_title_missing", stage: "validate" };
      const before = await loadSheetTitles(env, spreadsheetId);
      await ensureSheetTab(env, spreadsheetId, title);
      const after = await loadSheetTitles(env, spreadsheetId);
      return { ok: true, action: action.action, spreadsheetId, message: before.includes(title) ? `sheet_exists: ${title}` : `sheet_created: ${title}`, data: { title, created: !before.includes(title), tabs: after } };
    }
    if (action.action === "rename_sheet") {
      const res = await executeRileySheetProposalActions(env, [{ type: "rename_sheet", old_title: action.old_title, new_title: action.new_title }]);
      if (!res.ok) return { ok: false, action: action.action, error: res.error, stage: res.stage };
      return { ok: true, action: action.action, spreadsheetId, message: res.message };
    }
    if (action.action === "read_range") {
      const sheet = String(action.sheet || "").trim();
      const range = String(action.range || "1:40").trim();
      if (!sheet || !range) return { ok: false, action: action.action, error: "sheet_range_missing", stage: "validate" };
      const fullRange = `${sheet}!${range}`;
      const res = await sheetsFetch(env, `${spreadsheetId}/values/${encodeURIComponent(fullRange)}`);
      const data = await res.json().catch(() => ({})) as { values?: string[][]; error?: { message?: string } };
      if (!res.ok) return { ok: false, action: action.action, error: data.error?.message || `sheet_read_failed_${res.status}`, stage: "read" };
      return { ok: true, action: action.action, spreadsheetId, message: `read_range: ${fullRange}`, data: { range: fullRange, values: data.values || [] } };
    }
    if (action.action === "write_cell") {
      const sheet = String(action.sheet || "").trim();
      const cell = String(action.cell || "").trim().toUpperCase();
      const value = String(action.value || "");
      const res = await executeRileySheetProposalActions(env, [{ type: "update_cell", sheet, cell, value }]);
      if (!res.ok) return { ok: false, action: action.action, error: res.error, stage: res.stage };
      return { ok: true, action: action.action, spreadsheetId, message: res.message, data: { sheet, cell, value, verified: true } };
    }
    if (action.action === "append_row") {
      const sheet = String(action.sheet || "").trim();
      const values = Array.isArray(action.values) ? action.values.map((v) => String(v || "")) : [];
      if (!sheet || !values.length) return { ok: false, action: action.action, error: "append_row_values_missing", stage: "validate" };
      if (!values.some((v) => v.trim())) return { ok: false, action: action.action, error: "append_row_values_empty_use_insert_rows", stage: "validate" };
      const res = await sheetsFetch(env, `${spreadsheetId}/values/${encodeURIComponent(sheet)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
        method: "POST",
        body: JSON.stringify({ values: [values] }),
      });
      const data = await res.json().catch(() => ({})) as { updates?: { updatedRange?: string }; error?: { message?: string } };
      if (!res.ok) return { ok: false, action: action.action, error: data.error?.message || `sheet_append_failed_${res.status}`, stage: "append" };
      return { ok: true, action: action.action, spreadsheetId, message: `appended_row: ${data.updates?.updatedRange || sheet}`, data: { updatedRange: data.updates?.updatedRange, values } };
    }
    if (action.action === "insert_rows") {
      const sheet = String(action.sheet || "").trim();
      const startRow = Math.max(1, Math.floor(Number(action.start_row || 1)));
      const count = Math.max(1, Math.min(100, Math.floor(Number(action.count || 1))));
      if (!sheet) return { ok: false, action: action.action, error: "insert_rows_sheet_missing", stage: "validate" };
      const propsBefore = await loadSheetProperties(env, spreadsheetId);
      const target = propsBefore.find((s) => s.title === sheet);
      if (!target) return { ok: false, action: action.action, error: `sheet_not_found:${sheet}`, stage: "insert_rows" };
      const startIndex = startRow - 1;
      const res = await sheetsFetch(env, `${spreadsheetId}:batchUpdate`, {
        method: "POST",
        body: JSON.stringify({
          requests: [{
            insertDimension: {
              range: {
                sheetId: target.sheetId,
                dimension: "ROWS",
                startIndex,
                endIndex: startIndex + count,
              },
              inheritFromBefore: startIndex > 0,
            },
          }],
        }),
      });
      const data = await res.json().catch(() => ({})) as { error?: { message?: string } };
      if (!res.ok) return { ok: false, action: action.action, error: data.error?.message || `sheet_insert_rows_failed_${res.status}`, stage: "insert_rows" };
      const propsAfter = await loadSheetProperties(env, spreadsheetId);
      const after = propsAfter.find((s) => s.title === sheet);
      const verified = Number.isFinite(target.rowCount) && Number.isFinite(after?.rowCount)
        ? Number(after?.rowCount) >= Number(target.rowCount) + count
        : true;
      if (!verified) return { ok: false, action: action.action, error: "insert_rows_verification_failed", stage: "verify" };
      return {
        ok: true,
        action: action.action,
        spreadsheetId,
        message: `inserted_rows: ${sheet}!${startRow}:${startRow + count - 1}`,
        data: { sheet, startRow, count, rowCountBefore: target.rowCount, rowCountAfter: after?.rowCount, verified },
      };
    }
    return { ok: false, action: "unknown", error: "unsupported_action", stage: "validate" };
  } catch (e: any) {
    return { ok: false, action: action.action, error: e?.message || "sheet_action_failed", stage: "execute" };
  }
}

export async function runRileySheetRequestWithGemini(env: Env, text: string, apiKey: string, model: string): Promise<RileySheetAiResult | null> {
  const spreadsheetId = String(env.RILEY_SHEETS_SPREADSHEET_ID || "").trim();
  const plannerModel = String(model || "");
  const log = createRunLog(text, spreadsheetId, plannerModel);
  try {
    addRunStep(log, "request_received", true, { text: String(text || ""), plannerModel });
    addRunStep(log, "riley_gemini_plan_start", true, { model: plannerModel });
    const action = await planRileySheetActionWithGemini(env, text, apiKey, plannerModel);
    addRunStep(log, "riley_gemini_plan_result", !!action, { model: plannerModel, action });
    if (!action || action.action === "none") {
      log.final = { ok: true, action: "none", spreadsheetId, message: action?.reason || "no_sheet_action", runId: log.runId };
      await saveRunLog(env, log);
      return null;
    }
    addRunStep(log, "execute_start", true, { action });
    const result = await executeRileySheetAiAction(env, action);
    const final = { ...result, runId: log.runId } as RileySheetAiResult;
    addRunStep(log, "execute_result", result.ok, { result }, result.ok ? undefined : result.error);
    log.final = final;
    await saveRunLog(env, log);
    return final;
  } catch (e: any) {
    const final: RileySheetAiResult = { ok: false, error: e?.message || "riley_sheet_planner_failed", stage: "plan", runId: log.runId };
    addRunStep(log, "run_error", false, undefined, final.error);
    log.final = final;
    await saveRunLog(env, log).catch(() => {});
    return final;
  }
}

export async function writeRileySheetFromText(env: Env, text: string): Promise<
  | { ok: true; spreadsheetId: string; tab: string; updatedRange?: string; values: string[][]; verified: boolean }
  | { ok: false; error: string; stage?: string }
  | null
> {
  if (!isRileySheetWriteIntent(text)) return null;
  const spreadsheetId = String(env.RILEY_SHEETS_SPREADSHEET_ID || "").trim();
  if (!spreadsheetId) return { ok: false, error: "riley_sheets_spreadsheet_id_missing", stage: "config" };
  const tabs = await loadSheetTitles(env, spreadsheetId);
  const tab = inferTargetTab(text, tabs);
  if (!tab) return { ok: false, error: "sheet_tab_missing", stage: "config" };
  const content = inferSheetWriteContent(text);
  const cell = inferWriteCell(text);

  try {
    const values = cell ? [[content]] : [[new Date().toISOString(), "riley_chat", content]];
    const range = cell ? `${tab}!${cell}` : tab;
    const method = cell ? "PUT" : "POST";
    const suffix = cell ? "?valueInputOption=RAW" : ":append?valueInputOption=RAW&insertDataOption=INSERT_ROWS";
    const res = await sheetsFetch(env, `${spreadsheetId}/values/${encodeURIComponent(range)}${suffix}`, {
      method,
      body: JSON.stringify({ values }),
    });
    const data = await res.json().catch(() => ({})) as { updatedRange?: string; updates?: { updatedRange?: string }; error?: { message?: string } };
    if (!res.ok) throw new Error(data.error?.message || `sheet_append_failed_${res.status}`);
    const updatedRange = data.updatedRange || data.updates?.updatedRange;
    const verifyRange = updatedRange || range;
    const verifyRes = await sheetsFetch(env, `${spreadsheetId}/values/${encodeURIComponent(verifyRange)}`);
    const verifyData = await verifyRes.json().catch(() => ({})) as { values?: string[][]; error?: { message?: string } };
    if (!verifyRes.ok) throw new Error(verifyData.error?.message || `sheet_write_verify_read_failed_${verifyRes.status}`);
    const flat = (verifyData.values || []).flat().map((value) => String(value || ""));
    const verified = cell ? String(verifyData.values?.[0]?.[0] || "") === content : flat.includes(content);
    if (!verified) return { ok: false, error: `sheet_write_verify_failed:${verifyRange}`, stage: "verify" };
    return { ok: true, spreadsheetId, tab, updatedRange, values, verified };
  } catch (e: any) {
    return { ok: false, error: e?.message || "sheet_write_failed", stage: "write" };
  }
}
