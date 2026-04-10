import type { CorsHeaders, Env } from "./index";

type SessionMeta = {
  id: string;
  updatedAt: number;
  lastPreview: string;
  participantPids: string[];
  roomName: string;
  responseMode: string;
  worldContext: string;
  userOverride: unknown;
  userProfileMode: string;
  overrideModel: string | null;
};

export async function handleApiRoute(
  request: Request,
  env: Env,
  url: URL,
  cors: CorsHeaders,
): Promise<Response | null> {
  if (url.pathname === "/personas") {
    if (request.method === "GET") {
      const data = await env.KV.get("personas");
      return Response.json({ personas: data ? JSON.parse(data) : [] }, { headers: cors });
    }
    if (request.method === "PUT") {
      const { personas } = (await request.json()) as { personas: unknown[] };
      await env.KV.put("personas", JSON.stringify(personas));
      return Response.json({ ok: true }, { headers: cors });
    }
    return null;
  }

  if (url.pathname === "/profile") {
    if (request.method === "GET") {
      const data = await env.KV.get("user_profile");
      return Response.json({ profile: data || "" }, { headers: cors });
    }
    if (request.method === "PUT") {
      const { profile } = (await request.json()) as { profile: string };
      await env.KV.put("user_profile", profile);
      return Response.json({ ok: true }, { headers: cors });
    }
    return null;
  }

  if (url.pathname === "/sessions") {
    if (request.method === "GET") {
      const data = await env.KV.get("session_index");
      return Response.json({ sessions: data ? JSON.parse(data) : [] }, { headers: cors });
    }
    if (request.method === "PUT") {
      const { sessions } = (await request.json()) as { sessions: unknown[] };
      await env.KV.put("session_index", JSON.stringify(sessions));
      return Response.json({ ok: true }, { headers: cors });
    }
    return null;
  }

  if (url.pathname.startsWith("/session/")) {
    return await handleSessionRoute(request, env, url.pathname.slice(9), cors);
  }

  if (url.pathname.startsWith("/image-list/") && request.method === "GET") {
    const prefix = decodeURIComponent(url.pathname.slice(12));
    const list = await env.R2.list({ prefix: `${prefix}/` });
    const keys = (list.objects || []).map((o) => o.key);
    return Response.json({ keys }, { headers: cors });
  }

  if (url.pathname === "/image" && request.method === "POST") {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const sourceUrl = String(formData.get("sourceUrl") || "");
    if (!file && !sourceUrl) return Response.json({ error: "no file" }, { status: 400, headers: cors });

    const folder = String(formData.get("folder") || "").replace(/\/+$/, "");
    const fileName = file?.name || String(formData.get("fileName") || `${Date.now()}.jpg`);
    const key = folder ? `${folder}/${fileName}` : fileName;

    if (file) {
      await env.R2.put(key, file.stream(), {
        httpMetadata: { contentType: file.type || "image/jpeg" },
      });
    } else {
      const remote = await fetch(sourceUrl);
      if (!remote.ok) {
        return Response.json({ error: `remote fetch failed: ${remote.status}` }, { status: 400, headers: cors });
      }
      const contentType = (remote.headers.get("content-type") || "image/jpeg").split(";")[0];
      await env.R2.put(key, remote.body, {
        httpMetadata: { contentType },
      });
    }
    return Response.json({ url: `${url.origin}/image/${key}`, key }, { headers: cors });
  }

  if (url.pathname.startsWith("/image/") && request.method === "GET") {
    const key = decodeURIComponent(url.pathname.slice(7));
    const obj = await env.R2.get(key);
    if (!obj) return new Response("Not Found", { status: 404, headers: cors });

    return new Response(obj.body, {
      headers: {
        ...cors,
        "Content-Type": obj.httpMetadata?.contentType || "image/jpeg",
        "Cache-Control": "public, max-age=31536000",
      },
    });
  }

  return null;
}

async function handleSessionRoute(
  request: Request,
  env: Env,
  id: string,
  cors: CorsHeaders,
): Promise<Response | null> {
  if (request.method === "GET") {
    const data = await env.KV.get(`session:${id}`);
    return Response.json({ session: data ? JSON.parse(data) : null }, { headers: cors });
  }

  if (request.method === "PUT") {
    const { session } = (await request.json()) as { session: Record<string, unknown> };
    await env.KV.put(`session:${id}`, JSON.stringify(session));

    const idxData = await env.KV.get("session_index");
    const index: SessionMeta[] = idxData ? JSON.parse(idxData) : [];
    const meta: SessionMeta = {
      id: String(session.id),
      updatedAt: Number(session.updatedAt || Date.now()),
      lastPreview: String(session.lastPreview || ""),
      participantPids: Array.isArray(session.participantPids) ? (session.participantPids as string[]) : [],
      roomName: String(session.roomName || ""),
      responseMode: String(session.responseMode || "auto"),
      worldContext: String(session.worldContext || ""),
      userOverride: session.userOverride || null,
      userProfileMode: String(session.userProfileMode || "default"),
      overrideModel: (session.overrideModel as string | null) || null,
    };

    const existingIndex = index.findIndex((s) => s.id === id);
    if (existingIndex >= 0) index[existingIndex] = meta;
    else index.unshift(meta);

    await env.KV.put("session_index", JSON.stringify(index));
    return Response.json({ ok: true }, { headers: cors });
  }

  if (request.method === "DELETE") {
    await env.KV.delete(`session:${id}`);
    const idxData = await env.KV.get("session_index");
    let index: SessionMeta[] = idxData ? JSON.parse(idxData) : [];
    index = index.filter((s) => s.id !== id);
    await env.KV.put("session_index", JSON.stringify(index));
    return Response.json({ ok: true }, { headers: cors });
  }

  return null;
}
