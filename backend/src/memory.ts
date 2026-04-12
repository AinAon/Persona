import type { Env } from "./index";
import { generateGrokText } from "./model_grok";

export type MemoryScope = "public_profile" | "private_profile";

export type MemoryItem = {
  id: string;
  scope: MemoryScope;
  owner: string;
  text: string;
  source: "manual" | "chat";
  fingerprint: string;
  locked?: boolean;
  createdAt: number;
  updatedAt: number;
  lastSeenAt: number;
};

type SessionMemoryMeta = {
  lastExtractedAt: number;
  lastOptimizedAt: number;
};

type GlobalMemoryMeta = {
  lastOptimizedAt: number;
};

const MEMORY_MODEL = "grok-4.20-non-reasoning";
const MAX_ITEM_LEN = 220;

const EXPLICIT_MARKERS = [
  "remember this",
  "note this",
  "save this",
  "keep this",
  "remember",
];

const PROFILE_HINTS = [
  "my name",
  "i am",
  "i'm",
  "i like",
  "i prefer",
  "favorite",
  "allergy",
  "job",
  "birthday",
  "mbti",
];

function nowTs(): number {
  return Date.now();
}

function isKvWriteLimitError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error || "");
  return /kv\s+put\(\)\s+limit\s+exceeded/i.test(msg) || /limit exceeded/i.test(msg);
}

function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function normalizeText(input: string): string {
  return String(input || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s.,!?-]/gu, "")
    .trim();
}

function makeFingerprint(normalized: string): string {
  let hash = 5381;
  for (let i = 0; i < normalized.length; i++) {
    hash = ((hash << 5) + hash) + normalized.charCodeAt(i);
    hash |= 0;
  }
  return `fp_${(hash >>> 0).toString(16)}`;
}

function clampText(text: string, max = MAX_ITEM_LEN): string {
  const trimmed = String(text || "").trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 3)}...`;
}

function stripProfilePrefix(text: string): string {
  return String(text || "")
    .replace(/^\s*profile\s*:\s*/i, "")
    .trim();
}

function isValidScope(scope: string): scope is MemoryScope {
  return scope === "public_profile" || scope === "private_profile";
}

function normalizeOwner(scope: MemoryScope, owner?: string): string {
  if (scope === "public_profile") return "global";
  const clean = String(owner || "").trim();
  return clean || "unknown";
}

function itemKey(scope: MemoryScope, owner: string, id: string): string {
  return `memory:item:${scope}:${owner}:${id}`;
}

function indexKey(scope: MemoryScope, owner: string): string {
  return `memory:index:${scope}:${owner}`;
}

function fpKey(scope: MemoryScope, owner: string, fingerprint: string): string {
  return `memory:fp:${scope}:${owner}:${fingerprint}`;
}

function sessionMetaKey(sessionId: string): string {
  return `memory:meta:session:${sessionId}`;
}

function globalMetaKey(): string {
  return "memory:meta:global";
}

type LegacyMemoryDoc = {
  version: 1;
  items: MemoryItem[];
};

type MemoryChunkIndexDoc = {
  version: 1;
  chunks: string[];
};

type MemoryChunkDoc = {
  version: 1;
  items: MemoryItem[];
};

function legacyMemoryDocR2Key(scope: MemoryScope, owner: string): string {
  return `memory/${scope}/${owner}/memories.json`;
}

function memoryChunkIndexR2Key(scope: MemoryScope, owner: string): string {
  return `memory/${scope}/${owner}/index.json`;
}

function memoryChunkR2Key(scope: MemoryScope, owner: string, chunk: string): string {
  return `memory/${scope}/${owner}/chunks/${chunk}.json`;
}

function monthChunkFromTs(ts: number): string {
  const d = new Date(Number(ts || nowTs()));
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

async function readR2Text(env: Env, key: string): Promise<string | null> {
  try {
    const obj = await env.R2.get(key);
    if (!obj) return null;
    if (typeof obj.text === "function") return await obj.text();
    return null;
  } catch {
    return null;
  }
}

async function readR2Json<T>(env: Env, key: string, fallback: T): Promise<T> {
  const text = await readR2Text(env, key);
  if (!text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

async function writeR2Json(env: Env, key: string, value: unknown): Promise<void> {
  await env.R2.put(
    key,
    JSON.stringify(value),
    { httpMetadata: { contentType: "application/json; charset=utf-8" } },
  );
}

function sortMemoryItems(items: MemoryItem[]): MemoryItem[] {
  return [...items].sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
}

async function getIndex(env: Env, scope: MemoryScope, owner: string): Promise<string[]> {
  return safeJsonParse<string[]>(await env.KV.get(indexKey(scope, owner)), []);
}

async function putIndex(env: Env, scope: MemoryScope, owner: string, ids: string[]): Promise<void> {
  await env.KV.put(indexKey(scope, owner), JSON.stringify(ids.slice(0, 1000)));
}

async function getItem(env: Env, scope: MemoryScope, owner: string, id: string): Promise<MemoryItem | null> {
  return safeJsonParse<MemoryItem | null>(await env.KV.get(itemKey(scope, owner, id)), null);
}

function normalizeMemoryItemShape(item: MemoryItem): MemoryItem {
  return {
    ...item,
    locked: !!item.locked,
  };
}

async function loadLegacyMemoryItems(env: Env, scope: MemoryScope, owner: string): Promise<MemoryItem[]> {
  const ids = await getIndex(env, scope, owner);
  if (!ids.length) return [];
  const items: MemoryItem[] = [];
  for (const id of ids) {
    const it = await getItem(env, scope, owner, id);
    if (it) items.push(normalizeMemoryItemShape(it));
  }
  return items;
}

async function getChunkIndex(env: Env, scope: MemoryScope, owner: string): Promise<string[]> {
  const key = memoryChunkIndexR2Key(scope, owner);
  const idx = await readR2Json<MemoryChunkIndexDoc | null>(env, key, null);
  if (!idx || !Array.isArray(idx.chunks)) return [];
  return [...new Set(idx.chunks.map((x) => String(x || "").trim()).filter(Boolean))].sort().reverse();
}

async function putChunkIndex(env: Env, scope: MemoryScope, owner: string, chunks: string[]): Promise<void> {
  const uniq = [...new Set(chunks.map((x) => String(x || "").trim()).filter(Boolean))].sort().reverse();
  await writeR2Json(env, memoryChunkIndexR2Key(scope, owner), { version: 1, chunks: uniq } satisfies MemoryChunkIndexDoc);
}

async function getChunkItems(env: Env, scope: MemoryScope, owner: string, chunk: string): Promise<MemoryItem[]> {
  const key = memoryChunkR2Key(scope, owner, chunk);
  const doc = await readR2Json<MemoryChunkDoc | null>(env, key, null);
  if (!doc || !Array.isArray(doc.items)) return [];
  return doc.items.map((it) => normalizeMemoryItemShape(it));
}

async function putChunkItems(env: Env, scope: MemoryScope, owner: string, chunk: string, items: MemoryItem[]): Promise<void> {
  const key = memoryChunkR2Key(scope, owner, chunk);
  await writeR2Json(env, key, { version: 1, items: sortMemoryItems(items) } satisfies MemoryChunkDoc);
}

function bucketByMonth(items: MemoryItem[]): Record<string, MemoryItem[]> {
  const out: Record<string, MemoryItem[]> = {};
  for (const item of items) {
    const chunk = monthChunkFromTs(item.createdAt || item.updatedAt || nowTs());
    if (!out[chunk]) out[chunk] = [];
    out[chunk].push(item);
  }
  return out;
}

async function migrateLegacyToChunks(env: Env, scope: MemoryScope, owner: string): Promise<void> {
  let items: MemoryItem[] = [];

  const legacyDoc = await readR2Json<LegacyMemoryDoc | null>(env, legacyMemoryDocR2Key(scope, owner), null);
  if (legacyDoc && Array.isArray(legacyDoc.items)) {
    items = legacyDoc.items.map((it) => normalizeMemoryItemShape(it));
  } else {
    items = await loadLegacyMemoryItems(env, scope, owner);
  }
  if (!items.length) return;

  const buckets = bucketByMonth(items);
  const chunks = Object.keys(buckets).sort().reverse();
  for (const chunk of chunks) {
    await putChunkItems(env, scope, owner, chunk, buckets[chunk] || []);
  }
  await putChunkIndex(env, scope, owner, chunks);

  // best-effort cleanup of old layouts
  await env.KV.delete(indexKey(scope, owner));
  for (const item of items) {
    await env.KV.delete(itemKey(scope, owner, item.id));
    if (item.fingerprint) await env.KV.delete(fpKey(scope, owner, item.fingerprint));
  }
  await env.R2.delete(legacyMemoryDocR2Key(scope, owner));
}

async function loadAllChunkItems(
  env: Env,
  scope: MemoryScope,
  owner: string,
): Promise<{ chunks: string[]; byChunk: Record<string, MemoryItem[]>; all: MemoryItem[] }> {
  let chunks = await getChunkIndex(env, scope, owner);
  if (!chunks.length) {
    await migrateLegacyToChunks(env, scope, owner);
    chunks = await getChunkIndex(env, scope, owner);
  }

  const byChunk: Record<string, MemoryItem[]> = {};
  const all: MemoryItem[] = [];
  for (const chunk of chunks) {
    const items = await getChunkItems(env, scope, owner, chunk);
    byChunk[chunk] = items;
    all.push(...items);
  }
  return { chunks, byChunk, all: sortMemoryItems(all) };
}

async function writeAllChunkItems(
  env: Env,
  scope: MemoryScope,
  owner: string,
  items: MemoryItem[],
): Promise<void> {
  const buckets = bucketByMonth(items);
  const chunks = Object.keys(buckets).sort().reverse();
  for (const chunk of chunks) {
    await putChunkItems(env, scope, owner, chunk, buckets[chunk] || []);
  }
  await putChunkIndex(env, scope, owner, chunks);
}

function tokenize(text: string): Set<string> {
  return new Set(
    normalizeText(text)
      .split(" ")
      .filter((t) => t.length >= 2),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size && !b.size) return 1;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union ? inter / union : 0;
}

function findNearDuplicateInItems(
  items: MemoryItem[],
  text: string,
  threshold = 0.86,
): MemoryItem | null {
  if (!items.length) return null;
  const target = tokenize(text);
  for (const existing of items.slice(0, 30)) {
    const score = jaccard(target, tokenize(existing.text));
    if (score >= threshold) return existing;
  }
  return null;
}

export async function listMemories(
  env: Env,
  scope: MemoryScope,
  owner: string,
  limit = 50,
): Promise<MemoryItem[]> {
  const cleanOwner = normalizeOwner(scope, owner);
  const max = Math.max(1, Math.min(limit, 200));
  const { chunks, byChunk } = await loadAllChunkItems(env, scope, cleanOwner);
  const out: MemoryItem[] = [];
  for (const chunk of chunks) {
    const items = sortMemoryItems(byChunk[chunk] || []);
    for (const it of items) {
      out.push(it);
      if (out.length >= max) return out;
    }
  }
  return out;
}

export async function upsertMemory(
  env: Env,
  args: {
    scope: MemoryScope;
    owner?: string;
    text: string;
    source?: "manual" | "chat";
    createdAt?: number;
  },
): Promise<{ item: MemoryItem | null; duplicate: boolean }> {
  const scope = args.scope;
  const owner = normalizeOwner(scope, args.owner);
  const text = clampText(stripProfilePrefix(args.text), MAX_ITEM_LEN);
  if (!text) return { item: null, duplicate: false };

  const normalized = normalizeText(text);
  if (!normalized) return { item: null, duplicate: false };
  const fingerprint = makeFingerprint(normalized);
  const now = nowTs();
  const loaded = await loadAllChunkItems(env, scope, owner);
  const items = loaded.all.map((it) => normalizeMemoryItemShape(it));

  const byFp = items.find((it) => it.fingerprint === fingerprint);
  if (byFp) {
    byFp.lastSeenAt = now;
    byFp.updatedAt = now;
    await writeAllChunkItems(env, scope, owner, items);
    return { item: byFp, duplicate: true };
  }

  const nearDup = findNearDuplicateInItems(items, text);
  if (nearDup) {
    nearDup.lastSeenAt = now;
    nearDup.updatedAt = now;
    await writeAllChunkItems(env, scope, owner, items);
    return { item: nearDup, duplicate: true };
  }

  const id = `m_${now.toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const item: MemoryItem = {
    id,
    scope,
    owner,
    text,
    source: args.source || "manual",
    fingerprint,
    locked: false,
    createdAt: args.createdAt || now,
    updatedAt: now,
    lastSeenAt: now,
  };
  items.unshift(item);
  await writeAllChunkItems(env, scope, owner, items);
  return { item, duplicate: false };
}

export async function deleteMemory(
  env: Env,
  scope: MemoryScope,
  owner: string,
  id: string,
  force = false,
): Promise<boolean> {
  const cleanOwner = normalizeOwner(scope, owner);
  const loaded = await loadAllChunkItems(env, scope, cleanOwner);
  const found = loaded.all.find((it) => it.id === id) || null;
  if (!found) return false;
  if (found.locked && !force) return false;
  const nextItems = loaded.all.filter((it) => it.id !== id);
  await writeAllChunkItems(env, scope, cleanOwner, nextItems);
  return true;
}

export async function setMemoryLock(
  env: Env,
  scope: MemoryScope,
  owner: string,
  id: string,
  locked: boolean,
): Promise<MemoryItem | null> {
  const cleanOwner = normalizeOwner(scope, owner);
  const loaded = await loadAllChunkItems(env, scope, cleanOwner);
  const found = loaded.all.find((it) => it.id === id) || null;
  if (!found) return null;
  found.locked = !!locked;
  found.updatedAt = nowTs();
  await writeAllChunkItems(env, scope, cleanOwner, loaded.all);
  return found;
}

export async function setMemoryText(
  env: Env,
  scope: MemoryScope,
  owner: string,
  id: string,
  text: string,
): Promise<MemoryItem | null> {
  const cleanOwner = normalizeOwner(scope, owner);
  const loaded = await loadAllChunkItems(env, scope, cleanOwner);
  const found = loaded.all.find((it) => it.id === id) || null;
  if (!found) return null;

  const cleanText = clampText(stripProfilePrefix(text), MAX_ITEM_LEN);
  if (!cleanText) return null;
  found.text = cleanText;
  found.fingerprint = makeFingerprint(normalizeText(cleanText));
  found.updatedAt = nowTs();

  await writeAllChunkItems(env, scope, cleanOwner, loaded.all);
  return found;
}

function flattenMessageText(content: unknown): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((c: any) => (c?.type === "text" ? String(c.text || "") : ""))
      .filter(Boolean)
      .join(" ");
  }
  return String(content);
}

function stripNoisyPhrases(text: string): string {
  return String(text || "")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/[(){}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function shouldCaptureProfile(text: string): boolean {
  const t = normalizeText(text);
  return PROFILE_HINTS.some((k) => t.includes(normalizeText(k)));
}

function findMentionedPersonaPids(text: string, participantPids: string[]): string[] {
  const t = normalizeText(text);
  const out: string[] = [];
  for (const pid of participantPids || []) {
    const p = normalizeText(pid);
    if (!p) continue;
    if (t.includes(p)) out.push(pid);
  }
  return [...new Set(out)];
}

function fallbackExtractFacts(lines: string[]): string[] {
  const out = new Set<string>();
  for (const line of lines) {
    const base = stripNoisyPhrases(line);
    if (!base || base.length < 6) continue;
    const t = normalizeText(base);
    const explicit = EXPLICIT_MARKERS.some((m) => t.includes(normalizeText(m)));
    if (!explicit && !shouldCaptureProfile(base)) continue;
    out.add(clampText(base));
    if (out.size >= 40) break;
  }
  return [...out];
}

function tryParseJsonObject(raw: string): any | null {
  const text = String(raw || "").trim();
  if (!text) return null;
  const fence = text.match(/```json\s*([\s\S]*?)\s*```/i);
  const candidate = fence ? fence[1] : text;
  const first = candidate.indexOf("{");
  const last = candidate.lastIndexOf("}");
  if (first < 0 || last < 0 || last <= first) return null;
  try {
    return JSON.parse(candidate.slice(first, last + 1));
  } catch {
    return null;
  }
}

async function extractFactsWithGrok(
  lines: string[],
  apiKey: string,
  mode: "user" | "persona",
  personaPid = "",
): Promise<string[]> {
  if (!apiKey || !lines.length) return [];
  const purpose = mode === "user"
    ? "extract durable user profile facts"
    : `extract durable profile facts about the speaker persona "${personaPid}" only`;
  const exclusion = mode === "user"
    ? "Exclude persona facts."
    : "Exclude user profile facts. Keep only facts about this persona speaker.";

  const prompt = [
    "You are a memory extraction assistant.",
    `Task: ${purpose}.`,
    exclusion,
    "Do NOT include requests/questions, roleplay flavor text, or one-off chatter.",
    "Output STRICT JSON only with this schema:",
    "{\"profile_facts\": [\"short fact\", ...]}",
    "Rules:",
    "- Keep each fact under 120 chars.",
    "- Max 40 facts.",
    "- Prefer concise Korean if source is Korean.",
    ...(mode === "persona" ? ["- Do not mention any other persona id/name."] : []),
    "",
    "Conversation lines:",
    ...lines.map((line, idx) => `${idx + 1}. ${line}`),
  ].join("\n");

  const raw = await generateGrokText({
    model: MEMORY_MODEL,
    apiKey,
    messages: [{ role: "user", content: prompt }],
  });
  const json = tryParseJsonObject(raw);
  const facts = Array.isArray(json?.profile_facts) ? json.profile_facts : [];
  return facts
    .map((x) => clampText(String(x || "").trim()))
    .filter((x) => x.length > 12)
    .slice(0, 40);
}

function filterPersonaFactsByPid(
  facts: string[],
  targetPid: string,
  allPids: string[],
): string[] {
  const target = normalizeText(targetPid);
  const others = allPids
    .map((p) => normalizeText(p))
    .filter((p) => p && p !== target);
  if (!others.length) return facts;

  return facts.filter((fact) => {
    const t = normalizeText(fact);
    return !others.some((pid) => t.includes(pid));
  });
}

function parsePersonaTaggedText(raw: string, participantPids: string[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const pid of participantPids) out[pid] = [];
  const text = String(raw || "");
  if (!text || !participantPids.length) return out;

  for (const pid of participantPids) {
    const escaped = pid.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\[${escaped}\\]([\\s\\S]*?)\\[\\/${escaped}\\]`, "gi");
    const matches = [...text.matchAll(re)];
    for (const match of matches) {
      const seg = stripNoisyPhrases(String(match[1] || "").replace(/\[[^\]]+\]/g, " "));
      if (seg && seg.length >= 4) out[pid].push(seg);
    }
  }
  return out;
}

async function getSessionMeta(env: Env, sessionId: string): Promise<SessionMemoryMeta> {
  return safeJsonParse<SessionMemoryMeta>(await env.KV.get(sessionMetaKey(sessionId)), {
    lastExtractedAt: 0,
    lastOptimizedAt: 0,
  });
}

async function setSessionMeta(env: Env, sessionId: string, meta: SessionMemoryMeta): Promise<void> {
  await env.KV.put(sessionMetaKey(sessionId), JSON.stringify(meta));
}

async function getGlobalMeta(env: Env): Promise<GlobalMemoryMeta> {
  return safeJsonParse<GlobalMemoryMeta>(await env.KV.get(globalMetaKey()), { lastOptimizedAt: 0 });
}

async function setGlobalMeta(env: Env, meta: GlobalMemoryMeta): Promise<void> {
  await env.KV.put(globalMetaKey(), JSON.stringify(meta));
}

export async function getMemoryMeta(env: Env, sessionId?: string): Promise<{
  session: SessionMemoryMeta;
  global: GlobalMemoryMeta;
}> {
  const session = sessionId ? await getSessionMeta(env, sessionId) : { lastExtractedAt: 0, lastOptimizedAt: 0 };
  const global = await getGlobalMeta(env);
  return { session, global };
}

export async function extractAndStoreMemories(
  env: Env,
  args: {
    history: Array<{ role?: string; content?: unknown; createdAt?: number }>;
    participantPids?: string[];
    sessionId?: string;
    forceFull?: boolean;
  },
): Promise<{ saved: number; duplicate: number; processed: number; cursor: number; usedFallback: boolean }> {
  const history = Array.isArray(args.history) ? args.history : [];
  const participantPids = Array.isArray(args.participantPids) ? [...new Set(args.participantPids.filter(Boolean))] : [];
  const sessionId = String(args.sessionId || "").trim();
  const forceFull = !!args.forceFull;
  const apiKey = env.GROK_KEY || "";

  const sessionMeta = sessionId ? await getSessionMeta(env, sessionId) : { lastExtractedAt: 0, lastOptimizedAt: 0 };
  const cursorStart = forceFull ? 0 : sessionMeta.lastExtractedAt;

  const userLines: string[] = [];
  const personaLinesByPid: Record<string, string[]> = {};
  for (const pid of participantPids) personaLinesByPid[pid] = [];
  let cursor = cursorStart;

  for (const msg of history) {
    const createdAt = Number(msg?.createdAt || 0) || nowTs();
    if (createdAt <= cursorStart) continue;
    cursor = Math.max(cursor, createdAt);

    const role = String(msg?.role || "");
    if (role === "user") {
      const text = stripNoisyPhrases(flattenMessageText(msg?.content));
      if (text.length >= 4) userLines.push(text);
      continue;
    }

    if (role === "assistant" && participantPids.length) {
      const tagged = parsePersonaTaggedText(flattenMessageText(msg?.content), participantPids);
      for (const pid of participantPids) {
        const lines = tagged[pid] || [];
        if (lines.length) personaLinesByPid[pid].push(...lines);
      }
    }
  }

  const processed = userLines.length + Object.values(personaLinesByPid).reduce((a, b) => a + b.length, 0);
  if (!processed) {
    return { saved: 0, duplicate: 0, processed: 0, cursor, usedFallback: false };
  }

  let usedFallback = false;
  let saved = 0;
  let duplicate = 0;

  // User bubble -> only public user memory
  let userFacts: string[] = [];
  try {
    userFacts = await extractFactsWithGrok(userLines, apiKey, "user");
  } catch {
    userFacts = [];
  }
  if (!userFacts.length) {
    usedFallback = true;
    userFacts = fallbackExtractFacts(userLines);
  }
  for (const text of userFacts) {
    const mentionedPids = findMentionedPersonaPids(text, participantPids);
    if (mentionedPids.length) {
      for (const pid of mentionedPids) {
        const pr = await upsertMemory(env, {
          scope: "private_profile",
          owner: pid,
          text,
          source: "chat",
          createdAt: cursor,
        });
        if (pr.item) (pr.duplicate ? duplicate++ : saved++);
      }
      continue;
    }
    const r = await upsertMemory(env, {
      scope: "public_profile",
      text,
      source: "chat",
      createdAt: cursor,
    });
    if (r.item) (r.duplicate ? duplicate++ : saved++);
  }

  // Persona bubble tagged by pid -> only that pid private memory
  for (const pid of participantPids) {
    const personaLines = personaLinesByPid[pid] || [];
    if (!personaLines.length) continue;
    let personaFacts: string[] = [];
    try {
      personaFacts = await extractFactsWithGrok(personaLines, apiKey, "persona", pid);
    } catch {
      personaFacts = [];
    }
    if (!personaFacts.length) {
      usedFallback = true;
      personaFacts = fallbackExtractFacts(personaLines);
    }
    personaFacts = filterPersonaFactsByPid(personaFacts, pid, participantPids);
    for (const text of personaFacts) {
      const r = await upsertMemory(env, {
        scope: "private_profile",
        owner: pid,
        text,
        source: "chat",
        createdAt: cursor,
      });
      if (r.item) (r.duplicate ? duplicate++ : saved++);
    }
  }

  if (sessionId) {
    try {
      await setSessionMeta(env, sessionId, {
        lastExtractedAt: cursor,
        lastOptimizedAt: sessionMeta.lastOptimizedAt || 0,
      });
    } catch (e) {
      if (!isKvWriteLimitError(e)) throw e;
    }
  }

  return { saved, duplicate, processed, cursor, usedFallback };
}

export async function optimizeMemories(
  env: Env,
  args: { participantPids?: string[]; sessionId?: string; includePublic?: boolean },
): Promise<{ ok: boolean; optimized: number; removed: number; error?: string }> {
  try {
    const participantPids = Array.isArray(args.participantPids) ? [...new Set(args.participantPids.filter(Boolean))] : [];
    const includePublic = args.includePublic !== false;
    const targets: Array<{ scope: MemoryScope; owner: string; mode: "user" | "persona"; pid?: string }> = [
      ...(includePublic ? [{ scope: "public_profile" as MemoryScope, owner: "global", mode: "user" as const }] : []),
      ...participantPids.map((pid) => ({ scope: "private_profile" as MemoryScope, owner: pid, mode: "persona" as const, pid })),
    ];

    let optimized = 0;
    let removed = 0;
    const apiKey = env.GROK_KEY || "";

    for (const t of targets) {
      try {
        const items = await listMemories(env, t.scope, t.owner, 200);
        const manual = items.filter((x) => x.source === "manual" && !x.locked);
        const chat = items.filter((x) => x.source !== "manual" && !x.locked);
        if (chat.length < 2) continue;

        let consolidated: string[] = [];
        try {
          consolidated = await extractFactsWithGrok(
            chat.map((x) => x.text),
            apiKey,
            t.mode,
            t.pid || "",
          );
        } catch {
          // Keep optimize flow alive even when model call fails.
          consolidated = [];
        }
        if (!consolidated.length) continue;

        for (const it of chat) {
          const ok = await deleteMemory(env, t.scope, t.owner, it.id);
          if (ok) removed++;
        }

        for (const text of consolidated) {
          const r = await upsertMemory(env, {
            scope: t.scope,
            owner: t.owner,
            text,
            source: "chat",
          });
          if (r.item && !r.duplicate) optimized++;
        }

        for (const m of manual) {
          await upsertMemory(env, {
            scope: t.scope,
            owner: t.owner,
            text: m.text,
            source: "manual",
            createdAt: m.createdAt,
          });
        }
      } catch {
        // Skip only the failed target and continue optimizing others.
        continue;
      }
    }

    const now = nowTs();
    try {
      const globalMeta = await getGlobalMeta(env);
      await setGlobalMeta(env, { ...globalMeta, lastOptimizedAt: now });
    } catch (e) {
      if (!isKvWriteLimitError(e)) throw e;
    }

    const sessionId = String(args.sessionId || "").trim();
    if (sessionId) {
      try {
        const meta = await getSessionMeta(env, sessionId);
        await setSessionMeta(env, sessionId, {
          lastExtractedAt: meta.lastExtractedAt,
          lastOptimizedAt: now,
        });
      } catch (e) {
        if (!isKvWriteLimitError(e)) throw e;
      }
    }

    return { ok: true, optimized, removed };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || "optimize_failed");
    return { ok: false, optimized: 0, removed: 0, error: message };
  }
}

export async function buildMemorySystemPrompt(
  env: Env,
  args: { participantPids?: string[]; profileLimit?: number },
): Promise<string> {
  const pids = Array.isArray(args.participantPids) ? args.participantPids.filter(Boolean) : [];
  const profileLimit = Math.max(1, Math.min(30, args.profileLimit || 10));

  const pubProfile = await listMemories(env, "public_profile", "global", profileLimit);
  const privateProfileByPid: Record<string, MemoryItem[]> = {};
  for (const pid of pids) {
    privateProfileByPid[pid] = await listMemories(env, "private_profile", pid, profileLimit);
  }

  const lines: string[] = [];
  lines.push("Memory policy:");
  lines.push("- Use memory as soft context, not absolute truth.");
  lines.push("- If current user input conflicts, follow current user input.");
  lines.push("- Prefer newer memory when similar facts conflict.");

  if (pubProfile.length) {
    lines.push("Public user profile memory:");
    pubProfile.forEach((m) => lines.push(`- ${m.text}`));
  }

  for (const pid of pids) {
    const pp = privateProfileByPid[pid] || [];
    if (!pp.length) continue;
    lines.push(`Private persona memory for ${pid}:`);
    pp.forEach((m) => lines.push(`- ${m.text}`));
  }

  const hasRealMemory = pubProfile.length || Object.values(privateProfileByPid).some((x) => x.length);
  if (!hasRealMemory) return "";
  return lines.join("\n");
}

export function parseScope(input: string | null): MemoryScope | null {
  const scope = String(input || "").trim();
  return isValidScope(scope) ? scope : null;
}

export function normalizeScopeOwner(scope: MemoryScope, owner?: string | null): string {
  return normalizeOwner(scope, owner || "");
}
