// Reactor engine: a small deterministic model of Rialo's reactive transactions.
//
// A level is a world that unfolds block by block (price feeds, events, API responses) plus a chain state.
// The player writes rules: WHEN a predicate holds, THEN an action runs. At the end of every block the chain
// evaluates every armed rule against that block's signals and state; a rule that holds enqueues its action,
// which executes at the start of the next block (the one block reaction time of a reactive transaction).
// Nothing polls from outside: no keeper, no cron, no bot. The "legacy" run shows the same rules carried out
// by an offchain keeper that observes late and sometimes fails to land, so the player can compare.
//
// Credits stand in for Stake for Service: every action and every API call spends credits; a rule that holds
// with no credits left is skipped, which is exactly how a contract with an empty budget behaves.
(function (root) {
  'use strict';

  // ---------- deterministic rng (mulberry32) ----------
  function rng32(seed) {
    let a = seed >>> 0;
    const f = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    f.get = () => a; return f;
  }

  const OPS = {
    '<': (a, b) => a < b, '>': (a, b) => a > b, '<=': (a, b) => a <= b, '>=': (a, b) => a >= b,
    '==': (a, b) => a === b || String(a) === String(b), '!=': (a, b) => !(a === b || String(a) === String(b)),
  };

  // ---------- signals ----------
  // A level signal is one of:
  //   { kind: 'feed', label, unit, series: [v0, v1, ...] }              value at block b = series[b]
  //   { kind: 'event', label, at: [blocks] }                             present at those blocks
  //   { kind: 'webcall', label, unit, series, latency, cost }           value arrives `latency` blocks after a call, costs credits
  //   { kind: 'state', label, unit, read: (state) => value }             derived from chain state
  function signalValue(level, sig, id, b, state, ctx) {
    if (sig.kind === 'feed') return sig.series[Math.min(b, sig.series.length - 1)];
    if (sig.kind === 'state') return sig.read(state, b, ctx);
    if (sig.kind === 'event') return sig.at.includes(b);
    return undefined;
  }

  // ---------- conditions ----------
  // { kind: 'block', at }                      end of block `at`
  // { kind: 'every', n, from }                 end of every n-th block counted from `from` (default 0), not before `from`
  // { kind: 'event', id }                      the event is present in this block
  // { kind: 'signal', id, op, value }          feed or state value compared; op 'moves' = moved more than value % from the rule's reference
  // { kind: 'webcall', id, every, op, value }  call the API every `every` blocks; the condition holds when a response arrives and compares true
  // { kind: 'fired', card, after }             rule `card` fired `after` blocks ago (after >= 0)
  // { kind: 'dropped', card }                  rule `card`'s last action was dropped by the chain (Gauss handover)
  // An optional `and` holds a second condition of kind 'signal', 'event' or 'state'.
  function evalCondition(cond, ctx, cardIdx) {
    const { level, b, state, fired, calls, dropped, refs } = ctx;
    if (!cond) return false;
    let ok = false;
    switch (cond.kind) {
      case 'block': ok = b === cond.at; break;
      case 'every': { const from = cond.from || 0; ok = b >= from && cond.n > 0 && (b - from) % cond.n === 0; break; }
      case 'event': { const sig = level.signals[cond.id]; ok = !!sig && sig.kind === 'event' && sig.at.includes(b); break; }
      case 'signal': {
        const sig = level.signals[cond.id]; if (!sig) return false;
        const v = signalValue(level, sig, cond.id, b, state, ctx);
        if (cond.op === 'moves') {
          // moved more than value % away from a reference: the level's onchain reference signal when it names one,
          // otherwise the value this rule saw when it last fired
          const key = cardIdx + ':' + cond.id;
          let ref;
          if (sig.movesRef && level.signals[sig.movesRef]) ref = signalValue(level, level.signals[sig.movesRef], sig.movesRef, b, state, ctx);
          else { ref = refs[key]; if (ref == null) { refs[key] = v; return false; } }
          ok = Math.abs(v - ref) / Math.abs(ref || 1) * 100 > cond.value - 1e-9;
          if (ok) refs[key] = v;
        } else ok = !!OPS[cond.op] && OPS[cond.op](v, cond.value);
        break;
      }
      case 'webcall': {
        const sig = level.signals[cond.id]; if (!sig || sig.kind !== 'webcall') return false;
        const r = calls.find(c => c.card === cardIdx && c.id === cond.id && c.arrives === b);
        if (!r) return false;
        ok = OPS[cond.op] ? OPS[cond.op](r.value, cond.value) : true; break;
      }
      case 'fired': { const t = fired[cond.card]; ok = Array.isArray(t) && t.includes(b - (cond.after || 0)); break; }
      case 'dropped': ok = dropped[cond.card] === true; break;
      default: ok = false;
    }
    if (ok && cond.and) {
      const a = cond.and;
      if (a.kind === 'signal') { const sig = level.signals[a.id]; const v = sig ? signalValue(level, sig, a.id, b, state, ctx) : undefined; ok = !!OPS[a.op] && OPS[a.op](v, a.value); }
      else if (a.kind === 'event') { const sig = level.signals[a.id]; ok = !!sig && sig.kind === 'event' && sig.at.includes(b); }
      else ok = false;
    }
    return ok;
  }

  // ---------- the run ----------
  // cards: [{ when, then: { kind, ...params }, mode: 'once' | 'recurring' }]
  // opts: { legacy: bool, seed, scenario }
  function run(level, cards, opts = {}) {
    const scen = level.scenarios ? level.scenarios[opts.scenario || 0] : null;
    const L = scen ? Object.assign({}, level, scen, { signals: Object.assign({}, level.signals, scen.signals || {}) }) : level;
    const rnd = rng32((opts.seed || 1) ^ 0x9e3779b9);
    const state = L.init ? L.init() : {};
    if (L.routing && opts.routing != null) state.routing = Math.max(0, Math.min(100, Number(opts.routing) || 0));
    const trace = [];
    let credits = L.credits == null ? Infinity : L.credits;
    const fired = cards.map(() => []), done = cards.map(() => false), dropped = cards.map(() => false), droppedKind = cards.map(() => null), refs = {};
    const calls = []; // pending webcalls: { card, id, calledAt, arrives, value, cost }
    let queue = []; // actions waiting for the next block: { card, action, at }
    const legacy = !!opts.legacy, lag = L.legacy || { delay: [1, 3], drop: 0.25, congested: [] };
    const goalsAt = {}; let later = [];
    const ctxBase = { level: L, state, fired, calls, dropped, refs, credits: () => credits };

    for (let b = 0; b <= L.blocks; b++) {
      const row = { b, values: {}, events: [], calls: [], fired: [], executed: [], notes: [], credits: 0, epoch: L.epochAt != null && b >= L.epochAt ? 2 : 1 };
      const ctx = Object.assign({}, ctxBase, { b });
      // 1. the world ticks
      if (L.tick) L.tick(state, b, ctx);
      for (const id in L.signals) { const s = L.signals[id]; if (s.kind === 'feed' || s.kind === 'state') row.values[id] = signalValue(L, s, id, b, state, ctx); else if (s.kind === 'event' && s.at.includes(b)) row.events.push(id); }
      // 2. queued actions execute at the start of the block
      const drops = L.dropAt || []; // Gauss: transactions ordered by the old configuration after the handover boundary are not executed
      for (const q of queue) {
        const act = L.actions[q.action.kind];
        if (!act) { row.executed.push({ card: q.card, action: q.action.kind, result: 'rejected', note: 'unknown action' }); continue; }
        const cost = typeof act.cost === 'function' ? act.cost(q.action, state) : (act.cost || 0);
        if (cost > credits) { row.executed.push({ card: q.card, action: q.action.kind, result: 'nocredits', note: 'no credits left' }); continue; }
        if (drops.includes(b)) { dropped[q.card] = true; droppedKind[q.card] = q.action.kind; row.executed.push({ card: q.card, action: q.action.kind, result: 'dropped', note: 'ordered by the old configuration after the handover; not executed' }); continue; }
        const res = act.apply(state, q.action, { b, ctx, card: q.card, rnd });
        if (res && res.rejected) { row.executed.push({ card: q.card, action: q.action.kind, result: 'rejected', note: res.rejected }); continue; }
        credits -= cost; row.credits += cost; dropped[q.card] = false;
        droppedKind.forEach((k, i) => { if (k === q.action.kind) { dropped[i] = false; droppedKind[i] = null; } }); // a resubmission that landed clears the dropped flag it answered
        row.executed.push({ card: q.card, action: q.action.kind, result: 'ok', note: res && res.note || '', params: q.action });
        if (res && res.goal) { goalsAt[res.goal] = goalsAt[res.goal] || []; goalsAt[res.goal].push(b); }
      }
      queue = [];
      // 3. webcall responses arrive, new webcalls go out
      for (const c of calls) if (c.arrives === b) row.calls.push({ card: c.card, id: c.id, value: c.value, arrived: true });
      cards.forEach((card, i) => {
        if (done[i]) return;
        const w = card.when; if (!w || w.kind !== 'webcall') return;
        const sig = L.signals[w.id]; if (!sig || sig.kind !== 'webcall') return;
        const every = Math.max(1, w.every || 1), from = w.from || 0;
        if (b < from || (b - from) % every !== 0) return;
        if (sig.cost > credits) { row.notes.push({ card: i, text: 'API call skipped: no credits' }); return; }
        credits -= sig.cost; row.credits += sig.cost;
        const value = typeof sig.series === 'function' ? sig.series(b, state) : sig.series[Math.min(b, sig.series.length - 1)];
        const arrives = b + (sig.latency || 1);
        calls.push({ card: i, id: w.id, calledAt: b, arrives, value, cost: sig.cost });
        row.calls.push({ card: i, id: w.id, calledAt: b, arrives, arrived: false });
      });
      // 4. end of block: every validator evaluates every armed predicate against the same state
      cards.forEach((card, i) => {
        if (done[i]) return;
        let ok = evalCondition(card.when, ctx, i);
        if (!ok) return;
        fired[i].push(b); row.fired.push({ card: i });
        if (card.mode !== 'recurring') done[i] = true;
        if (legacy) {
          // the keeper sees the block late and may fail to land the transaction under congestion
          const delay = lag.delay[0] + Math.floor(rnd() * (lag.delay[1] - lag.delay[0] + 1));
          const congested = (lag.congested || []).includes(b) || (lag.congested || []).includes(b + delay);
          if (congested && rnd() < lag.drop) { row.notes.push({ card: i, text: 'keeper: transaction dropped in congestion' }); if (card.mode === 'recurring') return; done[i] = false; return; }
          queueLater(b + delay, { card: i, action: card.then, at: b });
        } else queue.push({ card: i, action: card.then, at: b });
      });
      // snapshot
      row.state = L.snapshot ? L.snapshot(state) : JSON.parse(JSON.stringify(state));
      row.creditsLeft = credits;
      trace.push(row);
      if (legacy) flushLater(b);
    }
    // legacy delayed queue helpers (closure over queue)
    function queueLater(at, q) { later.push({ at, q }); }
    function flushLater(b) { const due = later.filter(x => x.at === b + 1); for (const d of due) queue.push(d.q); later = later.filter(x => x.at !== b + 1); }

    const goals = (L.goals || []).map(g => { const r = g.check(state, trace, goalsAt); return { id: g.id, text: g.text, ok: !!(r && r.ok !== false), at: r && r.at != null ? r.at : null, par: g.par != null ? g.par : null, note: r && r.note || '' }; });
    const met = goals.filter(g => g.ok).length, all = goals.length && met === goals.length;
    const used = (L.credits == null ? 0 : L.credits - credits);
    const lateness = goals.reduce((s, g) => s + (g.ok && g.par != null && g.at != null ? Math.max(0, g.at - g.par) : 0), 0);
    let stars = 0;
    if (all) { stars = 1; if (L.creditsPar == null || used <= L.creditsPar) stars = 2; if (stars === 2 && lateness <= (L.latePar || 0) && (!L.extraStar || L.extraStar(state, trace, cards))) stars = 3; }
    const score = Math.round(1000 * (goals.length ? met / goals.length : 0) + (all ? Math.max(0, 300 - lateness * 40) : 0) + (all && isFinite(credits) ? Math.max(0, credits) * 5 : 0));
    return { trace, goals, met, all, stars, score, credits: isFinite(credits) ? credits : null, used, lateness, state, legacy, cards: cards.length };
  }
  const runWrapped = run;

  // run every scenario of a level; the result is the weakest scenario for stars, the sum for score
  function runAll(level, cards, opts = {}) {
    const n = level.scenarios ? level.scenarios.length : 1;
    const runs = []; for (let s = 0; s < n; s++) runs.push(runWrapped(level, cards, Object.assign({}, opts, { scenario: s })));
    const stars = Math.min(...runs.map(r => r.stars)), all = runs.every(r => r.all);
    const score = Math.round(runs.reduce((a, r) => a + r.score, 0) / n);
    return { runs, stars, all, score, met: runs.reduce((a, r) => a + r.met, 0), goals: runs.reduce((a, r) => a + r.goals.length, 0) };
  }

  // validate a card against what the level allows; returns a list of problems (empty when fine)
  function validate(level, card) {
    const p = [];
    const w = card.when, t = card.then;
    if (!w || !w.kind) p.push('pick a trigger');
    else if (!(level.triggers || []).includes(w.kind)) p.push('that trigger is not available here');
    else {
      if ((w.kind === 'signal' || w.kind === 'event' || w.kind === 'webcall') && !level.signals[w.id]) p.push('pick a signal');
      if (w.kind === 'webcall' && (!w.every || w.every < 1)) p.push('set how often to call');
      if (w.kind === 'every' && (!w.n || w.n < 1)) p.push('set the interval');
      if (w.kind === 'signal' && w.op !== 'moves' && !OPS[w.op]) p.push('pick a comparison');
      if (w.kind === 'signal' && (w.value == null || Number.isNaN(Number(w.value)))) p.push('set a value');
    }
    if (!t || !t.kind) p.push('pick an action');
    else if (!level.actions[t.kind]) p.push('that action is not available here');
    else { const a = level.actions[t.kind]; if (a.params) for (const k of a.params) if (t[k] == null || t[k] === '') p.push('set ' + k); }
    return p;
  }

  root.RX = { run: runWrapped, runAll, validate, rng32, evalCondition, OPS };
})(typeof window !== 'undefined' ? window : globalThis);
