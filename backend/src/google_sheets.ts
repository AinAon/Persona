import type { Env } from "./index";
import type { WealthEvent } from "./riley_wealth";

type ServiceAccountConfig = {
  clientEmail: string;
  privateKey: string;
};

type SheetsSyncResult =
  | { ok: true; spreadsheetId: string; tab: string; rows: number; imported: number; updated: number; updatedRange?: string }
  | { ok: false; error: string; stage?: string };

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

function rowsFromEvents(events: WealthEvent[]): string[][] {
  const header = [
    "event_id",
    "timestamp",
    "action",
    "bucket",
    "asset_id",
    "label",
    "currency",
    "amount",
    "effective_date",
    "source",
    "note",
    "source_text",
  ];
  const rows = events.map((event) => {
    const payload = event.payload || {};
    return [
      event.event_id || "",
      event.timestamp || "",
      String(payload.action || ""),
      String(payload.bucket || ""),
      String(payload.asset_id || ""),
      String(payload.label || ""),
      String(payload.currency || ""),
      payload.amount == null ? "" : String(payload.amount),
      String(payload.effective_date || ""),
      String(payload.source || ""),
      String(payload.note || ""),
      event.source_text || "",
    ];
  });
  return [header, ...rows];
}

function normalizeAction(raw: string): "add" | "update" | "remove" {
  const s = String(raw || "").trim().toLowerCase();
  if (s === "remove" || s === "delete" || s === "closed") return "remove";
  if (s === "update" || s === "edit") return "update";
  return "add";
}

function normalizeBucket(raw: string): "assets" | "liabilities" | "retirement" | "fixed_cashflow" {
  const s = String(raw || "").trim().toLowerCase();
  if (s === "liability" || s === "liabilities" || s === "debt") return "liabilities";
  if (s === "retirement" || s === "pension") return "retirement";
  if (s === "fixed_cashflow" || s === "cashflow" || s === "income" || s === "expense") return "fixed_cashflow";
  return "assets";
}

function makeSheetEventId(): string {
  return `sheet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function eventFromRow(row: string[], rowIndex: number): WealthEvent | null {
  const eventId = String(row[0] || "").trim() || makeSheetEventId();
  const timestamp = String(row[1] || "").trim() || new Date().toISOString();
  const action = normalizeAction(String(row[2] || ""));
  const bucket = normalizeBucket(String(row[3] || ""));
  const label = String(row[5] || row[4] || `sheet_row_${rowIndex}`).trim();
  const assetId = String(row[4] || `${bucket}:${label.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, "") || "unnamed"}`).trim();
  const amountRaw = String(row[7] || "").replace(/,/g, "").trim();
  const amount = amountRaw === "" ? null : Number(amountRaw);
  const effectiveDate = String(row[8] || "").trim() || timestamp.slice(0, 10);
  if (!label || (amount !== null && !Number.isFinite(amount))) return null;
  const sourceText = String(row[11] || "").trim() || `sheet row ${rowIndex}`;

  return {
    event_id: eventId,
    timestamp,
    mode: "wealth_action",
    event_type: `${bucket}_${action}`,
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
      source: "google_sheet",
      text: sourceText,
      note: String(row[10] || "").trim() || undefined,
    },
    source_text: sourceText,
  };
}

async function readEventsFromSheet(env: Env, spreadsheetId: string, tab: string): Promise<WealthEvent[]> {
  const res = await sheetsFetch(env, `${spreadsheetId}/values/${encodeURIComponent(`${tab}!A2:L`)}`);
  const data = await res.json().catch(() => ({})) as { values?: string[][]; error?: { message?: string } };
  if (!res.ok) throw new Error(data.error?.message || `sheet_read_failed_${res.status}`);
  return (data.values || [])
    .map((row, index) => eventFromRow(row, index + 2))
    .filter((event): event is WealthEvent => !!event);
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

export async function syncRileyWealthEventsToSheet(
  env: Env,
  events: WealthEvent[],
  mergeSheetEvents: (events: WealthEvent[]) => Promise<{ imported: number; updated: number; events: WealthEvent[] }>,
): Promise<SheetsSyncResult> {
  const spreadsheetId = String(env.RILEY_SHEETS_SPREADSHEET_ID || "").trim();
  const tab = String(env.RILEY_SHEETS_TAB || "wealth_events").trim() || "wealth_events";
  if (!spreadsheetId) return { ok: false, error: "riley_sheets_spreadsheet_id_missing", stage: "config" };

  try {
    await ensureSheetTab(env, spreadsheetId, tab);
    const sheetEvents = await readEventsFromSheet(env, spreadsheetId, tab);
    const merge = await mergeSheetEvents(sheetEvents);
    const mergedEvents = merge.events.length ? merge.events : events;
    const range = encodeURIComponent(`${tab}!A1:L${Math.max(1, mergedEvents.length + 1)}`);
    const clearRes = await sheetsFetch(env, `${spreadsheetId}/values/${encodeURIComponent(`${tab}!A:L`)}:clear`, {
      method: "POST",
      body: "{}",
    });
    if (!clearRes.ok) {
      const data = await clearRes.json().catch(() => ({})) as { error?: { message?: string } };
      throw new Error(data.error?.message || `sheet_clear_failed_${clearRes.status}`);
    }

    const updateRes = await sheetsFetch(env, `${spreadsheetId}/values/${range}?valueInputOption=RAW`, {
      method: "PUT",
      body: JSON.stringify({ values: rowsFromEvents(mergedEvents) }),
    });
    const data = await updateRes.json().catch(() => ({})) as { updatedRange?: string; error?: { message?: string } };
    if (!updateRes.ok) throw new Error(data.error?.message || `sheet_update_failed_${updateRes.status}`);
    return { ok: true, spreadsheetId, tab, rows: mergedEvents.length + 1, imported: merge.imported, updated: merge.updated, updatedRange: data.updatedRange };
  } catch (e: any) {
    return { ok: false, error: e?.message || "sheets_sync_failed", stage: "sync" };
  }
}

export async function getRileySheetsStatus(env: Env): Promise<{ ok: boolean; spreadsheetId: string; tab: string; configured: boolean; error?: string }> {
  const spreadsheetId = String(env.RILEY_SHEETS_SPREADSHEET_ID || "").trim();
  const tab = String(env.RILEY_SHEETS_TAB || "wealth_events").trim() || "wealth_events";
  const configured = !!spreadsheetId && !!parseServiceAccount(env);
  if (!configured) return { ok: false, spreadsheetId, tab, configured, error: "sheets_not_configured" };
  return { ok: true, spreadsheetId, tab, configured };
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
      const range = `${title}!A1:L${MAX_CONTEXT_ROWS_PER_TAB}`;
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
    "- Do not assume only wealth_events matters; respect tab names the user mentions, such as 시트1 or 시트2.",
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

function inferTargetTab(text: string, fallback = "시트1"): string {
  const raw = String(text || "");
  const quoted = raw.match(/["'`]([^"'`]{1,80})["'`]\s*(?:탭|시트|sheet|tab)/i)?.[1]
    || raw.match(/(?:탭|시트|sheet|tab)\s*["'`]([^"'`]{1,80})["'`]/i)?.[1];
  if (quoted) return quoted.trim();
  const korean = raw.match(/(시트\s*\d+|시트[^\s,.;:，。]{1,30})\s*(?:에|으로|에다가|탭에)?/i)?.[1];
  if (korean) return korean.replace(/\s+/g, "").trim();
  const named = raw.match(/\b(?:sheet|tab)\s*([A-Za-z0-9_-]{1,40})\b/i)?.[1];
  if (named) return /^sheet/i.test(named) ? named : `Sheet${named}`;
  return fallback;
}

function inferSheetWriteContent(text: string): string {
  const raw = String(text || "").trim();
  const marked = raw.match(/:{3}([\s\S]*)$/);
  if (marked?.[1]?.trim()) return marked[1].trim();
  const after = raw.match(/(?:써줘|써|작성해|작성|추가해|추가|기록해|기록|write|append|add)\s*[:：]?\s*([\s\S]+)$/i)?.[1];
  if (after?.trim()) return after.trim();
  return raw;
}

function isRileySheetWriteIntent(text: string): boolean {
  const raw = String(text || "");
  const mentionsSheet = /(시트|탭|sheet|tab|spreadsheet|스프레드시트)/i.test(raw);
  const wantsWrite = /(써줘|써|작성|추가|기록|입력|write|append|add|insert|update)/i.test(raw);
  const financeWrite = /(자산|부채|대출|연금|퇴직|etf|주식|채권|부동산|포트폴리오|지출|수입|가계|투자|상환|매수|매도|현금흐름|asset|liabilit|loan|debt|portfolio|expense|income|invest)/i.test(raw)
    && /(추가|등록|기록|저장|수정|변경|업데이트|갱신|삭제|제거|해지|매도|write|append|add|set|change|edit|remove|delete|sell)/i.test(raw);
  return (mentionsSheet && wantsWrite) || financeWrite;
}

export async function writeRileySheetFromText(env: Env, text: string): Promise<
  | { ok: true; spreadsheetId: string; tab: string; updatedRange?: string; values: string[][] }
  | { ok: false; error: string; stage?: string }
  | null
> {
  if (!isRileySheetWriteIntent(text)) return null;
  const spreadsheetId = String(env.RILEY_SHEETS_SPREADSHEET_ID || "").trim();
  if (!spreadsheetId) return { ok: false, error: "riley_sheets_spreadsheet_id_missing", stage: "config" };
  const tab = inferTargetTab(text, "시트1");
  const content = inferSheetWriteContent(text);
  const values = [[new Date().toISOString(), "riley_chat", content]];

  try {
    await ensureSheetTab(env, spreadsheetId, tab);
    const range = encodeURIComponent(`${tab}!A:C`);
    const res = await sheetsFetch(env, `${spreadsheetId}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
      method: "POST",
      body: JSON.stringify({ values }),
    });
    const data = await res.json().catch(() => ({})) as { updates?: { updatedRange?: string }; error?: { message?: string } };
    if (!res.ok) throw new Error(data.error?.message || `sheet_append_failed_${res.status}`);
    return { ok: true, spreadsheetId, tab, updatedRange: data.updates?.updatedRange, values };
  } catch (e: any) {
    return { ok: false, error: e?.message || "sheet_write_failed", stage: "write" };
  }
}
