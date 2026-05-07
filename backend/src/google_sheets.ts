import type { Env } from "./index";
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

export async function getRileySheetsStatus(env: Env): Promise<{ ok: boolean; spreadsheetId: string; tab: string; configured: boolean; error?: string }> {
  const spreadsheetId = String(env.RILEY_SHEETS_SPREADSHEET_ID || "").trim();
  const configured = !!spreadsheetId && !!parseServiceAccount(env);
  if (!configured) return { ok: false, spreadsheetId, tab: "", configured, error: "sheets_not_configured" };
  const titles = await loadSheetTitles(env, spreadsheetId).catch(() => []);
  return { ok: true, spreadsheetId, tab: String(titles[0] || "").trim(), configured };
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
  return mentionsSheet && wantsRead;
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

export async function writeRileySheetFromText(env: Env, text: string): Promise<
  | { ok: true; spreadsheetId: string; tab: string; updatedRange?: string; values: string[][] }
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
    return { ok: true, spreadsheetId, tab, updatedRange: data.updatedRange || data.updates?.updatedRange, values };
  } catch (e: any) {
    return { ok: false, error: e?.message || "sheet_write_failed", stage: "write" };
  }
}
