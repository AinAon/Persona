export async function generateGrokImage(params: {
  model: string;
  prompt: string;
  ratio: string;
  resolution?: string;
  images: string[];
  apiKey: string;
}): Promise<string> {
  const { model, prompt, ratio, resolution, images = [], apiKey } = params;
  const hasReferenceImages = images.length > 0;
  const endpoint = hasReferenceImages
    ? "https://api.x.ai/v1/images/edits"
    : "https://api.x.ai/v1/images/generations";
  const body: Record<string, unknown> = {
    model,
    prompt,
    n: 1,
    response_format: "url",
  };

  if (ratio && ratio !== "1:1") {
    body.aspect_ratio = ratio;
  }
  if (resolution) {
    body.resolution = resolution;
  }

  if (hasReferenceImages) {
    const refs = images.slice(0, 5).map((url) => ({
      type: "image_url",
      url,
    }));
    if (refs.length === 1) body.image = refs[0];
    else body.images = refs;
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`Grok Image Error: ${text}`);
  const data = JSON.parse(text);
  return data.data?.[0]?.url || "";
}

export async function generateGrokText(params: {
  model: string;
  messages: unknown[];
  apiKey: string;
}): Promise<string> {
  const { model, messages, apiKey } = params;
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, max_tokens: 2000 }),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`Grok Text API Error: ${text}`);
  const data = JSON.parse(text);
  return data.choices?.[0]?.message?.content || "";
}

export async function streamGrokText(params: {
  model: string;
  messages: unknown[];
  apiKey: string;
  onDelta: (delta: string) => Promise<void> | void;
}): Promise<string> {
  const { model, messages, apiKey, onDelta } = params;
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, max_tokens: 2000, stream: true }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Grok Text API Error: ${text}`);
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
        if (payload === "[DONE]") return full;
        if (payload) {
          try {
            const data = JSON.parse(payload);
            const delta = data?.choices?.[0]?.delta?.content;
            if (typeof delta === "string" && delta) {
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
