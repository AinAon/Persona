// ═══════════════════════════════════════════
//  PERSONA CHAT WORKER - KV + R2 only
// ═══════════════════════════════════════════

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

const IMAGE_MODELS = ["gemini-3.1-flash-image-preview", "grok-imagine-image-pro", "gpt-image-1.5"];
const RATIO_TO_SIZE = {
  "1:1" : "1024x1024",
  "16:9": "1536x1024",
  "9:16": "1024x1536",
  "4:3" : "1536x1152",
  "3:4" : "1152x1536",
  "3:2" : "1536x1024",
  "2:3" : "1024x1536",
  "21:9": "1536x1024",
  "9:21": "1024x1536",
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    const url = new URL(request.url);

    // ── 페르소나 ──
    if (url.pathname === "/personas") {
      if (request.method === "GET") {
        const data = await env.KV.get("personas");
        return Response.json({ personas: data ? JSON.parse(data) : [] }, { headers: CORS });
      }
      if (request.method === "PUT") {
        const { personas } = await request.json();
        await env.KV.put("personas", JSON.stringify(personas));
        return Response.json({ ok: true }, { headers: CORS });
      }
    }

    // ── 프로필 ──
    if (url.pathname === "/profile") {
      if (request.method === "GET") {
        const data = await env.KV.get("user_profile");
        return Response.json({ profile: data || "" }, { headers: CORS });
      }
      if (request.method === "PUT") {
        const { profile } = await request.json();
        await env.KV.put("user_profile", profile);
        return Response.json({ ok: true }, { headers: CORS });
      }
    }

    // ── 세션 인덱스 ──
    if (url.pathname === "/sessions") {
      if (request.method === "GET") {
        const data = await env.KV.get("session_index");
        return Response.json({ sessions: data ? JSON.parse(data) : [] }, { headers: CORS });
      }
      if (request.method === "PUT") {
        const { sessions } = await request.json();
        await env.KV.put("session_index", JSON.stringify(sessions));
        return Response.json({ ok: true }, { headers: CORS });
      }
    }

    // ── 개별 세션 ──
    if (url.pathname.startsWith("/session/")) {
      const id = url.pathname.slice(9);
      if (request.method === "GET") {
        const data = await env.KV.get("session:" + id);
        return Response.json({ session: data ? JSON.parse(data) : null }, { headers: CORS });
      }
      if (request.method === "PUT") {
        const { session } = await request.json();
        await env.KV.put("session:" + id, JSON.stringify(session));
        const idxData = await env.KV.get("session_index");
        let index = idxData ? JSON.parse(idxData) : [];
        const meta = {
          id: session.id, updatedAt: session.updatedAt, lastPreview: session.lastPreview,
          participantPids: session.participantPids, roomName: session.roomName || "",
          responseMode: session.responseMode, worldContext: session.worldContext,
          userOverride: session.userOverride || null, userProfileMode: session.userProfileMode || "default",
          overrideModel: session.overrideModel || null
        };
        const ei = index.findIndex(s => s.id === id);
        if (ei >= 0) index[ei] = meta; else index.unshift(meta);
        await env.KV.put("session_index", JSON.stringify(index));
        return Response.json({ ok: true }, { headers: CORS });
      }
      if (request.method === "DELETE") {
        await env.KV.delete("session:" + id);
        const idxData = await env.KV.get("session_index");
        let index = idxData ? JSON.parse(idxData) : [];
        index = index.filter(s => s.id !== id);
        await env.KV.put("session_index", JSON.stringify(index));
        return Response.json({ ok: true }, { headers: CORS });
      }
    }

    // ── R2 이미지 파일 목록 ──
    if (url.pathname.startsWith("/image-list/") && request.method === "GET") {
      const prefix = decodeURIComponent(url.pathname.slice(12));
      const list = await env.R2.list({ prefix: prefix + "/" });
      const keys = (list.objects || []).map(o => o.key);
      return Response.json({ keys }, { headers: CORS });
    }

    // ── R2 이미지 업로드 ──
    if (url.pathname === "/image" && request.method === "POST") {
      const formData = await request.formData();
      const file = formData.get("file");
      if (!file) return Response.json({ error: "no file" }, { status: 400, headers: CORS });
      const folder = (formData.get("folder") || "").replace(/\/+$/, "");
      const fname = file.name || `${Date.now()}.jpg`;
      const key = folder ? `${folder}/${fname}` : fname;
      await env.R2.put(key, file.stream(), {
        httpMetadata: { contentType: file.type || "image/jpeg" }
      });
      return Response.json({ url: `${url.origin}/image/${key}`, key }, { headers: CORS });
    }

    // ── R2 이미지 조회 ──
    if (url.pathname.startsWith("/image/") && request.method === "GET") {
      const key = decodeURIComponent(url.pathname.slice(7));
      const obj = await env.R2.get(key);
      if (!obj) return new Response("Not Found", { status: 404, headers: CORS });
      return new Response(obj.body, {
        headers: {
          ...CORS,
          "Content-Type": obj.httpMetadata?.contentType || "image/jpeg",
          "Cache-Control": "public, max-age=31536000"
        }
      });
    }

    // ── AI 채팅 / 이미지 생성 ──
    if (url.pathname === "/chat" && request.method === "POST") {
      const reqBody = await request.json();
      const { messages, model = "grok-4.20-non-reasoning", keys, prompt, aspect_ratio, size, images = [] } = reqBody;

      const apiKeys = {
        gemini:    keys?.gemini    || env.GEMINI_KEY    || "",
        grok:      keys?.grok      || env.GROK_KEY      || "",
        openai:    keys?.openai    || env.OPENAI_KEY    || "",
        anthropic: keys?.anthropic || env.ANTHROPIC_KEY || "",
      };

      const isImageReq = IMAGE_MODELS.includes(model) || !!prompt;

      try {
        let reply = "";

        // ════════════════════════════════
        //  이미지 생성 분기
        // ════════════════════════════════
        if (isImageReq) {
          // prompt: 프런트에서 직접 보낸 문자열 우선,
          //         없으면 messages 배열 마지막 user 메시지에서 추출
          const userPrompt = (typeof prompt === "string" && prompt.trim())
            ? prompt
            : extractText(messages?.filter(m => m.role === "user").pop()?.content) || "generate image";

          const ratio = aspect_ratio || "1:1";
          const apiModel = model; // 모델명 그대로 사용
          let imageUrl = "";

          // ── Grok (xAI) ──────────────────────────
          if (model.startsWith("grok")) {
            // xAI API는 aspect_ratio 파라미터 미지원 → 프롬프트 뒤에 힌트 추가
            const ratioHint = ratio !== "1:1" ? ` --ar ${ratio}` : "";
            const body = {
              model: apiModel,
              prompt: userPrompt + ratioHint,
              n: 1,
              response_format: "url",
            };
            const r = await fetch("https://api.x.ai/v1/images/generations", {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKeys.grok}` },
              body: JSON.stringify(body)
            });
            const text = await r.text();
            if (!r.ok) throw new Error(`Grok Image Error: ${text}`);
            const d = JSON.parse(text);
            imageUrl = d.data?.[0]?.url || "";

          // ── GPT Image (OpenAI) ───────────────────
          } else if (model.startsWith("gpt-image")) {
            const openaiSize = size || RATIO_TO_SIZE[ratio] || "1024x1024";

            if (images.length > 0) {
              // 이미지 편집: multipart/form-data
              const form = new FormData();
              form.append("model", apiModel);
              form.append("prompt", userPrompt);
              form.append("size", openaiSize);
              form.append("n", "1");
              // 참조 이미지 첫 번째를 image 필드로 (base64 data URL → Blob)
              const blob = dataUrlToBlob(images[0]);
              if (blob) form.append("image[]", blob, "reference.jpg");

              const r = await fetch("https://api.openai.com/v1/images/edits", {
                method: "POST",
                headers: { "Authorization": `Bearer ${apiKeys.openai}` },
                body: form
              });
              const text = await r.text();
              if (!r.ok) throw new Error(`GPT Image Edit Error: ${text}`);
              const d = JSON.parse(text);
              imageUrl = d.data?.[0]?.url || d.data?.[0]?.b64_json
                ? "data:image/png;base64," + d.data[0].b64_json : "";
            } else {
              // 신규 생성
              const r = await fetch("https://api.openai.com/v1/images/generations", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKeys.openai}` },
                body: JSON.stringify({ model: apiModel, prompt: userPrompt, size: openaiSize, n: 1 })
              });
              const text = await r.text();
              if (!r.ok) throw new Error(`GPT Image Error: ${text}`);
              const d = JSON.parse(text);
              imageUrl = d.data?.[0]?.url || (d.data?.[0]?.b64_json
                ? "data:image/png;base64," + d.data[0].b64_json : "");
            }

          // ── Gemini / Imagen ──────────────────────
          } else if (model.startsWith("gemini") || model.startsWith("imagen")) {
            const r = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${apiModel}:predict?key=${apiKeys.gemini}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  instances: [{ prompt: userPrompt }],
                  parameters: { sampleCount: 1, aspectRatio: ratio.replace(":", "x") }
                })
              }
            );
            const text = await r.text();
            if (!r.ok) throw new Error(`Gemini Image Error: ${text}`);
            const d = JSON.parse(text);
            const pred = d.predictions?.[0];
            if (pred?.bytesBase64Encoded) {
              imageUrl = "data:image/png;base64," + pred.bytesBase64Encoded;
            } else if (pred?.url) {
              imageUrl = pred.url;
            }
          }

          if (!imageUrl) throw new Error("이미지 URL 응답이 없습니다.");
          reply = `![generated](${imageUrl})`;

        // ════════════════════════════════
        //  텍스트 채팅 분기 (기존 로직 유지)
        // ════════════════════════════════
        } else {
          if (model.startsWith("gemini")) {
            const contents = await Promise.all(
              messages
                .filter(m => m.role !== "system")
                .map(async m => {
                  const parts = Array.isArray(m.content)
                    ? (await Promise.all(m.content.map(contentItemToGeminiPart))).filter(Boolean)
                    : [{ text: m.content }];
                  return {
                    role: m.role === "assistant" ? "model" : "user",
                    parts: parts.length ? parts : [{ text: "(image omitted)" }]
                  };
                })
            );
            const sys = messages.find(m => m.role === "system")?.content;
            const body = { contents };
            if (sys) body.systemInstruction = { parts: [{ text: sys }] };
            const r = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKeys.gemini}`,
              { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
            );
            const text = await r.text();
            if (!r.ok) throw new Error(`Gemini Text API Error: ${text}`);
            const d = JSON.parse(text);
            reply = d.candidates?.[0]?.content?.parts?.[0]?.text || "";
          } else {
            const apiUrl = model.startsWith("grok")   ? "https://api.x.ai/v1/chat/completions"
                         : model.startsWith("claude") ? "https://api.anthropic.com/v1/messages"
                         :                              "https://api.openai.com/v1/chat/completions";
            const key    = model.startsWith("grok")   ? apiKeys.grok
                         : model.startsWith("claude") ? apiKeys.anthropic
                         :                              apiKeys.openai;
            const isNewOpenAI = model.startsWith('gpt-5') || model.startsWith('o1') || model.startsWith('o3') || model.startsWith('o4');
            const tokenParam = isNewOpenAI ? { max_completion_tokens: 2000 } : { max_tokens: 2000 };
            const r = await fetch(apiUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
              body: JSON.stringify({ model, messages, ...tokenParam })
            });
            const text = await r.text();
            if (!r.ok) throw new Error(`Text API Error: ${text}`);
            const d = JSON.parse(text);
            reply = d.choices?.[0]?.message?.content || d.content?.[0]?.text || "";
          }
        }

        return Response.json({ result: "success", reply }, { headers: CORS });

      } catch(e) {
        return Response.json({ result: "error", error: e.message }, { status: 500, headers: CORS });
      }
    }

    return new Response("Not Found", { status: 404, headers: CORS });
  }
};

// ── 유틸: content 배열/문자열 → 텍스트 추출 ──────────
function extractText(content) {
  if (!content) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.find(c => c.type === "text")?.text || "";
  }
  return String(content);
}

// ── 유틸: data URL → Blob (GPT Image edit용) ─────────
function dataUrlToBlob(dataUrl) {
  try {
    const [header, b64] = dataUrl.split(",");
    const mime = header.match(/:(.*?);/)?.[1] || "image/jpeg";
    const bytes = atob(b64);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    return new Blob([arr], { type: mime });
  } catch { return null; }
}

async function contentItemToGeminiPart(item) {
  if (!item) return null;
  if (item.type === "image_url") {
    return await imageUrlToGeminiPart(item.image_url?.url || "");
  }
  if (item.type === "text") {
    return { text: item.text || "" };
  }
  return { text: String(item.text || "") };
}

async function imageUrlToGeminiPart(imageUrl) {
  if (!imageUrl || typeof imageUrl !== "string") return null;

  const dataUrlMatch = imageUrl.match(/^data:([^;,]+);base64,(.+)$/);
  if (dataUrlMatch) {
    return {
      inlineData: {
        mimeType: dataUrlMatch[1] || "image/jpeg",
        data: dataUrlMatch[2] || ""
      }
    };
  }

  if (!/^https?:\/\//i.test(imageUrl)) return null;

  try {
    const resp = await fetch(imageUrl);
    if (!resp.ok) return null;
    const mimeType = (resp.headers.get("content-type") || "image/jpeg").split(";")[0];
    const bytes = new Uint8Array(await resp.arrayBuffer());
    return {
      inlineData: {
        mimeType,
        data: bytesToBase64(bytes)
      }
    };
  } catch {
    return null;
  }
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}
