import type { Env } from "./index";

const DROPBOX_API = "https://api.dropboxapi.com/2";
const DROPBOX_CONTENT = "https://content.dropboxapi.com/2";

function dbxHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

type Persona = "riley" | "avery" | "shared";

function getDropboxAppConfig(env: Env, persona: Persona): { key: string; secret: string; refreshToken: string } {
  const key = String(
    persona === "riley"
      ? (env.RILEY_DBX_APP_KEY || "")
      : (persona === "avery" ? (env.AVERY_DBX_APP_KEY || "") : (env.PERSONA_SHARED_DBX_APP_KEY || "")),
  ).trim();
  const secret = String(
    persona === "riley"
      ? (env.RILEY_DBX_APP_SECRET || "")
      : (persona === "avery" ? (env.AVERY_DBX_APP_SECRET || "") : (env.PERSONA_SHARED_DBX_APP_SECRET || "")),
  ).trim();
  const refreshToken = String(
    persona === "riley"
      ? (env.RILEY_DBX_REFRESH_TOKEN || "")
      : (persona === "avery" ? (env.AVERY_DBX_REFRESH_TOKEN || "") : (env.PERSONA_SHARED_DBX_REFRESH_TOKEN || "")),
  ).trim();
  return { key, secret, refreshToken };
}

function toBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

async function dropboxUploadBytes(token: string, path: string, bytes: ArrayBuffer | Uint8Array): Promise<boolean> {
  await ensureFolder(token, dirname(path));
  const res = await fetch(`${DROPBOX_CONTENT}/files/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
      "Dropbox-API-Arg": JSON.stringify({
        path,
        mode: "overwrite",
        autorename: false,
        mute: true,
        strict_conflict: false,
      }),
    },
    body: bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes),
  });
  return res.ok;
}

async function listFolderOnce(token: string, path: string): Promise<boolean> {
  const res = await fetch(`${DROPBOX_API}/files/list_folder`, {
    method: "POST",
    headers: dbxHeaders(token),
    body: JSON.stringify({ path, limit: 1 }),
  });
  return res.ok;
}

async function ensureFolder(token: string, path: string): Promise<void> {
  if (!path || path === "/") return;
  if (await listFolderOnce(token, path)) return;
  await fetch(`${DROPBOX_API}/files/create_folder_v2`, {
    method: "POST",
    headers: dbxHeaders(token),
    body: JSON.stringify({ path, autorename: false }),
  });
}

function dirname(path: string): string {
  const idx = path.lastIndexOf("/");
  if (idx <= 0) return "/";
  return path.slice(0, idx);
}

export function getPersonaDropboxToken(env: Env, persona: Persona): string {
  return String(
    persona === "riley"
      ? (env.RILEY_DBX_ACCESS_TOKEN || "")
      : (persona === "avery" ? (env.AVERY_DBX_ACCESS_TOKEN || "") : (env.PERSONA_SHARED_DBX_ACCESS_TOKEN || "")),
  ).trim();
}

export async function getPersonaDropboxAccessToken(env: Env, persona: Persona): Promise<string> {
  const direct = getPersonaDropboxToken(env, persona);
  if (direct) return direct;
  const cfg = getDropboxAppConfig(env, persona);
  if (!cfg.key || !cfg.secret || !cfg.refreshToken) return "";
  const res = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: cfg.refreshToken,
      client_id: cfg.key,
      client_secret: cfg.secret,
    }),
  });
  if (!res.ok) return "";
  const raw = await res.json().catch(() => null) as any;
  const token = String(raw?.access_token || "").trim();
  return token;
}

export async function dropboxReadText(token: string, path: string): Promise<string | null> {
  const res = await fetch(`${DROPBOX_CONTENT}/files/download`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Dropbox-API-Arg": JSON.stringify({ path }),
    },
  });
  if (!res.ok) return null;
  return await res.text();
}

export async function dropboxReadBytes(token: string, path: string): Promise<{ bytes: ArrayBuffer; contentType: string } | null> {
  const res = await fetch(`${DROPBOX_CONTENT}/files/download`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Dropbox-API-Arg": JSON.stringify({ path }),
    },
  });
  if (!res.ok) return null;
  const bytes = await res.arrayBuffer();
  const contentType = res.headers.get("content-type") || "application/octet-stream";
  return { bytes, contentType };
}

export async function dropboxWriteText(token: string, path: string, content: string): Promise<boolean> {
  return await dropboxUploadBytes(token, path, toBytes(content));
}

export async function dropboxWriteTextWithDetail(token: string, path: string, content: string): Promise<{ ok: boolean; status: number; detail: string }> {
  await ensureFolder(token, dirname(path));
  const res = await fetch(`${DROPBOX_CONTENT}/files/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
      "Dropbox-API-Arg": JSON.stringify({
        path,
        mode: "overwrite",
        autorename: false,
        mute: true,
        strict_conflict: false,
      }),
    },
    body: toBytes(content),
  });
  const detail = await res.text().catch(() => "");
  return { ok: res.ok, status: res.status, detail };
}

export async function dropboxDeletePath(token: string, path: string): Promise<boolean> {
  const res = await fetch(`${DROPBOX_API}/files/delete_v2`, {
    method: "POST",
    headers: dbxHeaders(token),
    body: JSON.stringify({ path }),
  });
  return res.ok;
}

export async function dropboxListFolder(token: string, path: string): Promise<Array<{ path_display?: string; path_lower?: string; name?: string; ".tag"?: string }>> {
  const res = await fetch(`${DROPBOX_API}/files/list_folder`, {
    method: "POST",
    headers: dbxHeaders(token),
    body: JSON.stringify({ path, recursive: true, include_deleted: false, limit: 2000 }),
  });
  if (!res.ok) return [];
  const raw = await res.json().catch(() => null) as any;
  return Array.isArray(raw?.entries) ? raw.entries : [];
}

export async function dropboxMovePath(token: string, from_path: string, to_path: string): Promise<boolean> {
  const res = await fetch(`${DROPBOX_API}/files/move_v2`, {
    method: "POST",
    headers: dbxHeaders(token),
    body: JSON.stringify({ from_path, to_path, autorename: false, allow_shared_folder: true, allow_ownership_transfer: false }),
  });
  return res.ok;
}

export async function dropboxWriteBytes(token: string, path: string, bytes: ArrayBuffer | Uint8Array): Promise<boolean> {
  return await dropboxUploadBytes(token, path, bytes);
}

export async function dropboxPathExists(token: string, path: string): Promise<boolean> {
  const res = await fetch(`${DROPBOX_API}/files/get_metadata`, {
    method: "POST",
    headers: dbxHeaders(token),
    body: JSON.stringify({ path }),
  });
  return res.ok;
}
