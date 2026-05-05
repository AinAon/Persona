import type { CorsHeaders, Env } from "./index";
import { generateGeminiImage, generateGeminiText, generateImagenImage, streamGeminiText } from "./model_gemini";
import { generateOpenAIImage, generateOpenAIText, streamOpenAIText } from "./model_openai";
import { generateGrokImage, generateGrokText, streamGrokText } from "./model_grok";
import { buildPersonaVaultPath, dropboxWriteText, getPersonaDropboxAccessToken } from "./dropbox_vault";
import {
  appendAveryWorklogEvent,
  buildAverySystemPrompt,
  getAveryWorklogSnapshot,
  isAveryParticipant,
  loadAveryDirective,
  loadAveryVaultMemoryMarkdown,
  runAveryVaultActionFromText,
  shouldPersistAveryWorklogText,
} from "./avery_worklog";
import {
  appendRileyWealthEvent,
  buildRileySystemPrompt,
  ensureRileyStateSnapshot,
  extractLatestUserText,
  getRileyWealthSnapshot,
  isWealthIntentText,
  isWealthMutationText,
  isRileyParticipant,
  loadRileyDirective,
  loadRileyVaultMemoryMarkdown,
  runRileyVaultActionFromText,
} from "./riley_wealth";
import {
  applyPendingPolicyIfApproved,
  buildPersonaPolicySystemPrompt,
  resolvePolicyTargetPid,
  savePendingPolicyPatchFromReply,
} from "./persona_policy";
import {
  approveLatestPendingCandidate,
  buildPromotionSystemPrompt,
  saveCandidateFromReply,
} from "./persona_promotion";
import {
  inferAttitudeBFromUserText,
  loadPersonaUserProfile,
  loadSessionAttitudeState,
  mergeAttitudeB,
  normalizeSessionId,
  normalizeUserId,
  processAttitudeACandidateUpdate,
  resolvePrimaryPersonaPid,
  saveSessionAttitudeState,
} from "./persona_memory_profile";
import { buildPersonaContext, buildPersonaContextSections } from "./persona_context";
import { scopedKvKey, scopedR2Key } from "./auth";

const IMAGE_MODELS = ["gemini-3.1-flash-image-preview", "grok-imagine-image-pro", "gpt-image-2"];
const RATIO_TO_SIZE: Record<string, string> = {
  "1:1": "1024x1024",
  "16:9": "1536x1024",
  "9:16": "1024x1536",
  "4:3": "1536x1152",
  "3:4": "1152x1536",
  "3:2": "1536x1024",
  "2:3": "1024x1536",
  "21:9": "1536x1024",
  "9:21": "1024x1536",
};

const RESPONSE_VARIANCE_PROMPT = [
  "Vary response length naturally.",
  "Do not always answer in the same length, rhythm, or structure.",
  "Short reactions, medium replies, long explanations, or multiple short lines are all allowed when they fit the situation.",
  "Keep the persona consistent, but let the delivery feel alive and irregular.",
].join(" ");

const ANTI_HALLUCINATION_GUARD = [
  "Mandatory policy for all personas:",
  "- Do not fabricate facts.",
  "- If uncertain, explicitly say you are not sure and label assumptions.",
  "- Do not state specific numbers/dates/names as certain without confidence.",
].join(" ");

const RILEY_NUMERIC_PRIORITY_GUARD = [
  "Riley wealth policy:",
  "- For finance numbers, always prioritize Riley wealth state snapshot over memory text.",
  "- Use private/public memory only as qualitative context, not numeric source of truth.",
  "- If memory numbers conflict with state numbers, explicitly follow state numbers.",
].join(" ");

const AVERY_WORKLOG_GUARD = [
  "Avery worklog policy:",
  "- Treat Avery worklog snapshot as persistent source for tasks/errors/solutions/reminders.",
  "- Only persist work or mixed conversation; skip purely personal chat.",
  "- When user asks to record/update/remove/complete work items, respond consistently with snapshot.",
  "- Do not require user to log every task; allow partial logs.",
  "- If worklog has stale/open items or timeline gaps, occasionally ask one brief status question.",
  "- Keep follow-up probing light: max one short question and only when useful.",
  "- If uncertain, ask one short clarification before destructive removal.",
].join(" ");

const VAULT_AUTONOMY_GUARD = [
  "Vault autonomy policy (execute-first):",
  "- If user request is clear enough, execute immediately via vault action.",
  "- If target path/name is ambiguous, ask one concise follow-up question first.",
  "- You may use proposal block only for optional structure ideas or low-confidence plans.",
  "- Use this exact block when proposing:",
  "[VAULT_PROPOSAL]",
  "{\"persona\":\"riley|avery\",\"actions\":[{\"type\":\"create_folder\",\"path\":\"...\"},{\"type\":\"create_file\",\"path\":\"...\",\"content\":\"...\"}]}",
  "[/VAULT_PROPOSAL]",
  "- Proposal approval is optional. If action is safe and clear, auto-apply.",
  "- Do not claim false platform limits (e.g., 'cannot access file system') when vault action is available.",
  "- When you propose, keep it short and practical.",
].join("\n");

const SESSION_INDEX_R2_KEY = "session/index.json";
const SESSION_INDEX_KV_KEY = "session_index";
const SESSION_R2_PREFIX = "session/data/";

type VaultProposalAction = { type: "create_file" | "create_folder"; path: string; content?: string };
type VaultProposal = { persona: "riley" | "avery"; actions: VaultProposalAction[]; createdAt: number };
type VaultActionMode = "direct" | "proposal_apply";
type VaultActionEvidence = {
  id: string;
  at: string;
  persona: "riley" | "avery";
  mode: VaultActionMode;
  ok: boolean;
  message: string;
  userText: string;
  outputs: Array<{ type: "file" | "folder" | "count"; value: string }>;
};

function pendingVaultProposalKey(persona: "riley" | "avery"): string {
  return `vault:proposal:${persona}`;
}

function isApprovalText(text: string): boolean {
  const t = String(text || "").trim().toLowerCase();
  if (!t || t.length > 40) return false;
  // Strict approval gate: plain approval utterance only (no mixed command body).
  if (/(파일|폴더|path|경로|create|write|생성|만들|삭제|remove|move|rename)/i.test(t)) return false;
  return /^(?:네|응|예|오케이|ok|okay)?\s*(?:승인|진행해|진행시켜|적용해|approve|go ahead|do it|proceed)(?:\s*(?:해|줘|주세요|해줘|부탁해)?)?[.! ]*$/.test(t);
}

function detectVaultCreateIntent(text: string): boolean {
  const t = String(text || "");
  return /(?:파일|file|폴더|folder|디렉터리|directory|csv|md|txt|json).*(?:생성|만들|작성|저장|create|write)|(?:create|write).*(?:file|folder|directory)/i.test(t);
}

function hasExplicitVaultTarget(text: string): boolean {
  const t = String(text || "");
  if (/([a-zA-Z0-9_./-]+\.(?:csv|md|txt|json))\b/i.test(t)) return true;
  if (/(?:파일생성|파일 만들어|create file)\s+([^\n:]{1,140})/i.test(t)) return true;
  if (/(?:폴더생성|폴더 만들어|create folder)\s+([^\n]{1,140})/i.test(t)) return true;
  if (/["'`]([a-zA-Z0-9_./-]+)["'`]\s*(?:파일|file|폴더|folder)/i.test(t)) return true;
  return false;
}

function routeVaultRequestMode(text: string): "command" | "dialog" | "none" {
  if (!detectVaultCreateIntent(text)) return "none";
  if (hasExplicitVaultTarget(text)) return "command";
  return "dialog";
}

function extractFixedRoleFromDirective(directiveText: string, fallbackRole: string): string {
  const txt = String(directiveText || "");
  const m = txt.match(/^(?:role|역할)\s*:\s*([a-zA-Z0-9_-]{2,80})\s*$/im);
  if (m && m[1]) return String(m[1]).trim().toLowerCase();
  return fallbackRole;
}

function parseVaultProposalFromReply(reply: string): VaultProposal | null {
  const m = String(reply || "").match(/\[VAULT_PROPOSAL\]([\s\S]*?)\[\/VAULT_PROPOSAL\]/i);
  if (!m) return null;
  let parsed: any = null;
  try {
    parsed = JSON.parse(String(m[1] || "").trim());
  } catch {
    return null;
  }
  const persona = String(parsed?.persona || "").toLowerCase();
  if (persona !== "riley" && persona !== "avery") return null;
  const actionsRaw = Array.isArray(parsed?.actions) ? parsed.actions : [];
  const actions: VaultProposalAction[] = [];
  for (const a of actionsRaw) {
    const type = String(a?.type || "");
    const path = String(a?.path || "").trim().replace(/^\/+/, "");
    if (!path) continue;
    if (type === "create_folder") actions.push({ type: "create_folder", path });
    if (type === "create_file") actions.push({ type: "create_file", path, content: String(a?.content || "") });
  }
  if (!actions.length) return null;
  return { persona: persona as "riley" | "avery", actions: actions.slice(0, 20), createdAt: Date.now() };
}

async function savePendingVaultProposal(env: Env, proposal: VaultProposal): Promise<void> {
  await env.KV.put(pendingVaultProposalKey(proposal.persona), JSON.stringify(proposal));
}

async function loadPendingVaultProposal(env: Env, persona: "riley" | "avery"): Promise<VaultProposal | null> {
  const raw = await env.KV.get(pendingVaultProposalKey(persona));
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as VaultProposal;
    if (!p || !Array.isArray(p.actions) || !p.actions.length) return null;
    return p;
  } catch {
    return null;
  }
}

async function clearPendingVaultProposal(env: Env, persona: "riley" | "avery"): Promise<void> {
  await env.KV.delete(pendingVaultProposalKey(persona));
}

function parseVaultOutputs(message: string): Array<{ type: "file" | "folder" | "count"; value: string }> {
  const msg = String(message || "");
  const out: Array<{ type: "file" | "folder" | "count"; value: string }> = [];
  const file = msg.match(/created file:\s*(\/\S+)/i);
  if (file) out.push({ type: "file", value: file[1] });
  const folder = msg.match(/created folder:\s*(\/\S+)/i);
  if (folder) out.push({ type: "folder", value: folder[1] });
  const count = msg.match(/applied proposal:\s*(\d+)\s*action/i);
  if (count) out.push({ type: "count", value: String(count[1] || "0") });
  return out;
}

function evidenceKey(persona: "riley" | "avery"): string {
  return `vault:evidence:${persona}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}

async function writeVaultEvidence(
  env: Env,
  persona: "riley" | "avery",
  mode: VaultActionMode,
  ok: boolean,
  message: string,
  userText: string,
): Promise<VaultActionEvidence> {
  const id = evidenceKey(persona);
  const ev: VaultActionEvidence = {
    id,
    at: new Date().toISOString(),
    persona,
    mode,
    ok,
    message: String(message || ""),
    userText: String(userText || ""),
    outputs: parseVaultOutputs(message),
  };
  await env.KV.put(id, JSON.stringify(ev));
  await env.KV.put(`vault:evidence:last:${persona}`, id);
  return ev;
}

function guardPersonaReply(reply: string, hasExecutionEvidence: boolean, inPersonaChat: boolean): string {
  let out = String(reply || "").trim();
  if (!out) return out;
  if (!inPersonaChat) return out;

  // Block false capability disclaimers when vault execution path exists.
  if (/(직접\s*외부\s*파일\s*시스템.*제한|파일\s*시스템.*접근.*불가능|제안.*승인.*VAULT_PROPOSAL.*유효)/i.test(out)) {
    return "바로 실행 가능한 요청이면 지금 처리하겠습니다. 경로나 파일명만 명확히 알려주세요.";
  }

  // If no evidence exists, block fake completion claims.
  if (!hasExecutionEvidence && /(생성했|생성했습니다|만들었|적용했|저장했|완료했)/i.test(out)) {
    return "실행 전에 먼저 확인이 필요합니다. 파일명/경로를 지정해주시면 바로 처리하고 결과를 정확히 보고드릴게요.";
  }
  return out;
}

async function executeVaultProposal(env: Env, proposal: VaultProposal): Promise<{ ok: boolean; message: string }> {
  const token = await getPersonaDropboxAccessToken(env, proposal.persona);
  if (!token) return { ok: false, message: `${proposal.persona} dropbox token missing` };
  const pid = proposal.persona === "riley" ? "p_riley" : "p_avery";
  let okCount = 0;
  const failed: string[] = [];
  for (const a of proposal.actions) {
    const rawPath = String(a.path || "").trim().replace(/\\/g, "/");
    const path = rawPath.startsWith("/_vault/") || rawPath.startsWith("_vault/")
      ? `/${rawPath.replace(/^\/+/, "")}`
      : buildPersonaVaultPath(pid, rawPath.replace(/^\/+/, ""));
    if (!path || path === "/") continue;
    if (a.type === "create_folder") {
      const ok = await dropboxWriteText(token, `${path.replace(/\/+$/, "")}/.keep`, "");
      if (ok) okCount++; else failed.push(path);
    } else {
      const rawContent = String(a.content || "");
      const payload = /\.csv$/i.test(path)
        ? (rawContent.startsWith("\uFEFF") ? rawContent : `\uFEFF${rawContent}`)
        : rawContent;
      const ok = await dropboxWriteText(token, path, payload);
      if (ok) okCount++; else failed.push(path);
    }
  }
  if (failed.length) return { ok: false, message: `failed: ${failed.slice(0, 3).join(", ")}` };
  return { ok: true, message: `applied proposal: ${okCount} action(s)` };
}

function stripVaultProposalBlock(reply: string): string {
  return String(reply || "").replace(/\n?\[VAULT_PROPOSAL\][\s\S]*?\[\/VAULT_PROPOSAL\]\n?/i, "\n").trim();
}

type TextApiKeys = { gemini: string; grok: string; openai: string; anthropic: string };

async function renderVaultResultMessage(raw: string, model: string, apiKeys: TextApiKeys, contextText = ""): Promise<string> {
  const msg = String(raw || "").trim();
  if (!msg) return "";
  const system = [
    "Rewrite operation result into natural Korean response.",
    "Rules:",
    "- Keep facts exact (path/count/error text).",
    "- Do not invent actions.",
    "- Be concise and polite.",
    "- 1 to 3 short sentences.",
    "- No markdown list/code block.",
    "- Reflect the conversation tone lightly and naturally.",
    "- Avoid canned business phrases like '성공적으로 승인/적용했습니다' or repetitive templates.",
  ].join("\n");
  const messages = [
    { role: "system", content: system },
    ...(String(contextText || "").trim() ? [{ role: "user", content: `latest_user_context:\n${String(contextText || "").trim()}` }] : []),
    { role: "user", content: `operation_result:\n${msg}` },
  ];

  const tryModel = async (kind: "gemini" | "grok" | "openai" | "claude"): Promise<string> => {
    if (kind === "gemini") {
      if (!apiKeys.gemini) return "";
      return await generateGeminiText({ model: model.startsWith("gemini") ? model : "gemini-2.5-flash", messages, apiKey: apiKeys.gemini });
    }
    if (kind === "grok") {
      if (!apiKeys.grok) return "";
      return await generateGrokText({ model: model.startsWith("grok") ? model : "grok-4.20-non-reasoning", messages, apiKey: apiKeys.grok });
    }
    if (kind === "claude") {
      if (!apiKeys.anthropic) return "";
      return await generateClaudeText({ model: model.startsWith("claude") ? model : "claude-sonnet-4-20250514", messages, apiKey: apiKeys.anthropic });
    }
    if (!apiKeys.openai) return "";
    return await generateOpenAIText({ model: (model.startsWith("gpt-") || model.startsWith("o1") || model.startsWith("o3") || model.startsWith("o4")) ? model : "gpt-4.1-mini", messages, apiKey: apiKeys.openai });
  };

  const order: Array<"gemini" | "grok" | "openai" | "claude"> =
    model.startsWith("gemini") ? ["gemini", "grok", "openai", "claude"]
    : model.startsWith("grok") ? ["grok", "gemini", "openai", "claude"]
    : model.startsWith("claude") ? ["claude", "openai", "gemini", "grok"]
    : ["openai", "gemini", "grok", "claude"];

  for (const kind of order) {
    try {
      const out = String(await tryModel(kind) || "").trim();
      if (out) return out;
    } catch {
      // Try next provider
    }
  }
  const applied = msg.match(/^applied proposal:\s*(\d+)\s*action/i);
  if (applied) {
    const n = Number(applied[1] || "0");
    return n > 0
      ? `승인된 제안을 반영했어요. 총 ${n}개 작업을 적용했습니다.`
      : "승인된 제안을 반영했어요.";
  }
  const failed = msg.match(/^failed:\s*(.+)$/i);
  if (failed) {
    return `적용 중 일부 경로에서 실패했습니다: ${String(failed[1] || "").trim()}`;
  }
  return `처리 결과: ${msg}`;
}

type ChatBody = {
  messages?: any[];
  model?: string;
  keys?: {
    gemini?: string;
    grok?: string;
    openai?: string;
    anthropic?: string;
  };
  prompt?: string;
  aspect_ratio?: string;
  size?: string;
  resolution?: string;
  images?: string[];
  participant_pids?: string[];
  persona_memory_prefs?: Record<string, { focus?: string[]; avoid?: string[]; redirectTo?: string }>;
  user_id?: string;
  userId?: string;
  session_id?: string;
  sessionId?: string;
  stream?: boolean;
};

export async function handleChat(reqBody: ChatBody, env: Env, cors: CorsHeaders): Promise<Response> {
  const {
    messages = [],
    model = "grok-4.20-non-reasoning",
    keys,
    prompt,
    aspect_ratio,
    size,
    resolution,
    images = [],
    participant_pids = [],
    user_id,
    userId,
    session_id,
    sessionId,
    stream = false,
  } = reqBody;

  const apiKeys = {
    gemini: keys?.gemini || env.GEMINI_KEY || "",
    grok: keys?.grok || env.GROK_KEY || "",
    openai: keys?.openai || env.OPENAI_KEY || "",
    anthropic: keys?.anthropic || env.ANTHROPIC_KEY || "",
  };

  const isImageReq = IMAGE_MODELS.includes(model) || !!prompt;
  const userIdNorm = normalizeUserId(user_id || userId || "");
  const sessionIdNorm = normalizeSessionId(session_id || sessionId || "");
  const inRileyChat = isRileyParticipant(participant_pids || []);
  const inAveryChat = isAveryParticipant(participant_pids || []);
  const latestUserText = extractLatestUserText(messages);
  const shouldWriteRileyEvent = inRileyChat && (isWealthMutationText(latestUserText) || isWealthIntentText(latestUserText));
  const shouldWriteAveryEvent = inAveryChat && shouldPersistAveryWorklogText(latestUserText);
  const policyTargetPid = resolvePolicyTargetPid(participant_pids || []);
  const profilePersonaPid = resolvePrimaryPersonaPid(participant_pids || []);
  const vaultRouteMode = !isImageReq && (inRileyChat || inAveryChat) ? routeVaultRequestMode(latestUserText) : "none";

  try {
    const proposalPersona: "riley" | "avery" | null = inRileyChat ? "riley" : (inAveryChat ? "avery" : null);
    if (!isImageReq && proposalPersona && isApprovalText(latestUserText)) {
      const pending = await loadPendingVaultProposal(env, proposalPersona);
      if (pending) {
        const exec = await executeVaultProposal(env, pending);
        if (exec.ok) await clearPendingVaultProposal(env, proposalPersona);
        const evidence = await writeVaultEvidence(env, proposalPersona, "proposal_apply", exec.ok, exec.message, latestUserText);
        const natural = await renderVaultResultMessage(exec.message, model, apiKeys, latestUserText);
        return Response.json({ result: exec.ok ? "success" : "error", reply: natural, evidence_id: evidence.id }, { status: exec.ok ? 200 : 400, headers: cors });
      }
    }

    if (!isImageReq && inRileyChat && vaultRouteMode === "command") {
      const vaultAction = await runRileyVaultActionFromText(env, latestUserText);
      if (vaultAction) {
        if (!vaultAction.ok) {
          if (/^path_missing:/i.test(String(vaultAction.error || ""))) {
            // Ambiguous create request should stay conversational instead of hard failing.
          } else {
            const evidence = await writeVaultEvidence(env, "riley", "direct", false, String(vaultAction.error || "unknown"), latestUserText);
            return Response.json({ result: "error", error: vaultAction.error, evidence_id: evidence.id }, { status: 400, headers: cors });
          }
        } else {
          const evidence = await writeVaultEvidence(env, "riley", "direct", true, vaultAction.message, latestUserText);
          const natural = await renderVaultResultMessage(vaultAction.message, model, apiKeys, latestUserText);
          return Response.json({ result: "success", reply: natural, evidence_id: evidence.id }, { headers: cors });
        }
      }
    }
    if (!isImageReq && inAveryChat && vaultRouteMode === "command") {
      const vaultAction = await runAveryVaultActionFromText(env, latestUserText);
      if (vaultAction) {
        if (!vaultAction.ok) {
          if (/^path_missing:/i.test(String(vaultAction.error || ""))) {
            // Ambiguous create request should stay conversational instead of hard failing.
          } else {
            const evidence = await writeVaultEvidence(env, "avery", "direct", false, String(vaultAction.error || "unknown"), latestUserText);
            return Response.json({ result: "error", error: vaultAction.error, evidence_id: evidence.id }, { status: 400, headers: cors });
          }
        } else {
          const evidence = await writeVaultEvidence(env, "avery", "direct", true, vaultAction.message, latestUserText);
          const natural = await renderVaultResultMessage(vaultAction.message, model, apiKeys, latestUserText);
          return Response.json({ result: "success", reply: natural, evidence_id: evidence.id }, { headers: cors });
        }
      }
    }

    const vaultRoutingPrompt = (!isImageReq && (inRileyChat || inAveryChat) && vaultRouteMode === "dialog")
      ? "User intent suggests creating a file/folder but target path/name is ambiguous. Do not execute now. Ask one concise follow-up question in persona voice to confirm filename/path or offer 2-3 concrete options."
      : "";

    let rileyWriteResult: { ok: boolean; error?: string; eventId?: string } | null = null;
    let promotionApplyMessage = "";
    if (!isImageReq && policyTargetPid) {
      const promoted = await approveLatestPendingCandidate(env, policyTargetPid, latestUserText);
      if (promoted.applied && promoted.message) promotionApplyMessage = promoted.message;
    }
    let policyApplyMessage = "";
    if (!isImageReq && policyTargetPid) {
      const applied = await applyPendingPolicyIfApproved(env, policyTargetPid, latestUserText);
      if (applied.applied && applied.message) policyApplyMessage = applied.message;
    }
    const rileySnapshot = (!isImageReq && inRileyChat)
      ? await (async () => {
          await ensureRileyStateSnapshot(env);
          return await getRileyWealthSnapshot(env, 10);
        })()
      : null;
    const averySnapshot = (!isImageReq && inAveryChat)
      ? await getAveryWorklogSnapshot(env, 20)
      : null;
    const rileyDirective = (!isImageReq && inRileyChat) ? await loadRileyDirective(env) : "";
    const averyDirective = (!isImageReq && inAveryChat) ? await loadAveryDirective(env) : "";
    const fixedRole = profilePersonaPid === "p_riley"
      ? extractFixedRoleFromDirective(rileyDirective, "wealth_manager")
      : (profilePersonaPid === "p_avery"
        ? extractFixedRoleFromDirective(averyDirective, "worklog_manager")
        : "general_assistant");
    let attitudeAUpdateStatus = "";
    if (!isImageReq && profilePersonaPid) {
      const res = await processAttitudeACandidateUpdate(env, profilePersonaPid, userIdNorm, latestUserText);
      if (res.observed) {
        attitudeAUpdateStatus = res.applied
          ? `Attitude A updated (${res.reason}).`
          : `Attitude A candidate observed (${res.reason}).`;
      }
    }
    const rileyMemoryMd = (!isImageReq && inRileyChat) ? await loadRileyVaultMemoryMarkdown(env) : "";
    const averyMemoryMd = (!isImageReq && inAveryChat) ? await loadAveryVaultMemoryMarkdown(env) : "";
    const personaProfile = (!isImageReq && profilePersonaPid)
      ? await loadPersonaUserProfile(env, profilePersonaPid, userIdNorm)
      : null;
    let sessionAttitude = (!isImageReq && profilePersonaPid && sessionIdNorm)
      ? await loadSessionAttitudeState(env, profilePersonaPid, userIdNorm, sessionIdNorm)
      : null;
    if (!isImageReq && profilePersonaPid && sessionIdNorm) {
      const inferred = inferAttitudeBFromUserText(latestUserText);
      if (inferred) {
        const merged = mergeAttitudeB(sessionAttitude?.attitudeB || null, inferred);
        sessionAttitude = {
          version: 1,
          userId: userIdNorm,
          personaPid: profilePersonaPid,
          sessionId: sessionIdNorm,
          attitudeB: merged,
          updatedAt: new Date().toISOString(),
        };
        await saveSessionAttitudeState(env, sessionAttitude);
      }
    }
    const profileSections = personaProfile
      ? buildPersonaContextSections(personaProfile, sessionAttitude?.attitudeB || null, fixedRole)
      : null;
    const crossSessionContext = (!isImageReq && profilePersonaPid)
      ? await buildPersonaCrossSessionContextBlock(env, profilePersonaPid, sessionIdNorm, userIdNorm)
      : "";
    const memPrompt = isImageReq
      ? ""
      : [
          "Memory policy:",
          "- Public/private memory feature is disabled.",
          "- Do not create, update, or reference generic memory store entries.",
          ...(rileyMemoryMd
            ? ["Riley vault memory markdown (/_vault/p_riley/_memory/p_riley_memory.md):", rileyMemoryMd]
            : []),
          ...(averyMemoryMd
            ? ["Avery vault memory markdown (/_vault/p_avery/_memory/p_avery_memory.md):", averyMemoryMd]
            : []),
          ...(crossSessionContext ? [crossSessionContext] : []),
        ].join("\n");
    const personaPolicyPrompt = (!isImageReq && policyTargetPid)
      ? await buildPersonaPolicySystemPrompt(env, policyTargetPid)
      : "";
    const promotionPrompt = (!isImageReq && policyTargetPid)
      ? buildPromotionSystemPrompt(policyTargetPid)
      : "";
    const effectiveMessages = !isImageReq
      ? buildPersonaContext(messages, {
          globalRules: [ANTI_HALLUCINATION_GUARD],
          personaBaseRules: [
            ...(rileyDirective ? [`Priority 1 Directive (Riley):\n${rileyDirective}`] : []),
            ...(averyDirective ? [`Priority 1 Directive (Avery):\n${averyDirective}`] : []),
            ...(inRileyChat ? [RILEY_NUMERIC_PRIORITY_GUARD] : []),
            ...(inAveryChat ? [AVERY_WORKLOG_GUARD] : []),
            ...((inRileyChat || inAveryChat) ? [VAULT_AUTONOMY_GUARD] : []),
          ],
          sections: profileSections,
          extraSystemBlocks: [
            RESPONSE_VARIANCE_PROMPT,
            ...(rileySnapshot ? [buildRileySystemPrompt(rileySnapshot.state)] : []),
            ...(averySnapshot ? [buildAverySystemPrompt(averySnapshot.state)] : []),
            ...(personaPolicyPrompt ? [personaPolicyPrompt] : []),
            ...(promotionPrompt ? [promotionPrompt] : []),
            ...(vaultRoutingPrompt ? [vaultRoutingPrompt] : []),
            ...(memPrompt ? [memPrompt] : []),
            ...(policyApplyMessage ? [`Policy apply status: ${policyApplyMessage}`] : []),
            ...(promotionApplyMessage ? [`Promotion apply status: ${promotionApplyMessage}`] : []),
            ...(attitudeAUpdateStatus ? [attitudeAUpdateStatus] : []),
          ],
        })
      : messages;
    const preparedMessages = isImageReq
      ? effectiveMessages
      : await inlineImageUrlsInMessages(effectiveMessages);

    let reply = "";
    let imageUrlOut = "";
    if (isImageReq) {
      const userPrompt = typeof prompt === "string" && prompt.trim()
        ? prompt
        : extractText(messages.filter((m) => m.role === "user").pop()?.content) || "generate image";
      const ratio = aspect_ratio || "1:1";
      let imageUrl = "";

      if (model.startsWith("grok")) {
        imageUrl = await generateGrokImage({
          model,
          prompt: userPrompt,
          ratio,
          resolution,
          images,
          apiKey: apiKeys.grok,
        });
      } else if (model.startsWith("gpt-image")) {
        imageUrl = await generateOpenAIImage({
          model,
          prompt: userPrompt,
          size: images.length > 0 ? undefined : (size || RATIO_TO_SIZE[ratio] || "1024x1024"),
          images,
          apiKey: apiKeys.openai,
        });
      } else if (model.startsWith("gemini")) {
        imageUrl = await generateGeminiImage({
          model,
          prompt: userPrompt,
          ratio,
          resolution,
          images,
          apiKey: apiKeys.gemini,
        });
      } else if (model.startsWith("imagen")) {
        imageUrl = await generateImagenImage({
          model,
          prompt: userPrompt,
          ratio,
          apiKey: apiKeys.gemini,
        });
      }

      if (!imageUrl) throw new Error("이미지 URL 응답이 없습니다.");
      imageUrlOut = imageUrl;
      reply = `![generated](${imageUrl})`;
    } else if (stream && (model.startsWith("gemini") || model.startsWith("grok") || model.startsWith("gpt-") || model.startsWith("o1") || model.startsWith("o3") || model.startsWith("o4"))) {
      const encoder = new TextEncoder();
      const body = new ReadableStream<Uint8Array>({
        async start(controller) {
          const send = (obj: Record<string, unknown>) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
          };
          try {
            send({ type: "start" });
            if (model.startsWith("gemini")) {
              reply = await streamGeminiText({
                model,
                messages: preparedMessages,
                apiKey: apiKeys.gemini,
                onDelta: (delta) => send({ type: "delta", text: delta }),
              });
            } else if (model.startsWith("grok")) {
              reply = await streamGrokText({
                model,
                messages: preparedMessages,
                apiKey: apiKeys.grok,
                onDelta: (delta) => send({ type: "delta", text: delta }),
              });
            } else {
              reply = await streamOpenAIText({
                model,
                messages: preparedMessages,
                apiKey: apiKeys.openai,
                onDelta: (delta) => send({ type: "delta", text: delta }),
              });
            }
            if (shouldWriteRileyEvent) {
              const wr = await appendRileyWealthEvent(env, latestUserText);
              rileyWriteResult = wr.ok ? { ok: true, eventId: wr.eventId } : { ok: false, error: wr.error };
            }
            if (shouldWriteAveryEvent) {
              await appendAveryWorklogEvent(env, latestUserText);
            }
            if (policyTargetPid) {
              await savePendingPolicyPatchFromReply(env, policyTargetPid, reply);
              await saveCandidateFromReply(env, policyTargetPid, reply);
            }
            let proposalExecuted = false;
            if (proposalPersona) {
              const proposal = parseVaultProposalFromReply(reply);
              if (proposal && proposal.persona === proposalPersona) {
                const exec = await executeVaultProposal(env, proposal);
                await writeVaultEvidence(env, proposalPersona, "proposal_apply", exec.ok, exec.message, latestUserText);
                const natural = await renderVaultResultMessage(exec.message, model, apiKeys, latestUserText);
                reply = stripVaultProposalBlock(reply).trim();
                if (natural) {
                  reply = [reply, natural].filter(Boolean).join("\n\n");
                }
                proposalExecuted = exec.ok;
              }
            }
            reply = guardPersonaReply(reply, proposalExecuted, !!proposalPersona);
            send({ type: "done", reply });
          } catch (err: any) {
            send({ type: "error", error: err?.message || "stream error" });
          } finally {
            controller.close();
          }
        },
      });
      return new Response(body, {
        headers: {
          ...cors,
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    } else if (model.startsWith("gemini")) {
      reply = await generateGeminiText({
        model,
        messages: preparedMessages,
        apiKey: apiKeys.gemini,
      });
    } else if (model.startsWith("grok")) {
      reply = await generateGrokText({
        model,
        messages: preparedMessages,
        apiKey: apiKeys.grok,
      });
    } else if (model.startsWith("claude")) {
      reply = await generateClaudeText({
        model,
        messages: preparedMessages,
        apiKey: apiKeys.anthropic,
      });
    } else {
      reply = await generateOpenAIText({
        model,
        messages: preparedMessages,
        apiKey: apiKeys.openai,
      });
    }

    if (shouldWriteRileyEvent) {
      const wr = await appendRileyWealthEvent(env, latestUserText);
      rileyWriteResult = wr.ok ? { ok: true, eventId: wr.eventId } : { ok: false, error: wr.error };
    }
    if (shouldWriteAveryEvent) {
      await appendAveryWorklogEvent(env, latestUserText);
    }
    if (policyTargetPid) {
      await savePendingPolicyPatchFromReply(env, policyTargetPid, reply);
      await saveCandidateFromReply(env, policyTargetPid, reply);
    }
    let proposalExecuted = false;
    if (proposalPersona) {
      const proposal = parseVaultProposalFromReply(reply);
      if (proposal && proposal.persona === proposalPersona) {
        const exec = await executeVaultProposal(env, proposal);
        await writeVaultEvidence(env, proposalPersona, "proposal_apply", exec.ok, exec.message, latestUserText);
        const natural = await renderVaultResultMessage(exec.message, model, apiKeys, latestUserText);
        reply = stripVaultProposalBlock(reply).trim();
        if (natural) {
          reply = [reply, natural].filter(Boolean).join("\n\n");
        }
        proposalExecuted = exec.ok;
      }
    }
    reply = guardPersonaReply(reply, proposalExecuted, !!proposalPersona);

    if (imageUrlOut) {
      return Response.json({ result: "success", reply, image_url: imageUrlOut, riley_write: rileyWriteResult }, { headers: cors });
    }
    return Response.json({ result: "success", reply, riley_write: rileyWriteResult }, { headers: cors });
  } catch (e: any) {
    return Response.json({ result: "error", error: e?.message || "unknown error" }, { status: 500, headers: cors });
  }
}

async function fetchImageUrlAsDataUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url);
    if (!res.ok) return url;
    const mime = (res.headers.get("content-type") || "image/jpeg").split(";")[0] || "image/jpeg";
    if (!/^image\//i.test(mime)) return url;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (!bytes.length) return url;
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return `data:${mime};base64,${btoa(binary)}`;
  } catch {
    return url;
  }
}

function normalizeDataImageUrl(raw: string): string {
  const s = String(raw || "").trim();
  const m = s.match(/^data:([^;,]+);base64,(.+)$/i);
  if (!m) return s;
  const mime = (m[1] || "").trim();
  const b64 = (m[2] || "").trim();
  if (!/^image\//i.test(mime)) return s;
  if (!b64 || b64.length < 64) return s;
  return `data:${mime};base64,${b64}`;
}

async function inlineImageUrlsInMessages(messages: any[]): Promise<any[]> {
  const out: any[] = [];
  for (const m of (messages || [])) {
    if (!Array.isArray(m?.content)) {
      out.push(m);
      continue;
    }
    const content = [];
    for (const item of m.content) {
      if (item?.type !== "image_url" || !item?.image_url?.url) {
        content.push(item);
        continue;
      }
      const raw = String(item.image_url.url || "").trim();
      try {
        const normalized = /^data:image\//i.test(raw)
          ? normalizeDataImageUrl(raw)
          : await fetchImageUrlAsDataUrl(raw);
        content.push({ ...item, image_url: { ...item.image_url, url: normalized } });
      } catch {
        content.push(item);
      }
    }
    out.push({ ...m, content });
  }
  return out;
}

function extractText(content: unknown): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return (content.find((c: any) => c.type === "text") as any)?.text || "";
  }
  return String(content);
}

type SessionIndexLite = {
  id?: string;
  updatedAt?: number;
  roomName?: string;
  participantPids?: string[];
};

async function r2ReadText(env: Env, key: string): Promise<string | null> {
  try {
    const obj = await env.R2.get(key);
    if (!obj || typeof obj.text !== "function") return null;
    return await obj.text();
  } catch {
    return null;
  }
}

async function loadSessionIndexLite(env: Env, userId = "user_default"): Promise<SessionIndexLite[]> {
  const fromR2 = await r2ReadText(env, scopedR2Key(userId, SESSION_INDEX_R2_KEY));
  if (fromR2) {
    try {
      const parsed = JSON.parse(fromR2);
      if (Array.isArray(parsed)) return parsed as SessionIndexLite[];
    } catch {
      // ignore
    }
  }
  const fromKv = await env.KV.get(scopedKvKey(userId, SESSION_INDEX_KV_KEY));
  if (fromKv) {
    try {
      const parsed = JSON.parse(fromKv);
      if (Array.isArray(parsed)) return parsed as SessionIndexLite[];
    } catch {
      // ignore
    }
  }
  return [];
}

function asTrimmedText(raw: unknown): string {
  return String(raw || "").replace(/\s+/g, " ").trim();
}

function summarizeSessionHistory(history: unknown[]): string {
  const msgs = Array.isArray(history) ? history : [];
  const picked: string[] = [];
  for (let i = msgs.length - 1; i >= 0 && picked.length < 4; i--) {
    const m = msgs[i] as any;
    const role = String(m?.role || "").trim();
    if (role !== "user" && role !== "assistant") continue;
    const txt = asTrimmedText(extractText(m?.content));
    if (!txt) continue;
    const short = txt.length > 140 ? `${txt.slice(0, 140)}...` : txt;
    picked.push(`${role}: ${short}`);
  }
  return picked.reverse().join(" | ");
}

async function loadSessionPayloadText(env: Env, id: string, userId = "user_default"): Promise<string | null> {
  const sid = String(id || "").trim();
  if (!sid) return null;
  const fromR2 = await r2ReadText(env, scopedR2Key(userId, `${SESSION_R2_PREFIX}${sid}.json`));
  if (fromR2) return fromR2;
  return await env.KV.get(scopedKvKey(userId, `session:${sid}`));
}

async function buildPersonaCrossSessionContextBlock(env: Env, personaPid: string, currentSessionId = "", userId = "user_default"): Promise<string> {
  const pid = String(personaPid || "").trim().toLowerCase();
  if (!pid) return "";
  const index = await loadSessionIndexLite(env, userId);
  const current = String(currentSessionId || "").trim();
  const sessions = index
    .filter((s) => String(s?.id || "").trim())
    .filter((s) => String(s.id) !== current)
    .filter((s) => Array.isArray(s.participantPids) && s.participantPids.some((p) => String(p || "").trim().toLowerCase() === pid))
    .sort((a, b) => Number(b?.updatedAt || 0) - Number(a?.updatedAt || 0))
    .slice(0, 6);
  if (!sessions.length) return "";

  const lines: string[] = [];
  for (const s of sessions) {
    const sid = String(s.id || "").trim();
    const room = asTrimmedText(s.roomName || sid) || sid;
    let snippet = "";
    const payloadText = await loadSessionPayloadText(env, sid, userId);
    if (payloadText) {
      try {
        const parsed = JSON.parse(payloadText) as Record<string, unknown>;
        snippet = summarizeSessionHistory(Array.isArray(parsed?.history) ? (parsed.history as unknown[]) : []);
      } catch {
        // ignore parse failure
      }
    }
    if (!snippet) continue;
    lines.push(`- [${room}] ${snippet}`);
    if (lines.length >= 6) break;
  }
  if (!lines.length) return "";
  return [
    `Persona cross-session context (${pid}):`,
    ...lines,
    "- Use this as soft continuity context; prioritize current chat and current user intent.",
  ].join("\n");
}

async function generateClaudeText(params: {
  model: string;
  messages: unknown[];
  apiKey: string;
}): Promise<string> {
  const { model, messages, apiKey } = params;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, max_tokens: 2000 }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Claude Text API Error: ${text}`);
  const data = JSON.parse(text);
  return data.content?.[0]?.text || "";
}
