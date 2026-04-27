import type { Env } from "./index";

const AVERY_LOG_KEY = "avery_memory/avery_worklog.log.jsonl";
const AVERY_STATE_KEY = "avery_memory/avery_worklog_state.json";
const AVERY_IDS = new Set(["p_avery", "avery"]);

type WorkKind = "worklog" | "error" | "solution" | "todo" | "reminder";
type WorkAction = "add" | "update" | "remove" | "complete";
type WorkStatus = "active" | "done" | "removed";
type WorkContext = "office" | "home" | "other";
type WorkTool = "codex" | "claude" | "other";

type AveryItem = {
  id: string;
  kind: WorkKind;
  title: string;
  body: string;
  topic_key: string;
  context: WorkContext;
  tool: WorkTool;
  status: WorkStatus;
  due_at: string | null;
  first_seen_at: string;
  updated_at: string;
};

type AveryDaySummary = {
  date: string;
  count: number;
  office_count: number;
  home_count: number;
  by_kind: Record<WorkKind, number>;
  topic_groups: Array<{ topic: string; count: number }>;
};

type AveryState = {
  version: string;
  as_of_date: string;
  items: AveryItem[];
  daily: Record<string, AveryDaySummary>;
  stats: {
    active: number;
    done: number;
    removed: number;
    reminders_active: number;
    days_with_work: number;
    days_without_work: number;
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
    topic_key: string;
    context: WorkContext;
    tool: WorkTool;
    due_at: string | null;
    source: "chat_text";
    text: string;
  };
  source_text: string;
};

type AveryFollowupHints = {
  stale_active: string[];
  unresolved_errors: string[];
  likely_gaps: string[];
};

function nowIso(): string {
  return new Date().toISOString();
}

function todayYmd(iso: string): string {
  return String(iso || nowIso()).slice(0, 10);
}

function kstYmd(iso: string): string {
  const ms = Date.parse(String(iso || nowIso()));
  if (!Number.isFinite(ms)) return todayYmd(nowIso());
  const kst = new Date(ms + 9 * 60 * 60 * 1000).toISOString();
  return kst.slice(0, 10);
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
  const daySet = new Set(items.map((x) => kstYmd(x.updated_at)));
  let days_with_work = daySet.size;
  let days_without_work = 0;
  if (items.length > 0) {
    const minTs = Math.min(...items.map((x) => Date.parse(x.first_seen_at || x.updated_at)).filter((x) => Number.isFinite(x)));
    const maxTs = Date.parse(nowIso());
    if (Number.isFinite(minTs) && Number.isFinite(maxTs) && maxTs >= minTs) {
      const spanDays = Math.floor((maxTs - minTs) / 86400000) + 1;
      days_without_work = Math.max(0, spanDays - days_with_work);
    }
  } else {
    days_with_work = 0;
    days_without_work = 0;
  }
  return { active, done, removed, reminders_active, days_with_work, days_without_work };
}

function emptyDay(date: string): AveryDaySummary {
  return {
    date,
    count: 0,
    office_count: 0,
    home_count: 0,
    by_kind: { worklog: 0, error: 0, solution: 0, todo: 0, reminder: 0 },
    topic_groups: [],
  };
}

function buildDaily(items: AveryItem[]): Record<string, AveryDaySummary> {
  const out: Record<string, AveryDaySummary> = {};
  for (const item of items) {
    const d = kstYmd(item.updated_at);
    if (!out[d]) out[d] = emptyDay(d);
    const day = out[d];
    day.count += 1;
    if (item.context === "office") day.office_count += 1;
    if (item.context === "home") day.home_count += 1;
    day.by_kind[item.kind] = (day.by_kind[item.kind] || 0) + 1;
    const idx = day.topic_groups.findIndex((g) => g.topic === item.topic_key);
    if (idx >= 0) day.topic_groups[idx].count += 1;
    else day.topic_groups.push({ topic: item.topic_key, count: 1 });
  }
  for (const d of Object.keys(out)) {
    out[d].topic_groups.sort((a, b) => b.count - a.count);
  }
  return out;
}

function daysAgoFromIso(ts: string): number {
  const n = Date.parse(String(ts || ""));
  if (!Number.isFinite(n)) return 0;
  const diff = Date.now() - n;
  if (diff <= 0) return 0;
  return Math.floor(diff / 86400000);
}

function buildFollowupHints(state: AveryState): AveryFollowupHints {
  const items = Array.isArray(state.items) ? state.items : [];
  const active = items.filter((x) => x.status === "active");
  const stale_active = active
    .filter((x) => daysAgoFromIso(x.updated_at || x.first_seen_at) >= 2)
    .sort((a, b) => Date.parse(a.updated_at || a.first_seen_at) - Date.parse(b.updated_at || b.first_seen_at))
    .slice(0, 4)
    .map((x) => `${x.title} (${daysAgoFromIso(x.updated_at || x.first_seen_at)}d)`);

  const solvedTopics = new Set(
    items
      .filter((x) => x.kind === "solution" || x.status === "done")
      .map((x) => norm(x.topic_key)),
  );
  const unresolved_errors = active
    .filter((x) => x.kind === "error" && !solvedTopics.has(norm(x.topic_key)))
    .slice(0, 4)
    .map((x) => x.title);

  const likely_gaps: string[] = [];
  if ((state.stats?.days_without_work || 0) >= 2) {
    likely_gaps.push(`worklog blank days=${state.stats.days_without_work}`);
  }
  const days = Object.keys(state.daily || {}).sort();
  for (let i = 1; i < days.length; i++) {
    const prev = Date.parse(`${days[i - 1]}T00:00:00Z`);
    const cur = Date.parse(`${days[i]}T00:00:00Z`);
    if (!Number.isFinite(prev) || !Number.isFinite(cur)) continue;
    const gap = Math.floor((cur - prev) / 86400000) - 1;
    if (gap >= 2) {
      likely_gaps.push(`${days[i - 1]} -> ${days[i]} (gap ${gap}d)`);
      if (likely_gaps.length >= 3) break;
    }
  }

  return { stale_active, unresolved_errors, likely_gaps };
}

function defaultState(): AveryState {
  const iso = nowIso();
  const items: AveryItem[] = [];
  return {
    version: "1.1.0",
    as_of_date: todayYmd(iso),
    items,
    daily: {},
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

function isPersonalChatText(text: string): boolean {
  const t = String(text || "").trim().toLowerCase();
  if (!t) return false;
  return /(안녕|ㅎㅇ|하이|hello|hi|뭐해|배고|졸리|심심|주말|영화|드라마|연애|날씨|저녁|점심|아침|놀자|수다)/i.test(t);
}

export function classifyAveryConversation(text: string): "work" | "personal" | "mixed" {
  const t = String(text || "").trim();
  if (!t) return "personal";
  const hasWork = isWorklogIntentText(t)
    || /(배포|deploy|push|commit|브랜치|branch|코드|리팩터|테스트|test|빌드|build|로그|log|api|모듈|성능|최적화|리그레션|버전|릴리스|회의|요건|요구사항|기획|문서|spec)/i.test(t);
  const hasPersonal = isPersonalChatText(t);
  if (hasWork && hasPersonal) return "mixed";
  if (hasWork) return "work";
  return "personal";
}

export function shouldPersistAveryWorklogText(text: string): boolean {
  const cls = classifyAveryConversation(text);
  return cls === "work" || cls === "mixed";
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

function classifyContext(text: string): WorkContext {
  const t = String(text || "").toLowerCase();
  if (/(출근|회사|사무실|office|workplace|근무)/i.test(t)) return "office";
  if (/(집|재택|home|house|원격)/i.test(t)) return "home";
  return "other";
}

function classifyTool(text: string): WorkTool {
  const t = String(text || "").toLowerCase();
  if (/(codex|코덱스)/i.test(t)) return "codex";
  if (/(claude|클로드)/i.test(t)) return "claude";
  return "other";
}

function classifyTopicKey(text: string): string {
  const t = String(text || "").toLowerCase();
  if (/(메모리|memory)/i.test(t)) return "memory";
  if (/(캐시|cache|로딩|loading|stale)/i.test(t)) return "cache_loading";
  if (/(이미지|image|upload|업로드)/i.test(t)) return "image_upload";
  if (/(채팅|chat|세션|session|히스토리|history)/i.test(t)) return "chat_session";
  if (/(에러|오류|버그|error|bug|exception)/i.test(t)) return "bugfix";
  if (/(배포|deploy|push|commit|브랜치|branch|git)/i.test(t)) return "release_git";
  if (/(리마인더|알림|reminder|deadline)/i.test(t)) return "reminder";
  return "general";
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
  if (!["office", "home", "other"].includes(p.context)) return false;
  if (!["codex", "claude", "other"].includes(p.tool)) return false;
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
      topic_key: p.topic_key || next[idx].topic_key,
      context: p.context || next[idx].context,
      tool: p.tool || next[idx].tool,
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
    topic_key: p.topic_key || "general",
    context: p.context || "other",
    tool: p.tool || "other",
    status,
    due_at: p.due_at,
    first_seen_at: event.timestamp,
    updated_at: event.timestamp,
  });
  return next;
}

function applyEventToState(state: AveryState, event: AveryEvent): AveryState {
  if (!isValidAveryEvent(event)) return state;
  const oldItems = Array.isArray(state.items) ? state.items : [];
  const nextItems = upsertItem(oldItems, event);
  const next: AveryState = {
    ...state,
    version: "1.1.0",
    items: nextItems,
    daily: buildDaily(nextItems),
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
      topic_key: classifyTopicKey(raw),
      context: classifyContext(raw),
      tool: classifyTool(raw),
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
  const loaded = await r2Json<AveryState>(env, AVERY_STATE_KEY, defaultState());
  const normalizedItems = (Array.isArray(loaded.items) ? loaded.items : []).map((x) => ({
    ...x,
    topic_key: x.topic_key || "general",
    context: x.context || "other",
    tool: x.tool || "other",
    first_seen_at: x.first_seen_at || x.updated_at || nowIso(),
  }));
  const daily = buildDaily(normalizedItems);
  return {
    ...loaded,
    version: "1.1.0",
    items: normalizedItems,
    daily,
    stats: computeStats(normalizedItems),
  };
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
  const recentDays = Object.keys(state.daily || {}).sort((a, b) => (a < b ? 1 : -1)).slice(0, 7);
  const dayLines = recentDays.map((d) => {
    const day = state.daily[d];
    const topics = (day?.topic_groups || []).slice(0, 3).map((x) => x.topic).join(",");
    return `${d}:count=${day?.count || 0},office=${day?.office_count || 0},home=${day?.home_count || 0},topics=${topics || "none"}`;
  });
  const hints = buildFollowupHints(state);
  return [
    "Avery worklog snapshot (persistent):",
    `as_of_date=${state.as_of_date}`,
    `stats.active=${state.stats.active}`,
    `stats.done=${state.stats.done}`,
    `stats.reminders_active=${state.stats.reminders_active}`,
    `stats.days_with_work=${state.stats.days_with_work}`,
    `stats.days_without_work=${state.stats.days_without_work}`,
    `errors=${topErrors.join(" | ") || "none"}`,
    `todos=${topTodos.join(" | ") || "none"}`,
    `reminders=${topReminders.join(" | ") || "none"}`,
    `daily_recent=${dayLines.join(" || ") || "none"}`,
    `followup_candidates.stale_active=${hints.stale_active.join(" | ") || "none"}`,
    `followup_candidates.unresolved_errors=${hints.unresolved_errors.join(" | ") || "none"}`,
    `followup_candidates.gaps=${hints.likely_gaps.join(" | ") || "none"}`,
    "When user asks to record/update/remove tasks or lessons learned, keep this snapshot consistent.",
    "Do not force logging every turn.",
    "If there are stale active items, unresolved errors, or timeline gaps, occasionally ask one short check question.",
    "Ask at most one follow-up question in a reply, and only when it helps fill missing history (status, blocker, workaround, solved_at).",
    "When user asks unrelated casual chat, prioritize normal conversation and skip follow-up probing.",
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
