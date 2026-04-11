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
  setMemoryText,
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
const SESSION_INDEX_R2_KEY = "session/index.json";
const DELETED_SESSION_INDEX_R2_KEY = "session/deleted_index.json";
const SESSION_R2_PREFIX = "session/data/";
const DELETED_SESSION_R2_PREFIX = "session/deleted/";

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

function sessionR2Key(id: string): string {
  return `${SESSION_R2_PREFIX}${id}.json`;
}

function deletedSessionR2Key(id: string): string {
  return `${DELETED_SESSION_R2_PREFIX}${id}.json`;
}

async function r2Text(env: Env, key: string): Promise<string | null> {
  try {
    const obj = await env.R2.get(key);
    if (!obj) return null;
    if (typeof obj.text === "function") return await obj.text();
    return null;
  } catch {
    return null;
  }
}

async function r2Json<T>(env: Env, key: string, fallback: T): Promise<T> {
  const text = await r2Text(env, key);
  if (!text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

async function r2PutJson(env: Env, key: string, value: unknown): Promise<void> {
  await env.R2.put(
    key,
    JSON.stringify(value),
    { httpMetadata: { contentType: "application/json; charset=utf-8" } },
  );
}

async function getSessionIndex(env: Env): Promise<SessionMeta[]> {
  const fromR2 = await r2Json<SessionMeta[] | null>(env, SESSION_INDEX_R2_KEY, null);
  if (Array.isArray(fromR2)) return fromR2;
  const legacy = await env.KV.get(SESSION_INDEX_KEY);
  return legacy ? JSON.parse(legacy) : [];
}

async function putSessionIndex(env: Env, sessions: SessionMeta[]): Promise<void> {
  await r2PutJson(env, SESSION_INDEX_R2_KEY, sessions);
}

async function getDeletedSessionIndex(env: Env): Promise<DeletedSessionMeta[]> {
  const fromR2 = await r2Json<DeletedSessionMeta[] | null>(env, DELETED_SESSION_INDEX_R2_KEY, null);
  if (Array.isArray(fromR2)) return fromR2;
  const legacy = await env.KV.get(DELETED_SESSION_INDEX_KEY);
  return legacy ? JSON.parse(legacy) : [];
}

async function putDeletedSessionIndex(env: Env, sessions: DeletedSessionMeta[]): Promise<void> {
  await r2PutJson(env, DELETED_SESSION_INDEX_R2_KEY, sessions);
}

async function getSessionPayloadText(env: Env, id: string): Promise<string | null> {
  const fromR2 = await r2Text(env, sessionR2Key(id));
  if (fromR2) return fromR2;
  return await env.KV.get(`session:${id}`);
}

async function getDeletedSessionPayloadText(env: Env, id: string): Promise<string | null> {
  const fromR2 = await r2Text(env, deletedSessionR2Key(id));
  if (fromR2) return fromR2;
  return await env.KV.get(`deleted:session:${id}`);
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

async function listR2ByPrefix(env: Env, prefix: string, max = 5000): Promise<string[]> {
  const names: string[] = [];
  let cursor: string | undefined = undefined;
  for (;;) {
    const page = await env.R2.list({ prefix, cursor, limit: 1000 });
    const objects = page.objects || [];
    for (const o of objects) {
      if (o?.key) names.push(o.key);
      if (names.length >= max) return names;
    }
    const nextCursor = (page as any).cursor as string | undefined;
    const listComplete = (page as any).list_complete as boolean | undefined;
    if (listComplete || !nextCursor) break;
    cursor = nextCursor;
  }
  return names;
}

async function deleteR2ByPrefix(env: Env, prefix: string, batchMax = 5000): Promise<number> {
  const keys = await listR2ByPrefix(env, prefix, batchMax);
  if (!keys.length) return 0;
  for (const key of keys) await env.R2.delete(key);
  return keys.length;
}

async function getRecoverableSessions(env: Env): Promise<RecoverableSessionMeta[]> {
  const activeIndex = await getSessionIndex(env);
  const activeIds = new Set(activeIndex.map((s) => String(s.id || "")));

  const deletedIndex = await getDeletedSessionIndex(env);
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

  const deletedR2Keys = await listR2ByPrefix(env, DELETED_SESSION_R2_PREFIX);
  for (const key of deletedR2Keys) {
    const id = key.replace(DELETED_SESSION_R2_PREFIX, "").replace(/\.json$/, "");
    if (!id || map.has(id)) continue;
    const raw = await r2Text(env, key);
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

  const sessionR2Keys = await listR2ByPrefix(env, SESSION_R2_PREFIX);
  for (const key of sessionR2Keys) {
    const id = key.replace(SESSION_R2_PREFIX, "").replace(/\.json$/, "");
    if (!id || activeIds.has(id) || map.has(id)) continue;
    const raw = await r2Text(env, key);
    const meta = parseSessionLike(raw);
    if (!meta) continue;
    map.set(id, toRecoverable(meta, "orphan_session_kv", Date.now()));
  }

  return [...map.values()].sort((a, b) => (b.deletedAt || b.updatedAt || 0) - (a.deletedAt || a.updatedAt || 0));
}

async function restoreSessionById(env: Env, sessionId: string): Promise<{ ok: boolean; error?: string; session?: SessionMeta }> {
  const id = String(sessionId || "").trim();
  if (!id) return { ok: false, error: "id required" };

  const deletedRaw = await getDeletedSessionPayloadText(env, id);
  const activeRaw = await getSessionPayloadText(env, id);
  const raw = deletedRaw || activeRaw;
  if (!raw) return { ok: false, error: "session not found" };

  const meta = parseSessionLike(raw);
  if (!meta) return { ok: false, error: "invalid session payload" };

  await env.R2.put(sessionR2Key(id), raw, { httpMetadata: { contentType: "application/json; charset=utf-8" } });
  await env.KV.delete(`session:${id}`);

  const index = await getSessionIndex(env);
  const existingIndex = index.findIndex((s) => s.id === id);
  if (existingIndex >= 0) index[existingIndex] = meta;
  else index.unshift(meta);
  await putSessionIndex(env, index);

  const deletedIndex = await getDeletedSessionIndex(env);
  await putDeletedSessionIndex(env, deletedIndex.filter((s) => s.id !== id));
  await env.KV.delete(`deleted:session:${id}`);
  await env.R2.delete(deletedSessionR2Key(id));

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
    const body = await request.json() as { participantPids?: string[]; sessionId?: string; includePublic?: boolean };
    const outcome = await optimizeMemories(env, {
      participantPids: Array.isArray(body.participantPids) ? body.participantPids : [],
      sessionId: String(body.sessionId || ""),
      includePublic: body.includePublic !== false,
    });
    if (!outcome?.ok) {
      return Response.json(outcome, { status: 500, headers: cors });
    }
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

  if (url.pathname === "/memory/update" && request.method === "POST") {
    const body = await request.json() as { scope?: string; owner?: string; id?: string; text?: string };
    const scope = parseScope(body.scope || null);
    if (!scope) return Response.json({ error: "invalid scope" }, { status: 400, headers: cors });
    const owner = normalizeScopeOwner(scope, body.owner || null);
    const id = String(body.id || "").trim();
    const text = String(body.text || "").trim();
    if (!id) return Response.json({ error: "id required" }, { status: 400, headers: cors });
    if (!text) return Response.json({ error: "text required" }, { status: 400, headers: cors });
    const item = await setMemoryText(env, scope, owner, id, text);
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

      const r2Deleted = await deleteR2ByPrefix(env, "memory/");
      if (r2Deleted > 0) {
        deletedPrefixes.push(`R2:memory/* (${r2Deleted})`);
        deleted += r2Deleted;
      }
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

    const r2Prefix = `memory/${scope}/${owner}/`;
    const r2Deleted = await deleteR2ByPrefix(env, r2Prefix);
    if (r2Deleted > 0) {
      deletedPrefixes.push(`R2:${r2Prefix}* (${r2Deleted})`);
      deleted += r2Deleted;
    }

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
      const sessions = await getSessionIndex(env);
      return Response.json({ sessions }, { headers: cors });
    }
    if (request.method === "PUT") {
      const { sessions } = (await request.json()) as { sessions: unknown[] };
      await putSessionIndex(env, (Array.isArray(sessions) ? sessions : []) as SessionMeta[]);
      return Response.json({ ok: true }, { headers: cors });
    }
    return null;
  }

  if (url.pathname === "/sessions/deleted" && request.method === "GET") {
    const sessions = await getDeletedSessionIndex(env);
    return Response.json({ sessions }, { headers: cors });
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
    await env.R2.delete(sessionR2Key(sessionId));
    await env.R2.delete(deletedSessionR2Key(sessionId));

    const index = await getSessionIndex(env);
    await putSessionIndex(env, index.filter((s) => s.id !== sessionId));

    const deletedIndex = await getDeletedSessionIndex(env);
    await putDeletedSessionIndex(env, deletedIndex.filter((s) => s.id !== sessionId));

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
    const data = await getSessionPayloadText(env, id);
    return Response.json({ session: data ? JSON.parse(data) : null }, { headers: cors });
  }

  if (request.method === "PUT") {
    const { session } = (await request.json()) as { session: Record<string, unknown> };
    const payload = JSON.stringify(session);
    await env.R2.put(sessionR2Key(id), payload, { httpMetadata: { contentType: "application/json; charset=utf-8" } });
    await env.KV.delete(`session:${id}`);

    const index = await getSessionIndex(env);
    const meta: SessionMeta = buildSessionMeta(session);

    const existingIndex = index.findIndex((s) => s.id === id);
    if (existingIndex >= 0) index[existingIndex] = meta;
    else index.unshift(meta);

    await putSessionIndex(env, index);
    return Response.json({ ok: true }, { headers: cors });
  }

  if (request.method === "DELETE") {
    const existingRaw = await getSessionPayloadText(env, id);
    if (existingRaw) {
      try {
        const session = JSON.parse(existingRaw) as Record<string, unknown>;
        const meta = buildSessionMeta(session);
        const deletedMeta: DeletedSessionMeta = { ...meta, deletedAt: Date.now() };
        await env.R2.put(deletedSessionR2Key(id), existingRaw, { httpMetadata: { contentType: "application/json; charset=utf-8" } });
        await env.KV.delete(`deleted:session:${id}`);
        const deletedIndex = await getDeletedSessionIndex(env);
        const nextDeleted = [deletedMeta, ...deletedIndex.filter((s) => s.id !== id)].slice(0, 200);
        await putDeletedSessionIndex(env, nextDeleted);
      } catch {
        // ignore archival parse failure and continue hard-delete path
      }
    }

    await env.KV.delete(`session:${id}`);
    await env.R2.delete(sessionR2Key(id));
    let index = await getSessionIndex(env);
    index = index.filter((s) => s.id !== id);
    await putSessionIndex(env, index);
    return Response.json({ ok: true }, { headers: cors });
  }

  return null;
}
