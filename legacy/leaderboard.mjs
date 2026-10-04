// Reactor leaderboard API (Netlify Functions v2 + Netlify Blobs).
//
//   POST /api/register -> { handle, key }   claims a player name; the key stays on the device and signs its posts
//   GET  /api/scores?stage=n            -> top rows of level n (1 to 10), best score per name
//   GET  /api/scores?stage=all          -> overall: best score per level added up, with the level count
//   GET  /api/scores?stage=daily[&day=] -> the daily puzzle board for that UTC day
//   POST /api/scores { handle, key, stage, day?, cards, routing? } -> { ok, improved, rank, best, score, stars }
//
// Nothing about the score is trusted from the client: the server runs the same engine on the submitted rules
// and posts the score it computes. A rule set is a few dozen bytes, so the whole proof travels with the post.
import { getStore } from '@netlify/blobs';
import crypto from 'node:crypto';
import '../../src/engine.js';
import '../../src/levels.js';
const RX = globalThis.RX, LV = globalThis.RX_LEVELS;

const KEEP = 200, SHOW = 50, SUBMIT_GAP_MS = 4000, MIN_HANDLE = 3;
const dayKeyOf = (ms) => new Date(ms).toISOString().slice(0, 10);
const dayIndex = (d) => Math.floor(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86400000);
const isDay = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(dayIndex(d));
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
export const cleanHandle = (v) => String(v || '').trim().replace(/^@+/, '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 15);
const hashIp = (secret, ip) => crypto.createHmac('sha256', secret).update(`ip:${ip || 'unknown'}`).digest('base64url').slice(0, 22);
const hashKey = (k) => crypto.createHash('sha256').update(String(k)).digest('base64url');
const safeEqual = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const RESERVED = new Set(['anon', 'admin', 'rialo', 'subzero', 'reactor']);
const int = (v) => (Number.isFinite(Number(v)) ? Math.floor(Number(v)) : NaN);
const boardKeyOf = (id) => `board/level/${id}`;

async function readBoard(store, key) { const b = await store.get(key, { type: 'json' }); return b && Array.isArray(b.rows) ? b : { rows: [] }; }
export async function overall(store) {
  const boards = await Promise.all(LV.LEVELS.map((l) => readBoard(store, boardKeyOf(l.id))));
  const by = new Map();
  for (const b of boards) for (const r of b.rows) { const k = r.handle.toLowerCase(); const o = by.get(k) || { handle: r.handle, score: 0, levels: 0, stars: 0, at: r.at }; o.score += r.score; o.levels += 1; o.stars += r.stars || 0; if (r.at > o.at) o.at = r.at; by.set(k, o); }
  return [...by.values()].sort((x, y) => y.score - x.score || y.levels - x.levels || x.at.localeCompare(y.at));
}
async function upsertBest(store, boardKey, row) {
  const b = await readBoard(store, boardKey), key = row.handle.toLowerCase();
  const i = b.rows.findIndex((r) => r.handle.toLowerCase() === key), prev = i >= 0 ? b.rows[i] : null;
  let improved = false;
  if (!prev || row.score > prev.score) { if (i >= 0) b.rows[i] = row; else b.rows.push(row); b.rows.sort((x, y) => y.score - x.score || y.stars - x.stars || x.at.localeCompare(y.at)); b.rows = b.rows.slice(0, KEEP); await store.setJSON(boardKey, b); improved = true; }
  const rank = b.rows.findIndex((r) => r.handle.toLowerCase() === key) + 1;
  return { improved, rank, best: rank ? b.rows[rank - 1].score : row.score };
}

// a submitted rule set, sanitised to the shape the engine expects
function cleanCards(v) {
  if (!Array.isArray(v) || v.length > 6) return null;
  const out = [];
  for (const c of v) {
    if (!c || typeof c !== 'object' || !c.when || !c.then) return null;
    const w = c.when, t = c.then; const num = (x) => (x == null || x === '' ? null : Number.isFinite(Number(x)) ? Number(x) : (typeof x === 'string' && x.length <= 24 ? x : null));
    const when = { kind: String(w.kind || '').slice(0, 12) };
    for (const k of ['id', 'op']) if (w[k] != null) when[k] = String(w[k]).slice(0, 24);
    for (const k of ['at', 'n', 'from', 'every', 'after', 'card', 'value']) if (w[k] != null) when[k] = num(w[k]);
    if (w.and && typeof w.and === 'object') { const a = w.and; when.and = { kind: String(a.kind || '').slice(0, 12) }; for (const k of ['id', 'op']) if (a[k] != null) when.and[k] = String(a[k]).slice(0, 24); if (a.value != null) when.and.value = num(a.value); }
    const then = { kind: String(t.kind || '').slice(0, 16) };
    for (const k of Object.keys(t)) if (k !== 'kind' && k.length <= 16) then[k] = num(t[k]);
    out.push({ when, then, mode: c.mode === 'recurring' ? 'recurring' : 'once' });
  }
  return out;
}

export async function handle(req, { store, ip, secret, now = Date.now() }) {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, '');

  if (path.endsWith('/api/register')) {
    if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);
    let body; try { body = await req.json(); } catch { return json({ error: 'Bad request.' }, 400); }
    const handle = cleanHandle(body.handle);
    if (handle.length < MIN_HANDLE) return json({ error: 'Names need 3 to 15 letters, digits or underscores.' }, 400);
    if (RESERVED.has(handle.toLowerCase())) return json({ error: 'That name is reserved. Pick another.' }, 409);
    const rlKey = `rl/reg/${hashIp(secret, ip)}`;
    const last = await store.get(rlKey, { type: 'json' });
    if (last && now - last.at < SUBMIT_GAP_MS) return json({ error: 'Slow down a little, then try again.' }, 429);
    await store.setJSON(rlKey, { at: now });
    const uKey = `user/${handle.toLowerCase()}`;
    if (await store.get(uKey, { type: 'json' })) return json({ error: 'That name is taken. Pick another.' }, 409);
    const key = crypto.randomBytes(24).toString('base64url');
    await store.setJSON(uKey, { handle, keyHash: hashKey(key), at: now });
    const again = await store.get(uKey, { type: 'json' });
    if (!again || !safeEqual(again.keyHash, hashKey(key))) return json({ error: 'That name is taken. Pick another.' }, 409);
    return json({ ok: true, handle, key });
  }

  if (!path.endsWith('/api/scores')) return json({ error: 'Not found.' }, 404);

  if (req.method === 'GET') {
    const which = url.searchParams.get('stage');
    if (which === 'all') return json({ stage: 'all', rows: (await overall(store)).slice(0, SHOW) });
    if (which === 'daily') { const day = isDay(url.searchParams.get('day')) ? url.searchParams.get('day') : dayKeyOf(now); const b = await readBoard(store, `board/daily/${day}`); return json({ stage: 'daily', day, rows: b.rows.slice(0, SHOW) }); }
    const id = int(which); const lv = LV.LEVELS.find((l) => l.id === id); if (!lv) return json({ error: 'Unknown level.' }, 400);
    const b = await readBoard(store, boardKeyOf(id));
    return json({ stage: id, rows: b.rows.slice(0, SHOW) });
  }
  if (req.method !== 'POST') return json({ error: 'Use GET or POST.' }, 405);

  let body; try { body = await req.json(); } catch { return json({ error: 'Bad request.' }, 400); }
  const asked = cleanHandle(body.handle);
  if (asked.length < MIN_HANDLE) return json({ error: 'Pick a player name first.' }, 401);
  const user = await store.get(`user/${asked.toLowerCase()}`, { type: 'json' });
  if (!user) return json({ error: 'That name is not registered. Save a name first.' }, 401);
  if (!body.key || !safeEqual(user.keyHash, hashKey(body.key))) return json({ error: 'That name belongs to another player. Pick a different one.' }, 403);
  const handle = user.handle;

  // which puzzle
  const daily = body.stage === 'daily';
  let lv, day = null;
  if (daily) { day = body.day; const today = dayKeyOf(now), yesterday = dayKeyOf(now - 86400000); if (!isDay(day) || (day !== today && day !== yesterday)) return json({ error: 'That daily puzzle is over. Play today\'s.' }, 400); lv = LV.daily(day, dayIndex(day)); }
  else { const id = int(body.stage); lv = LV.LEVELS.find((l) => l.id === id); if (!lv) return json({ error: 'Unknown level.' }, 400); }

  // the proof: the rules themselves. The server runs them.
  const cards = cleanCards(body.cards);
  if (!cards || cards.length === 0 || cards.length > lv.maxCards) return json({ error: 'That rule set does not fit the level.' }, 400);
  for (const c of cards) if (RX.validate(lv, c).length) return json({ error: 'A rule in that set is not valid for the level.' }, 400);
  const routing = lv.routing ? Math.max(0, Math.min(100, Number(body.routing) || 0)) : undefined;
  let res; try { res = RX.runAll(lv, cards, { routing }); } catch (e) { return json({ error: 'Those rules could not be run.' }, 400); }
  if (!res.all) return json({ error: 'That rule set does not solve the puzzle.' }, 400);

  const rlKey = `rl/${hashIp(secret, ip)}`;
  const last = await store.get(rlKey, { type: 'json' });
  if (last && now - last.at < SUBMIT_GAP_MS) return json({ error: 'Slow down a little, then try again.' }, 429);
  await store.setJSON(rlKey, { at: now });

  const row = { handle, score: res.score, stars: res.stars, rules: cards.length, at: new Date(now).toISOString() };
  const r = await upsertBest(store, daily ? `board/daily/${day}` : boardKeyOf(lv.id), row);
  return json({ ok: true, stage: daily ? 'daily' : lv.id, day, handle, improved: r.improved, rank: r.rank || null, best: r.best, score: res.score, stars: res.stars });
}

let cachedSecret = null;
export async function resolveSecret(store, envSecret) {
  if (envSecret && envSecret.length >= 16) return envSecret;
  if (cachedSecret) return cachedSecret;
  const saved = await store.get('config/secret', { type: 'json' });
  if (saved && typeof saved.v === 'string' && saved.v.length >= 32) return (cachedSecret = saved.v);
  const v = crypto.randomBytes(32).toString('base64url');
  await store.setJSON('config/secret', { v, at: Date.now() });
  const again = await store.get('config/secret', { type: 'json' });
  return (cachedSecret = (again && again.v) || v);
}

export default async (req, context) => {
  const store = getStore({ name: 'reactor', consistency: 'strong' });
  try {
    const env = (k) => (globalThis.Netlify && Netlify.env.get(k)) || process.env[k];
    const secret = await resolveSecret(store, env('RUN_SECRET'));
    return await handle(req, { store, ip: context.ip, secret });
  } catch (e) { console.error(e); return json({ error: 'The board hit an error. Try again in a moment.' }, 500); }
};
export const config = { path: ['/api/scores', '/api/register'] };
