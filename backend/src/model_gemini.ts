type ChatMessage = {
  role: string;
  content: string | Array<{ type?: string; text?: string; image_url?: { url?: string } }>;
};

async function imageUrlToGeminiPart(imageUrl: string): Promise<Record<string, unknown> | null> {
  if (!imageUrl || typeof imageUrl !== "string") return null;

  const dataUrlMatch = imageUrl.match(/^data:([^;,]+);base64,(.+)$/);
  if (dataUrlMatch) {
    return {
      inlineData: {
        mimeType: dataUrlMatch[1] || "image/jpeg",
        data: dataUrlMatch[2] || "",
      },
    };
  }

  if (!/^https?:\/\//i.test(imageUrl)) return null;
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) return null;
    const mimeType = (res.headers.get("content-type") || "image/jpeg").split(";")[0];
    const bytes = new Uint8Array(await res.arrayBuffer());
    return {
      inlineData: {
        mimeType,
        data: bytesToBase64(bytes),
      },
    };
  } catch {
    return null;
  }
}

async function contentItemToGeminiPart(item: { type?: string; text?: string; image_url?: { url?: string } }): Promise<Record<string, unknown> | null> {
  if (!item) return null;
  if (item.type === "image_url") return await imageUrlToGeminiPart(item.image_url?.url || "");
  if (item.type === "text") return { text: item.text || "" };
  return { text: String(item.text || "") };
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export async function generateGeminiImage(params: {
  model: string;
  prompt: string;
  ratio: string;
  resolution?: string;
  images: string[];
  apiKey: string;
}): Promise<string> {
  const { model, prompt, ratio, resolution, images = [], apiKey } = params;
  const imageParts = (await Promise.all(images.map(imageUrlToGeminiPart))).filter(Boolean);
  const requestParts = [{ text: prompt }, ...imageParts];
  const normalizedSize = String(resolution || "").toLowerCase() === "2k" ? "2K" : "1K";

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: requestParts }],
        generationConfig: {
          responseModalities: ["IMAGE"],
          candidateCount: 1,
          imageConfig: {
            aspectRatio: ratio || "1:1",
            imageSize: normalizedSize,
          },
        },
      }),
    },
  );
  const text = await res.text();
  if (!res.ok) throw new Error(`Gemini Image Error: ${text}`);
  const data = JSON.parse(text);
  const parts = data.candidates?.[0]?.content?.parts || [];
  const inlinePart = parts.find((p: any) => p?.inlineData?.data || p?.inline_data?.data);
  const b64 = inlinePart?.inlineData?.data || inlinePart?.inline_data?.data;
  const mimeType = inlinePart?.inlineData?.mimeType || inlinePart?.inline_data?.mime_type || "image/jpeg";
  return b64 ? `data:${mimeType};base64,${b64}` : "";
}

export async function generateImagenImage(params: {
  model: string;
  prompt: string;
  ratio: string;
  apiKey: string;
}): Promise<string> {
  const { model, prompt, ratio, apiKey } = params;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: { sampleCount: 1, aspectRatio: ratio },
      }),
    },
  );
  const text = await res.text();
  if (!res.ok) throw new Error(`Imagen Error: ${text}`);
  const data = JSON.parse(text);
  const pred = data.predictions?.[0];
  const mimeType = pred?.mimeType || "image/jpeg";
  if (pred?.bytesBase64Encoded) return `data:${mimeType};base64,${pred.bytesBase64Encoded}`;
  return pred?.url || "";
}

export async function generateGeminiText(params: {
  model: string;
  messages: ChatMessage[];
  apiKey: string;
}): Promise<string> {
  const { model, messages, apiKey } = params;
  const body = await buildGeminiTextBody(messages);

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const text = await res.text();
  if (!res.ok) throw new Error(`Gemini Text API Error: ${text}`);
  const data = JSON.parse(text);
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

export async function streamGeminiText(params: {
  model: string;
  messages: ChatMessage[];
  apiKey: string;
  onDelta: (delta: string) => Promise<void> | void;
}): Promise<string> {
  const { model, messages, apiKey, onDelta } = params;
  const body = await buildGeminiTextBody(messages);
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini Stream API Error: ${text}`);
  }
  if (!res.body) return "";
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let lineEnd = buffer.indexOf("\n");
    while (lineEnd !== -1) {
      const line = buffer.slice(0, lineEnd).trim();
      buffer = buffer.slice(lineEnd + 1);
      if (line.startsWith("data:")) {
        const payload = line.slice(5).trim();
        if (payload) {
          try {
            const data = JSON.parse(payload);
            const parts = data?.candidates?.[0]?.content?.parts || [];
            let delta = "";
            for (const part of parts) {
              if (typeof part?.text === "string") delta += part.text;
            }
            if (delta) {
              full += delta;
              await onDelta(delta);
            }
          } catch {
            // ignore malformed chunks
          }
        }
      }
      lineEnd = buffer.indexOf("\n");
    }
  }
  return full;
}

async function buildGeminiTextBody(messages: ChatMessage[]): Promise<Record<string, unknown>> {
  const contents = await Promise.all(
    messages
      .filter((m) => m.role !== "system")
      .map(async (m) => {
        const parts = Array.isArray(m.content)
          ? (await Promise.all(m.content.map(contentItemToGeminiPart))).filter(Boolean)
          : [{ text: m.content }];
        return {
          role: m.role === "assistant" ? "model" : "user",
          parts: parts.length ? parts : [{ text: "(image omitted)" }],
        };
      }),
  );

  const systemMessages = messages
    .filter((m) => m.role === "system")
    .map((m) => (typeof m.content === "string" ? m.content.trim() : ""))
    .filter(Boolean);

  const body: Record<string, unknown> = { contents };
  if (systemMessages.length) {
    body.systemInstruction = { parts: [{ text: systemMessages.join("\n\n") }] };
  }
  return body;
}
