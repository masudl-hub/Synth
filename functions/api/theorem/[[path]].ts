import { quotaExhausted } from '@theoremjs/agents';
import { caughtStatus, clientError } from '@theoremjs/agents/host';
import { createMemoryConversationStore, createTheoremHandler } from '@theoremjs/web/server';
import {
  FALLBACK_KEY_SLOT,
  KEY_SLOT,
  synthProfile,
  WEEKLY_PER_BROWSER,
  WEEKLY_PER_IP,
} from '../../../theorem/profile.ts';

export interface Env {
  GEMINI_API_KEY: string;
  GEMINI_API_KEY_B?: string;
  QUOTA?: KVNamespace;
  /** Set by `npm run dev` only, so local work isn't held to the weekly limit. */
  NO_QUOTA?: string;
}

type Handler = (request: Request) => Promise<Response>;

let handler: Handler | undefined;

const WEEK_SECONDS = 7 * 24 * 60 * 60;
const COOKIE = 'synth_visitor';

/** One count, kept for a week from its first generation. */
interface Window {
  used: number;
  resetAt: number;
}

const readWindow = async (kv: KVNamespace, key: string): Promise<Window> => {
  const saved = await kv.get<Window>(key, 'json');
  const now = Date.now();
  return saved && saved.resetAt > now ? saved : { used: 0, resetAt: now + WEEK_SECONDS * 1000 };
};

const spend = (kv: KVNamespace, key: string, window: Window) => {
  const ttl = Math.max(60, Math.ceil((window.resetAt - Date.now()) / 1000));
  return kv.put(key, JSON.stringify({ ...window, used: window.used + 1 }), { expirationTtl: ttl });
};

const isGeneration = (request: Request) =>
  request.method === 'POST' && new URL(request.url).pathname.split('/').filter(Boolean).at(-1) === 'turn';

const visitorOf = (request: Request) =>
  request.headers.get('cookie')?.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([\\w-]{8,64})`))?.[1];

/** Theorem's own quota refusal, worded with the limit that was hit. */
const refusal = (perWeek: number) => {
  const err = quotaExhausted({ ...synthProfile, guardrails: { quota: { perDay: perWeek } } });
  if (!err) {
    // Only a profile with no quota has no refusal, and this one is given a quota just above.
    throw new Error('A quota refusal needs a quota');
  }
  return Response.json(clientError(err, synthProfile.labels), {
    status: caughtStatus(err),
    headers: { 'cache-control': 'no-store' },
  });
};

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  handler ??= createTheoremHandler({
    profile: synthProfile,
    provider: { vault: { [KEY_SLOT]: env.GEMINI_API_KEY, [FALLBACK_KEY_SLOT]: env.GEMINI_API_KEY_B } },
    conversationStore: createMemoryConversationStore(),
  });

  const kv = env.NO_QUOTA ? undefined : env.QUOTA;
  if (!(kv && isGeneration(request))) {
    return handler(request);
  }

  const existing = visitorOf(request);
  const visitor = existing ?? crypto.randomUUID();
  const ipKey = `week:ip:${request.headers.get('cf-connecting-ip') ?? 'local'}`;
  const visitorKey = `week:visitor:${visitor}`;
  const [ip, browser] = await Promise.all([readWindow(kv, ipKey), readWindow(kv, visitorKey)]);
  if (ip.used >= WEEKLY_PER_IP) {
    return refusal(WEEKLY_PER_IP);
  }
  if (browser.used >= WEEKLY_PER_BROWSER) {
    return refusal(WEEKLY_PER_BROWSER);
  }

  const response = await handler(request);
  // Only a turn that was accepted counts, so the retry after a lost conversation is free.
  if (response.status >= 400) {
    return response;
  }
  await Promise.all([spend(kv, ipKey, ip), spend(kv, visitorKey, browser)]);
  if (existing) {
    return response;
  }

  const tagged = new Response(response.body, response);
  tagged.headers.append('set-cookie', `${COOKIE}=${visitor}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax`);
  return tagged;
};
