import type { CorsHeaders, Env } from "./index";
import {
  deleteMemory,
  extractAndStoreMemories,
  getMemoryMeta,
  listMemories,
  normalizeScopeOwner,
  optimizeMemories,
  parseScope,
  setMemoryLock,
  upsertMemory,
} from "./memory";

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

type DeletedSessionMeta = SessionMeta & {
  deletedAt: number;
};

type RecoverableSessionMeta = DeletedSessionMeta & {
  source: "deleted_index" | "deleted_kv" | "orphan_session_kv";
};

const SESSION_INDEX_KEY = "session_index";
const DELETED_SESSION_INDEX_KEY = "deleted_session_index";

function buildSessionMeta(session: Record<string, unknown>): SessionMeta {
  return {
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
}

function toRecoverable(meta: SessionMeta, source: RecoverableSessionMeta["source"], deletedAt?: number): RecoverableSessionMeta {
  return {
    ...meta,
    deletedAt: Number(deletedAt || meta.updatedAt || Date.now()),
    source,
  };
}

function parseSessionLike(raw: string | null): SessionMeta | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return null;
    const history = parsed.history;
    if (!Array.isArray(history)) return null;
    return buildSessionMeta(parsed);
  } catch {
    return null;
  }
}

async function listKvByPrefix(env: Env, prefix: string, max = 500): Promise<string[]> {
  if (!env.KV.list) return [];
  const names: string[] = [];
  let cursor: string | undefined = undefined;
  for (;;) {
    const page = await env.KV.list({ prefix, cursor, limit: 1000 });
    const keys = page.keys || [];
    for (const k of keys) {
      if (k?.name) names.push(k.name);
      if (names.length >= max) return names;
    }
    if (page.list_complete || !page.cursor) break;
    cursor = page.cursor;
  }
  return names;
}

async function deleteKvByPrefix(env: Env, prefix: string, batchMax = 5000): Promise<number> {
  const keys = await listKvByPrefix(env, prefix, batchMax);
  if (!keys.length) return 0;
  for (const key of keys) await env.KV.delete(key);
  return keys.length;
}

async function getRecoverableSessions(env: Env): Promise<RecoverableSessionMeta[]> {
  const idxData = await env.KV.get(SESSION_INDEX_KEY);
  const activeIndex: SessionMeta[] = idxData ? JSON.parse(idxData) : [];
  const activeIds = new Set(activeIndex.map((s) => String(s.id || "")));

  const deletedIdxData = await env.KV.get(DELETED_SESSION_INDEX_KEY);
  const deletedIndex: DeletedSessionMeta[] = deletedIdxData ? JSON.parse(deletedIdxData) : [];
  const map = new Map<string, RecoverableSessionMeta>();

  for (const d of deletedIndex) {
    if (!d?.id) continue;
    map.set(d.id, { ...d, source: "deleted_index" });
  }

  const deletedKeys = await listKvByPrefix(env, "deleted:session:");
  for (const key of deletedKeys) {
    const id = key.replace(/^deleted:session:/, "");
    if (!id || map.has(id)) continue;
    const raw = await env.KV.get(key);
    const meta = parseSessionLike(raw);
    if (!meta) continue;
    map.set(id, toRecoverable(meta, "deleted_kv", Date.now()));
  }

  const sessionKeys = await listKvByPrefix(env, "session:");
  for (const key of sessionKeys) {
    const id = key.replace(/^session:/, "");
    if (!id || activeIds.has(id) || map.has(id)) continue;
    const raw = await env.KV.get(key);
    const meta = parseSessionLike(raw);
    if (!meta) continue;
    map.set(id, toRecoverable(meta, "orphan_session_kv", Date.now()));
  }

  return [...map.values()].sort((a, b) => (b.deletedAt || b.updatedAt || 0) - (a.deletedAt || a.updatedAt || 0));
}

async function restoreSessionById(env: Env, sessionId: string): Promise<{ ok: boolean; error?: string; session?: SessionMeta }> {
  const id = String(sessionId || "").trim();
  if (!id) return { ok: false, error: "id required" };

  const deletedKey = `deleted:session:${id}`;
  const activeKey = `session:${id}`;
  const deletedRaw = await env.KV.get(deletedKey);
  const activeRaw = await env.KV.get(activeKey);
  const raw = deletedRaw || activeRaw;
  if (!raw) return { ok: false, error: "session not found in KV" };

  const meta = parseSessionLike(raw);
  if (!meta) return { ok: false, error: "invalid session payload" };

  await env.KV.put(activeKey, raw);

  const idxData = await env.KV.get(SESSION_INDEX_KEY);
  const index: SessionMeta[] = idxData ? JSON.parse(idxData) : [];
  const existingIndex = index.findIndex((s) => s.id === id);
  if (existingIndex >= 0) index[existingIndex] = meta;
  else index.unshift(meta);
  await env.KV.put(SESSION_INDEX_KEY, JSON.stringify(index));

  const deletedIdxData = await env.KV.get(DELETED_SESSION_INDEX_KEY);
  const deletedIndex: DeletedSessionMeta[] = deletedIdxData ? JSON.parse(deletedIdxData) : [];
  await env.KV.put(DELETED_SESSION_INDEX_KEY, JSON.stringify(deletedIndex.filter((s) => s.id !== id)));
  await env.KV.delete(deletedKey);

  return { ok: true, session: meta };
}

export async function handleApiRoute(
  request: Request,
  env: Env,
  url: URL,
  cors: CorsHeaders,
): Promise<Response | null> {
  if (url.pathname === "/memory/list" && request.method === "GET") {
    const scope = parseScope(url.searchParams.get("scope"));
    if (!scope) return Response.json({ error: "invalid scope" }, { status: 400, headers: cors });
    const owner = normalizeScopeOwner(scope, url.searchParams.get("owner"));
    const limit = Number(url.searchParams.get("limit") || "50");
    const items = await listMemories(env, scope, owner, Number.isFinite(limit) ? limit : 50);
    return Response.json({ items }, { headers: cors });
  }

  if (url.pathname === "/memory/upsert" && request.method === "POST") {
    const body = await request.json() as {
      scope?: string;
      owner?: string;
      text?: string;
      source?: "manual" | "chat";
      createdAt?: number;
    };
    const scope = parseScope(body.scope || null);
    if (!scope) return Response.json({ error: "invalid scope" }, { status: 400, headers: cors });
    const owner = normalizeScopeOwner(scope, body.owner || null);
    const result = await upsertMemory(env, {
      scope,
      owner,
      text: String(body.text || ""),
      source: body.source || "manual",
      createdAt: Number(body.createdAt || 0) || undefined,
    });
    return Response.json({
      ok: !!result.item,
      duplicate: result.duplicate,
      item: result.item,
    }, { headers: cors });
  }

  if (url.pathname === "/memory/extract" && request.method === "POST") {
    const body = await request.json() as {
      history?: Array<{ role?: string; content?: unknown; createdAt?: number }>;
      participantPids?: string[];
      sessionId?: string;
      forceFull?: boolean;
    };
    const outcome = await extractAndStoreMemories(env, {
      history: Array.isArray(body.history) ? body.history : [],
      participantPids: Array.isArray(body.participantPids) ? body.participantPids : [],
      sessionId: String(body.sessionId || ""),
      forceFull: !!body.forceFull,
    });
    return Response.json({ ok: true, ...outcome }, { headers: cors });
  }

  if (url.pathname === "/memory/optimize" && request.method === "POST") {
    const body = await request.json() as { participantPids?: string[]; sessionId?: string };
    const outcome = await optimizeMemories(env, {
      participantPids: Array.isArray(body.participantPids) ? body.participantPids : [],
      sessionId: String(body.sessionId || ""),
    });
    return Response.json(outcome, { headers: cors });
  }

  if (url.pathname === "/memory/meta" && request.method === "GET") {
    const sessionId = String(url.searchParams.get("sessionId") || "");
    const meta = await getMemoryMeta(env, sessionId || undefined);
    return Response.json({ ok: true, ...meta }, { headers: cors });
  }

  if (url.pathname === "/memory/delete" && request.method === "POST") {
    const body = await request.json() as { scope?: string; owner?: string; id?: string; force?: boolean };
    const scope = parseScope(body.scope || null);
    if (!scope) return Response.json({ error: "invalid scope" }, { status: 400, headers: cors });
    const owner = normalizeScopeOwner(scope, body.owner || null);
    const id = String(body.id || "").trim();
    if (!id) return Response.json({ error: "id required" }, { status: 400, headers: cors });
    const ok = await deleteMemory(env, scope, owner, id, !!body.force);
    return Response.json({ ok }, { headers: cors });
  }

  if (url.pathname === "/memory/lock" && request.method === "POST") {
    const body = await request.json() as { scope?: string; owner?: string; id?: string; locked?: boolean };
    const scope = parseScope(body.scope || null);
    if (!scope) return Response.json({ error: "invalid scope" }, { status: 400, headers: cors });
    const owner = normalizeScopeOwner(scope, body.owner || null);
    const id = String(body.id || "").trim();
    if (!id) return Response.json({ error: "id required" }, { status: 400, headers: cors });
    const item = await setMemoryLock(env, scope, owner, id, !!body.locked);
    return Response.json({ ok: !!item, item }, { headers: cors });
  }

  if (url.pathname === "/memory/purge" && request.method === "POST") {
    const body = await request.json() as { scope?: string; owner?: string; all?: boolean };
    const purgeAll = !!body.all;
    let deleted = 0;
    const deletedPrefixes: string[] = [];

    if (purgeAll) {
      const prefixes = [
        "memory:item:",
        "memory:index:",
        "memory:fp:",
        "memory:meta:session:",
      ];
      for (const p of prefixes) {
        const n = await deleteKvByPrefix(env, p);
        if (n > 0) deletedPrefixes.push(`${p}* (${n})`);
        deleted += n;
      }
      await env.KV.delete("memory:meta:global");
      deletedPrefixes.push("memory:meta:global (1)");
      deleted += 1;
      return Response.json({ ok: true, deleted, deletedPrefixes }, { headers: cors });
    }

    const scope = parseScope(body.scope || null);
    if (!scope) return Response.json({ error: "invalid scope" }, { status: 400, headers: cors });
    const owner = normalizeScopeOwner(scope, body.owner || null);
    const base = `${scope}:${owner}`;

    const targetPrefixes = [
      `memory:item:${base}:`,
      `memory:fp:${base}:`,
    ];
    for (const p of targetPrefixes) {
      const n = await deleteKvByPrefix(env, p);
      if (n > 0) deletedPrefixes.push(`${p}* (${n})`);
      deleted += n;
    }

    // index/meta are single keys; delete directly.
    await env.KV.delete(`memory:index:${base}`);
    deletedPrefixes.push(`memory:index:${base} (1)`);
    deleted += 1;

    return Response.json({ ok: true, deleted, deletedPrefixes }, { headers: cors });
  }

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
      const data = await env.KV.get(SESSION_INDEX_KEY);
      return Response.json({ sessions: data ? JSON.parse(data) : [] }, { headers: cors });
    }
    if (request.method === "PUT") {
      const { sessions } = (await request.json()) as { sessions: unknown[] };
      await env.KV.put(SESSION_INDEX_KEY, JSON.stringify(sessions));
      return Response.json({ ok: true }, { headers: cors });
    }
    return null;
  }

  if (url.pathname === "/sessions/deleted" && request.method === "GET") {
    const data = await env.KV.get(DELETED_SESSION_INDEX_KEY);
    return Response.json({ sessions: data ? JSON.parse(data) : [] }, { headers: cors });
  }

  if (url.pathname === "/sessions/recoverable" && request.method === "GET") {
    const sessions = await getRecoverableSessions(env);
    return Response.json({ sessions }, { headers: cors });
  }

  if (url.pathname === "/session/restore" && request.method === "POST") {
    const { id } = (await request.json()) as { id?: string };
    const restored = await restoreSessionById(env, String(id || ""));
    if (!restored.ok) {
      const status = restored.error === "id required" ? 400 : 404;
      return Response.json({ ok: false, error: restored.error }, { status, headers: cors });
    }
    return Response.json({ ok: true, session: restored.session }, { headers: cors });
  }

  if (url.pathname === "/session/recover" && request.method === "POST") {
    const { id } = (await request.json()) as { id?: string };
    const recovered = await restoreSessionById(env, String(id || ""));
    if (!recovered.ok) {
      const status = recovered.error === "id required" ? 400 : 404;
      return Response.json({ ok: false, error: recovered.error }, { status, headers: cors });
    }
    return Response.json({ ok: true, session: recovered.session }, { headers: cors });
  }

  if (url.pathname === "/session/purge" && request.method === "POST") {
    const { id } = (await request.json()) as { id?: string };
    const sessionId = String(id || "").trim();
    if (!sessionId) return Response.json({ ok: false, error: "id required" }, { status: 400, headers: cors });

    await env.KV.delete(`session:${sessionId}`);
    await env.KV.delete(`deleted:session:${sessionId}`);

    const idxData = await env.KV.get(SESSION_INDEX_KEY);
    const index: SessionMeta[] = idxData ? JSON.parse(idxData) : [];
    await env.KV.put(SESSION_INDEX_KEY, JSON.stringify(index.filter((s) => s.id !== sessionId)));

    const deletedIdxData = await env.KV.get(DELETED_SESSION_INDEX_KEY);
    const deletedIndex: DeletedSessionMeta[] = deletedIdxData ? JSON.parse(deletedIdxData) : [];
    await env.KV.put(DELETED_SESSION_INDEX_KEY, JSON.stringify(deletedIndex.filter((s) => s.id !== sessionId)));

    return Response.json({ ok: true }, { headers: cors });
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

    const idxData = await env.KV.get(SESSION_INDEX_KEY);
    const index: SessionMeta[] = idxData ? JSON.parse(idxData) : [];
    const meta: SessionMeta = buildSessionMeta(session);

    const existingIndex = index.findIndex((s) => s.id === id);
    if (existingIndex >= 0) index[existingIndex] = meta;
    else index.unshift(meta);

    await env.KV.put(SESSION_INDEX_KEY, JSON.stringify(index));
    return Response.json({ ok: true }, { headers: cors });
  }

  if (request.method === "DELETE") {
    const existingRaw = await env.KV.get(`session:${id}`);
    if (existingRaw) {
      try {
        const session = JSON.parse(existingRaw) as Record<string, unknown>;
        const meta = buildSessionMeta(session);
        const deletedMeta: DeletedSessionMeta = { ...meta, deletedAt: Date.now() };
        await env.KV.put(`deleted:session:${id}`, existingRaw);
        const deletedIdxData = await env.KV.get(DELETED_SESSION_INDEX_KEY);
        const deletedIndex: DeletedSessionMeta[] = deletedIdxData ? JSON.parse(deletedIdxData) : [];
        const nextDeleted = [deletedMeta, ...deletedIndex.filter((s) => s.id !== id)].slice(0, 200);
        await env.KV.put(DELETED_SESSION_INDEX_KEY, JSON.stringify(nextDeleted));
      } catch {
        // ignore archival parse failure and continue hard-delete path
      }
    }

    await env.KV.delete(`session:${id}`);
    const idxData = await env.KV.get(SESSION_INDEX_KEY);
    let index: SessionMeta[] = idxData ? JSON.parse(idxData) : [];
    index = index.filter((s) => s.id !== id);
    await env.KV.put(SESSION_INDEX_KEY, JSON.stringify(index));
    return Response.json({ ok: true }, { headers: cors });
  }

  return null;
}
