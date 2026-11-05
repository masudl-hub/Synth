// @vitest-environment node
// A Pages Function runs on Workers, where a request may carry a cookie; a browser-like Request drops it.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WEEKLY_PER_BROWSER, WEEKLY_PER_IP } from '../../../theorem/profile.ts';

const theorem = vi.hoisted(() => ({
  respond: (_request: Request): Promise<Response> => Promise.resolve(new Response('ok')),
  options: [] as unknown[],
}));

vi.mock('@theoremjs/web/server', () => ({
  createMemoryConversationStore: () => ({}),
  createTheoremHandler: (options: unknown) => {
    theorem.options.push(options);
    return (request: Request) => theorem.respond(request);
  },
}));

const { onRequest } = await import('./[[path]].ts');

type Context = Parameters<typeof onRequest>[0];

/** A KV store in memory that keeps what was put and with which expiry. */
const fakeKv = () => {
  const data = new Map<string, string>();
  const ttls = new Map<string, number | undefined>();
  const kv = {
    get: (key: string) => Promise.resolve(data.has(key) ? JSON.parse(data.get(key) ?? 'null') : null),
    put: (key: string, value: string, options?: { expirationTtl?: number }) => {
      data.set(key, value);
      ttls.set(key, options?.expirationTtl);
      return Promise.resolve();
    },
  };
  return { kv: kv as unknown as KVNamespace, data, ttls };
};

const TURN = 'https://synth.test/api/theorem/session/abc/turn';
const VISITOR = 'visitor-0123456789';
const VISITOR_COOKIE = /^synth_visitor=([\w-]+); Path=\/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax$/u;

const call = (
  kv: KVNamespace | undefined,
  {
    url = TURN,
    method = 'POST',
    cookie,
    ip = '203.0.113.7',
  }: { url?: string; method?: string; cookie?: string; ip?: string } = {},
) => {
  const headers = new Headers({ 'cf-connecting-ip': ip });
  if (cookie) {
    headers.set('cookie', cookie);
  }
  const request = new Request(url, { method, headers });
  return onRequest({ request, env: { GEMINI_API_KEY: 'a', GEMINI_API_KEY_B: 'b', QUOTA: kv } } as unknown as Context);
};

const used = (data: Map<string, string>, key: string) => JSON.parse(data.get(key) ?? '{"used":0}').used;

/** A window already filled to the limit, still open for a day. */
const full = (limit: number) => JSON.stringify({ used: limit, resetAt: Date.now() + 86_400_000 });

describe('the Theorem Pages Function', () => {
  beforeEach(() => {
    theorem.respond = () => Promise.resolve(new Response('ok'));
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('builds the handler once, with both keys', async () => {
    await call(undefined);
    await call(undefined);
    expect(theorem.options).toHaveLength(1);
    expect(theorem.options[0]).toEqual(
      expect.objectContaining({ provider: { vault: { gemini: 'a', 'gemini-b': 'b' } } }),
    );
  });

  it('passes through without a quota store, or for anything but a new turn', async () => {
    const respond = vi.fn(() => Promise.resolve(new Response('ok')));
    theorem.respond = respond;
    const { kv, data } = fakeKv();
    expect((await call(undefined)).status).toBe(200);
    await call(kv, { method: 'GET' });
    await call(kv, { url: 'https://synth.test/api/theorem/interface' });
    expect(respond).toHaveBeenCalledTimes(3);
    expect(data.size).toBe(0);
  });

  it('neither counts nor refuses a turn when the quota is off for local work', async () => {
    const respond = vi.fn(() => Promise.resolve(new Response('ok')));
    theorem.respond = respond;
    const { kv, data } = fakeKv();
    data.set('week:ip:203.0.113.7', full(WEEKLY_PER_IP));
    const request = new Request(TURN, { method: 'POST', headers: { 'cf-connecting-ip': '203.0.113.7' } });
    const response = await onRequest({
      request,
      env: { GEMINI_API_KEY: 'a', QUOTA: kv, NO_QUOTA: '1' },
    } as unknown as Context);
    expect(response.status).toBe(200);
    expect(respond).toHaveBeenCalledOnce();
    expect(used(data, 'week:ip:203.0.113.7')).toBe(WEEKLY_PER_IP);
  });

  it('counts an accepted turn against the address and the browser, for a week', async () => {
    const { kv, data, ttls } = fakeKv();
    const response = await call(kv, { cookie: `theme=dark; synth_visitor=${VISITOR}` });
    expect(await response.text()).toBe('ok');
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(used(data, 'week:ip:203.0.113.7')).toBe(1);
    expect(used(data, `week:visitor:${VISITOR}`)).toBe(1);
    expect(ttls.get('week:ip:203.0.113.7')).toBe(7 * 24 * 60 * 60);

    await call(kv, { cookie: `synth_visitor=${VISITOR}` });
    expect(used(data, 'week:ip:203.0.113.7')).toBe(2);
  });

  it('gives a new visitor a cookie, and counts them by it', async () => {
    const { kv, data } = fakeKv();
    const response = await call(kv);
    const cookie = response.headers.get('set-cookie') ?? '';
    const [, visitor] = cookie.match(VISITOR_COOKIE) ?? [];
    expect(visitor).toBeTruthy();
    expect(used(data, `week:visitor:${visitor}`)).toBe(1);
    expect(await response.text()).toBe('ok');
  });

  it('treats a malformed visitor cookie as a new visitor', async () => {
    const { kv } = fakeKv();
    const response = await call(kv, { cookie: 'synth_visitor=short' });
    expect(response.headers.get('set-cookie')).toMatch(VISITOR_COOKIE);
  });

  it('counts a turn without an address under one shared key', async () => {
    const { kv, data } = fakeKv();
    const request = new Request(TURN, { method: 'POST', headers: { cookie: `synth_visitor=${VISITOR}` } });
    await onRequest({ request, env: { GEMINI_API_KEY: 'a', QUOTA: kv } } as unknown as Context);
    expect(used(data, 'week:ip:local')).toBe(1);
  });

  it('refuses a turn once the address has used its week', async () => {
    const respond = vi.fn(() => Promise.resolve(new Response('ok')));
    theorem.respond = respond;
    const { kv, data } = fakeKv();
    data.set('week:ip:203.0.113.7', full(WEEKLY_PER_IP));
    const response = await call(kv, { cookie: `synth_visitor=${VISITOR}` });
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(JSON.stringify(await response.json())).toContain(String(WEEKLY_PER_IP));
    expect(respond).not.toHaveBeenCalled();
    expect(data.has(`week:visitor:${VISITOR}`)).toBe(false);
  });

  it('refuses a turn once the browser has used its week, even from a new address', async () => {
    const respond = vi.fn(() => Promise.resolve(new Response('ok')));
    theorem.respond = respond;
    const { kv, data } = fakeKv();
    data.set(`week:visitor:${VISITOR}`, full(WEEKLY_PER_BROWSER));
    const response = await call(kv, { cookie: `synth_visitor=${VISITOR}`, ip: '198.51.100.1' });
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(await response.json())).toContain(String(WEEKLY_PER_BROWSER));
    expect(respond).not.toHaveBeenCalled();
    expect(data.has('week:ip:198.51.100.1')).toBe(false);
  });

  it('starts a fresh week once the old one has run out', async () => {
    const { kv, data } = fakeKv();
    data.set('week:ip:203.0.113.7', JSON.stringify({ used: WEEKLY_PER_IP, resetAt: Date.now() - 1 }));
    const response = await call(kv, { cookie: `synth_visitor=${VISITOR}` });
    expect(response.status).toBe(200);
    expect(used(data, 'week:ip:203.0.113.7')).toBe(1);
  });

  it('does not count a turn that failed, so the retry is free', async () => {
    theorem.respond = () => Promise.resolve(new Response('lost', { status: 409 }));
    const { kv, data } = fakeKv();
    const response = await call(kv);
    expect(response.status).toBe(409);
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(data.size).toBe(0);
  });
});
