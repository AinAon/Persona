export async function generateGrokImage(params: {
  model: string;
  prompt: string;
  ratio: string;
  images: string[];
  apiKey: string;
}): Promise<string> {
  const { model, prompt, ratio, images = [], apiKey } = params;
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
