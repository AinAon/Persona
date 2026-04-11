import { handleApiRoute } from "./routes_api";
import { handleChat } from "./routes_chat";

export type CorsHeaders = Record<string, string>;

interface KVStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  list?(options?: { prefix?: string; cursor?: string; limit?: number }): Promise<{
    keys?: Array<{ name: string }>;
    list_complete?: boolean;
    cursor?: string;
  }>;
}

interface R2Store {
  get(key: string): Promise<any>;
  put(key: string, value: any, options?: any): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: any): Promise<{ objects?: Array<{ key: string }> }>;
}

export interface Env {
  KV: KVStore;
  R2: R2Store;
  GEMINI_KEY?: string;
  GROK_KEY?: string;
  OPENAI_KEY?: string;
  ANTHROPIC_KEY?: string;
}

const CORS: CorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
      const url = new URL(request.url);

      if (url.pathname === "/chat" && request.method === "POST") {
        const reqBody = await request.json();
        return await handleChat(reqBody, env, CORS);
      }

      const apiResponse = await handleApiRoute(request, env, url, CORS);
      if (apiResponse) return apiResponse;

      return new Response("Not Found", { status: 404, headers: CORS });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || "unknown_error");
      return Response.json({ ok: false, error: message }, { status: 500, headers: CORS });
    }
  },
};
