import type { CorsHeaders, Env } from "./index";
import {
  deleteMemory,
  extractAndStoreMemories,
  getMemoryMeta,
  listMemories,
  normalizeScopeOwner,
  optimizeMemories,
  rebuildMemoriesFromSession,
  parseScope,
  setMemoryLock,
  setMemoryText,
  upsertMemory,
} from "./memory";
import { getRileyWealthSnapshot, reconcileRileyWealth } from "./riley_wealth";

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
const PERSONAS_KEY = "personas";
const PERSONAS_R2_KEY = "personas/personas.json";
const SESSION_INDEX_R2_KEY = "session/index.json";
const DELETED_SESSION_INDEX_R2_KEY = "session/deleted_index.json";
const SESSION_R2_PREFIX = "session/data/";
const DELETED_SESSION_R2_PREFIX = "session/deleted/";
const SESSION_AUDIO_R2_PREFIXES = ["tts/session/", "audio/session/"];

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

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function ttsFormatToExt(format: string): string {
  if (format === "wav") return "wav";
  if (format === "opus") return "opus";
  return "mp3";
}

function ttsFormatToContentType(format: string): string {
  if (format === "wav") return "audio/wav";
  if (format === "opus") return "audio/ogg";
  return "audio/mpeg";
}

function isLikelyAudioBytes(format: string, bytes: Uint8Array): boolean {
  if (!bytes || bytes.length < 64) return false;
  if (format === "wav") {
    return bytes.length >= 12
      && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
      && bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45;
  }
  if (format === "opus") {
    return bytes.length >= 4
      && bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53;
  }
  const hasId3 = bytes.length >= 3 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33;
  const hasMpegFrameSync = bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0;
  return hasId3 || hasMpegFrameSync;
}

function isAudioContentItem(item: unknown): boolean {
  if (!item || typeof item !== "object") return false;
  const rec = item as Record<string, unknown>;
  const type = String(rec.type || "").toLowerCase();
  if (type.includes("audio")) return true;
  if (typeof rec.audio === "string" || typeof rec.audio_url === "string" || typeof rec.audioUrl === "string") return true;
  return false;
}

function sanitizeSessionForRestorePayload(session: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...session };
  const history = Array.isArray(session.history) ? session.history : [];
  next.history = history.map((msg) => {
    if (!msg || typeof msg !== "object") return msg as unknown;
    const m = { ...(msg as Record<string, unknown>) };
    if (Array.isArray(m.content)) {
      m.content = (m.content as unknown[]).filter((item) => !isAudioContentItem(item));
    }
    delete m.audio;
    delete m.audioUrl;
    delete m.audio_url;
    delete m.audioKey;
    delete m.ttsAudioUrl;
    delete m.ttsAudioKey;
    delete m.ttsCacheKey;
    return m;
  });
  delete next.ttsAudio;
  delete next.ttsAudioMap;
  delete next.audioMap;
  return next;
}

function stableMessageKey(msg: unknown): string {
  try {
    if (!msg || typeof msg !== "object") return String(msg || "");
    const m = msg as Record<string, unknown>;
    const role = String(m.role || "");
    const createdAt = Number(m.createdAt || 0);
    const content = JSON.stringify(m.content ?? null);
    return `${role}|${createdAt}|${content}`;
  } catch {
    return String(msg || "");
  }
}

function mergeSessionHistory(existingHistory: unknown, incomingHistory: unknown): unknown[] {
  const a = Array.isArray(existingHistory) ? existingHistory : [];
  const b = Array.isArray(incomingHistory) ? incomingHistory : [];
  const out: unknown[] = [];
  const seen = new Set<string>();
  for (const msg of [...a, ...b]) {
    const key = stableMessageKey(msg);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(msg);
  }
  out.sort((x, y) => {
    const tx = Number((x as any)?.createdAt || 0);
    const ty = Number((y as any)?.createdAt || 0);
    return tx - ty;
  });
  return out;
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

  let parsedSession: Record<string, unknown>;
  try {
    parsedSession = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { ok: false, error: "invalid session payload" };
  }
  const sanitizedSession = sanitizeSessionForRestorePayload(parsedSession);
  const meta = buildSessionMeta(sanitizedSession);
  const sanitizedRaw = JSON.stringify(sanitizedSession);

  await env.R2.put(sessionR2Key(id), sanitizedRaw, { httpMetadata: { contentType: "application/json; charset=utf-8" } });
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
  for (const base of SESSION_AUDIO_R2_PREFIXES) {
    await deleteR2ByPrefix(env, `${base}${id}/`);
  }

  return { ok: true, session: meta };
}

export async function handleApiRoute(
  request: Request,
  env: Env,
  url: URL,
  cors: CorsHeaders,
): Promise<Response | null> {
  const noStoreHeaders = { ...cors, "Cache-Control": "no-store" };
  if (url.pathname === "/tts" && request.method === "POST") {
    const body = await request.json() as {
      text?: string;
      sessionId?: string;
      voice?: string;
      model?: string;
      prompt?: string;
      tone?: string;
      emotion?: string;
      emotionEnabled?: boolean;
      emotionStrength?: "low" | "medium" | "high";
      format?: "mp3" | "wav" | "opus";
    };
    const text = String(body?.text || "").trim();
    if (!text) return Response.json({ error: "text required" }, { status: 400, headers: cors });

    const apiKey = String(env.DASHSCOPE_API_KEY || env.QWEN_API_KEY || env.QWEN_KEY || "").trim();
    if (!apiKey) return Response.json({ error: "server tts key missing" }, { status: 500, headers: cors });

    const configuredWs = String(env.DASHSCOPE_WS_URL || "").trim();

    const requestedVoice = String(body?.voice || "").trim();
    const voiceMap: Record<string, string> = {
      lena: "Cherry",
      aria: "Serena",
      nova: "Cherry",
      sora: "Serena",
      yuna: "Cherry",
    };
    const voice = voiceMap[requestedVoice.toLowerCase()] || requestedVoice || "Cherry";
    const model = String(body?.model || "").trim() || "qwen3-tts-flash-realtime";
    const format = body?.format || "mp3";
    const tone = String(body?.tone || "").trim();
    const prompt = String(body?.prompt || "").trim();
    const emotion = String(body?.emotion || "").trim().toLowerCase();
    const emotionEnabled = body?.emotionEnabled !== false;
    const emotionStrength = body?.emotionStrength || "medium";
    const sessionIdRaw = String(body?.sessionId || "").trim();
    const sessionIdSafe = sessionIdRaw.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
    const contentType = ttsFormatToContentType(format);

    const cacheBasis = JSON.stringify({
      v: 1,
      text,
      model,
      voice,
      prompt,
      tone,
      emotion,
      emotionEnabled: !!emotionEnabled,
      emotionStrength,
      format,
      language: "Korean",
    });
    const cacheHash = await sha256Hex(cacheBasis);
    const cachePrefix = sessionIdSafe ? `tts/session/${sessionIdSafe}` : "tts/global";
    const cacheKey = `${cachePrefix}/${cacheHash}.${ttsFormatToExt(format)}`;
    const cached = await env.R2.get(cacheKey);
    if (cached) {
      try {
        const cachedBytes = new Uint8Array(await cached.arrayBuffer());
        if (isLikelyAudioBytes(format, cachedBytes)) {
          return new Response(cachedBytes, {
            headers: {
              ...cors,
              "Content-Type": cached.httpMetadata?.contentType || contentType,
              "Cache-Control": "private, max-age=31536000",
              "X-TTS-Cache": "HIT",
            },
          });
        }
        await env.R2.delete(cacheKey);
      } catch {
        await env.R2.delete(cacheKey);
      }
    }

    const defaultWsIntl = `wss://dashscope-intl.aliyuncs.com/api-ws/v1/realtime?model=${encodeURIComponent(model)}`;
    const defaultWsCn = `wss://dashscope.aliyuncs.com/api-ws/v1/realtime?model=${encodeURIComponent(model)}`;

    const emotionMap: Record<string, Record<string, string>> = {
      low: { happy: "밝기를 아주 약하게", sad: "차분함을 아주 약하게", angry: "강세를 아주 약하게", shy: "부드러움을 아주 약하게", neutral: "중립 톤을 유지" },
      medium: { happy: "밝기를 적당히", sad: "차분함을 적당히", angry: "강세를 적당히", shy: "부드러움을 적당히", neutral: "중립 톤을 유지" },
      high: { happy: "밝기를 비교적 뚜렷하게", sad: "차분함을 비교적 뚜렷하게", angry: "강세를 비교적 뚜렷하게", shy: "부드러움을 비교적 뚜렷하게", neutral: "중립 톤을 유지" },
    };
    const emotionHint =
      emotionEnabled && emotion
        ? (emotionMap[emotionStrength]?.[emotion] || `감정(${emotion})을 ${emotionStrength === "high" ? "비교적 뚜렷하게" : emotionStrength === "low" ? "아주 약하게" : "적당히"} 반영`)
        : "";
    const sessionPrompt = [
      "한국어 여성 보이스를 유지하고, 인위적 연기 없이 자연스럽게 읽어주세요.",
      tone ? `기본 톤: ${tone}.` : "",
      emotionHint ? `현재 감정 반영: ${emotionHint}.` : "",
      prompt ? `추가 지시: ${prompt}` : "",
    ].filter(Boolean).join(" ");

    const wsTargets = configuredWs ? [configuredWs] : [defaultWsIntl, defaultWsCn];

    const decodeBase64ToBytes = (b64: string): Uint8Array => {
      const bin = atob(b64);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    };
    const concatChunks = (chunks: Uint8Array[]): Uint8Array => {
      const total = chunks.reduce((n, c) => n + c.length, 0);
      const merged = new Uint8Array(total);
      let offset = 0;
      for (const c of chunks) {
        merged.set(c, offset);
        offset += c.length;
      }
      return merged;
    };

    const runRealtimeTts = async (wsUrl: string): Promise<{ bytes: Uint8Array; endpoint: string }> => {
      const fetchableUrl = String(wsUrl || "").replace(/^wss:\/\//i, "https://").replace(/^ws:\/\//i, "http://");
      const upgraded = await fetch(fetchableUrl, {
        headers: {
          Upgrade: "websocket",
          Authorization: `Bearer ${apiKey}`,
        },
      });
      if (upgraded.status !== 101 || !upgraded.webSocket) {
        const detail = await upgraded.text().catch(() => "");
        throw new Error(`ws_connect_failed:${upgraded.status}:${detail.slice(0, 200)}`);
      }
      const ws = upgraded.webSocket;
      ws.accept();

      const chunks: Uint8Array[] = [];
      let done = false;
      let errorMsg = "";

      const eventId = () => `event_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const sendEvent = (evt: Record<string, unknown>) => ws.send(JSON.stringify({ ...evt, event_id: eventId() }));

      const finished = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("ws_timeout"));
        }, 45000);

        ws.addEventListener("message", (evt: MessageEvent) => {
          try {
            const data = typeof evt.data === "string" ? JSON.parse(evt.data) : {};
            const type = String(data?.type || "");
            if (type === "response.audio.delta") {
              const delta = String(data?.delta || "");
              if (delta) chunks.push(decodeBase64ToBytes(delta));
              return;
            }
            if (type === "response.done") {
              done = true;
              clearTimeout(timeout);
              resolve();
              return;
            }
            if (type === "error") {
              errorMsg = JSON.stringify(data?.error || data).slice(0, 500);
              clearTimeout(timeout);
              reject(new Error(`ws_error:${errorMsg}`));
            }
          } catch (e) {
            clearTimeout(timeout);
            reject(e);
          }
        });
        ws.addEventListener("close", () => {
          if (done) return;
          clearTimeout(timeout);
          reject(new Error(errorMsg || "ws_closed_early"));
        });
      });

      sendEvent({
        type: "session.update",
        session: {
          mode: "commit",
          voice,
          response_format: format,
          language_type: "Korean",
          prompt: sessionPrompt,
        },
      });
      sendEvent({ type: "input_text_buffer.append", text });
      sendEvent({ type: "input_text_buffer.commit" });

      await finished;
      try { sendEvent({ type: "session.finish" }); } catch {}
      try { ws.close(1000, "done"); } catch {}

      const bytes = concatChunks(chunks);
      if (!bytes.length) throw new Error("empty_audio");
      return { bytes, endpoint: wsUrl };
    };

    let lastErr = "";
    let lastEndpoint = "";
    for (const target of wsTargets) {
      try {
        const out = await runRealtimeTts(target);
        if (!isLikelyAudioBytes(format, out.bytes)) {
          throw new Error("invalid_audio_bytes");
        }
        await env.R2.put(cacheKey, out.bytes, { httpMetadata: { contentType } });
        return new Response(out.bytes, {
          headers: {
            ...cors,
            "Content-Type": contentType,
            "Cache-Control": "private, max-age=31536000",
            "X-TTS-Cache": "MISS",
          },
        });
      } catch (e: any) {
        lastErr = String(e?.message || e || "");
        lastEndpoint = target;
      }
    }

    return Response.json({
      error: "qwen tts failed",
      status: 502,
      endpoint: lastEndpoint,
      detail: lastErr.slice(0, 600),
    }, { status: 502, headers: cors });
  }

  if (url.pathname === "/memory/list" && request.method === "GET") {
    const scope = parseScope(url.searchParams.get("scope"));
    if (!scope) return Response.json({ error: "invalid scope" }, { status: 400, headers: cors });
    const owner = normalizeScopeOwner(scope, url.searchParams.get("owner"));
    const limit = Number(url.searchParams.get("limit") || "50");
    const cursor = String(url.searchParams.get("cursor") || "");
    const result = await listMemories(env, scope, owner, Number.isFinite(limit) ? limit : 50, cursor);
    return Response.json({ items: result.items, nextCursor: result.nextCursor }, { headers: cors });
  }

  if (url.pathname === "/memory/upsert" && request.method === "POST") {
    const body = await request.json() as {
      scope?: string;
      owner?: string;
      text?: string;
      category?: "profile" | "preference" | "finance" | "project" | "constraint" | "context" | "other";
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
      category: body.category,
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

  if (url.pathname === "/memory/rebuild" && request.method === "POST") {
    const body = await request.json() as {
      history?: Array<{ role?: string; content?: unknown; createdAt?: number }>;
      participantPids?: string[];
      sessionId?: string;
      includePublic?: boolean;
    };
    const outcome = await rebuildMemoriesFromSession(env, {
      history: Array.isArray(body.history) ? body.history : [],
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

  if (url.pathname === "/memory/delete-batch" && request.method === "POST") {
    const body = await request.json() as { scope?: string; owner?: string; ids?: string[]; force?: boolean };
    const scope = parseScope(body.scope || null);
    if (!scope) return Response.json({ error: "invalid scope" }, { status: 400, headers: cors });
    const owner = normalizeScopeOwner(scope, body.owner || null);
    const ids = Array.isArray(body.ids) ? body.ids.map((x) => String(x || "").trim()).filter(Boolean) : [];
    if (!ids.length) return Response.json({ ok: false, deleted: 0, error: "ids required" }, { status: 400, headers: cors });
    let deleted = 0;
    for (const id of ids) {
      const ok = await deleteMemory(env, scope, owner, id, !!body.force);
      if (ok) deleted++;
    }
    return Response.json({ ok: true, deleted, requested: ids.length }, { headers: cors });
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

  if (url.pathname === "/riley/wealth" && request.method === "GET") {
    const tail = Math.max(1, Math.min(200, Number(url.searchParams.get("tail") || 30)));
    const snapshot = await getRileyWealthSnapshot(env, tail);
    return Response.json({
      ok: true,
      state: snapshot.state,
      events: snapshot.events,
    }, { headers: { ...cors, "Cache-Control": "no-store" } });
  }

  if (url.pathname === "/riley/wealth/reconcile" && request.method === "POST") {
    const result = await reconcileRileyWealth(env);
    return Response.json(result, { headers: { ...cors, "Cache-Control": "no-store" } });
  }

  if (url.pathname === "/personas") {
    if (request.method === "GET") {
      const fromR2 = await r2Json<unknown[] | null>(env, PERSONAS_R2_KEY, null);
      if (Array.isArray(fromR2)) return Response.json({ personas: fromR2 }, { headers: cors });
      const data = await env.KV.get(PERSONAS_KEY);
      return Response.json({ personas: data ? JSON.parse(data) : [] }, { headers: cors });
    }
    if (request.method === "PUT") {
      const { personas } = (await request.json()) as { personas: unknown[] };
      const payload = Array.isArray(personas) ? personas : [];
      await r2PutJson(env, PERSONAS_R2_KEY, payload);
      try {
        await env.KV.put(PERSONAS_KEY, JSON.stringify(payload));
      } catch {
        // KV daily write limit may be exceeded; R2 remains source of truth.
      }
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
      return Response.json({ sessions }, { headers: noStoreHeaders });
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
    for (const base of SESSION_AUDIO_R2_PREFIXES) {
      await deleteR2ByPrefix(env, `${base}${sessionId}/`);
    }

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
    const rawPrefix = decodeURIComponent(url.pathname.slice(12));
    const normalizedPrefix = rawPrefix.replace(/^\/+|\/+$/g, "");
    const listPrefix = normalizedPrefix ? `${normalizedPrefix}/` : "";
    const list = await env.R2.list({ prefix: listPrefix });
    const keys = (list.objects || []).map((o) => o.key);
    return Response.json({ keys }, { headers: cors });
  }

  if (url.pathname === "/image-fetch" && request.method === "GET") {
    const targetUrl = String(url.searchParams.get("url") || "").trim();
    if (!targetUrl) return Response.json({ error: "url required" }, { status: 400, headers: cors });
    let parsed: URL;
    try {
      parsed = new URL(targetUrl);
    } catch {
      return Response.json({ error: "invalid url" }, { status: 400, headers: cors });
    }
    if (!/^https?:$/.test(parsed.protocol)) {
      return Response.json({ error: "unsupported url protocol" }, { status: 400, headers: cors });
    }
    const remote = await fetch(parsed.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "image/*,*/*;q=0.8",
      },
    });
    if (!remote.ok) {
      return Response.json({ error: `remote fetch failed: ${remote.status}` }, { status: 502, headers: cors });
    }
    const contentType = (remote.headers.get("content-type") || "image/png").split(";")[0];
    return new Response(remote.body, {
      headers: {
        ...cors,
        "Content-Type": contentType,
        "Cache-Control": "no-store",
      },
    });
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

  if (url.pathname.startsWith("/image/") && request.method === "DELETE") {
    const key = decodeURIComponent(url.pathname.slice(7));
    if (!key) return Response.json({ error: "key required" }, { status: 400, headers: cors });
    await env.R2.delete(key);
    return Response.json({ ok: true, key }, { headers: cors });
  }

  return null;
}

async function handleSessionRoute(
  request: Request,
  env: Env,
  id: string,
  cors: CorsHeaders,
): Promise<Response | null> {
  const noStoreHeaders = { ...cors, "Cache-Control": "no-store" };
  if (request.method === "GET") {
    const data = await getSessionPayloadText(env, id);
    return Response.json({ session: data ? JSON.parse(data) : null }, { headers: noStoreHeaders });
  }

  if (request.method === "PUT") {
    const { session } = (await request.json()) as { session: Record<string, unknown> };
    const incomingUpdatedAt = Number((session as any)?.updatedAt || 0);
    const existingRaw = await getSessionPayloadText(env, id);
    let mergedSession: Record<string, unknown> = { ...(session || {}) };
    if (existingRaw) {
      try {
        const existing = JSON.parse(existingRaw) as Record<string, unknown>;
        const mergedHistory = mergeSessionHistory(existing?.history, session?.history);
        const existingUpdatedAt = Number(existing?.updatedAt || 0);
        mergedSession = {
          ...existing,
          ...session,
          history: mergedHistory,
          updatedAt: Math.max(existingUpdatedAt, incomingUpdatedAt, Date.now()),
        };
      } catch {
        // ignore parse failure and proceed with incoming payload
      }
    }
    const payload = JSON.stringify(mergedSession);
    await env.R2.put(sessionR2Key(id), payload, { httpMetadata: { contentType: "application/json; charset=utf-8" } });
    await env.KV.delete(`session:${id}`);

    const index = await getSessionIndex(env);
    const meta: SessionMeta = buildSessionMeta(mergedSession);

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
    for (const base of SESSION_AUDIO_R2_PREFIXES) {
      await deleteR2ByPrefix(env, `${base}${id}/`);
    }
    let index = await getSessionIndex(env);
    index = index.filter((s) => s.id !== id);
    await putSessionIndex(env, index);
    return Response.json({ ok: true }, { headers: cors });
  }

  return null;
}
