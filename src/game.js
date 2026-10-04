// Reactor arcade: the world throws events at you block by block. You are the keeper bot: tap the right cards in
// time, do not tap the decoys, survive congestion. Earn credits, install a rule, and watch the chain handle
// that event type by itself from then on. Pure simulation, no DOM: the page drives it and draws it.
(function (root) {
  'use strict';

  // ---------- content ----------
  // event types: id, label (what the card says), action (what tapping does), decoy variants say why tapping is wrong
  const LEVELS = [
    {
      id: 1, key: 'nightshift', name: 'Night shift', blocks: 30, blockMs: 1250, startCredits: 10,
      src: { label: 'Introducing Rialo: A Blockchain Built for the Real World', url: 'https://www.rialo.io/posts/introducing-rialo' },
      intro: 'You are the keeper bot tonight. Rewards pile up, a presale opens at block 12, and the network gets busy right then. Tap a card to send the transaction. Decoys are traps. Earn credits and install a rule: the chain then handles that event by itself.',
      congestion: [[11, 16]], latency: 0.35, congestedLatency: 2.6,
      types: {
        claim: { label: 'Rewards ready: {v} RLO', action: 'Claim', decoyLabel: 'Rewards: {v} RLO, under 6', decoyWhy: 'nothing worth claiming yet', color: '#f2b84b' },
        presale: { label: 'Presale is open', action: 'Buy 100 tokens', decoyLabel: 'Presale opens soon', decoyWhy: 'the presale is not open', color: '#9fd3e8', critical: true },
      },
      events: [
        { at: 3, type: 'claim', v: 8, window: 3 }, { at: 6, type: 'claim', v: 3, window: 2, decoy: true }, { at: 8, type: 'claim', v: 9, window: 3 },
        { at: 10, type: 'presale', window: 2, decoy: true }, { at: 12, type: 'presale', window: 3.6 },
        { at: 13.5, type: 'claim', v: 7, window: 3 }, { at: 17, type: 'claim', v: 4, window: 2, decoy: true }, { at: 19, type: 'claim', v: 11, window: 3 },
        { at: 22, type: 'claim', v: 2, window: 2, decoy: true }, { at: 24, type: 'claim', v: 8, window: 3 }, { at: 27, type: 'claim', v: 9, window: 2.5 },
      ],
      rules: [
        { id: 'r_claim', type: 'claim', label: 'When rewards reach 6 RLO, claim', cost: 20 },
        { id: 'r_presale', type: 'presale', label: 'When the presale opens, buy 100', cost: 25 },
      ],
      goals: [
        { id: 'presale', text: 'Buy into the presale while it is open', check: (s) => s.landedByType.presale >= 1 },
        { id: 'nomiss', text: 'Miss no reward and tap no decoy', check: (s) => s.missed === 0 && s.rejected === 0 },
        { id: 'rule', text: 'Install at least one rule and let the chain react', check: (s) => s.automated >= 1 },
      ],
    },
  ];

  function rng32(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // ---------- simulation ----------
  function newRun(level) {
    return {
      level, t: 0, done: false, credits: level.startCredits, score: 0, combo: 0, maxCombo: 0,
      cards: level.events.map((e, i) => ({ id: i, ...e, status: 'waiting', landAt: null, resolvedAt: null, auto: false })),
      installed: {}, landed: 0, missed: 0, rejected: 0, automated: 0, landedByType: {}, log: [], gasWasted: 0,
    };
  }
  const congested = (run, t) => run.level.congestion.some(([a, b]) => t >= a && t < b);
  const latencyAt = (run, t) => (congested(run, t) ? run.level.congestedLatency : run.level.latency);
  const deadline = (c) => c.at + c.window;

  function tap(run, cardId) {
    const c = run.cards.find(x => x.id === cardId); if (!c || run.done) return null;
    if (c.status !== 'active') return null;
    const t = run.t;
    if (c.decoy) { c.status = 'rejected'; c.resolvedAt = t; run.rejected++; run.combo = 0; run.score = Math.max(0, run.score - 50); run.credits = Math.max(0, run.credits - 3); run.gasWasted += 3; run.log.push({ t, kind: 'rejected', card: c.id, why: run.level.types[c.type].decoyWhy }); return 'rejected'; }
    c.status = 'sent'; c.sentAt = t; c.landAt = t + latencyAt(run, t); run.log.push({ t, kind: 'sent', card: c.id, lands: c.landAt });
    return 'sent';
  }
  function install(run, ruleId) {
    const r = run.level.rules.find(x => x.id === ruleId); if (!r || run.done || run.installed[r.type]) return false;
    if (run.credits < r.cost) return false;
    run.credits -= r.cost; run.installed[r.type] = r; run.log.push({ t: run.t, kind: 'installed', rule: r.id });
    return true;
  }
  // advance to time t (in blocks); resolves spawns, landings, misses, automation
  function advance(run, t) {
    if (run.done) return;
    const L = run.level; const prev = run.t; run.t = t;
    for (const c of run.cards) {
      if (c.status === 'waiting' && t >= c.at) { c.status = 'active'; c.shownAt = t; }
      if (c.status === 'active') {
        // a rule covers this type: the chain evaluates the predicate at the end of the block the event appeared in
        const rule = run.installed[c.type];
        if (rule) { const blockEnd = Math.floor(c.at) + 1; if (t >= blockEnd) { if (c.decoy) { c.status = 'ignored'; c.resolvedAt = t; c.auto = true; run.log.push({ t, kind: 'ignored', card: c.id }); } else { resolveLanded(run, c, t, true); } continue; } }
        if (t >= deadline(c)) { if (c.decoy) { c.status = 'expired'; c.resolvedAt = t; continue; } c.status = 'missed'; c.resolvedAt = t; run.missed++; run.combo = 0; const crit = !!L.types[c.type].critical; run.score = Math.max(0, run.score - (crit ? 300 : 80)); run.log.push({ t, kind: 'missed', card: c.id, critical: crit }); }
      } else if (c.status === 'sent') {
        if (t >= c.landAt) { if (c.landAt <= deadline(c)) resolveLanded(run, c, t, false); else { c.status = 'late'; c.resolvedAt = t; run.missed++; run.combo = 0; const crit = !!L.types[c.type].critical; run.score = Math.max(0, run.score - (crit ? 300 : 80)); run.log.push({ t, kind: 'late', card: c.id, critical: crit }); } }
      }
    }
    if (t >= L.blocks) { run.done = true; run.t = L.blocks; finish(run); }
  }
  function resolveLanded(run, c, t, auto) {
    c.status = 'landed'; c.resolvedAt = t; c.auto = auto;
    run.landed++; run.landedByType[c.type] = (run.landedByType[c.type] || 0) + 1;
    if (auto) run.automated++;
    run.combo = Math.min(5, run.combo + 1); run.maxCombo = Math.max(run.maxCombo, run.combo);
    const gain = (auto ? 150 : 100) * run.combo; run.score += gain; run.credits += 10;
    run.log.push({ t, kind: auto ? 'auto' : 'landed', card: c.id, gain });
  }
  function finish(run) {
    const L = run.level;
    run.goals = L.goals.map(g => ({ id: g.id, text: g.text, ok: !!g.check(run) }));
    run.stars = run.goals.filter(g => g.ok).length;
  }

  root.RXA = { LEVELS, newRun, advance, tap, install, congested, latencyAt, deadline, rng32 };
})(typeof window !== 'undefined' ? window : globalThis);
