import type { Env } from "./index";

const DROPBOX_API = "https://api.dropboxapi.com/2";
const DROPBOX_CONTENT = "https://content.dropboxapi.com/2";

function dbxHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
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

export function getPersonaDropboxToken(env: Env, persona: "riley" | "avery"): string {
  return String(persona === "riley" ? (env.RILEY_DBX_ACCESS_TOKEN || "") : (env.AVERY_DBX_ACCESS_TOKEN || "")).trim();
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
