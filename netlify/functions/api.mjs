// Reactor API (Netlify function + Blobs). The Daily Block is refereed here: the page never sees a correct
// answer before it has answered, the clock runs on the server, and the score is computed from the rules
// module, so a doctored page cannot post a score it did not earn.
//
//   POST /api/register        { handle } -> { handle, key }            claim a player name; the key stays on the device
//   POST /api/daily/start     { handle, key } -> { run, day, number, n, score, i, question, servedAt, remainingMs }
//                             starts today's run or resumes the unfinished one; one run per name per day
//   POST /api/daily/lifeline  { run, key, i, lifeline } -> webcall: { ev, title, url } | filter: { remove: [i, j] } | handover: next question
//   POST /api/daily/answer    { run, key, i, answer, stake } -> { correct, reveal, gain, penalty, score, streak, question?, result? }
//   GET  /api/daily/run?run=  -> the finished run (for the result screen)
//   GET  /api/board?which=today|week|all[&day=] -> { rows }
//   GET  /api/me?handle=      -> { handle, total, rank, playedToday, run }
import crypto from 'node:crypto';
import { getStore } from '@netlify/blobs';
import BANK from '../../data/bank.mjs';
import * as R from '../../shared/rules.mjs';

const KEEP = 500, SHOW = 50, SUBMIT_GAP_MS = 2500;
const MIN_HANDLE = 3;
const RESERVED = new Set(['anon', 'admin', 'rialo', 'rialohq', 'subzero', 'reactor', 'system']);
const byId = new Map(BANK.questions.map((q) => [q.id, q]));
const trById = new Map(BANK.tr.map((q) => [q.id, q]));

const json = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra } });
export const cleanHandle = (v) => String(v || '').trim().replace(/^@+/, '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 15);
const hashKey = (k) => crypto.createHash('sha256').update(String(k)).digest('base64url');
const hashIp = (secret, ip) => crypto.createHmac('sha256', secret).update(`ip:${ip || 'unknown'}`).digest('base64url').slice(0, 22);
const safeEqual = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const int = (v) => (Number.isFinite(Number(v)) ? Math.floor(Number(v)) : NaN);
async function readBoard(store, key) { const b = await store.get(key, { type: 'json' }); return b && Array.isArray(b.rows) ? b : { rows: [] }; }

async function auth(store, body) {
  const asked = cleanHandle(body.handle);
  if (asked.length < MIN_HANDLE) return { err: json({ error: 'Pick a player name first.', code: 'noname' }, 401) };
  const user = await store.get(`user/${asked.toLowerCase()}`, { type: 'json' });
  if (!user) return { err: json({ error: 'That name is not registered. Save a name first.', code: 'noname' }, 401) };
  if (!body.key || !safeEqual(user.keyHash, hashKey(body.key))) return { err: json({ error: 'That name belongs to another player. Pick a different one.', code: 'badkey' }, 403) };
  return { user, handle: user.handle, lower: user.handle.toLowerCase() };
}

function serve(run, now) {
  const q = byId.get(run.qids[run.i]);
  const perm = R.permFor(run.day, q.id, R.optionCount(q));
  run.servedAt = now;
  return R.publicView(q, trById.get(q.id), perm, run.day);
}
const remaining = (run, now) => Math.max(0, R.LIMITS[byId.get(run.qids[run.i]).type] * 1000 - (now - run.servedAt));

function resultOf(run) {
  const cells = run.answers.map((a) => (a.skipped ? 'skip' : a.correct ? 'ok' : 'x'));
  return {
    day: run.day, number: R.dailyNumber(run.day), handle: run.handle, score: run.score, cells, line: R.shareLine(cells),
    correct: run.answers.filter((a) => a.correct).length, n: run.qids.length, bestStreak: run.bestStreak, timeMs: run.answers.reduce((s, a) => s + (a.elapsedMs || 0), 0),
    answers: run.answers, finishedAt: run.finishedAt || null,
  };
}

// one question answered or expired: score it, store it, move on
function settle(run, { correct, timeout, skipped, answer, elapsedMs, stake }) {
  const q = byId.get(run.qids[run.i]);
  const perm = R.permFor(run.day, q.id, R.optionCount(q));
  const webcall = !!(run.lifelines.webcall === run.i);
  let gain = 0, penalty = 0;
  if (!skipped) { const p = R.points({ type: q.type, diff: q.diff, correct, stake, streak: run.streak, elapsedMs, webcall, timeout }); gain = p.gain; penalty = p.penalty; }
  run.score = Math.max(0, run.score + gain - penalty);
  if (skipped) { /* handover keeps the streak */ } else if (correct) { run.streak += 1; run.bestStreak = Math.max(run.bestStreak, run.streak); } else run.streak = 0;
  const rev = R.reveal(q, trById.get(q.id), perm, BANK);
  const view = R.publicView(q, trById.get(q.id), perm, run.day);
  run.answers.push({ view, id: q.id, type: q.type, topic: q.topic, diff: q.diff, correct: !!correct, timeout: !!timeout, skipped: !!skipped, answer: answer ?? null, stake, elapsedMs, gain, penalty, webcall, reveal: rev });
  run.i += 1;
  return { correct: !!correct, timeout: !!timeout, skipped: !!skipped, reveal: rev, gain, penalty, score: run.score, streak: run.streak };
}

async function finishRun(store, run, now) {
  run.done = true; run.finishedAt = new Date(now).toISOString();
  const row = { handle: run.handle, score: run.score, correct: run.answers.filter((a) => a.correct).length, streak: run.bestStreak, at: run.finishedAt };
  await upsert(store, `board/daily/${run.day}`, row, false);
  // totals live on the player's record so every player keeps a full history, boards are the top slice
  const uKey = `user/${run.handle.toLowerCase()}`;
  const user = (await store.get(uKey, { type: 'json' })) || { handle: run.handle };
  user.total = (user.total || 0) + run.score; user.played = (user.played || 0) + 1;
  user.weeks = user.weeks || {}; const wk = R.weekKeyOf(Date.parse(run.day + 'T12:00:00Z')); user.weeks[wk] = (user.weeks[wk] || 0) + run.score;
  user.lastDay = run.day;
  await store.setJSON(uKey, user);
  await upsert(store, `board/week/${wk}`, { handle: run.handle, score: user.weeks[wk], days: Object.keys(user.weeks).length, at: run.finishedAt }, true);
  await upsert(store, 'board/all', { handle: run.handle, score: user.total, played: user.played, rank: R.rankFor(user.total), at: run.finishedAt }, true);
  const b = await readBoard(store, `board/daily/${run.day}`);
  run.rank = b.rows.findIndex((r) => r.handle.toLowerCase() === run.handle.toLowerCase()) + 1 || null;
  run.total = user.total;
}
// one row per name; replace=true overwrites (running totals), otherwise keep the better score
async function upsert(store, key, row, replace) {
  const b = await readBoard(store, key), k = row.handle.toLowerCase();
  const i = b.rows.findIndex((r) => r.handle.toLowerCase() === k);
  if (i >= 0) { if (replace || row.score > b.rows[i].score) b.rows[i] = row; } else b.rows.push(row);
  b.rows.sort((x, y) => y.score - x.score || (x.at || '').localeCompare(y.at || ''));
  b.rows = b.rows.slice(0, KEEP);
  await store.setJSON(key, b);
}

export async function handle(req, { store, ip, secret, now = Date.now() }) {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, '');
  const body = async () => { try { return await req.json(); } catch { return null; } };

  if (path.endsWith('/api/register')) {
    if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);
    const b = await body(); if (!b) return json({ error: 'Bad request.' }, 400);
    const handle = cleanHandle(b.handle);
    if (handle.length < MIN_HANDLE) return json({ error: 'Names need 3 to 15 letters, digits or underscores.' }, 400);
    if (RESERVED.has(handle.toLowerCase())) return json({ error: 'That name is reserved. Pick another.' }, 409);
    const uKey = `user/${handle.toLowerCase()}`;
    if (await store.get(uKey, { type: 'json' })) return json({ error: 'That name is taken. Pick another.' }, 409);
    const rlKey = `rl/reg/${hashIp(secret, ip)}`;
    const last = await store.get(rlKey, { type: 'json' });
    if (last && now - last.at < SUBMIT_GAP_MS) return json({ error: 'Slow down a little, then try again.' }, 429);
    await store.setJSON(rlKey, { at: now });
    const key = crypto.randomBytes(24).toString('base64url');
    await store.setJSON(uKey, { handle, keyHash: hashKey(key), at: now, total: 0, played: 0, weeks: {} });
    const again = await store.get(uKey, { type: 'json' });
    if (!again || !safeEqual(again.keyHash, hashKey(key))) return json({ error: 'That name is taken. Pick another.' }, 409);
    return json({ ok: true, handle, key });
  }

  // a name already claimed on another device: the device code proves it is yours
  if (path.endsWith('/api/login')) {
    if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);
    const b = await body(); if (!b) return json({ error: 'Bad request.' }, 400);
    const rlKey = `rl/login/${hashIp(secret, ip)}`;
    const last = await store.get(rlKey, { type: 'json' });
    if (last && now - last.at < SUBMIT_GAP_MS) return json({ error: 'Slow down a little, then try again.' }, 429);
    await store.setJSON(rlKey, { at: now });
    const a = await auth(store, { handle: b.handle, key: String(b.key || '').trim() });
    if (a.err) return json({ error: 'That name and device code do not match.' }, 403);
    return json({ ok: true, handle: a.handle, key: String(b.key).trim() });
  }

  if (path.endsWith('/api/board')) {
    const which = url.searchParams.get('which') || 'today';
    if (which === 'all') return json({ which, rows: (await readBoard(store, 'board/all')).rows.slice(0, SHOW) });
    if (which === 'week') { const wk = R.weekKeyOf(now); return json({ which, week: wk, rows: (await readBoard(store, `board/week/${wk}`)).rows.slice(0, SHOW) }); }
    const day = R.isDay(url.searchParams.get('day')) ? url.searchParams.get('day') : R.dayKeyOf(now);
    return json({ which: 'today', day, number: R.dailyNumber(day), rows: (await readBoard(store, `board/daily/${day}`)).rows.slice(0, SHOW) });
  }

  if (path.endsWith('/api/me')) {
    const h = cleanHandle(url.searchParams.get('handle'));
    const user = h.length >= MIN_HANDLE ? await store.get(`user/${h.toLowerCase()}`, { type: 'json' }) : null;
    if (!user) return json({ error: 'Unknown name.' }, 404);
    const day = R.dayKeyOf(now);
    const ref = await store.get(`daily/${day}/${h.toLowerCase()}`, { type: 'json' });
    const run = ref ? await store.get(`run/${ref.run}`, { type: 'json' }) : null;
    return json({ handle: user.handle, total: user.total || 0, played: user.played || 0, rank: R.rankFor(user.total || 0), next: R.nextRank(user.total || 0), day, number: R.dailyNumber(day), today: run ? { run: ref.run, done: !!run.done, i: run.i, score: run.score, cells: run.answers.map((x) => (x.skipped ? 'skip' : x.correct ? 'ok' : 'x')) } : null });
  }

  if (path.endsWith('/api/daily/run')) {
    const run = await store.get(`run/${String(url.searchParams.get('run') || '').replace(/[^A-Za-z0-9_-]/g, '')}`, { type: 'json' });
    if (!run || !run.done) return json({ error: 'No finished run with that id.' }, 404);
    return json({ ok: true, result: { ...resultOf(run), rank: run.rank || null, total: run.total || 0 } });
  }

  if (path.endsWith('/api/daily/start')) {
    if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);
    const b = await body(); if (!b) return json({ error: 'Bad request.' }, 400);
    const a = await auth(store, b); if (a.err) return a.err;
    const day = R.dayKeyOf(now);
    const refKey = `daily/${day}/${a.lower}`;
    const ref = await store.get(refKey, { type: 'json' });
    let run = ref ? await store.get(`run/${ref.run}`, { type: 'json' }) : null;
    if (run && run.done) return json({ ok: true, done: true, run: ref.run, result: { ...resultOf(run), rank: run.rank || null, total: run.total || 0 } });
    if (!run) {
      const id = crypto.randomBytes(12).toString('base64url');
      run = { id, handle: a.handle, day, qids: R.pickDaily(BANK, day), i: 0, score: 0, streak: 0, bestStreak: 0, answers: [], lifelines: {}, done: false, startedAt: new Date(now).toISOString() };
      await store.setJSON(refKey, { run: id, at: now });
      const again = await store.get(refKey, { type: 'json' });
      if (!again || again.run !== id) return json({ error: 'A run is already open for this name. Reload the page.' }, 409);
      const question = serve(run, now);
      await store.setJSON(`run/${id}`, run);
      return json({ ok: true, run: id, day, number: R.dailyNumber(day), n: run.qids.length, i: 0, score: 0, streak: 0, lifelines: run.lifelines, cells: [], question, remainingMs: R.LIMITS[question.type] * 1000 });
    }
    // resume: an expired question counts as a timeout, then the next one is served
    let settled = null;
    if (now - run.servedAt > R.LIMITS[byId.get(run.qids[run.i]).type] * 1000 + R.GRACE_MS) {
      settled = settle(run, { correct: false, timeout: true, stake: 1, elapsedMs: R.LIMITS[byId.get(run.qids[run.i]).type] * 1000 });
      if (run.i >= run.qids.length) { await finishRun(store, run, now); await store.setJSON(`run/${run.id}`, run); return json({ ok: true, done: true, run: run.id, result: { ...resultOf(run), rank: run.rank, total: run.total } }); }
      serve(run, now); await store.setJSON(`run/${run.id}`, run);
    }
    const q = byId.get(run.qids[run.i]);
    const question = R.publicView(q, trById.get(q.id), R.permFor(run.day, q.id, R.optionCount(q)), run.day);
    return json({ ok: true, run: run.id, day, number: R.dailyNumber(day), n: run.qids.length, i: run.i, score: run.score, streak: run.streak, lifelines: run.lifelines, cells: run.answers.map((x) => (x.skipped ? 'skip' : x.correct ? 'ok' : 'x')), question, remainingMs: remaining(run, now), settled });
  }

  if (path.endsWith('/api/daily/lifeline') || path.endsWith('/api/daily/answer')) {
    if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);
    const b = await body(); if (!b) return json({ error: 'Bad request.' }, 400);
    const runId = String(b.run || '').replace(/[^A-Za-z0-9_-]/g, '');
    const run = await store.get(`run/${runId}`, { type: 'json' });
    if (!run) return json({ error: 'Unknown run. Start today\'s block again.' }, 404);
    const user = await store.get(`user/${run.handle.toLowerCase()}`, { type: 'json' });
    if (!user || !b.key || !safeEqual(user.keyHash, hashKey(b.key))) return json({ error: 'This run belongs to another player.' }, 403);
    if (run.done) return json({ error: 'This block is already finalized.', done: true }, 409);
    if (int(b.i) !== run.i) return json({ error: 'Out of step. Reload the page.', i: run.i }, 409);
    const q = byId.get(run.qids[run.i]);
    const limitMs = R.LIMITS[q.type] * 1000;
    const elapsed = now - run.servedAt;
    const expired = elapsed > limitMs + R.GRACE_MS;

    if (path.endsWith('/api/daily/lifeline')) {
      const kind = String(b.lifeline || '');
      if (!['webcall', 'filter', 'handover'].includes(kind)) return json({ error: 'Unknown lifeline.' }, 400);
      if (run.lifelines[kind] !== undefined) return json({ error: 'That lifeline is already used.' }, 409);
      if (expired) return json({ error: 'Too late for that question.', expired: true }, 409);
      if (kind === 'handover') {
        run.lifelines.handover = run.i;
        const settled = settle(run, { skipped: true, stake: 1, elapsedMs: elapsed });
        if (run.i >= run.qids.length) { await finishRun(store, run, now); await store.setJSON(`run/${run.id}`, run); return json({ ok: true, settled, done: true, result: { ...resultOf(run), rank: run.rank, total: run.total } }); }
        const question = serve(run, now); await store.setJSON(`run/${run.id}`, run);
        return json({ ok: true, settled, i: run.i, question, remainingMs: limitFor(question), lifelines: run.lifelines });
      }
      if (kind === 'filter') {
        if (q.type === 'noise' || q.type === 'order') return json({ error: 'The filter only works on questions with options.' }, 400);
        const perm = R.permFor(run.day, q.id, R.optionCount(q));
        const wrong = perm.map((orig, shown) => (orig === 0 ? -1 : shown)).filter((x) => x >= 0);
        const remove = R.shuffled(wrong, R.hash32(run.id + '|filter')).slice(0, 2);
        run.lifelines.filter = run.i; await store.setJSON(`run/${run.id}`, run);
        return json({ ok: true, remove, lifelines: run.lifelines });
      }
      if (q.type === 'source') return json({ error: 'The webcall would give that one away.' }, 400);
      run.lifelines.webcall = run.i; await store.setJSON(`run/${run.id}`, run);
      const src = BANK.sources[q.file] || {};
      return json({ ok: true, ev: q.ev, title: src.title || '', url: src.url || '', lifelines: run.lifelines });
    }

    // answer
    const stake = [1, 2, 3].includes(int(b.stake)) ? int(b.stake) : 1;
    const perm = R.permFor(run.day, q.id, R.optionCount(q));
    let settled;
    if (expired) settled = settle(run, { correct: false, timeout: true, stake, elapsedMs: limitMs });
    else settled = settle(run, { correct: R.isCorrect(q, b.answer, perm), answer: b.answer, stake, elapsedMs: Math.min(elapsed, limitMs) });
    if (run.i >= run.qids.length) { await finishRun(store, run, now); await store.setJSON(`run/${run.id}`, run); return json({ ok: true, ...settled, done: true, result: { ...resultOf(run), rank: run.rank, total: run.total } }); }
    const question = serve(run, now); await store.setJSON(`run/${run.id}`, run);
    return json({ ok: true, ...settled, i: run.i, question, remainingMs: limitFor(question), cells: run.answers.map((x) => (x.skipped ? 'skip' : x.correct ? 'ok' : 'x')) });
  }

  return json({ error: 'Not found.' }, 404);
}
const limitFor = (question) => R.LIMITS[question.type] * 1000;

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
  const store = getStore({ name: 'reactor-daily', consistency: 'strong' });
  try {
    const env = (k) => (globalThis.Netlify && Netlify.env.get(k)) || process.env[k];
    const secret = await resolveSecret(store, env('RUN_SECRET'));
    return await handle(req, { store, ip: context.ip, secret });
  } catch (e) {
    console.error(e);
    return json({ error: 'The board hit an error. Try again in a moment.' }, 500);
  }
};

export const config = { path: ['/api/register', '/api/login', '/api/board', '/api/me', '/api/daily/start', '/api/daily/lifeline', '/api/daily/answer', '/api/daily/run'] };
