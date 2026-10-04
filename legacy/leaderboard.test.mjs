import test from 'node:test';
import assert from 'node:assert/strict';
import { handle } from '../netlify/functions/leaderboard.mjs';
import { SOLUTIONS } from './levels.test.mjs';

const mem = new Map();
const store = { async get(k) { return mem.has(k) ? JSON.parse(mem.get(k)) : null; }, async setJSON(k, v) { mem.set(k, JSON.stringify(v)); } };
let clock = 1_800_000_000_000;
const call = (path, body, ip = '1.1.1.1', method = body ? 'POST' : 'GET') => handle(new Request('http://x' + path, { method, body: body ? JSON.stringify(body) : undefined, headers: { 'content-type': 'application/json' } }), { store, ip, secret: 's3cret-s3cret-s3cret', now: (clock += 10_000) });
const j = async (r) => ({ status: r.status, body: await r.json() });

test('register a name, post a verified solution, read the boards', async () => {
  let r = await j(await call('/api/register', { handle: 'ecamli' })); assert.equal(r.status, 200); const key = r.body.key;
  r = await j(await call('/api/scores', { handle: 'ecamli', key, stage: 1, cards: SOLUTIONS[1] })); assert.equal(r.status, 200, JSON.stringify(r.body)); assert.equal(r.body.stars, 3); assert.equal(r.body.rank, 1);
  r = await j(await call('/api/scores?stage=1')); assert.equal(r.body.rows[0].handle, 'ecamli'); assert.equal(r.body.rows[0].stars, 3);
  r = await j(await call('/api/scores', { handle: 'ecamli', key, stage: 9, cards: SOLUTIONS[9], routing: 30 })); assert.equal(r.status, 200, JSON.stringify(r.body));
  r = await j(await call('/api/scores?stage=all')); assert.equal(r.body.rows[0].levels, 2);
});

test('the server does not trust the client score: a rule set that fails is refused, a forged score is ignored', async () => {
  let r = await j(await call('/api/register', { handle: 'cheater' }, '2.2.2.2')); const key = r.body.key;
  r = await j(await call('/api/scores', { handle: 'cheater', key, stage: 2, score: 999999, cards: [{ when: { kind: 'block', at: 1 }, then: { kind: 'sell', amount: 'all' }, mode: 'once' }] }, '2.2.2.2')); assert.equal(r.status, 400);
  r = await j(await call('/api/scores', { handle: 'cheater', key, stage: 2, score: 999999, cards: SOLUTIONS[2] }, '2.2.2.2')); assert.equal(r.status, 200); assert.ok(r.body.score < 2000);
  r = await j(await call('/api/scores', { handle: 'cheater', key, stage: 2, cards: [] }, '2.2.2.2')); assert.equal(r.status, 400);
  r = await j(await call('/api/scores', { handle: 'cheater', key: 'wrong', stage: 2, cards: SOLUTIONS[2] }, '2.2.2.2')); assert.equal(r.status, 403);
  r = await j(await call('/api/scores', { handle: 'nobody', key, stage: 2, cards: SOLUTIONS[2] }, '2.2.2.2')); assert.equal(r.status, 401);
});

test('daily board accepts today only and runs the reseeded world', async () => {
  let r = await j(await call('/api/register', { handle: 'dailyone' }, '3.3.3.3')); const key = r.body.key;
  const today = new Date(clock + 10_000).toISOString().slice(0, 10);
  r = await j(await call('/api/scores', { handle: 'dailyone', key, stage: 'daily', day: '2020-01-01', cards: SOLUTIONS[3] }, '3.3.3.3')); assert.equal(r.status, 400);
  // find a rule set that solves today's puzzle: the template decides which solution applies
  globalThis.window = globalThis; await import('../src/engine.js'); await import('../src/levels.js');
  const d = globalThis.RX_LEVELS.daily(today, Math.floor(Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10)) / 86400000));
  let cards = SOLUTIONS[d.id];
  if (d.id === 2) { const stop = +d.goals[0].text.match(/under (\d+)/)[1], rebuy = +d.goals[1].text.match(/under (\d+)/)[1]; cards = [{ when: { kind: 'signal', id: 'eth', op: '<', value: stop }, then: { kind: 'sell', amount: 'all' }, mode: 'once' }, { when: { kind: 'signal', id: 'eth', op: '<', value: rebuy }, then: { kind: 'buy', amount: 10 }, mode: 'once' }]; }
  r = await j(await call('/api/scores', { handle: 'dailyone', key, stage: 'daily', day: today, cards }, '3.3.3.3')); assert.equal(r.status, 200, JSON.stringify(r.body));
  r = await j(await call('/api/scores?stage=daily&day=' + today)); assert.equal(r.body.rows.length, 1);
});

test('rate limit and name rules', async () => {
  let r = await j(await call('/api/register', { handle: 'ab' }, '4.4.4.4')); assert.equal(r.status, 400);
  r = await j(await call('/api/register', { handle: 'rialo' }, '4.4.4.4')); assert.equal(r.status, 409);
  r = await j(await call('/api/register', { handle: 'fine_name' }, '4.4.4.4')); assert.equal(r.status, 200);
  r = await j(await call('/api/register', { handle: 'fine_name' }, '5.5.5.5')); assert.equal(r.status, 409);
});
