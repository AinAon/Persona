import type { Env } from "./index";

const RILEY_LOG_KEY = "riley_memory/riley_memory.log.jsonl";
const RILEY_STATE_KEY = "riley_memory/riley_state.json";
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
    action: WealthAction;
    bucket: WealthBucket;
    label: string;
    amount: number | null;
    text: string;
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

function safeNumber(v: unknown): number {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n : 0;
}

async function r2Text(env: Env, key: string): Promise<string | null> {
  try {
    const obj = await env.R2.get(key);
    if (!obj) return null;
    if (typeof obj.text === "function") return await obj.text();
    return null;
  } catch {
    return null;
  }
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
  await env.R2.put(
    key,
    JSON.stringify(value),
    { httpMetadata: { contentType: "application/json; charset=utf-8" } },
  );
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
  if (!wonNum) return null;
  const v = safeNumber(wonNum[1]);
  if (!v) return null;
  if (v >= 1000) return Math.round(v);
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

function applyEventToState(state: RileyState, event: WealthEvent): RileyState {
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

function buildEventFromText(text: string): WealthEvent {
  const ts = nowIso();
  const action = classifyAction(text);
  const bucket = classifyBucket(text);
  const amount = parseKrwAmount(text);
  const eventType = `${bucket}_${action}`;
  return {
    event_id: makeId("evt"),
    timestamp: ts,
    mode: "wealth_action",
    event_type: eventType,
    actor: "riley",
    active: action !== "remove",
    payload: {
      action,
      bucket,
      label: extractLabel(text),
      amount,
      text: String(text || "").trim(),
    },
    source_text: String(text || "").trim(),
  };
}

async function appendLogLine(env: Env, event: WealthEvent): Promise<void> {
  const existing = await r2Text(env, RILEY_LOG_KEY);
  const line = JSON.stringify(event);
  const next = existing && existing.trim() ? `${existing.trim()}\n${line}` : line;
  await env.R2.put(
    RILEY_LOG_KEY,
    next,
    { httpMetadata: { contentType: "application/json; charset=utf-8" } },
  );
}

export async function loadRileyState(env: Env): Promise<RileyState> {
  return await r2Json<RileyState>(env, RILEY_STATE_KEY, defaultState());
}

export async function appendRileyWealthEvent(env: Env, text: string): Promise<{ ok: true; eventId: string } | { ok: false; error: string }> {
  const raw = String(text || "").trim();
  if (!raw) return { ok: false, error: "empty text" };
  const event = buildEventFromText(raw);
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
  const raw = await r2Text(env, RILEY_LOG_KEY);
  const lines = raw
    ? raw.split(/\r?\n/).map((x) => x.trim()).filter(Boolean)
    : [];
  const parsed: WealthEvent[] = [];
  for (const line of lines.slice(-Math.max(1, tail))) {
    try {
      parsed.push(JSON.parse(line) as WealthEvent);
    } catch {
      // skip broken line
    }
  }
  return { state, events: parsed };
}
