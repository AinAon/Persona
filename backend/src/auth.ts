import { createRemoteJWKSet, jwtVerify } from "jose";
import type { Env } from "./index";

const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

export type AuthContext = {
  userId: string;
  sub: string;
  email: string;
  name: string;
  picture: string;
};

export class AuthError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

function parseGoogleClientIds(env: Env): string[] {
  return String(env.GOOGLE_CLIENT_IDS || env.GOOGLE_CLIENT_ID || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function readBearerToken(request: Request): string {
  const header = request.headers.get("Authorization") || "";
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (m) return m[1].trim();
  try {
    const url = new URL(request.url);
    return String(url.searchParams.get("authToken") || "").trim();
  } catch {
    return "";
  }
}

function normalizeUserId(raw: unknown): string {
  const s = String(raw || "").trim().toLowerCase();
  const cleaned = s.replace(/[^a-z0-9_-]/g, "_").replace(/^_+|_+$/g, "");
  return cleaned ? cleaned.slice(0, 80) : "user_default";
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyGoogleIdToken(env: Env, token: string): Promise<AuthContext> {
  const audiences = parseGoogleClientIds(env);
  if (!audiences.length) throw new AuthError("GOOGLE_CLIENT_ID missing", 500);
  if (!token) throw new AuthError("credential required", 400);

  const { payload } = await jwtVerify(token, GOOGLE_JWKS, {
    issuer: GOOGLE_ISSUERS,
    audience: audiences,
  });

  const sub = String(payload.sub || "");
  if (!sub) throw new AuthError("google sub missing", 401);
  const hash = await sha256Hex(`google:${sub}`);
  return {
    userId: normalizeUserId(`google_${hash.slice(0, 24)}`),
    sub,
    email: String(payload.email || ""),
    name: String(payload.name || ""),
    picture: String(payload.picture || ""),
  };
}

export async function getAuthContext(request: Request, env: Env): Promise<AuthContext | null> {
  const token = readBearerToken(request);
  if (!token) return null;
  try {
    return await verifyGoogleIdToken(env, token);
  } catch (error) {
    if (error instanceof AuthError) throw error;
    const message = error instanceof Error ? error.message : String(error || "invalid_token");
    throw new AuthError(`invalid google credential: ${message}`, 401);
  }
}

export function effectiveUserId(auth?: AuthContext | null): string {
  return auth?.userId || "user_default";
}

export function scopedR2Key(userIdRaw: string, keyRaw: string): string {
  const userId = normalizeUserId(userIdRaw);
  const key = String(keyRaw || "").replace(/^\/+/, "");
  if (!key) return key;
  if (userId === "user_default") return key;
  return `users/${userId}/${key}`;
}

export function scopedKvKey(userIdRaw: string, keyRaw: string): string {
  const userId = normalizeUserId(userIdRaw);
  const key = String(keyRaw || "");
  if (!key) return key;
  if (userId === "user_default") return key;
  return `user:${userId}:${key}`;
}

export function unscopedR2Key(userIdRaw: string, keyRaw: string): string {
  const userId = normalizeUserId(userIdRaw);
  const key = String(keyRaw || "").replace(/^\/+/, "");
  const prefix = userId === "user_default" ? "" : `users/${userId}/`;
  return prefix && key.startsWith(prefix) ? key.slice(prefix.length) : key;
}

export function googleAuthConfig(env: Env): { enabled: boolean; clientId: string } {
  const clientId = parseGoogleClientIds(env)[0] || "";
  return { enabled: !!clientId, clientId };
}
