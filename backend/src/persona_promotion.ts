import type { Env } from "./index";
import { dropboxReadText, dropboxWriteText, getPersonaDropboxAccessToken } from "./dropbox_vault";

type PromotionCandidate = {
  id: string;
  personaPid: string;
  scope: "policy" | "profile";
  text: string;
  reason: string;
  source: "assistant" | "user";
  status: "pending" | "applied" | "rejected";
  createdAt: string;
  updatedAt: string;
};

type CandidateDoc = { version: 1; items: PromotionCandidate[] };

const APPROVE_PATTERNS = [/(진행시켜)/i, /(그렇게\s*해)/i, /(적용해)/i];

function nowKstIso(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(now);
  const pick = (t: string) => parts.find((p) => p.type === t)?.value || "00";
  return `${pick("year")}-${pick("month")}-${pick("day")}T${pick("hour")}:${pick("minute")}:${pick("second")}+09:00`;
}

function key(pid: string): string { return `persona_promotion/${String(pid || "").trim().toLowerCase()}/candidates.json`; }

function normalizePid(pid: string): string { return String(pid || "").trim().toLowerCase(); }

function pidToPersona(pid: string): "riley" | "avery" | null {
  const p = normalizePid(pid);
  if (p === "p_riley" || p === "riley") return "riley";
  if (p === "p_avery" || p === "avery") return "avery";
  return null;
}

function vaultPathFromR2Key(path: string): string {
  return `/${String(path || "").replace(/^\/+/, "")}`;
}

async function load(env: Env, pid: string): Promise<CandidateDoc> {
  const k = key(pid);
  const persona = pidToPersona(pid);
  if (persona) {
    const token = await getPersonaDropboxAccessToken(env, persona);
    if (token) {
      const txt = await dropboxReadText(token, vaultPathFromR2Key(k));
      if (txt) {
        try {
          const parsed = JSON.parse(txt) as CandidateDoc;
          return parsed?.version === 1 && Array.isArray(parsed.items) ? parsed : { version: 1, items: [] };
        } catch {
          return { version: 1, items: [] };
        }
      }
    }
  }
  const obj = await env.R2.get(k);
  if (!obj) return { version: 1, items: [] };
  try {
    const parsed = JSON.parse(await obj.text()) as CandidateDoc;
    return parsed?.version === 1 && Array.isArray(parsed.items) ? parsed : { version: 1, items: [] };
  } catch {
    return { version: 1, items: [] };
  }
}

async function save(env: Env, pid: string, doc: CandidateDoc): Promise<void> {
  const payload = JSON.stringify(doc, null, 2);
  const k = key(pid);
  const persona = pidToPersona(pid);
  if (persona) {
    const token = await getPersonaDropboxAccessToken(env, persona);
    if (token) {
      const ok = await dropboxWriteText(token, vaultPathFromR2Key(k), payload);
      if (ok) return;
    }
  }
  await env.R2.put(k, payload, { httpMetadata: { contentType: "application/json; charset=utf-8" } });
}

export function isPromotionApprovalText(text: string): boolean {
  const t = String(text || "").trim();
  return !!t && APPROVE_PATTERNS.some((re) => re.test(t));
}

export function buildPromotionSystemPrompt(pid: string): string {
  return [
    `Promotion candidate mode enabled for ${pid}.`,
    "If a user states durable preference/rule/fact for this persona, you may propose one candidate block:",
    "```promotion_candidate",
    '{"scope":"policy|profile","text":"candidate text","reason":"why this should be promoted"}',
    "```",
    "Do not claim it is already applied. Applied only after user approval phrase.",
  ].join("\n");
}

export async function saveCandidateFromReply(env: Env, pid: string, reply: string): Promise<void> {
  const m = String(reply || "").match(/```promotion_candidate\s*([\s\S]*?)```/i);
  if (!m) return;
  let payload: any = null;
  try { payload = JSON.parse(m[1]); } catch { return; }
  const scope = payload?.scope === "policy" ? "policy" : "profile";
  const text = String(payload?.text || "").trim();
  const reason = String(payload?.reason || "").trim();
  if (!text || !reason) return;
  const now = nowKstIso();
  const doc = await load(env, pid);
  doc.items.push({
    id: `pc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    personaPid: String(pid || "").trim().toLowerCase(),
    scope,
    text,
    reason,
    source: "assistant",
    status: "pending",
    createdAt: now,
    updatedAt: now,
  });
  if (doc.items.length > 200) doc.items = doc.items.slice(-200);
  await save(env, pid, doc);
}

export async function approveLatestPendingCandidate(
  env: Env,
  pid: string,
  userText: string
): Promise<{ applied: boolean; message?: string }> {
  if (!isPromotionApprovalText(userText)) return { applied: false };
  const doc = await load(env, pid);
  const idx = [...doc.items].reverse().findIndex((it) => it.status === "pending");
  if (idx < 0) return { applied: false, message: "승격 후보가 없습니다." };
  const realIdx = doc.items.length - 1 - idx;
  doc.items[realIdx].status = "applied";
  doc.items[realIdx].updatedAt = nowKstIso();
  await save(env, pid, doc);
  return { applied: true, message: `승격 후보 적용: ${doc.items[realIdx].scope}` };
}

export async function getPromotionCandidates(env: Env, pid: string): Promise<CandidateDoc> {
  return load(env, pid);
}
