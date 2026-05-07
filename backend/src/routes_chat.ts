import type { CorsHeaders, Env } from "./index";
import { generateGeminiImage, generateGeminiText, generateImagenImage, streamGeminiText } from "./model_gemini";
import { generateOpenAIImage, generateOpenAIText, streamOpenAIText } from "./model_openai";
import { generateGrokImage, generateGrokText, streamGrokText } from "./model_grok";
import { buildPersonaVaultPath, dropboxReadText, dropboxWriteText, getPersonaDropboxAccessToken } from "./dropbox_vault";
import {
  appendAveryWorklogEvent,
  buildAverySystemPrompt,
  getAveryWorklogSnapshot,
  isAveryParticipant,
  loadAveryDirective,
  recordAveryVaultMutation,
  runAveryVaultActionFromText,
  shouldPersistAveryWorklogText,
} from "./avery_worklog";
import {
  extractLatestUserText,
  isRileyParticipant,
  loadRileyDirective,
  recordRileyVaultMutation,
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
import { buildPersonaVaultV2SystemPrompt } from "./persona_vault_v2";
import { buildRileySheetsContextPrompt, executeRileySheetProposalActions, loadRileySheetsContext, runRileySheetRequestWithGemini, type RileySheetProposalAction } from "./google_sheets";
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

const RILEY_SHEETS_CAPABILITY_GUARD = [
  "Riley Google Sheets capability policy:",
  "- Riley has delegated server-side capability to read, write, and create tabs in the configured Google Spreadsheet.",
  "- Do not claim Riley only has stale snapshots, read-only access, missing API permission, or that the user must resync.",
  "- For explicit sheet reads/writes/creates, the server executes the operation before Riley replies and returns the API result.",
  "- Riley may say a sheet write failed only when the server returns a concrete write or read-back verification error.",
].join("\n");

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
  "- When the user directly requests an action, do not ask for approval first.",
  "- Use proposal blocks only for optional structure ideas, low-confidence plans, or ambiguous changes.",
  "- If you output a clear proposal block for a direct user request, the server may execute it immediately before the reply is shown.",
  "- Use this exact block when proposing:",
  "[VAULT_PROPOSAL]",
  "{\"persona\":\"riley|avery\",\"actions\":[{\"type\":\"create_folder\",\"path\":\"...\"},{\"type\":\"create_file\",\"path\":\"...\",\"content\":\"...\"}]}",
  "[/VAULT_PROPOSAL]",
  "- For Riley sheet proposals, allowed action types are rename_sheet {old_title,new_title} and update_cell {sheet,cell,value}.",
  "- Proposal approval is optional only for ambiguous plans. If action is safe and clear, auto-apply.",
  "- Do not claim false platform limits (e.g., 'cannot access file system') when vault action is available.",
  "- When you propose, keep it short and practical.",
].join("\n");

function formatKstNow(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now).reduce<Record<string, string>>((acc, part) => {
    if (part.type !== "literal") acc[part.type] = part.value;
    return acc;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second} KST (${parts.weekday})`;
}

function isTimeQuestion(text: string): boolean {
  const raw = String(text || "");
  return /(현재\s*시간|지금\s*몇\s*시|오늘\s*날짜|오늘\s*몇\s*일|current\s*time|what\s*time|today'?s?\s*date)/i.test(raw);
}

const SESSION_INDEX_DROPBOX_PATH = "/session/index.json";

type VaultProposalAction = { type: "create_file" | "create_folder"; path: string; content?: string } | RileySheetProposalAction;
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
  return /(?:파일|file|폴더|folder|디렉터리|directory|csv|md|txt|json|jsonl).*(?:생성|만들|작성|저장|삭제|제거|지워|읽|열|확인|보여|수정|변경|업데이트|create|write|delete|remove|read|open|show|view|check|update|edit|overwrite)|(?:create|write|delete|remove|read|open|show|view|check|update|edit|overwrite).*(?:file|folder|directory)/i.test(t);
}

function isDefaultableRileyVaultIntent(text: string): boolean {
  const t = String(text || "");
  return /(?:파일|file|폴더|folder|디렉터리|directory|csv|md|txt|json|jsonl|문서).*(?:생성|만들|작성|저장|기록|create|write|save)|(?:create|write|save).*(?:file|folder|directory|ledger|csv|md|txt|json|jsonl)|(?:자산|부채|wealth|ledger).*(?:기록|저장|작성)/i.test(t);
}

function hasExplicitVaultTarget(text: string): boolean {
  const t = String(text || "");
  if (/([a-zA-Z0-9_./-]+\.(?:csv|md|txt|json|jsonl))\b/i.test(t)) return true;
  if (/(?:파일생성|파일 만들어|create file)\s+([^\n:]{1,140})/i.test(t)) return true;
  if (/(?:폴더생성|폴더 만들어|create folder)\s+([^\n]{1,140})/i.test(t)) return true;
  if (/["'`]([a-zA-Z0-9_./-]+)["'`]\s*(?:파일|file|폴더|folder)/i.test(t)) return true;
  return false;
}

function routeVaultRequestMode(text: string, persona: "riley" | "avery" | null): "command" | "dialog" | "none" {
  if (!detectVaultCreateIntent(text)) return "none";
  if (hasExplicitVaultTarget(text)) return "command";
  if (persona === "riley" && isDefaultableRileyVaultIntent(text)) return "command";
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
    if (type === "rename_sheet") {
      const oldTitle = String(a?.old_title || a?.oldTitle || "").trim();
      const newTitle = String(a?.new_title || a?.newTitle || "").trim();
      if (persona === "riley" && oldTitle && newTitle) actions.push({ type: "rename_sheet", old_title: oldTitle, new_title: newTitle });
      continue;
    }
    if (type === "update_cell") {
      const sheet = String(a?.sheet || a?.tab || "").trim();
      const cell = String(a?.cell || "").trim().toUpperCase();
      if (persona === "riley" && sheet && cell) actions.push({ type: "update_cell", sheet, cell, value: String(a?.value || "") });
      continue;
    }
    const path = String(a?.path || "").trim().replace(/^\/+/, "");
    if (!path) continue;
    if (type === "create_folder") actions.push({ type: "create_folder", path });
    if (type === "create_file") actions.push({ type: "create_file", path, content: String(a?.content || "") });
  }
  if (!actions.length) return null;
  return { persona: persona as "riley" | "avery", actions: actions.slice(0, 20), createdAt: Date.now() };
}

function parseLatestVaultProposalFromMessages(messages: any[]): VaultProposal | null {
  for (let i = (messages || []).length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (String(msg?.role || "") !== "assistant") continue;
    const parsed = parseVaultProposalFromReply(extractText(msg?.content));
    if (parsed) return parsed;
  }
  return null;
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
  const read = msg.match(/read file:\s*(\/\S+)/i);
  if (read) out.push({ type: "file", value: read[1] });
  const updated = msg.match(/updated file:\s*(\/\S+)/i);
  if (updated) out.push({ type: "file", value: updated[1] });
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
    return "요청을 직접 실행할 수 있는 경로로 다시 처리하겠습니다.";
  }

  // If no evidence exists, block fake completion claims.
  if (!hasExecutionEvidence && /(생성했|생성했습니다|만들었|적용했|저장했|완료했|수정했|변경했|고쳤|created|made|saved|completed|done|updated|edited|deleted|removed)/i.test(out)) {
    return "실행 증거가 없어 완료로 보고하지 않았습니다.";
  }
  return out;
}

async function executeVaultProposal(env: Env, proposal: VaultProposal): Promise<{ ok: boolean; message: string; evidenceIds?: string[] }> {
  const sheetActions = proposal.actions.filter((a): a is RileySheetProposalAction => a.type === "rename_sheet" || a.type === "update_cell");
  if (sheetActions.length) {
    if (proposal.persona !== "riley") return { ok: false, message: "sheet proposal is only supported for riley" };
    const res = await executeRileySheetProposalActions(env, sheetActions);
    if (!res.ok) return { ok: false, message: `failed: ${res.error}` };
    return { ok: true, message: res.message };
  }

  const token = await getPersonaDropboxAccessToken(env, proposal.persona);
  if (!token) return { ok: false, message: `${proposal.persona} dropbox token missing` };
  const pid = proposal.persona === "riley" ? "p_riley" : "p_avery";
  let okCount = 0;
  const failed: string[] = [];
  const evidenceIds: string[] = [];
  for (const a of proposal.actions) {
    if (a.type !== "create_file" && a.type !== "create_folder") continue;
    const rawPath = String(a.path || "").trim().replace(/\\/g, "/");
    const path = rawPath.startsWith("/_vault/") || rawPath.startsWith("_vault/")
      ? `/${rawPath.replace(/^\/+/, "")}`
      : buildPersonaVaultPath(pid, rawPath.replace(/^\/+/, ""));
    if (!path || path === "/") continue;
    if (a.type === "create_folder") {
      const ok = await dropboxWriteText(token, `${path.replace(/\/+$/, "")}/.keep`, "");
      if (ok) {
        const rec = proposal.persona === "riley"
          ? await recordRileyVaultMutation(env, "create_folder", path.replace(/\/+$/, ""), "proposal_apply")
          : await recordAveryVaultMutation(env, "create_folder", path.replace(/\/+$/, ""), "proposal_apply");
        if (rec.ok) {
          okCount++;
          evidenceIds.push(rec.evidenceId);
        } else {
          failed.push(`${path}: ${rec.error || "index/evidence failed"}`);
        }
      } else failed.push(path);
    } else {
      const rawContent = String(a.content || "");
      const payload = /\.csv$/i.test(path)
        ? (rawContent.startsWith("\uFEFF") ? rawContent : `\uFEFF${rawContent}`)
        : rawContent;
      const ok = await dropboxWriteText(token, path, payload);
      if (ok) {
        const rec = proposal.persona === "riley"
          ? await recordRileyVaultMutation(env, "create_file", path, "proposal_apply")
          : await recordAveryVaultMutation(env, "create_file", path, "proposal_apply");
        if (rec.ok) {
          okCount++;
          evidenceIds.push(rec.evidenceId);
        } else {
          failed.push(`${path}: ${rec.error || "index/evidence failed"}`);
        }
      } else failed.push(path);
    }
  }
  if (failed.length) return { ok: false, message: `failed: ${failed.slice(0, 3).join(", ")}` };
  return { ok: true, message: `applied proposal: ${okCount} action(s); evidence_id: ${evidenceIds.join(",")}`, evidenceIds };
}

function stripVaultProposalBlock(reply: string): string {
  return String(reply || "").replace(/\n?\[VAULT_PROPOSAL\][\s\S]*?\[\/VAULT_PROPOSAL\]\n?/i, "\n").trim();
}

type TextApiKeys = { gemini: string; grok: string; openai: string; anthropic: string };

function compactOperationPayload(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return value.length > 1000 ? `${value.slice(0, 1000)}...` : value;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => compactOperationPayload(item, depth + 1));
  const src = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(src)) {
    if (key === "values" && Array.isArray(val)) {
      const rows = val as unknown[][];
      out[key] = {
        rowCount: rows.length,
        preview: rows.slice(0, 5).map((row) => Array.isArray(row) ? row.slice(0, 8) : row),
      };
    } else if (key === "logs" && Array.isArray(val)) {
      out[key] = val.slice(0, 10).map((log: any) => ({
        runId: log?.runId,
        at: log?.at,
        userText: typeof log?.userText === "string" ? log.userText.slice(0, 300) : log?.userText,
        plannerModel: log?.plannerModel,
        final: compactOperationPayload(log?.final, depth + 1),
        steps: Array.isArray(log?.steps) ? log.steps.map((step: any) => ({
          at: step?.at,
          stage: step?.stage,
          ok: step?.ok,
          error: step?.error,
          data: compactOperationPayload(step?.data, depth + 2),
        })) : undefined,
      }));
    } else if (depth >= 4) {
      out[key] = "[compact]";
    } else {
      out[key] = compactOperationPayload(val, depth + 1);
    }
  }
  return out;
}

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
    "- Do not ask a follow-up question unless the operation failed or the user must choose something.",
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
  if (msg.includes("tool_result=")) {
    return "작업 결과를 확인했지만 응답 요약 생성에 실패했습니다. 실행 로그에서 결과와 오류를 다시 확인할 수 있습니다.";
  }
  const short = msg.length > 800 ? `${msg.slice(0, 800)}...` : msg;
  return `처리 결과: ${short}`;
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
  const shouldWriteAveryEvent = inAveryChat && shouldPersistAveryWorklogText(latestUserText);
  const policyTargetPid = resolvePolicyTargetPid(participant_pids || []);
  const profilePersonaPid = resolvePrimaryPersonaPid(participant_pids || []);
  const proposalPersona: "riley" | "avery" | null = inRileyChat ? "riley" : (inAveryChat ? "avery" : null);
  const vaultRouteMode = !isImageReq && proposalPersona ? routeVaultRequestMode(latestUserText, proposalPersona) : "none";

  try {
    if (!isImageReq && inRileyChat && isTimeQuestion(latestUserText)) {
      return Response.json({
        result: "success",
        reply: `현재 시간은 ${formatKstNow()}입니다.`,
        time_source: "server_runtime_intl_asia_seoul",
      }, { headers: cors });
    }

    if (!isImageReq && inRileyChat) {
      const sheetResult = await runRileySheetRequestWithGemini(env, latestUserText, apiKeys.gemini, model);
      if (sheetResult) {
        const evidence = await writeVaultEvidence(env, "riley", "sheets_write", sheetResult.ok, sheetResult.ok ? sheetResult.message : sheetResult.error, latestUserText);
        const natural = await renderVaultResultMessage([
          "Riley received a Google Sheets tool result.",
          "Riley must inspect it and decide the final user-facing reply.",
          "If ok=false, Riley should explain the concrete problem and the next fix without pretending it succeeded.",
          `tool_result=${JSON.stringify(compactOperationPayload(sheetResult))}`,
          `run_id=${sheetResult.runId || ""}`,
          `evidence_id=${evidence.id}`,
        ].join("\n"), model, apiKeys, latestUserText);
        return Response.json({
          result: "success",
          reply: natural || (sheetResult.ok ? sheetResult.message : sheetResult.error),
          evidence_id: evidence.id,
          sheet_action: sheetResult,
        }, { headers: cors });
      }
    }

    if (!isImageReq && proposalPersona && isApprovalText(latestUserText)) {
      const pending = await loadPendingVaultProposal(env, proposalPersona)
        || parseLatestVaultProposalFromMessages(messages);
      if (pending) {
        const exec = await executeVaultProposal(env, pending);
        if (exec.ok) await clearPendingVaultProposal(env, proposalPersona);
        const evidence = await writeVaultEvidence(env, proposalPersona, "proposal_apply", exec.ok, exec.message, latestUserText);
        const natural = await renderVaultResultMessage(exec.message, model, apiKeys, latestUserText);
        return Response.json({ result: exec.ok ? "success" : "error", reply: natural, evidence_id: evidence.id }, { status: exec.ok ? 200 : 400, headers: cors });
      }
    }

    if (!isImageReq && inRileyChat) {
      let vaultAction = await runRileyVaultActionFromText(env, latestUserText);
      if (!vaultAction && /\bcsv\b/i.test(latestUserText)) {
        vaultAction = await runRileyVaultActionFromText(env, `create csv file\n${latestUserText}`);
      }
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
          return Response.json({ result: "success", reply: natural, evidence_id: evidence.id, vault_evidence_id: vaultAction.evidenceId }, { headers: cors });
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
          return Response.json({ result: "success", reply: natural, evidence_id: evidence.id, vault_evidence_id: vaultAction.evidenceId }, { headers: cors });
        }
      }
    }

    const vaultRoutingPrompt = (!isImageReq && (inRileyChat || inAveryChat) && vaultRouteMode === "dialog")
      ? "User intent suggests creating a file/folder but target path/name is ambiguous. Do not execute now. Ask one concise follow-up question in persona voice to confirm filename/path or offer 2-3 concrete options."
      : "";

    let averyWriteResult: { ok: boolean; error?: string; eventId?: string } | null = null;
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
    if (shouldWriteAveryEvent) {
      const wr = await appendAveryWorklogEvent(env, latestUserText);
      averyWriteResult = wr.ok ? { ok: true, eventId: wr.eventId } : { ok: false, error: wr.error };
    }
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
    const rileyVaultV2Prompt = (!isImageReq && inRileyChat) ? await buildPersonaVaultV2SystemPrompt(env, "riley") : "";
    const averyVaultV2Prompt = (!isImageReq && inAveryChat) ? await buildPersonaVaultV2SystemPrompt(env, "avery") : "";
    const rileySheetsPrompt = (!isImageReq && inRileyChat) ? buildRileySheetsContextPrompt(await loadRileySheetsContext(env)) : "";
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
      ? await buildPersonaCrossSessionContextBlock(env, profilePersonaPid, sessionIdNorm)
      : "";
    const memPrompt = isImageReq
      ? ""
      : [
          "Memory policy:",
          "- Public/private memory feature is disabled.",
          "- Do not create, update, or reference generic memory store entries.",
          "- Persona vault context comes from Vault v2 index/state/evidence, not legacy _memory markdown files.",
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
            ...(inRileyChat ? [RILEY_SHEETS_CAPABILITY_GUARD] : []),
            ...(inAveryChat ? [AVERY_WORKLOG_GUARD] : []),
            ...((inRileyChat || inAveryChat) ? [VAULT_AUTONOMY_GUARD] : []),
          ],
          sections: profileSections,
          extraSystemBlocks: [
            RESPONSE_VARIANCE_PROMPT,
            ...(averySnapshot ? [buildAverySystemPrompt(averySnapshot.state)] : []),
            ...(rileyVaultV2Prompt ? [rileyVaultV2Prompt] : []),
            ...(averyVaultV2Prompt ? [averyVaultV2Prompt] : []),
            ...(rileySheetsPrompt ? [rileySheetsPrompt] : []),
            ...(personaPolicyPrompt ? [personaPolicyPrompt] : []),
            ...(promotionPrompt ? [promotionPrompt] : []),
            ...(vaultRoutingPrompt ? [vaultRoutingPrompt] : []),
            ...(memPrompt ? [memPrompt] : []),
            ...(averyWriteResult ? [`Avery mutation status: already_applied=${averyWriteResult.ok}; event_id=${averyWriteResult.eventId || ""}; error=${averyWriteResult.error || ""}. Do not output VAULT_PROPOSAL for this already-applied mutation.`] : []),
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

    if (policyTargetPid) {
      await savePendingPolicyPatchFromReply(env, policyTargetPid, reply);
      await saveCandidateFromReply(env, policyTargetPid, reply);
    }
    let proposalExecuted = false;
    let proposalEvidenceId = "";
    if (proposalPersona) {
      const proposal = parseVaultProposalFromReply(reply);
      if (proposal && proposal.persona === proposalPersona) {
        const exec = await executeVaultProposal(env, proposal);
        const evidence = await writeVaultEvidence(env, proposalPersona, "proposal_apply", exec.ok, exec.message, latestUserText);
        proposalEvidenceId = exec.evidenceIds?.join(",") || evidence.id;
        const natural = await renderVaultResultMessage(exec.message, model, apiKeys, latestUserText);
        reply = stripVaultProposalBlock(reply).trim();
        if (natural) {
          reply = [reply, natural].filter(Boolean).join("\n\n");
        }
        proposalExecuted = exec.ok;
      }
    }
    reply = stripVaultProposalBlock(reply).trim() || reply;
    reply = guardPersonaReply(reply, proposalExecuted, !!proposalPersona);

    if (imageUrlOut) {
      return Response.json({ result: "success", reply, image_url: imageUrlOut, evidence_id: proposalEvidenceId || undefined, avery_write: averyWriteResult }, { headers: cors });
    }
    return Response.json({ result: "success", reply, evidence_id: proposalEvidenceId || undefined, avery_write: averyWriteResult }, { headers: cors });
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

async function loadSessionIndexLite(env: Env): Promise<SessionIndexLite[]> {
  const token = await getPersonaDropboxAccessToken(env, "shared");
  if (!token) return [];
  const fromDropbox = await dropboxReadText(token, SESSION_INDEX_DROPBOX_PATH);
  if (!fromDropbox) return [];
  try {
    const parsed = JSON.parse(fromDropbox);
    if (Array.isArray(parsed)) return parsed as SessionIndexLite[];
  } catch {
    // ignore
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

async function loadSessionPayloadText(env: Env, id: string): Promise<string | null> {
  const sid = String(id || "").trim();
  if (!sid) return null;
  const token = await getPersonaDropboxAccessToken(env, "shared");
  if (!token) return null;
  return await dropboxReadText(token, `/session/data/${sid}.json`);
}

async function buildPersonaCrossSessionContextBlock(env: Env, personaPid: string, currentSessionId = ""): Promise<string> {
  const pid = String(personaPid || "").trim().toLowerCase();
  if (!pid) return "";
  const index = await loadSessionIndexLite(env);
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
    const payloadText = await loadSessionPayloadText(env, sid);
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
