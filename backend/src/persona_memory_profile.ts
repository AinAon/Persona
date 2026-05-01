import type { Env } from "./index";
import { buildPersonaVaultPath, dropboxReadText, dropboxWriteText, getPersonaDropboxAccessToken } from "./dropbox_vault";

export type AttitudeABase = {
  summary: string;
  style: string;
  avoid: string[];
  updatedReason: string;
  updatedAt: string;
};

export type ImportantEvent = {
  id: string;
  content: string;
  domain: string;
  importance: number;
  happenedAt: string;
};

export type PersonaUserProfile = {
  version: 1;
  userId: string;
  personaPid: string;
  bioSummary: string;
  attitudeA: AttitudeABase;
  roleMemorySummary: Record<string, string>;
  importantEvents: ImportantEvent[];
  updatedAt: string;
};

export type AttitudeBSession = {
  currentUserState: string;
  temporaryTone: string;
  urgency: number;
  note: string;
  expiresAt: string;
};

export type SessionAttitudeState = {
  version: 1;
  userId: string;
  personaPid: string;
  sessionId: string;
  attitudeB: AttitudeBSession;
  updatedAt: string;
};

type AttitudeAPatch = {
  summary?: string;
  style?: string;
  avoidAdd?: string[];
};

type AttitudeUpdateCandidate = {
  id: string;
  key: string;
  patch: AttitudeAPatch;
  confidence: number;
  count: number;
  explicit: boolean;
  lastSeenAt: string;
  lastMessage: string;
  status: "pending" | "applied";
};

function nowIso(): string {
  return new Date().toISOString();
}

function addMs(iso: string, ms: number): string {
  const t = Date.parse(String(iso || ""));
  const base = Number.isFinite(t) ? t : Date.now();
  return new Date(base + ms).toISOString();
}

export function normalizeUserId(raw: unknown): string {
  const s = String(raw || "").trim().toLowerCase();
  const cleaned = s.replace(/[^a-z0-9_-]/g, "_").replace(/^_+|_+$/g, "");
  return cleaned ? cleaned.slice(0, 80) : "user_default";
}

export function normalizeSessionId(raw: unknown): string {
  const s = String(raw || "").trim().toLowerCase();
  const cleaned = s.replace(/[^a-z0-9_-]/g, "_").replace(/^_+|_+$/g, "");
  return cleaned ? cleaned.slice(0, 120) : "";
}

export function normalizePersonaPid(raw: unknown): string {
  const s = String(raw || "").trim().toLowerCase();
  if (!s) return "";
  if (s.startsWith("p_")) return s;
  if (s === "riley" || s === "avery") return `p_${s}`;
  if (/^[a-z0-9_-]+$/.test(s)) return `p_${s}`;
  return "";
}

export function resolvePrimaryPersonaPid(participantPids: string[] = []): string {
  for (const item of participantPids || []) {
    const pid = normalizePersonaPid(item);
    if (pid) return pid;
  }
  return "";
}

function profilePath(pid: string, userId: string): string {
  return buildPersonaVaultPath(pid, `_memory/profile/${userId}.json`);
}

function candidatePath(pid: string, userId: string): string {
  return buildPersonaVaultPath(pid, `_memory/profile/${userId}.attitude_candidates.json`);
}

function sessionStateKey(pid: string, userId: string, sessionId: string): string {
  return `attitude_b:${pid}:${userId}:${sessionId}`;
}

function defaultProfile(pid: string, userId: string): PersonaUserProfile {
  const now = nowIso();
  return {
    version: 1,
    userId,
    personaPid: pid,
    bioSummary: "",
    attitudeA: {
      summary: "User prefers practical, clear responses with minimal fluff.",
      style: "concise, concrete, and respectful",
      avoid: ["vague encouragement", "too many options at once"],
      updatedReason: "default seed",
      updatedAt: now,
    },
    roleMemorySummary: {},
    importantEvents: [],
    updatedAt: now,
  };
}

export async function loadPersonaUserProfile(env: Env, pidRaw: string, userIdRaw: string): Promise<PersonaUserProfile | null> {
  const pid = normalizePersonaPid(pidRaw);
  if (!pid) return null;
  const userId = normalizeUserId(userIdRaw);
  const token = await getPersonaDropboxAccessToken(env, "shared");
  const fallback = defaultProfile(pid, userId);
  if (!token) return fallback;
  const path = profilePath(pid, userId);
  const txt = await dropboxReadText(token, path);
  if (!txt) {
    await dropboxWriteText(token, path, JSON.stringify(fallback, null, 2));
    return fallback;
  }
  try {
    const raw = JSON.parse(txt) as Partial<PersonaUserProfile>;
    const merged: PersonaUserProfile = {
      ...fallback,
      ...raw,
      userId,
      personaPid: pid,
      version: 1,
      attitudeA: {
        ...fallback.attitudeA,
        ...(raw?.attitudeA || {}),
        avoid: Array.isArray(raw?.attitudeA?.avoid) ? raw!.attitudeA!.avoid.map((x) => String(x || "")).filter(Boolean).slice(0, 20) : fallback.attitudeA.avoid,
      },
      roleMemorySummary: raw?.roleMemorySummary && typeof raw.roleMemorySummary === "object" ? raw.roleMemorySummary : {},
      importantEvents: Array.isArray(raw?.importantEvents) ? raw.importantEvents.slice(0, 50).map((e: any) => ({
        id: String(e?.id || `ev_${Date.now()}`),
        content: String(e?.content || ""),
        domain: String(e?.domain || "general"),
        importance: Math.max(0, Math.min(1, Number(e?.importance || 0))),
        happenedAt: String(e?.happenedAt || nowIso()),
      })) : [],
    };
    return merged;
  } catch {
    return fallback;
  }
}

export async function savePersonaUserProfile(env: Env, profile: PersonaUserProfile): Promise<boolean> {
  const pid = normalizePersonaPid(profile.personaPid);
  if (!pid) return false;
  const userId = normalizeUserId(profile.userId);
  const token = await getPersonaDropboxAccessToken(env, "shared");
  if (!token) return false;
  const payload: PersonaUserProfile = {
    ...profile,
    personaPid: pid,
    userId,
    version: 1,
    updatedAt: nowIso(),
  };
  return await dropboxWriteText(token, profilePath(pid, userId), JSON.stringify(payload, null, 2));
}

async function loadAttitudeCandidates(env: Env, pidRaw: string, userIdRaw: string): Promise<AttitudeUpdateCandidate[]> {
  const pid = normalizePersonaPid(pidRaw);
  const userId = normalizeUserId(userIdRaw);
  if (!pid) return [];
  const token = await getPersonaDropboxAccessToken(env, "shared");
  if (!token) return [];
  const txt = await dropboxReadText(token, candidatePath(pid, userId));
  if (!txt) return [];
  try {
    const arr = JSON.parse(txt) as AttitudeUpdateCandidate[];
    return Array.isArray(arr) ? arr.filter((x) => x && x.key && x.patch).slice(0, 50) : [];
  } catch {
    return [];
  }
}

async function saveAttitudeCandidates(env: Env, pidRaw: string, userIdRaw: string, items: AttitudeUpdateCandidate[]): Promise<boolean> {
  const pid = normalizePersonaPid(pidRaw);
  const userId = normalizeUserId(userIdRaw);
  if (!pid) return false;
  const token = await getPersonaDropboxAccessToken(env, "shared");
  if (!token) return false;
  return await dropboxWriteText(token, candidatePath(pid, userId), JSON.stringify(items.slice(-50), null, 2));
}

function detectAttitudePatchFromText(text: string): { key: string; patch: AttitudeAPatch; confidence: number; explicit: boolean } | null {
  const raw = String(text || "").trim();
  const t = raw.toLowerCase();
  if (!t) return null;
  const explicit = /(앞으로|다음부터|항상|기본적으로|from now on|always)/i.test(raw);

  if (/(간결|짧게|핵심만|요약해서|brief|concise|shorter)/i.test(raw)) {
    return {
      key: "style_concise",
      patch: {
        summary: "User prefers concise answers with concrete next actions.",
        style: "concise and action-oriented",
        avoidAdd: ["long preambles", "too many options at once"],
      },
      confidence: explicit ? 0.95 : 0.7,
      explicit,
    };
  }
  if (/(직설|돌려말|단도직입|direct)/i.test(raw)) {
    return {
      key: "style_direct",
      patch: {
        summary: "User prefers direct communication without hedging.",
        style: "direct but respectful",
        avoidAdd: ["indirect wording", "vague reassurance"],
      },
      confidence: explicit ? 0.95 : 0.72,
      explicit,
    };
  }
  if (/(존댓말|격식|formal)/i.test(raw)) {
    return {
      key: "tone_formal",
      patch: {
        summary: "User prefers formal and polite tone.",
        style: "formal Korean",
      },
      confidence: explicit ? 0.95 : 0.68,
      explicit,
    };
  }
  if (/(반말|캐주얼|편하게|casual)/i.test(raw)) {
    return {
      key: "tone_casual",
      patch: {
        summary: "User prefers casual and comfortable tone.",
        style: "casual Korean",
      },
      confidence: explicit ? 0.95 : 0.68,
      explicit,
    };
  }
  return null;
}

function applyAttitudePatch(base: AttitudeABase, patch: AttitudeAPatch): AttitudeABase {
  const avoid = new Set([...(base.avoid || []), ...((patch.avoidAdd || []).map((x) => String(x || "").trim()).filter(Boolean))]);
  return {
    ...base,
    summary: String(patch.summary || base.summary || "").trim(),
    style: String(patch.style || base.style || "").trim(),
    avoid: [...avoid].slice(0, 30),
    updatedAt: nowIso(),
  };
}

export async function processAttitudeACandidateUpdate(
  env: Env,
  pidRaw: string,
  userIdRaw: string,
  latestUserText: string,
): Promise<{ observed: boolean; applied: boolean; reason: string }> {
  const pid = normalizePersonaPid(pidRaw);
  const userId = normalizeUserId(userIdRaw);
  if (!pid) return { observed: false, applied: false, reason: "no_pid" };
  const detected = detectAttitudePatchFromText(latestUserText);
  if (!detected) return { observed: false, applied: false, reason: "no_signal" };

  const profile = await loadPersonaUserProfile(env, pid, userId);
  if (!profile) return { observed: true, applied: false, reason: "profile_unavailable" };
  const candidates = await loadAttitudeCandidates(env, pid, userId);
  const now = nowIso();
  const idx = candidates.findIndex((c) => c.key === detected.key && c.status === "pending");
  if (idx >= 0) {
    candidates[idx] = {
      ...candidates[idx],
      confidence: Math.max(candidates[idx].confidence, detected.confidence),
      count: Math.min(20, Number(candidates[idx].count || 0) + 1),
      explicit: candidates[idx].explicit || detected.explicit,
      lastSeenAt: now,
      lastMessage: String(latestUserText || "").slice(0, 300),
      patch: { ...candidates[idx].patch, ...detected.patch },
    };
  } else {
    candidates.push({
      id: `auc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      key: detected.key,
      patch: detected.patch,
      confidence: detected.confidence,
      count: 1,
      explicit: detected.explicit,
      lastSeenAt: now,
      lastMessage: String(latestUserText || "").slice(0, 300),
      status: "pending",
    });
  }

  const current = idx >= 0 ? candidates[idx] : candidates[candidates.length - 1];
  const shouldApply = !!current.explicit || (Number(current.count || 0) >= 3 && Number(current.confidence || 0) >= 0.75);
  if (!shouldApply) {
    await saveAttitudeCandidates(env, pid, userId, candidates);
    return { observed: true, applied: false, reason: `candidate_saved_count_${current.count}` };
  }

  const nextProfile: PersonaUserProfile = {
    ...profile,
    attitudeA: {
      ...applyAttitudePatch(profile.attitudeA, current.patch),
      updatedReason: current.explicit
        ? `explicit_user_request:${current.key}`
        : `repeated_signal:${current.key} count=${current.count}`,
    },
    updatedAt: now,
  };
  const profileOk = await savePersonaUserProfile(env, nextProfile);
  if (!profileOk) {
    await saveAttitudeCandidates(env, pid, userId, candidates);
    return { observed: true, applied: false, reason: "profile_save_failed" };
  }
  const nextCandidates = candidates.map((c) => c.id === current.id ? { ...c, status: "applied" as const } : c);
  await saveAttitudeCandidates(env, pid, userId, nextCandidates);
  return { observed: true, applied: true, reason: current.explicit ? "explicit_applied" : "threshold_applied" };
}

function isExpired(iso: string): boolean {
  const t = Date.parse(String(iso || ""));
  if (!Number.isFinite(t)) return true;
  return t <= Date.now();
}

export async function loadSessionAttitudeState(
  env: Env,
  pidRaw: string,
  userIdRaw: string,
  sessionIdRaw: string,
): Promise<SessionAttitudeState | null> {
  const pid = normalizePersonaPid(pidRaw);
  const userId = normalizeUserId(userIdRaw);
  const sessionId = normalizeSessionId(sessionIdRaw);
  if (!pid || !sessionId) return null;
  const raw = await env.KV.get(sessionStateKey(pid, userId, sessionId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SessionAttitudeState;
    if (!parsed?.attitudeB?.expiresAt || isExpired(parsed.attitudeB.expiresAt)) {
      await env.KV.delete(sessionStateKey(pid, userId, sessionId));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function saveSessionAttitudeState(env: Env, state: SessionAttitudeState): Promise<void> {
  const pid = normalizePersonaPid(state.personaPid);
  const userId = normalizeUserId(state.userId);
  const sessionId = normalizeSessionId(state.sessionId);
  if (!pid || !sessionId) return;
  const next: SessionAttitudeState = {
    ...state,
    version: 1,
    personaPid: pid,
    userId,
    sessionId,
    updatedAt: nowIso(),
  };
  await env.KV.put(sessionStateKey(pid, userId, sessionId), JSON.stringify(next));
}

export function inferAttitudeBFromUserText(text: string): AttitudeBSession | null {
  const t = String(text || "").trim().toLowerCase();
  if (!t) return null;
  const now = nowIso();

  if (/(급해|급하다|빨리|지금당장|asap|urgent|rush)/i.test(t)) {
    return {
      currentUserState: "urgent",
      temporaryTone: "more_concise",
      urgency: 0.9,
      note: "User appears time-constrained in this session.",
      expiresAt: addMs(now, 2 * 60 * 60 * 1000),
    };
  }
  if (/(짜증|답답|화나|frustrat|annoyed|stuck)/i.test(t)) {
    return {
      currentUserState: "frustrated",
      temporaryTone: "calm_and_direct",
      urgency: 0.8,
      note: "User shows frustration; keep guidance short and stabilizing.",
      expiresAt: addMs(now, 2 * 60 * 60 * 1000),
    };
  }
  if (/(피곤|지쳤|힘들|tired|exhausted)/i.test(t)) {
    return {
      currentUserState: "tired",
      temporaryTone: "gentle_and_concise",
      urgency: 0.5,
      note: "User appears fatigued; reduce cognitive load.",
      expiresAt: addMs(now, 2 * 60 * 60 * 1000),
    };
  }
  return null;
}

export function mergeAttitudeB(previous: AttitudeBSession | null, incoming: AttitudeBSession): AttitudeBSession {
  if (!previous) return incoming;
  return {
    currentUserState: incoming.currentUserState || previous.currentUserState,
    temporaryTone: incoming.temporaryTone || previous.temporaryTone,
    urgency: Number.isFinite(incoming.urgency) ? incoming.urgency : previous.urgency,
    note: incoming.note || previous.note,
    expiresAt: incoming.expiresAt || previous.expiresAt,
  };
}

export function buildPersonaProfilePrompt(profile: PersonaUserProfile, attitudeB: AttitudeBSession | null): string {
  const lines: string[] = [];
  lines.push("Persona memory profile:");
  lines.push(`- user_id: ${profile.userId}`);
  lines.push(`- persona_id: ${profile.personaPid}`);
  lines.push("");
  lines.push("Attitude A (base, stable):");
  lines.push(`- summary: ${profile.attitudeA.summary || ""}`);
  lines.push(`- style: ${profile.attitudeA.style || ""}`);
  lines.push(`- avoid: ${(profile.attitudeA.avoid || []).join(", ") || "none"}`);
  lines.push("- policy: Do not overwrite Attitude A from one conversation mood.");

  if (profile.bioSummary) {
    lines.push("");
    lines.push("Bio memory:");
    lines.push(`- ${profile.bioSummary}`);
  }

  const roleLines = Object.entries(profile.roleMemorySummary || {}).filter(([k, v]) => k && String(v || "").trim());
  if (roleLines.length) {
    lines.push("");
    lines.push("Role memory summary:");
    for (const [k, v] of roleLines.slice(0, 8)) lines.push(`- ${k}: ${String(v || "").trim()}`);
  }

  if (Array.isArray(profile.importantEvents) && profile.importantEvents.length) {
    lines.push("");
    lines.push("Important events:");
    for (const ev of profile.importantEvents.slice(0, 10)) {
      lines.push(`- [${ev.happenedAt}] (${ev.domain}, ${ev.importance}) ${ev.content}`);
    }
  }

  if (attitudeB) {
    lines.push("");
    lines.push("Attitude B (session temporary):");
    lines.push(`- current_user_state: ${attitudeB.currentUserState}`);
    lines.push(`- temporary_tone: ${attitudeB.temporaryTone}`);
    lines.push(`- urgency: ${attitudeB.urgency}`);
    lines.push(`- note: ${attitudeB.note}`);
    lines.push(`- expires_at: ${attitudeB.expiresAt}`);
    lines.push("- policy: Session-only override; do not persist into Attitude A directly.");
  }

  return lines.join("\n");
}
