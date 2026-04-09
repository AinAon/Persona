import type { CorsHeaders, Env } from "./index";
import { generateGeminiImage, generateGeminiText, generateImagenImage } from "./model_gemini";
import { generateOpenAIImage, generateOpenAIText } from "./model_openai";
import { generateGrokImage, generateGrokText } from "./model_grok";

const IMAGE_MODELS = ["gemini-3.1-flash-image-preview", "grok-imagine-image-pro", "gpt-image-1.5"];
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
  images?: string[];
};

export async function handleChat(reqBody: ChatBody, env: Env, cors: CorsHeaders): Promise<Response> {
  const {
    messages = [],
    model = "grok-4.20-non-reasoning",
    keys,
    prompt,
    aspect_ratio,
    size,
    images = [],
  } = reqBody;

  const apiKeys = {
    gemini: keys?.gemini || env.GEMINI_KEY || "",
    grok: keys?.grok || env.GROK_KEY || "",
    openai: keys?.openai || env.OPENAI_KEY || "",
    anthropic: keys?.anthropic || env.ANTHROPIC_KEY || "",
  };

  const isImageReq = IMAGE_MODELS.includes(model) || !!prompt;

  try {
    let reply = "";
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
          apiKey: apiKeys.grok,
        });
      } else if (model.startsWith("gpt-image")) {
        imageUrl = await generateOpenAIImage({
          model,
          prompt: userPrompt,
          size: size || RATIO_TO_SIZE[ratio] || "1024x1024",
          images,
          apiKey: apiKeys.openai,
        });
      } else if (model.startsWith("gemini")) {
        imageUrl = await generateGeminiImage({
          model,
          prompt: userPrompt,
          ratio,
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
      reply = `![generated](${imageUrl})`;
    } else if (model.startsWith("gemini")) {
      reply = await generateGeminiText({
        model,
        messages,
        apiKey: apiKeys.gemini,
      });
    } else if (model.startsWith("grok")) {
      reply = await generateGrokText({
        model,
        messages,
        apiKey: apiKeys.grok,
      });
    } else if (model.startsWith("claude")) {
      reply = await generateClaudeText({
        model,
        messages,
        apiKey: apiKeys.anthropic,
      });
    } else {
      reply = await generateOpenAIText({
        model,
        messages,
        apiKey: apiKeys.openai,
      });
    }

    return Response.json({ result: "success", reply }, { headers: cors });
  } catch (e: any) {
    return Response.json({ result: "error", error: e?.message || "unknown error" }, { status: 500, headers: cors });
  }
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
