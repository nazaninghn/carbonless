// The Next.js auth proxy routes (src/app/api/auth/{logout,refresh}/route.js): what they send to the backend.
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { register } from 'node:module';

// The route files import 'next/server' the way Next's bundler resolves it; plain Node needs the file extension.
register('data:text/javascript,' + encodeURIComponent(`
  export async function resolve(specifier, context, next) {
    return next(specifier === 'next/server' ? 'next/server.js' : specifier, context);
  }`), import.meta.url);
const { NextRequest } = await import('next/server.js');

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = (rel) => import(pathToFileURL(path.join(root, rel)));
const logout = await load('src/app/api/auth/logout/route.js');
const refresh = await load('src/app/api/auth/refresh/route.js');
let passed = 0, failed = 0;
const test = async (name, fn) => { try { await fn(); passed++; } catch (e) { failed++; console.error('✗', name, '\n  ', e.message); } };

const realFetch = globalThis.fetch;
/** Run `fn` with the backend replaced; returns what the route sent. */
async function withBackend(reply, fn) {
  const sent = [];
  globalThis.fetch = async (url, init) => { sent.push({ url: String(url), init }); return typeof reply === 'function' ? reply(url, init) : reply; };
  try { return { result: await fn(), sent }; } finally { globalThis.fetch = realFetch; }
}
const req = (url, { cookie, headers = {} } = {}) => new NextRequest(`http://localhost:3000${url}`, {
  method: 'POST', headers: { ...(cookie ? { cookie } : {}), ...headers },
});
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const deletesRefreshCookie = (res) => /_carbonless_refresh=;/.test(res.headers.get('set-cookie') || '');

await test('logout passes the refresh token (from its HttpOnly cookie) and the access token to the backend, and clears the cookie', async () => {
  const { result, sent } = await withBackend(json(200, { status: 'ok' }), () =>
    logout.POST(req('/api/auth/logout', { cookie: '_carbonless_refresh=REFRESH123', headers: { authorization: 'Bearer ACCESS1' } })));
  assert.equal(sent.length, 1);
  assert.match(sent[0].url, /\/accounts\/logout\/$/);
  assert.equal(sent[0].init.headers.Authorization, 'Bearer ACCESS1');
  assert.deepEqual(JSON.parse(sent[0].init.body), { refresh: 'REFRESH123' });
  assert.equal(result.status, 200);
  assert.ok(deletesRefreshCookie(result));
});
await test('logout without a refresh cookie still signs out and sends no token', async () => {
  const { result, sent } = await withBackend(json(200, {}), () => logout.POST(req('/api/auth/logout')));
  assert.deepEqual(JSON.parse(sent[0].init.body), {});
  assert.equal(result.status, 200);
});
await test('logout clears the cookie even when the backend is unreachable', async () => {
  const { result } = await withBackend(() => { throw new Error('down'); }, () =>
    logout.POST(req('/api/auth/logout', { cookie: '_carbonless_refresh=R' })));
  assert.equal(result.status, 200);
  assert.ok(deletesRefreshCookie(result));
});
await test('refresh forwards the browser-reported activity header, and only when there is one', async () => {
  const ok = json(200, { access: 'A2', refresh: 'R2' });
  const a = await withBackend(ok, () => refresh.POST(req('/api/auth/refresh', { cookie: '_carbonless_refresh=R1', headers: { 'x-user-activity': '12' } })));
  assert.equal(a.sent[0].init.headers['X-User-Activity'], '12');
  assert.deepEqual(JSON.parse(a.sent[0].init.body), { refresh: 'R1' });
  const b = await withBackend(ok, () => refresh.POST(req('/api/auth/refresh', { cookie: '_carbonless_refresh=R1' })));
  assert.equal('X-User-Activity' in b.sent[0].init.headers, false);
});
await test('refresh forwards the attempt id (so a repeat of a lost refresh is recognised), and only when there is one', async () => {
  const ok = json(200, { access: 'A2', refresh: 'R2' });
  const a = await withBackend(ok, () => refresh.POST(req('/api/auth/refresh', { cookie: '_carbonless_refresh=R1', headers: { 'x-refresh-attempt': 'attempt-0123456789abcdef' } })));
  assert.equal(a.sent[0].init.headers['X-Refresh-Attempt'], 'attempt-0123456789abcdef');
  const b = await withBackend(ok, () => refresh.POST(req('/api/auth/refresh', { cookie: '_carbonless_refresh=R1' })));
  assert.equal('X-Refresh-Attempt' in b.sent[0].init.headers, false);
});
await test('refresh: an idle session is reported with its code and the cookie is cleared', async () => {
  const { result } = await withBackend(json(401, { code: 'session_expired' }), () => refresh.POST(req('/api/auth/refresh', { cookie: '_carbonless_refresh=R1' })));
  assert.equal(result.status, 401);
  assert.equal((await result.json()).code, 'session_expired');
  assert.ok(deletesRefreshCookie(result));
});
await test('refresh: any other refusal has no code; a server error is not the end of the session', async () => {
  const other = await withBackend(json(401, { detail: 'x' }), () => refresh.POST(req('/api/auth/refresh', { cookie: '_carbonless_refresh=R1' })));
  assert.equal((await other.result.json()).code, undefined);
  const down = await withBackend(json(503, {}), () => refresh.POST(req('/api/auth/refresh', { cookie: '_carbonless_refresh=R1' })));
  assert.equal(down.result.status, 502);
  assert.equal(deletesRefreshCookie(down.result), false);
});
await test('refresh without a cookie is refused', async () => {
  const { result } = await withBackend(json(200, {}), () => refresh.POST(req('/api/auth/refresh')));
  assert.equal(result.status, 401);
});

console.log(`auth-routes: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
