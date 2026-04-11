import type { Env } from "./index";

export type MemoryScope = "public_profile" | "public_chronicle" | "private_profile" | "private_chronicle";

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

const PROFILE_SCOPES = new Set<MemoryScope>(["public_profile", "private_profile"]);
const CHRONICLE_SCOPES = new Set<MemoryScope>(["public_chronicle", "private_chronicle"]);

const EXPLICIT_MARKERS = [
  "remember this",
  "note this",
  "save this",
  "keep this",
  "remember",
  "기억해",
  "기억해줘",
  "기록해",
  "메모해",
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
  "이름",
  "좋아",
  "선호",
  "취향",
  "직업",
  "생일",
];

const CHRONICLE_HINTS = [
  "today",
  "yesterday",
  "recently",
  "appointment",
  "trip",
  "moved",
  "graduated",
  "married",
  "오늘",
  "어제",
  "최근",
  "약속",
  "여행",
  "이사",
  "졸업",
  "결혼",
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

function clampText(text: string, max = 220): string {
  const trimmed = String(text || "").trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 3)}...`;
}

function isValidScope(scope: string): scope is MemoryScope {
  return scope === "public_profile"
    || scope === "public_chronicle"
    || scope === "private_profile"
    || scope === "private_chronicle";
}

function normalizeOwner(scope: MemoryScope, owner?: string): string {
  if (scope.startsWith("public_")) return "global";
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
  const text = clampText(args.text, PROFILE_SCOPES.has(scope) ? 220 : 320);
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
  const next = [id, ...ids.filter((x) => x !== id)];
  await putIndex(env, scope, owner, next);
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
    .replace(/\[[^\]]+\]/g, " ")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/[(){}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelyQuestion(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (t.includes("?")) return true;
  return /(can you|could you|what|why|how|when|where|뭐야|뭐지|어떻게|언제|어디|왜|누가)\b/i.test(t);
}

function shouldCaptureProfile(text: string): boolean {
  const t = normalizeText(text);
  return PROFILE_HINTS.some((k) => t.includes(normalizeText(k)));
}

function shouldCaptureChronicle(text: string): boolean {
  const t = normalizeText(text);
  return CHRONICLE_HINTS.some((k) => t.includes(normalizeText(k)));
}

function extractCoreClause(text: string): string {
  const clean = stripNoisyPhrases(text);
  const delimiters = [" and ", " but ", " then ", " 그리고 ", " 그런데 ", " 하지만 ", " 그래서 "];
  let chunk = clean;
  for (const delimiter of delimiters) {
    const idx = chunk.toLowerCase().indexOf(delimiter.trim().toLowerCase());
    if (idx > 18) {
      chunk = chunk.slice(0, idx).trim();
      break;
    }
  }
  return chunk;
}

function compactText(text: string): string {
  return text
    .replace(/["'`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function summarizeProfile(text: string): string {
  const core = compactText(extractCoreClause(text));
  if (!core || core.length < 6 || isLikelyQuestion(core)) return "";
  return clampText(`Profile: ${core}`, 180);
}

function summarizeChronicle(text: string): string {
  const core = compactText(extractCoreClause(text));
  if (!core || core.length < 6 || isLikelyQuestion(core)) return "";
  return clampText(`Chronicle: ${core}`, 220);
}

export async function extractAndStoreMemories(
  env: Env,
  args: {
    history: Array<{ role?: string; content?: unknown; createdAt?: number }>;
    participantPids?: string[];
  },
): Promise<{ saved: number; duplicate: number }> {
  const history = Array.isArray(args.history) ? args.history : [];
  const participantPids = Array.isArray(args.participantPids) ? args.participantPids.filter(Boolean) : [];
  const lines = history
    .filter((m) => m?.role === "user")
    .slice(-30)
    .map((m) => ({
      text: flattenMessageText(m.content),
      createdAt: Number(m.createdAt || nowTs()),
    }))
    .filter((x) => String(x.text || "").trim().length >= 4);

  let saved = 0;
  let duplicate = 0;

  for (const line of lines) {
    const base = stripNoisyPhrases(line.text);
    if (!base) continue;
    const normalizedBase = normalizeText(base);
    const explicit = EXPLICIT_MARKERS.some((m) => normalizedBase.includes(normalizeText(m)));
    const toProfile = explicit || shouldCaptureProfile(base);
    const toChronicle = explicit || shouldCaptureChronicle(base);
    if (!toProfile && !toChronicle) continue;

    if (toProfile) {
      const text = summarizeProfile(base);
      if (text) {
        const r = await upsertMemory(env, {
          scope: "public_profile",
          text,
          source: "chat",
          createdAt: line.createdAt,
        });
        if (r.item) (r.duplicate ? duplicate++ : saved++);

        for (const pid of participantPids) {
          const rp = await upsertMemory(env, {
            scope: "private_profile",
            owner: pid,
            text,
            source: "chat",
            createdAt: line.createdAt,
          });
          if (rp.item) (rp.duplicate ? duplicate++ : saved++);
        }
      }
    }

    if (toChronicle) {
      const text = summarizeChronicle(base);
      if (text) {
        const r = await upsertMemory(env, {
          scope: "public_chronicle",
          text,
          source: "chat",
          createdAt: line.createdAt,
        });
        if (r.item) (r.duplicate ? duplicate++ : saved++);

        for (const pid of participantPids) {
          const rp = await upsertMemory(env, {
            scope: "private_chronicle",
            owner: pid,
            text,
            source: "chat",
            createdAt: line.createdAt,
          });
          if (rp.item) (rp.duplicate ? duplicate++ : saved++);
        }
      }
    }
  }

  return { saved, duplicate };
}

export async function buildMemorySystemPrompt(
  env: Env,
  args: { participantPids?: string[]; profileLimit?: number; chronicleLimit?: number },
): Promise<string> {
  const pids = Array.isArray(args.participantPids) ? args.participantPids.filter(Boolean) : [];
  const profileLimit = Math.max(1, Math.min(20, args.profileLimit || 8));
  const chronicleLimit = Math.max(1, Math.min(20, args.chronicleLimit || 6));

  const pubProfile = await listMemories(env, "public_profile", "global", profileLimit);
  const pubChronicle = await listMemories(env, "public_chronicle", "global", chronicleLimit);

  const privateProfileByPid: Record<string, MemoryItem[]> = {};
  const privateChronicleByPid: Record<string, MemoryItem[]> = {};
  for (const pid of pids) {
    privateProfileByPid[pid] = await listMemories(env, "private_profile", pid, profileLimit);
    privateChronicleByPid[pid] = await listMemories(env, "private_chronicle", pid, chronicleLimit);
  }

  const lines: string[] = [];
  lines.push("Memory policy:");
  lines.push("- Use memory only as soft context; do not invent facts.");
  lines.push("- Prefer newer entries when conflicts exist.");
  lines.push("- If memory conflicts with current user message, follow the current message.");

  if (pubProfile.length) {
    lines.push("Public profile memory:");
    pubProfile.forEach((m) => lines.push(`- ${m.text}`));
  }
  if (pubChronicle.length) {
    lines.push("Public chronicle memory:");
    pubChronicle.forEach((m) => lines.push(`- ${m.text}`));
  }

  for (const pid of pids) {
    const pp = privateProfileByPid[pid] || [];
    const pc = privateChronicleByPid[pid] || [];
    if (!pp.length && !pc.length) continue;
    lines.push(`Private memory for ${pid}:`);
    pp.forEach((m) => lines.push(`- [profile] ${m.text}`));
    pc.forEach((m) => lines.push(`- [chronicle] ${m.text}`));
  }

  const hasRealMemory = pubProfile.length || pubChronicle.length
    || Object.values(privateProfileByPid).some((x) => x.length)
    || Object.values(privateChronicleByPid).some((x) => x.length);
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

export function isChronicleScope(scope: MemoryScope): boolean {
  return CHRONICLE_SCOPES.has(scope);
}
