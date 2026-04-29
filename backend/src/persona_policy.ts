import type { Env } from "./index";
import { dropboxDeletePath, dropboxReadText, dropboxWriteText, getPersonaDropboxAccessToken } from "./dropbox_vault";

type PersonaPolicyPatch = {
  personaPid: string;
  summary: string;
  policyText: string;
  proposedAt: string;
  source: "assistant";
};

type PersonaPolicyApprovalLog = {
  ts: string;
  personaPid: string;
  approvedByText: string;
  summary: string;
};

const APPROVAL_PATTERNS = [/(그렇게\s*해)/i, /(진행시켜)/i, /(적용해)/i, /\bapprove\b/i];
const POLICY_PIDS = new Set(["p_riley", "p_avery"]);

function nowKstIso(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const pick = (t: string) => parts.find((p) => p.type === t)?.value || "00";
  return `${pick("year")}-${pick("month")}-${pick("day")}T${pick("hour")}:${pick("minute")}:${pick("second")}+09:00`;
}

function policyKey(pid: string): string {
  return `persona_policy/${pid}/policy.md`;
}
function pendingKey(pid: string): string {
  return `persona_policy/${pid}/pending.json`;
}
function approvalLogKey(pid: string): string {
  return `persona_policy/${pid}/approval.log.jsonl`;
}

function normalizePid(pid: string): string {
  return String(pid || "").trim().toLowerCase();
}

function pidToPersona(pid: string): "riley" | "avery" | null {
  const p = normalizePid(pid);
  if (p === "p_riley" || p === "riley") return "riley";
  if (p === "p_avery" || p === "avery") return "avery";
  return null;
}

function vaultPathFromR2Key(key: string): string {
  return `/${String(key || "").replace(/^\/+/, "")}`;
}

async function readPolicyText(env: Env, pid: string, key: string): Promise<string | null> {
  const persona = pidToPersona(pid);
  if (persona) {
    const token = await getPersonaDropboxAccessToken(env, persona);
    if (token) {
      const txt = await dropboxReadText(token, vaultPathFromR2Key(key));
      if (txt != null) return txt;
    }
  }
  const obj = await env.R2.get(key);
  if (!obj) return null;
  return await obj.text();
}

async function writePolicyText(env: Env, pid: string, key: string, text: string, contentType: string): Promise<void> {
  const persona = pidToPersona(pid);
  if (persona) {
    const token = await getPersonaDropboxAccessToken(env, persona);
    if (token) {
      const ok = await dropboxWriteText(token, vaultPathFromR2Key(key), text);
      if (ok) return;
    }
  }
  await env.R2.put(key, text, { httpMetadata: { contentType } });
}

async function deletePolicyText(env: Env, pid: string, key: string): Promise<void> {
  const persona = pidToPersona(pid);
  if (persona) {
    const token = await getPersonaDropboxAccessToken(env, persona);
    if (token) {
      const ok = await dropboxDeletePath(token, vaultPathFromR2Key(key));
      if (ok) return;
    }
  }
  await env.R2.delete(key);
}

export function resolvePolicyTargetPid(participantPids: string[] = []): string | null {
  for (const raw of participantPids || []) {
    const pid = normalizePid(raw);
    if (POLICY_PIDS.has(pid)) return pid;
  }
  return null;
}

export function isPolicyApprovalText(text: string): boolean {
  const t = String(text || "").trim();
  if (!t) return false;
  return APPROVAL_PATTERNS.some((re) => re.test(t));
}

function parsePolicyPatchFromReply(reply: string, expectedPid: string): PersonaPolicyPatch | null {
  const s = String(reply || "");
  const m = s.match(/```policy_patch\s*([\s\S]*?)```/i);
  if (!m) return null;
  try {
    const payload = JSON.parse(m[1]) as Partial<PersonaPolicyPatch>;
    const personaPid = normalizePid(payload.personaPid || expectedPid);
    if (personaPid !== expectedPid) return null;
    const summary = String(payload.summary || "").trim();
    const policyText = String(payload.policyText || "").trim();
    if (!summary || !policyText) return null;
    return {
      personaPid,
      summary,
      policyText,
      proposedAt: nowKstIso(),
      source: "assistant",
    };
  } catch {
    return null;
  }
}

export async function buildPersonaPolicySystemPrompt(env: Env, personaPid: string): Promise<string> {
  const pid = normalizePid(personaPid);
  if (!POLICY_PIDS.has(pid)) return "";
  const policyText = (await readPolicyText(env, pid, policyKey(pid))) || "";
  return [
    `Persona policy control enabled for ${pid}.`,
    "If user asks to change this persona policy, DO NOT claim direct modification.",
    "Instead, include exactly one machine block using this format:",
    "```policy_patch",
    '{"personaPid":"p_xxx","summary":"short summary","policyText":"full replacement markdown"}',
    "```",
    "Only propose patch when user explicitly asks policy/rule update.",
    policyText ? `Current policy.md:\n${policyText}` : "Current policy.md: (empty)",
  ].join("\n");
}

export async function savePendingPolicyPatchFromReply(env: Env, personaPid: string, reply: string): Promise<void> {
  const pid = normalizePid(personaPid);
  if (!POLICY_PIDS.has(pid)) return;
  const patch = parsePolicyPatchFromReply(reply, pid);
  if (!patch) return;
  await writePolicyText(env, pid, pendingKey(pid), JSON.stringify(patch, null, 2), "application/json; charset=utf-8");
}

async function appendApprovalLog(env: Env, pid: string, line: PersonaPolicyApprovalLog): Promise<void> {
  const prev = (await readPolicyText(env, pid, approvalLogKey(pid))) || "";
  const next = `${prev ? `${prev}\n` : ""}${JSON.stringify(line)}`;
  await writePolicyText(env, pid, approvalLogKey(pid), next, "application/x-ndjson; charset=utf-8");
}

export async function applyPendingPolicyIfApproved(
  env: Env,
  personaPid: string,
  userText: string
): Promise<{ applied: boolean; message?: string }> {
  const pid = normalizePid(personaPid);
  if (!POLICY_PIDS.has(pid)) return { applied: false };
  if (!isPolicyApprovalText(userText)) return { applied: false };
  const pendingRaw = await readPolicyText(env, pid, pendingKey(pid));
  if (!pendingRaw) return { applied: false, message: "승인할 policy 제안이 아직 없습니다." };
  const pending = JSON.parse(pendingRaw) as PersonaPolicyPatch;
  if (!pending?.policyText) return { applied: false, message: "제안 형식이 유효하지 않아 적용을 건너뛰었습니다." };
  await writePolicyText(env, pid, policyKey(pid), pending.policyText, "text/markdown; charset=utf-8");
  await appendApprovalLog(env, pid, {
    ts: nowKstIso(),
    personaPid: pid,
    approvedByText: String(userText || "").trim().slice(0, 200),
    summary: pending.summary || "",
  });
  await deletePolicyText(env, pid, pendingKey(pid));
  return { applied: true, message: `${pid} policy.md 적용 완료` };
}

export async function getPersonaPolicy(env: Env, personaPid: string): Promise<{
  ok: boolean;
  personaPid: string;
  policyText: string;
  hasPending: boolean;
}> {
  const pid = normalizePid(personaPid);
  if (!POLICY_PIDS.has(pid)) {
    return { ok: false, personaPid: pid, policyText: "", hasPending: false };
  }
  const policyText = (await readPolicyText(env, pid, policyKey(pid))) || "";
  const pendingText = await readPolicyText(env, pid, pendingKey(pid));
  return {
    ok: true,
    personaPid: pid,
    policyText,
    hasPending: !!pendingText,
  };
}
