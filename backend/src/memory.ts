import type { Env } from "./index";
import { generateGeminiText } from "./model_gemini";

export type MemoryScope = "public_profile" | "private_profile";

export type MemoryItem = {
  id: string;
  scope: MemoryScope;
  owner: string;
  text: string;
  source: "manual" | "chat";
  fingerprint: string;
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

const MEMORY_MODEL = "gemini-3.1-flash-lite-preview";
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

async function getIndex(env: Env, scope: MemoryScope, owner: string): Promise<string[]> {
  return safeJsonParse<string[]>(await env.KV.get(indexKey(scope, owner)), []);
}

async function putIndex(env: Env, scope: MemoryScope, owner: string, ids: string[]): Promise<void> {
  await env.KV.put(indexKey(scope, owner), JSON.stringify(ids.slice(0, 1000)));
}

async function getItem(env: Env, scope: MemoryScope, owner: string, id: string): Promise<MemoryItem | null> {
  return safeJsonParse<MemoryItem | null>(await env.KV.get(itemKey(scope, owner, id)), null);
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

async function findNearDuplicate(
  env: Env,
  scope: MemoryScope,
  owner: string,
  text: string,
  threshold = 0.86,
): Promise<MemoryItem | null> {
  const ids = (await getIndex(env, scope, owner)).slice(0, 30);
  if (!ids.length) return null;
  const target = tokenize(text);
  for (const id of ids) {
    const existing = await getItem(env, scope, owner, id);
    if (!existing) continue;
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
  const ids = (await getIndex(env, scope, owner)).slice(0, Math.max(1, Math.min(limit, 200)));
  const out: MemoryItem[] = [];
  for (const id of ids) {
    const it = await getItem(env, scope, owner, id);
    if (it) out.push(it);
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
  const text = clampText(args.text, MAX_ITEM_LEN);
  if (!text) return { item: null, duplicate: false };

  const normalized = normalizeText(text);
  if (!normalized) return { item: null, duplicate: false };
  const fingerprint = makeFingerprint(normalized);
  const now = nowTs();

  const byFpId = await env.KV.get(fpKey(scope, owner, fingerprint));
  if (byFpId) {
    const found = await getItem(env, scope, owner, byFpId);
    if (found) {
      found.lastSeenAt = now;
      found.updatedAt = now;
      await env.KV.put(itemKey(scope, owner, found.id), JSON.stringify(found));
      return { item: found, duplicate: true };
    }
  }

  const nearDup = await findNearDuplicate(env, scope, owner, text);
  if (nearDup) {
    nearDup.lastSeenAt = now;
    nearDup.updatedAt = now;
    await env.KV.put(itemKey(scope, owner, nearDup.id), JSON.stringify(nearDup));
    await env.KV.put(fpKey(scope, owner, fingerprint), nearDup.id);
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
    createdAt: args.createdAt || now,
    updatedAt: now,
    lastSeenAt: now,
  };

  await env.KV.put(itemKey(scope, owner, id), JSON.stringify(item));
  await env.KV.put(fpKey(scope, owner, fingerprint), id);
  const ids = await getIndex(env, scope, owner);
  await putIndex(env, scope, owner, [id, ...ids.filter((x) => x !== id)]);
  return { item, duplicate: false };
}

export async function deleteMemory(
  env: Env,
  scope: MemoryScope,
  owner: string,
  id: string,
): Promise<boolean> {
  const found = await getItem(env, scope, owner, id);
  if (!found) return false;
  await env.KV.delete(itemKey(scope, owner, id));
  if (found.fingerprint) await env.KV.delete(fpKey(scope, owner, found.fingerprint));
  const ids = await getIndex(env, scope, owner);
  await putIndex(env, scope, owner, ids.filter((x) => x !== id));
  return true;
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

function fallbackExtractFacts(lines: string[]): string[] {
  const out = new Set<string>();
  for (const line of lines) {
    const base = stripNoisyPhrases(line);
    if (!base || base.length < 6) continue;
    const t = normalizeText(base);
    const explicit = EXPLICIT_MARKERS.some((m) => t.includes(normalizeText(m)));
    if (!explicit && !shouldCaptureProfile(base)) continue;
    out.add(clampText(`Profile: ${base}`));
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

async function extractFactsWithGemini(
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
    "",
    "Conversation lines:",
    ...lines.map((line, idx) => `${idx + 1}. ${line}`),
  ].join("\n");

  const raw = await generateGeminiText({
    model: MEMORY_MODEL,
    apiKey,
    messages: [{ role: "user", content: prompt }],
  });
  const json = tryParseJsonObject(raw);
  const facts = Array.isArray(json?.profile_facts) ? json.profile_facts : [];
  return facts
    .map((x) => clampText(`Profile: ${String(x || "").trim()}`))
    .filter((x) => x.length > 12)
    .slice(0, 40);
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
  const apiKey = env.GEMINI_KEY || "";

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
  let userFacts = await extractFactsWithGemini(userLines, apiKey, "user");
  if (!userFacts.length) {
    usedFallback = true;
    userFacts = fallbackExtractFacts(userLines);
  }
  for (const text of userFacts) {
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
    let personaFacts = await extractFactsWithGemini(personaLines, apiKey, "persona", pid);
    if (!personaFacts.length) {
      usedFallback = true;
      personaFacts = fallbackExtractFacts(personaLines);
    }
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
    await setSessionMeta(env, sessionId, {
      lastExtractedAt: cursor,
      lastOptimizedAt: sessionMeta.lastOptimizedAt || 0,
    });
  }

  return { saved, duplicate, processed, cursor, usedFallback };
}

export async function optimizeMemories(
  env: Env,
  args: { participantPids?: string[]; sessionId?: string },
): Promise<{ ok: boolean; optimized: number; removed: number }> {
  const participantPids = Array.isArray(args.participantPids) ? [...new Set(args.participantPids.filter(Boolean))] : [];
  const targets: Array<{ scope: MemoryScope; owner: string; mode: "user" | "persona"; pid?: string }> = [
    { scope: "public_profile", owner: "global", mode: "user" },
    ...participantPids.map((pid) => ({ scope: "private_profile" as MemoryScope, owner: pid, mode: "persona" as const, pid })),
  ];

  let optimized = 0;
  let removed = 0;
  const apiKey = env.GEMINI_KEY || "";

  for (const t of targets) {
    const items = await listMemories(env, t.scope, t.owner, 200);
    const manual = items.filter((x) => x.source === "manual");
    const chat = items.filter((x) => x.source !== "manual");
    if (chat.length < 2) continue;

    const consolidated = await extractFactsWithGemini(
      chat.map((x) => x.text),
      apiKey,
      t.mode,
      t.pid || "",
    );
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
  }

  const now = nowTs();
  const globalMeta = await getGlobalMeta(env);
  await setGlobalMeta(env, { ...globalMeta, lastOptimizedAt: now });

  const sessionId = String(args.sessionId || "").trim();
  if (sessionId) {
    const meta = await getSessionMeta(env, sessionId);
    await setSessionMeta(env, sessionId, {
      lastExtractedAt: meta.lastExtractedAt,
      lastOptimizedAt: now,
    });
  }

  return { ok: true, optimized, removed };
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
