export async function generateGrokImage(params: {
  model: string;
  prompt: string;
  ratio: string;
  apiKey: string;
}): Promise<string> {
  const { model, prompt, ratio, apiKey } = params;
  const ratioHint = ratio !== "1:1" ? ` --ar ${ratio}` : "";

  const res = await fetch("https://api.x.ai/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      prompt: `${prompt}${ratioHint}`,
      n: 1,
      response_format: "url",
    }),
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
