import { quotaExhausted } from "@theoremjs/agents";
import { caughtStatus, clientError } from "@theoremjs/agents/host";
import { createMemoryConversationStore, createTheoremHandler } from "@theoremjs/web/server";
import { FALLBACK_KEY_SLOT, KEY_SLOT, synthProfile, WEEKLY_GENERATIONS } from "../../../theorem/profile";

interface Env {
  GEMINI_API_KEY: string;
  GEMINI_API_KEY_B?: string;
  QUOTA?: KVNamespace;
}

type Handler = (request: Request) => Promise<Response>;

let handler: Handler | undefined;

const WEEK_SECONDS = 7 * 24 * 60 * 60;

/** One count per IP, kept for a week from its first generation. */
interface Window { used: number; resetAt: number }

const readWindow = async (kv: KVNamespace, key: string): Promise<Window> => {
  const saved = await kv.get<Window>(key, "json");
  const now = Date.now();
  return saved && saved.resetAt > now ? saved : { used: 0, resetAt: now + WEEK_SECONDS * 1000 };
};

const isGeneration = (request: Request) =>
  request.method === "POST" && new URL(request.url).pathname.split("/").filter(Boolean).at(-1) === "turn";

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  handler ??= createTheoremHandler({
    profile: synthProfile,
    provider: { vault: { [KEY_SLOT]: env.GEMINI_API_KEY, [FALLBACK_KEY_SLOT]: env.GEMINI_API_KEY_B } },
    conversationStore: createMemoryConversationStore(),
  });

  const kv = env.QUOTA;
  if (!kv || !isGeneration(request)) return handler(request);

  const key = `week:${request.headers.get("cf-connecting-ip") ?? "local"}`;
  const window = await readWindow(kv, key);
  if (window.used >= WEEKLY_GENERATIONS) {
    const err = quotaExhausted(synthProfile)!;
    return Response.json(clientError(err, synthProfile.labels), {
      status: caughtStatus(err),
      headers: { "cache-control": "no-store" },
    });
  }

  const response = await handler(request);
  // Only a turn that was accepted counts, so the retry after a lost conversation is free.
  if (response.status < 400) {
    window.used += 1;
    const ttl = Math.max(60, Math.ceil((window.resetAt - Date.now()) / 1000));
    await kv.put(key, JSON.stringify(window), { expirationTtl: ttl });
  }
  return response;
};
