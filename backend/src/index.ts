import { handleApiRoute } from "./routes_api";
import { handleChat } from "./routes_chat";

export type CorsHeaders = Record<string, string>;

export interface Env {
  KV: KVNamespace;
  R2: R2Bucket;
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
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    const url = new URL(request.url);

    if (url.pathname === "/chat" && request.method === "POST") {
      const reqBody = await request.json();
      return await handleChat(reqBody, env, CORS);
    }

    const apiResponse = await handleApiRoute(request, env, url, CORS);
    if (apiResponse) return apiResponse;

    return new Response("Not Found", { status: 404, headers: CORS });
  },
};
