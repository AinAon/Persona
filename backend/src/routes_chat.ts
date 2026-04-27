import type { CorsHeaders, Env } from "./index";
import { generateGeminiImage, generateGeminiText, generateImagenImage, streamGeminiText } from "./model_gemini";
import { generateOpenAIImage, generateOpenAIText, streamOpenAIText } from "./model_openai";
import { generateGrokImage, generateGrokText, streamGrokText } from "./model_grok";
import { buildMemorySystemPrompt } from "./memory";
import {
  appendAveryWorklogEvent,
  buildAverySystemPrompt,
  getAveryWorklogSnapshot,
  isAveryParticipant,
  shouldPersistAveryWorklogText,
} from "./avery_worklog";
import {
  appendRileyWealthEvent,
  buildRileySystemPrompt,
  extractLatestUserText,
  getRileyWealthSnapshot,
  isWealthMutationText,
  isRileyParticipant,
} from "./riley_wealth";

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
  const shouldWriteRileyEvent = inRileyChat && isWealthMutationText(latestUserText);
  const shouldWriteAveryEvent = inAveryChat && shouldPersistAveryWorklogText(latestUserText);

  try {
    const rileySnapshot = (!isImageReq && inRileyChat)
      ? await getRileyWealthSnapshot(env, 10)
      : null;
    const averySnapshot = (!isImageReq && inAveryChat)
      ? await getAveryWorklogSnapshot(env, 20)
      : null;
    const memPrompt = isImageReq
      ? ""
      : await buildMemorySystemPrompt(env, {
          participantPids: participant_pids,
          personaCategoryPrefs: persona_memory_prefs as any,
        });
    const effectiveMessages = (!isImageReq && memPrompt)
      ? [
          { role: "system", content: ANTI_HALLUCINATION_GUARD },
          { role: "system", content: RESPONSE_VARIANCE_PROMPT },
          ...(inRileyChat ? [{ role: "system", content: RILEY_NUMERIC_PRIORITY_GUARD }] : []),
          ...(inAveryChat ? [{ role: "system", content: AVERY_WORKLOG_GUARD }] : []),
          ...(rileySnapshot ? [{ role: "system", content: buildRileySystemPrompt(rileySnapshot.state) }] : []),
          ...(averySnapshot ? [{ role: "system", content: buildAverySystemPrompt(averySnapshot.state) }] : []),
          { role: "system", content: memPrompt },
          ...messages
        ]
      : ((!isImageReq && (rileySnapshot || averySnapshot))
          ? [
              ...(inRileyChat ? [{ role: "system", content: RILEY_NUMERIC_PRIORITY_GUARD }] : []),
              ...(inAveryChat ? [{ role: "system", content: AVERY_WORKLOG_GUARD }] : []),
              ...(rileySnapshot ? [{ role: "system", content: buildRileySystemPrompt(rileySnapshot.state) }] : []),
              ...(averySnapshot ? [{ role: "system", content: buildAverySystemPrompt(averySnapshot.state) }] : []),
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
              await appendRileyWealthEvent(env, latestUserText);
            }
            if (shouldWriteAveryEvent) {
              await appendAveryWorklogEvent(env, latestUserText);
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
      await appendRileyWealthEvent(env, latestUserText);
    }
    if (shouldWriteAveryEvent) {
      await appendAveryWorklogEvent(env, latestUserText);
    }

    if (imageUrlOut) {
      return Response.json({ result: "success", reply, image_url: imageUrlOut }, { headers: cors });
    }
    return Response.json({ result: "success", reply }, { headers: cors });
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
