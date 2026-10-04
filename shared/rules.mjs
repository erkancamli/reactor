// Rules shared by the page and the server: how a Daily Block is composed from the bank, how options are
// shuffled, how an answer is judged and how many points it is worth. The server is the referee for the
// Daily Block; the page uses the same functions for Sprint and Atlas, which are played locally.
// Plain ESM; the build strips the `export` keywords when it inlines this file into the page.

export const LAUNCH_DAY = '2026-10-04';          // Daily Block #1
export const DAILY_N = 12;
// slots of a Daily Block: pool name -> count. Pools are defined in pickDaily; hard questions are capped so a
// follower who has not memorised the posts still has a fair block.
export const DAILY_MIX = { easy: 4, mid: 3, hard: 1, noise: 2, order: 1, source: 1 };
export const LIMITS = { mcq: 20, fill: 20, noise: 10, order: 35, source: 25 }; // seconds to answer
export const BASE = { mcq: [100, 150, 200], fill: [100, 150, 200], noise: [80, 100, 120], order: [200, 250, 300], source: [150, 200, 250] };
export const STAKE_PENALTY = { 1: 0, 2: 100, 3: 300 };
export const STREAK_STEP = 0.1, STREAK_MAX = 0.5;  // +10% per consecutive correct answer, up to +50%
export const TIME_BONUS = 0.5;                     // up to +50% for an instant answer
export const WEBCALL_COST = 0.5;                   // the Webcall lifeline halves that question's points
export const GRACE_MS = 2500;                      // network slack accepted after the limit
// ranks cool down as the total grows: a nod to Subzero Labs and to kelvin, Rialo's base unit
export const RANKS = [[0, 'Ambient'], [2000, 'Frost'], [8000, 'Subzero'], [20000, 'Zero Kelvin']];
export const SPRINT_SECONDS = 90;

// ---------- deterministic randomness ----------
export function hash32(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export function rng32(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function shuffled(arr, seed) { const a = arr.slice(), r = rng32(seed); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
// permutation of n options for one question on one day; perm[shownIndex] = originalIndex
export function permFor(day, qid, n) { return shuffled([...Array(n).keys()], hash32(`${day}|${qid}|perm`)); }

// ---------- calendar ----------
export const dayKeyOf = (ms) => new Date(ms).toISOString().slice(0, 10);
export const dayIndex = (day) => Math.round((Date.parse(day + 'T00:00:00Z') - Date.parse(LAUNCH_DAY + 'T00:00:00Z')) / 86400000);
export const dailyNumber = (day) => dayIndex(day) + 1;
export const isDay = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(Date.parse(d + 'T00:00:00Z'));
export const weekKeyOf = (ms) => { const d = new Date(ms); const back = (d.getUTCDay() + 6) % 7; return dayKeyOf(ms - back * 86400000); };

// ---------- daily composition ----------
// Each type pool is permuted once with a fixed seed and the day index walks it, so a question comes back
// only after the whole pool has been used (about a month for the big pool). Nothing to store.
export function pickDaily(bank, day) {
  const d = Math.max(0, dayIndex(day));
  const pools = { easy: [], mid: [], hard: [], noise: [], order: [], source: [] };
  for (const q of bank.questions) {
    if (q.type === 'mcq' || q.type === 'fill') pools[q.diff >= 3 ? 'hard' : q.diff === 2 ? 'mid' : 'easy'].push(q.id);
    else if (q.type === 'noise' && q.diff <= 2) pools.noise.push(q.id);
    else if (q.type === 'order' && q.diff <= 2) pools.order.push(q.id);
    else if (q.type === 'source' && q.diff <= 1) pools.source.push(q.id);
  }
  const out = [];
  for (const [name, n] of Object.entries(DAILY_MIX)) {
    const pool = shuffled(pools[name].sort(), hash32('reactor|pool|' + name));
    if (!pool.length) continue;
    const start = (d * n) % pool.length;
    for (let i = 0; i < Math.min(n, pool.length); i++) out.push(pool[(start + i) % pool.length]);
  }
  const by = new Map(bank.questions.map((q) => [q.id, q]));
  // easy first, then harder; a little day flavoured shuffle inside each difficulty band
  const seeded = shuffled(out, hash32(day + '|order'));
  return seeded.sort((a, b) => by.get(a).diff - by.get(b).diff).slice(0, DAILY_N);
}

// ---------- judging ----------
export function optionCount(q) { return q.type === 'order' ? q.steps.length : q.type === 'noise' ? 0 : q.a.length; }
// answer: mcq/fill/source -> shown index; noise -> boolean; order -> array of shown indices in the player's order
export function isCorrect(q, answer, perm) {
  if (q.type === 'noise') return typeof answer === 'boolean' && answer === q.truth;
  if (q.type === 'order') { if (!Array.isArray(answer) || answer.length !== q.steps.length) return false; const seen = new Set(); for (let i = 0; i < answer.length; i++) { const s = answer[i]; if (!Number.isInteger(s) || s < 0 || s >= perm.length || seen.has(s) || perm[s] !== i) return false; seen.add(s); } return true; }
  return Number.isInteger(answer) && answer >= 0 && answer < perm.length && perm[answer] === 0;
}
export const correctShown = (q, perm) => q.type === 'noise' ? q.truth : q.type === 'order' ? q.steps.map((_, orig) => perm.indexOf(orig)) : perm.indexOf(0);

// points for one answered question
export function points({ type, diff, correct, stake = 1, streak = 0, elapsedMs = 0, webcall = false, timeout = false }) {
  const base = BASE[type][Math.min(3, Math.max(1, diff)) - 1];
  const limit = LIMITS[type] * 1000;
  if (!correct || timeout) return { gain: 0, penalty: STAKE_PENALTY[stake] || 0, base };
  const remaining = Math.max(0, Math.min(1, (limit - elapsedMs) / (limit - 400)));
  let g = base * (1 + TIME_BONUS * remaining) * (1 + Math.min(STREAK_MAX, STREAK_STEP * streak)) * stake;
  if (webcall) g *= WEBCALL_COST;
  return { gain: Math.round(g / 5) * 5, penalty: 0, base };
}
export function rankFor(total) { let r = RANKS[0][1]; for (const [min, name] of RANKS) if (total >= min) r = name; return r; }
export function nextRank(total) { for (const [min, name] of RANKS) if (total < min) return { min, name, left: min - total }; return null; }

// what the page is allowed to see of a daily question before answering
export function publicView(q, qtr, perm, day) {
  const v = { id: q.id, type: q.type, topic: q.topic, diff: q.diff, limit: LIMITS[q.type] };
  if (q.type === 'noise') { v.s = { en: q.s, tr: qtr ? qtr.s : q.s }; return v; }
  v.q = { en: q.q, tr: qtr ? qtr.q : q.q };
  if (q.context) v.context = { en: q.context, tr: (qtr && qtr.context) || q.context };
  if (q.type === 'order') { v.steps = { en: perm.map((i) => q.steps[i]), tr: perm.map((i) => (qtr ? qtr.steps : q.steps)[i]) }; return v; }
  v.a = { en: perm.map((i) => q.a[i]), tr: perm.map((i) => (qtr ? qtr.a : q.a)[i]) };
  return v;
}
// what the page sees after answering
export function reveal(q, qtr, perm, bank) {
  const src = bank.sources[q.file] || {};
  return { correct: correctShown(q, perm), why: { en: q.why, tr: qtr ? qtr.why : q.why }, ev: q.ev, title: src.title || '', url: src.url || '' };
}
// the share card: one cell per question
export function shareLine(cells) { return cells.map((c) => (c === 'ok' ? '▮' : c === 'skip' ? '▯' : '✕')).join(''); }
