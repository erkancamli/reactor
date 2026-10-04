import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handle } from '../netlify/functions/api.mjs';
import BANK from '../data/bank.mjs';
import * as R from '../shared/rules.mjs';

const mem = () => { const m = new Map(); return { async get(k) { return m.has(k) ? JSON.parse(m.get(k)) : null; }, async setJSON(k, v) { m.set(k, JSON.stringify(v)); }, m }; };
const byId = new Map(BANK.questions.map((q) => [q.id, q]));
const call = async (store, path, body, now, ip = '1.1.1.1') => {
  const req = new Request('http://x' + path, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {});
  const r = await handle(req, { store, ip, secret: 's3cret-s3cret-s3cret', now });
  return { status: r.status, body: await r.json() };
};
// the test knows the bank, so it can answer every question correctly through the shown permutation
const correctAnswerFor = (view, day) => {
  const q = byId.get(view.id), perm = R.permFor(day, q.id, R.optionCount(q));
  return R.correctShown(q, perm);
};

test('rules: daily set is stable, mixed and ordered by difficulty', () => {
  const a = R.pickDaily(BANK, '2026-10-04'), b = R.pickDaily(BANK, '2026-10-04'), c = R.pickDaily(BANK, '2026-10-05');
  assert.deepEqual(a, b); assert.notDeepEqual(a, c); assert.equal(a.length, 12);
  const types = a.map((id) => byId.get(id).type);
  assert.equal(types.filter((x) => x === 'noise').length, 2); assert.equal(types.filter((x) => x === 'order').length, 1); assert.equal(types.filter((x) => x === 'source').length, 1);
  assert.ok(a.map((id) => byId.get(id).diff).filter((x) => x === 3).length <= 1, 'at most one hard question');
  const diffs = a.map((id) => byId.get(id).diff); assert.deepEqual(diffs, diffs.slice().sort());
  // no repeats across 30 consecutive days for the big pool
  const seen = new Map();
  for (let d = 0; d < 14; d++) for (const id of R.pickDaily(BANK, R.dayKeyOf(Date.parse('2026-10-04T00:00:00Z') + d * 86400000))) if (byId.get(id).type === 'mcq' || byId.get(id).type === 'fill') { assert.ok(!seen.has(id), 'repeat ' + id + ' day ' + d + ' and ' + seen.get(id)); seen.set(id, d); }
});

test('rules: points reward difficulty, speed, streak and stake', () => {
  const base = R.points({ type: 'mcq', diff: 2, correct: true, elapsedMs: 20000 });
  assert.equal(base.gain, 150);
  const fast = R.points({ type: 'mcq', diff: 2, correct: true, elapsedMs: 400 });
  assert.equal(fast.gain, 225);
  const staked = R.points({ type: 'mcq', diff: 2, correct: true, elapsedMs: 20000, stake: 3 });
  assert.equal(staked.gain, 450);
  const wrong = R.points({ type: 'mcq', diff: 2, correct: false, stake: 3 });
  assert.deepEqual([wrong.gain, wrong.penalty], [0, 300]);
  const streak = R.points({ type: 'noise', diff: 1, correct: true, elapsedMs: 10000, streak: 5 });
  assert.equal(streak.gain, 120);
  const webcall = R.points({ type: 'order', diff: 3, correct: true, elapsedMs: 35000, webcall: true });
  assert.equal(webcall.gain, 150);
});

test('rules: judging through a permutation', () => {
  const q = BANK.questions.find((x) => x.type === 'order');
  const perm = R.permFor('2026-10-04', q.id, q.steps.length);
  const shown = R.correctShown(q, perm);
  assert.ok(R.isCorrect(q, shown, perm));
  assert.ok(!R.isCorrect(q, shown.slice().reverse(), perm));
  const m = BANK.questions.find((x) => x.type === 'mcq'), pm = R.permFor('2026-10-04', m.id, 4);
  assert.ok(R.isCorrect(m, pm.indexOf(0), pm)); assert.ok(!R.isCorrect(m, (pm.indexOf(0) + 1) % 4, pm));
  const n = BANK.questions.find((x) => x.type === 'noise');
  assert.ok(R.isCorrect(n, n.truth, [])); assert.ok(!R.isCorrect(n, !n.truth, []));
});

test('api: a perfect daily run with all three lifelines, boards and the one run rule', async () => {
  const store = mem(); let now = Date.parse('2026-10-04T10:00:00Z');
  let r = await call(store, '/api/register', { handle: 'ecamli' }, now);
  assert.equal(r.status, 200); const key = r.body.key;
  r = await call(store, '/api/register', { handle: 'ecamli' }, now + 5000, '2.2.2.2'); assert.equal(r.status, 409);
  r = await call(store, '/api/daily/start', { handle: 'ecamli', key: 'wrong' }, now); assert.equal(r.status, 403);
  r = await call(store, '/api/daily/start', { handle: 'ecamli', key }, now);
  assert.equal(r.status, 200); assert.equal(r.body.number, 1); assert.equal(r.body.i, 0);
  const run = r.body.run, day = r.body.day;
  assert.ok(!('truth' in r.body.question) && !('why' in r.body.question) && !('ev' in r.body.question), 'no answers leak');
  let q = r.body.question, usedFilter = false, usedWebcall = false, usedHandover = false, score = 0, lastGain = 0;
  for (let i = 0; i < 12; i++) {
    now += 1500;
    if (!usedWebcall && q.type !== 'source') { const w = await call(store, '/api/daily/lifeline', { run, key, i, lifeline: 'webcall' }, now); assert.equal(w.status, 200); assert.equal(w.body.ev, byId.get(q.id).ev); usedWebcall = true; }
    if (!usedFilter && (q.type === 'mcq' || q.type === 'fill' || q.type === 'source')) { const f = await call(store, '/api/daily/lifeline', { run, key, i, lifeline: 'filter' }, now); assert.equal(f.status, 200); assert.equal(f.body.remove.length, 2); assert.ok(!f.body.remove.includes(correctAnswerFor(q, day))); usedFilter = true; }
    if (!usedHandover && i === 5) { const h = await call(store, '/api/daily/lifeline', { run, key, i, lifeline: 'handover' }, now); assert.equal(h.status, 200); assert.ok(h.body.settled.skipped); assert.equal(h.body.i, 6); q = h.body.question; usedHandover = true; continue; }
    const stake = i === 2 ? 3 : 1;
    const a = await call(store, '/api/daily/answer', { run, key, i, answer: correctAnswerFor(q, day), stake }, now);
    assert.equal(a.status, 200, JSON.stringify(a.body)); assert.ok(a.body.correct, 'q ' + i + ' judged wrong'); assert.ok(a.body.gain > 0);
    if (i === 2) assert.ok(a.body.gain >= 3 * 100, 'stake tripled'); lastGain = a.body.gain;
    score = a.body.score;
    if (a.body.done) { assert.equal(i, 11); assert.equal(a.body.result.score, score); assert.equal(a.body.result.correct, 11); assert.equal(a.body.result.rank, 1); assert.equal(a.body.result.cells.filter((c) => c === 'skip').length, 1); assert.ok(a.body.result.answers[0].view.q || a.body.result.answers[0].view.s); break; }
    q = a.body.question; assert.equal(a.body.i, i + 1);
  }
  assert.ok(lastGain > 0);
  // one run per day
  r = await call(store, '/api/daily/start', { handle: 'ecamli', key }, now); assert.ok(r.body.done); assert.equal(r.body.result.score, score);
  r = await call(store, '/api/daily/answer', { run, key, i: 12, answer: 0 }, now); assert.equal(r.status, 409);
  // boards
  r = await call(store, '/api/board?which=today', null, now); assert.equal(r.body.rows[0].handle, 'ecamli'); assert.equal(r.body.rows[0].score, score);
  r = await call(store, '/api/board?which=week', null, now); assert.equal(r.body.rows[0].score, score);
  r = await call(store, '/api/board?which=all', null, now); assert.equal(r.body.rows[0].score, score); assert.ok(r.body.rows[0].rank);
  r = await call(store, '/api/me?handle=ecamli', null, now); assert.equal(r.body.total, score); assert.ok(r.body.today.done); assert.equal(r.body.today.cells.length, 12);
  r = await call(store, '/api/daily/run?run=' + run, null, now); assert.equal(r.body.result.score, score);
  // next day: a fresh run, totals add up
  now += 86400000;
  r = await call(store, '/api/daily/start', { handle: 'ecamli', key }, now); assert.equal(r.status, 200); assert.equal(r.body.number, 2); assert.equal(r.body.i, 0);
});

test('api: timeouts, wrong answers with stake, resume after an expired question', async () => {
  const store = mem(); let now = Date.parse('2026-10-06T10:00:00Z');
  const key = (await call(store, '/api/register', { handle: 'late_bird' }, now)).body.key;
  let r = await call(store, '/api/daily/start', { handle: 'late_bird', key }, now);
  const run = r.body.run, day = r.body.day; let q = r.body.question;
  // wrong answer at 3x costs 300 but the score floors at 0
  now += 1000;
  let wrong = correctAnswerFor(q, day); wrong = q.type === 'noise' ? !wrong : q.type === 'order' ? wrong.slice().reverse() : (wrong + 1) % q.a.en.length;
  r = await call(store, '/api/daily/answer', { run, key, i: 0, answer: wrong, stake: 3 }, now);
  assert.equal(r.body.correct, false); assert.equal(r.body.penalty, 300); assert.equal(r.body.score, 0); q = r.body.question;
  // answering far too late counts as a timeout
  now += (R.LIMITS[q.type] + 10) * 1000;
  r = await call(store, '/api/daily/answer', { run, key, i: 1, answer: correctAnswerFor(q, day), stake: 1 }, now);
  assert.equal(r.body.timeout, true); assert.equal(r.body.correct, false); q = r.body.question;
  // out of step index is refused
  r = await call(store, '/api/daily/answer', { run, key, i: 1, answer: 0 }, now); assert.equal(r.status, 409);
  // walk away, come back: the open question expired and the next one is served
  now += (R.LIMITS[q.type] + 20) * 1000;
  r = await call(store, '/api/daily/start', { handle: 'late_bird', key }, now);
  assert.equal(r.status, 200); assert.equal(r.body.i, 3); assert.ok(r.body.settled && r.body.settled.timeout); assert.equal(r.body.cells.length, 3);
  // lifelines cannot be used twice, filter refuses noise and order
  r = await call(store, '/api/daily/lifeline', { run, key, i: 3, lifeline: 'webcall' }, now); assert.equal(r.status, 200);
  r = await call(store, '/api/daily/lifeline', { run, key, i: 3, lifeline: 'webcall' }, now); assert.equal(r.status, 409);
});

test('api: the same name on a second device with the device code', async () => {
  const store = mem(); const now = Date.parse('2026-10-07T10:00:00Z');
  const key = (await call(store, '/api/register', { handle: 'ecamli' }, now)).body.key;
  let r = await call(store, '/api/login', { handle: 'ECAMLI', key: 'nope' }, now, '9.9.9.9'); assert.equal(r.status, 403);
  r = await call(store, '/api/login', { handle: 'ecamli', key: ' ' + key + ' ' }, now + 5000, '9.9.9.9'); assert.equal(r.status, 200); assert.equal(r.body.handle, 'ecamli'); assert.equal(r.body.key, key);
  r = await call(store, '/api/daily/start', { handle: 'ecamli', key: r.body.key }, now + 6000); assert.equal(r.status, 200);
});
