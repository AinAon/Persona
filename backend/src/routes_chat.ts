import type { CorsHeaders, Env } from "./index";
import { generateGeminiImage, generateGeminiText, generateImagenImage, streamGeminiText } from "./model_gemini";
import { generateOpenAIImage, generateOpenAIText, streamOpenAIText } from "./model_openai";
import { generateGrokImage, generateGrokText, streamGrokText } from "./model_grok";
import { buildMemorySystemPrompt } from "./memory";
import { dropboxWriteText, getPersonaDropboxAccessToken } from "./dropbox_vault";
import {
  appendAveryWorklogEvent,
  buildAverySystemPrompt,
  getAveryWorklogSnapshot,
  isAveryParticipant,
  loadAveryDirective,
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
  "Vault autonomy policy (proposal-first):",
  "- If you think new folder/file structure will improve workflow, propose first; do not execute immediately.",
  "- Use this exact block when proposing:",
  "[VAULT_PROPOSAL]",
  "{\"persona\":\"riley|avery\",\"actions\":[{\"type\":\"create_folder\",\"path\":\"...\"},{\"type\":\"create_file\",\"path\":\"...\",\"content\":\"...\"}]}",
  "[/VAULT_PROPOSAL]",
  "- Never claim execution before explicit user approval.",
  "- Execute only after user approval words like: 승인, 진행해, 적용해, 해줘, approve, go ahead.",
].join("\n");

type VaultProposalAction = { type: "create_file" | "create_folder"; path: string; content?: string };
type VaultProposal = { persona: "riley" | "avery"; actions: VaultProposalAction[]; createdAt: number };

function pendingVaultProposalKey(persona: "riley" | "avery"): string {
  return `vault:proposal:${persona}`;
}

function isApprovalText(text: string): boolean {
  const t = String(text || "").toLowerCase();
  return /(승인|진행해|진행시켜|적용해|해줘|오케이|approve|go ahead|do it|proceed)/i.test(t);
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

async function executeVaultProposal(env: Env, proposal: VaultProposal): Promise<{ ok: boolean; message: string }> {
  const token = await getPersonaDropboxAccessToken(env, proposal.persona);
  if (!token) return { ok: false, message: `${proposal.persona} dropbox token missing` };
  let okCount = 0;
  const failed: string[] = [];
  for (const a of proposal.actions) {
    const path = `/${String(a.path || "").trim().replace(/^\/+/, "")}`;
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

async function renderVaultResultMessage(raw: string, model: string, apiKeys: TextApiKeys): Promise<string> {
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
  ].join("\n");
  const messages = [
    { role: "system", content: system },
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
  return msg;
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
    persona_memory_prefs = {},
    stream = false,
  } = reqBody;

  const apiKeys = {
    gemini: keys?.gemini || env.GEMINI_KEY || "",
    grok: keys?.grok || env.GROK_KEY || "",
    openai: keys?.openai || env.OPENAI_KEY || "",
    anthropic: keys?.anthropic || env.ANTHROPIC_KEY || "",
  };

  const isImageReq = IMAGE_MODELS.includes(model) || !!prompt;
  const inRileyChat = isRileyParticipant(participant_pids || []);
  const inAveryChat = isAveryParticipant(participant_pids || []);
  const latestUserText = extractLatestUserText(messages);
  const shouldWriteRileyEvent = inRileyChat && (isWealthMutationText(latestUserText) || isWealthIntentText(latestUserText));
  const shouldWriteAveryEvent = inAveryChat && shouldPersistAveryWorklogText(latestUserText);
  const policyTargetPid = resolvePolicyTargetPid(participant_pids || []);

  try {
    const proposalPersona: "riley" | "avery" | null = inRileyChat ? "riley" : (inAveryChat ? "avery" : null);
    if (!isImageReq && proposalPersona && isApprovalText(latestUserText)) {
      const pending = await loadPendingVaultProposal(env, proposalPersona);
      if (pending) {
        const exec = await executeVaultProposal(env, pending);
        if (exec.ok) await clearPendingVaultProposal(env, proposalPersona);
        const natural = await renderVaultResultMessage(exec.message, model, apiKeys);
        return Response.json({ result: exec.ok ? "success" : "error", reply: natural }, { status: exec.ok ? 200 : 400, headers: cors });
      }
    }

    if (!isImageReq && inRileyChat) {
      const vaultAction = await runRileyVaultActionFromText(env, latestUserText);
      if (vaultAction) {
        if (!vaultAction.ok) return Response.json({ result: "error", error: vaultAction.error }, { status: 400, headers: cors });
        const natural = await renderVaultResultMessage(vaultAction.message, model, apiKeys);
        return Response.json({ result: "success", reply: natural }, { headers: cors });
      }
    }
    if (!isImageReq && inAveryChat) {
      const vaultAction = await runAveryVaultActionFromText(env, latestUserText);
      if (vaultAction) {
        if (!vaultAction.ok) return Response.json({ result: "error", error: vaultAction.error }, { status: 400, headers: cors });
        const natural = await renderVaultResultMessage(vaultAction.message, model, apiKeys);
        return Response.json({ result: "success", reply: natural }, { headers: cors });
      }
    }

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
    const memPrompt = isImageReq
      ? ""
      : await buildMemorySystemPrompt(env, {
          participantPids: participant_pids,
          personaCategoryPrefs: persona_memory_prefs as any,
        });
    const personaPolicyPrompt = (!isImageReq && policyTargetPid)
      ? await buildPersonaPolicySystemPrompt(env, policyTargetPid)
      : "";
    const promotionPrompt = (!isImageReq && policyTargetPid)
      ? buildPromotionSystemPrompt(policyTargetPid)
      : "";
    const effectiveMessages = (!isImageReq && memPrompt)
      ? [
          { role: "system", content: ANTI_HALLUCINATION_GUARD },
          ...(rileyDirective ? [{ role: "system", content: `Priority 1 Directive (Riley):\n${rileyDirective}` }] : []),
          ...(averyDirective ? [{ role: "system", content: `Priority 1 Directive (Avery):\n${averyDirective}` }] : []),
          { role: "system", content: RESPONSE_VARIANCE_PROMPT },
          ...(inRileyChat ? [{ role: "system", content: RILEY_NUMERIC_PRIORITY_GUARD }] : []),
          ...(inAveryChat ? [{ role: "system", content: AVERY_WORKLOG_GUARD }] : []),
          ...((inRileyChat || inAveryChat) ? [{ role: "system", content: VAULT_AUTONOMY_GUARD }] : []),
          ...(rileySnapshot ? [{ role: "system", content: buildRileySystemPrompt(rileySnapshot.state) }] : []),
          ...(averySnapshot ? [{ role: "system", content: buildAverySystemPrompt(averySnapshot.state) }] : []),
          ...(personaPolicyPrompt ? [{ role: "system", content: personaPolicyPrompt }] : []),
          ...(promotionPrompt ? [{ role: "system", content: promotionPrompt }] : []),
          { role: "system", content: memPrompt },
          ...(policyApplyMessage ? [{ role: "system", content: `Policy apply status: ${policyApplyMessage}` }] : []),
          ...(promotionApplyMessage ? [{ role: "system", content: `Promotion apply status: ${promotionApplyMessage}` }] : []),
          ...messages
        ]
      : ((!isImageReq && (rileySnapshot || averySnapshot))
          ? [
              ...(inRileyChat ? [{ role: "system", content: RILEY_NUMERIC_PRIORITY_GUARD }] : []),
              ...(inAveryChat ? [{ role: "system", content: AVERY_WORKLOG_GUARD }] : []),
              ...((inRileyChat || inAveryChat) ? [{ role: "system", content: VAULT_AUTONOMY_GUARD }] : []),
              ...(rileyDirective ? [{ role: "system", content: `Priority 1 Directive (Riley):\n${rileyDirective}` }] : []),
              ...(averyDirective ? [{ role: "system", content: `Priority 1 Directive (Avery):\n${averyDirective}` }] : []),
              ...(rileySnapshot ? [{ role: "system", content: buildRileySystemPrompt(rileySnapshot.state) }] : []),
              ...(averySnapshot ? [{ role: "system", content: buildAverySystemPrompt(averySnapshot.state) }] : []),
              ...(personaPolicyPrompt ? [{ role: "system", content: personaPolicyPrompt }] : []),
              ...(promotionPrompt ? [{ role: "system", content: promotionPrompt }] : []),
              ...(policyApplyMessage ? [{ role: "system", content: `Policy apply status: ${policyApplyMessage}` }] : []),
              ...(promotionApplyMessage ? [{ role: "system", content: `Promotion apply status: ${promotionApplyMessage}` }] : []),
              ...messages,
            ]
          : messages);
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
            if (proposalPersona) {
              const proposal = parseVaultProposalFromReply(reply);
              if (proposal && proposal.persona === proposalPersona) {
                await savePendingVaultProposal(env, proposal);
                reply = `${stripVaultProposalBlock(reply)}\n\n승인하면 적용할게요. \"승인\" 또는 \"진행해\"라고 말해줘.`.trim();
              }
            }
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
    if (proposalPersona) {
      const proposal = parseVaultProposalFromReply(reply);
      if (proposal && proposal.persona === proposalPersona) {
        await savePendingVaultProposal(env, proposal);
        reply = `${stripVaultProposalBlock(reply)}\n\n승인하면 적용할게요. \"승인\" 또는 \"진행해\"라고 말해줘.`.trim();
      }
    }

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
