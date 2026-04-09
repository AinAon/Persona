function dataUrlToBlob(dataUrl: string): Blob | null {
  try {
    const [header, b64] = dataUrl.split(",");
    const mime = header.match(/:(.*?);/)?.[1] || "image/jpeg";
    const bytes = atob(b64);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    return new Blob([arr], { type: mime });
  } catch {
    return null;
  }
}

async function imageRefToBlob(imageRef: string): Promise<Blob | null> {
  if (!imageRef || typeof imageRef !== "string") return null;
  if (imageRef.startsWith("data:")) return dataUrlToBlob(imageRef);
  if (!/^https?:\/\//i.test(imageRef)) return null;

  try {
    const res = await fetch(imageRef);
    if (!res.ok) return null;
    const mime = (res.headers.get("content-type") || "image/jpeg").split(";")[0];
    const bytes = await res.arrayBuffer();
    return new Blob([bytes], { type: mime });
  } catch {
    return null;
  }
}

export async function generateOpenAIImage(params: {
  model: string;
  prompt: string;
  size: string;
  images: string[];
  apiKey: string;
}): Promise<string> {
  const { model, prompt, size, images, apiKey } = params;

  if (images.length > 0) {
    const form = new FormData();
    form.append("model", model);
    form.append("prompt", prompt);
    form.append("size", size);
    form.append("n", "1");

    const refBlob = await imageRefToBlob(images[0]);
    if (refBlob) form.append("image[]", refBlob, "reference.jpg");

    const editRes = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    const editText = await editRes.text();
    if (!editRes.ok) throw new Error(`GPT Image Edit Error: ${editText}`);
    const editData = JSON.parse(editText);
    return editData.data?.[0]?.url || (editData.data?.[0]?.b64_json ? `data:image/png;base64,${editData.data[0].b64_json}` : "");
  }

  const genRes = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, prompt, size, n: 1 }),
  });
  const genText = await genRes.text();
  if (!genRes.ok) throw new Error(`GPT Image Error: ${genText}`);
  const genData = JSON.parse(genText);
  return genData.data?.[0]?.url || (genData.data?.[0]?.b64_json ? `data:image/png;base64,${genData.data[0].b64_json}` : "");
}

export async function generateOpenAIText(params: {
  model: string;
  messages: unknown[];
  apiKey: string;
}): Promise<string> {
  const { model, messages, apiKey } = params;
  const isNewOpenAI = model.startsWith("gpt-5") || model.startsWith("o1") || model.startsWith("o3") || model.startsWith("o4");
  const tokenParam = isNewOpenAI ? { max_completion_tokens: 2000 } : { max_tokens: 2000 };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, ...tokenParam }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`OpenAI Text API Error: ${text}`);
  const data = JSON.parse(text);
  return data.choices?.[0]?.message?.content || "";
}
