import type { Env } from "./index";

const DROPBOX_API = "https://api.dropboxapi.com/2";
const DROPBOX_CONTENT = "https://content.dropboxapi.com/2";

function dbxHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

type Persona = "riley" | "avery";

function getDropboxAppConfig(env: Env, persona: Persona): { key: string; secret: string; refreshToken: string } {
  const key = String(persona === "riley" ? (env.RILEY_DBX_APP_KEY || "") : (env.AVERY_DBX_APP_KEY || "")).trim();
  const secret = String(persona === "riley" ? (env.RILEY_DBX_APP_SECRET || "") : (env.AVERY_DBX_APP_SECRET || "")).trim();
  const refreshToken = String(persona === "riley" ? (env.RILEY_DBX_REFRESH_TOKEN || "") : (env.AVERY_DBX_REFRESH_TOKEN || "")).trim();
  return { key, secret, refreshToken };
}

function toBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
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
  return String(persona === "riley" ? (env.RILEY_DBX_ACCESS_TOKEN || "") : (env.AVERY_DBX_ACCESS_TOKEN || "")).trim();
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

export async function dropboxWriteText(token: string, path: string, content: string): Promise<boolean> {
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
  return res.ok;
}
