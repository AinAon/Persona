import type { Env } from "./index";

const AVERY_LOG_KEY = "avery_memory/avery_worklog.log.jsonl";
const AVERY_STATE_KEY = "avery_memory/avery_worklog_state.json";
const AVERY_IDS = new Set(["p_avery", "avery"]);

type WorkKind = "worklog" | "error" | "solution" | "todo" | "reminder";
type WorkAction = "add" | "update" | "remove" | "complete";
type WorkStatus = "active" | "done" | "removed";

type AveryItem = {
  id: string;
  kind: WorkKind;
  title: string;
  body: string;
  status: WorkStatus;
  due_at: string | null;
  updated_at: string;
};

type AveryState = {
  version: string;
  as_of_date: string;
  items: AveryItem[];
  stats: {
    active: number;
    done: number;
    removed: number;
    reminders_active: number;
  };
  meta: {
    last_event_id: string;
    last_updated_at: string;
    source_log: string;
  };
};

type AveryEvent = {
  event_id: string;
  timestamp: string;
  mode: "avery_worklog_action";
  event_type: string;
  actor: "avery";
  active: boolean;
  payload: {
    schema_version: "1.0.0";
    action: WorkAction;
    kind: WorkKind;
    item_id: string;
    title: string;
    body: string;
    due_at: string | null;
    source: "chat_text";
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

function norm(s: string): string {
  return String(s || "").trim().toLowerCase();
}

function toItemId(kind: WorkKind, title: string): string {
  const key = String(title || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  return `${kind}:${key || "unnamed"}`;
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

function computeStats(items: AveryItem[]): AveryState["stats"] {
  const active = items.filter((x) => x.status === "active").length;
  const done = items.filter((x) => x.status === "done").length;
  const removed = items.filter((x) => x.status === "removed").length;
  const reminders_active = items.filter((x) => x.status === "active" && x.kind === "reminder").length;
  return { active, done, removed, reminders_active };
}

function defaultState(): AveryState {
  const iso = nowIso();
  const items: AveryItem[] = [];
  return {
    version: "1.0.0",
    as_of_date: todayYmd(iso),
    items,
    stats: computeStats(items),
    meta: {
      last_event_id: "",
      last_updated_at: iso,
      source_log: "avery_worklog.log.jsonl",
    },
  };
}

export function isAveryParticipant(participantPids: string[] = []): boolean {
  return participantPids.some((pid) => AVERY_IDS.has(norm(pid)));
}

export function isWorklogIntentText(text: string): boolean {
  const t = String(text || "").toLowerCase();
  if (!t) return false;
  return /(작업|작업내역|에러|오류|버그|해결|수정|할일|todo|to-do|다음|리마인더|알림|마감|업무|worklog|issue|error|fix|resolve|task|reminder|deadline|next)/i.test(t);
}

export function isWorklogMutationText(text: string): boolean {
  const t = String(text || "").toLowerCase();
  if (!isWorklogIntentText(t)) return false;
  return /(추가|등록|기록|저장|수정|변경|업데이트|갱신|삭제|제거|완료|끝|체크|add|create|set|update|change|edit|remove|delete|complete|done|close)/i.test(t);
}

function classifyKind(text: string): WorkKind {
  const t = String(text || "").toLowerCase();
  if (/(에러|오류|버그|error|bug|exception|fail)/i.test(t)) return "error";
  if (/(해결|수정완료|원인해결|fix|resolve|solution|patched)/i.test(t)) return "solution";
  if (/(리마인더|알림|마감|deadline|reminder|due)/i.test(t)) return "reminder";
  if (/(할일|todo|to-do|다음|next)/i.test(t)) return "todo";
  return "worklog";
}

function classifyAction(text: string): WorkAction {
  const t = String(text || "").toLowerCase();
  if (/(삭제|제거|드랍|drop|remove|delete)/i.test(t)) return "remove";
  if (/(완료|끝|해결됨|done|complete|closed)/i.test(t)) return "complete";
  if (/(수정|변경|업데이트|갱신|update|change|edit|revise)/i.test(t)) return "update";
  return "add";
}

function extractTitle(text: string): string {
  const oneLine = String(text || "").replace(/\s+/g, " ").trim();
  if (!oneLine) return "untitled";
  return oneLine.length > 90 ? `${oneLine.slice(0, 90)}...` : oneLine;
}

function parseDueAt(text: string, ts: string): string | null {
  const raw = String(text || "");
  const dt = raw.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?\b/);
  if (dt) {
    const y = dt[1];
    const mo = String(Number(dt[2])).padStart(2, "0");
    const d = String(Number(dt[3])).padStart(2, "0");
    const hh = String(Number(dt[4] || 9)).padStart(2, "0");
    const mm = String(Number(dt[5] || 0)).padStart(2, "0");
    return `${y}-${mo}-${d}T${hh}:${mm}:00+09:00`;
  }
  if (/(내일|tomorrow)/i.test(raw)) {
    const base = new Date(ts);
    base.setUTCDate(base.getUTCDate() + 1);
    return `${todayYmd(base.toISOString())}T09:00:00+09:00`;
  }
  return null;
}

function isValidAveryEvent(event: AveryEvent): boolean {
  if (!event?.payload) return false;
  const p = event.payload;
  if (!p.schema_version || !p.item_id || !p.title) return false;
  if (!["add", "update", "remove", "complete"].includes(p.action)) return false;
  if (!["worklog", "error", "solution", "todo", "reminder"].includes(p.kind)) return false;
  return true;
}

function upsertItem(list: AveryItem[], event: AveryEvent): AveryItem[] {
  const next = [...list];
  const p = event.payload;
  const idx = next.findIndex((x) => x.id === p.item_id || (norm(x.title) === norm(p.title) && x.kind === p.kind));
  const status: WorkStatus = p.action === "complete" ? "done" : (p.action === "remove" ? "removed" : "active");

  if (idx >= 0) {
    next[idx] = {
      ...next[idx],
      title: p.title,
      body: p.body || next[idx].body,
      due_at: p.due_at,
      status,
      updated_at: event.timestamp,
    };
    return next;
  }

  next.push({
    id: p.item_id,
    kind: p.kind,
    title: p.title,
    body: p.body || p.text || "",
    status,
    due_at: p.due_at,
    updated_at: event.timestamp,
  });
  return next;
}

function applyEventToState(state: AveryState, event: AveryEvent): AveryState {
  if (!isValidAveryEvent(event)) return state;
  const next: AveryState = {
    ...state,
    items: upsertItem(state.items || [], event),
    meta: { ...state.meta },
  };
  next.stats = computeStats(next.items);
  next.as_of_date = todayYmd(event.timestamp);
  next.meta.last_event_id = event.event_id;
  next.meta.last_updated_at = event.timestamp;
  return next;
}

function parseStructuredFromText(text: string): AveryEvent | null {
  const raw = String(text || "").trim();
  if (!raw) return null;
  const ts = nowIso();
  const kind = classifyKind(raw);
  const action = classifyAction(raw);
  const title = extractTitle(raw);
  const event: AveryEvent = {
    event_id: makeId("evt"),
    timestamp: ts,
    mode: "avery_worklog_action",
    event_type: `${kind}_${action}`,
    actor: "avery",
    active: action !== "remove",
    payload: {
      schema_version: "1.0.0",
      action,
      kind,
      item_id: toItemId(kind, title),
      title,
      body: raw,
      due_at: parseDueAt(raw, ts),
      source: "chat_text",
      text: raw,
    },
    source_text: raw,
  };
  return isValidAveryEvent(event) ? event : null;
}

async function appendLogLine(env: Env, event: AveryEvent): Promise<void> {
  const existing = await r2Text(env, AVERY_LOG_KEY);
  const line = JSON.stringify(event);
  const next = existing && existing.trim() ? `${existing.trim()}\n${line}` : line;
  await env.R2.put(
    AVERY_LOG_KEY,
    next,
    { httpMetadata: { contentType: "application/json; charset=utf-8" } },
  );
}

async function loadAllAveryEvents(env: Env): Promise<AveryEvent[]> {
  const raw = await r2Text(env, AVERY_LOG_KEY);
  const lines = raw
    ? raw.split(/\r?\n/).map((x) => x.trim()).filter(Boolean)
    : [];
  const parsed: AveryEvent[] = [];
  for (const line of lines) {
    try {
      const event = JSON.parse(line) as AveryEvent;
      if (isValidAveryEvent(event)) parsed.push(event);
    } catch {
      // skip broken line
    }
  }
  return parsed;
}

export async function loadAveryState(env: Env): Promise<AveryState> {
  return await r2Json<AveryState>(env, AVERY_STATE_KEY, defaultState());
}

export async function appendAveryWorklogEvent(env: Env, text: string): Promise<{ ok: true; eventId: string } | { ok: false; error: string }> {
  const raw = String(text || "").trim();
  if (!raw) return { ok: false, error: "empty text" };
  const event = parseStructuredFromText(raw);
  if (!event) return { ok: false, error: "parse_failed" };
  const prev = await loadAveryState(env);
  const next = applyEventToState(prev, event);
  await appendLogLine(env, event);
  await r2PutJson(env, AVERY_STATE_KEY, next);
  return { ok: true, eventId: event.event_id };
}

export function buildAverySystemPrompt(state: AveryState): string {
  const active = (state.items || []).filter((x) => x.status === "active");
  const topErrors = active.filter((x) => x.kind === "error").slice(0, 6).map((x) => x.title);
  const topTodos = active.filter((x) => x.kind === "todo").slice(0, 6).map((x) => x.title);
  const topReminders = active
    .filter((x) => x.kind === "reminder")
    .slice(0, 6)
    .map((x) => `${x.title}${x.due_at ? `@${x.due_at}` : ""}`);
  return [
    "Avery worklog snapshot (persistent):",
    `as_of_date=${state.as_of_date}`,
    `stats.active=${state.stats.active}`,
    `stats.done=${state.stats.done}`,
    `stats.reminders_active=${state.stats.reminders_active}`,
    `errors=${topErrors.join(" | ") || "none"}`,
    `todos=${topTodos.join(" | ") || "none"}`,
    `reminders=${topReminders.join(" | ") || "none"}`,
    "When user asks to record/update/remove tasks or lessons learned, keep this snapshot consistent.",
  ].join("\n");
}

export async function getAveryWorklogSnapshot(env: Env, tail = 30): Promise<{ state: AveryState; events: AveryEvent[] }> {
  const state = await loadAveryState(env);
  const allEvents = await loadAllAveryEvents(env);
  return { state, events: allEvents.slice(-Math.max(1, tail)) };
}

export async function reconcileAveryWorklog(env: Env): Promise<{
  ok: true;
  changed: boolean;
  report: {
    events: number;
    oldStats: AveryState["stats"];
    newStats: AveryState["stats"];
  };
}> {
  const oldState = await loadAveryState(env);
  const events = await loadAllAveryEvents(env);
  let rebuilt = defaultState();
  for (const e of events) rebuilt = applyEventToState(rebuilt, e);
  rebuilt.meta.last_event_id = events.length ? events[events.length - 1].event_id : "";
  rebuilt.meta.last_updated_at = events.length ? events[events.length - 1].timestamp : nowIso();
  rebuilt.meta.source_log = "avery_worklog.log.jsonl";

  const changed = JSON.stringify(oldState.stats) !== JSON.stringify(rebuilt.stats)
    || oldState.items.length !== rebuilt.items.length;
  if (changed) {
    await r2PutJson(env, AVERY_STATE_KEY, rebuilt);
  }
  return {
    ok: true,
    changed,
    report: {
      events: events.length,
      oldStats: oldState.stats,
      newStats: rebuilt.stats,
    },
  };
}
