// Every campaign level must be solvable for three stars with its reference solution, and a wrong or empty
// rule set must fail. The reference solutions double as documentation of what each level teaches.
import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.window = globalThis;
await import('../src/engine.js'); await import('../src/levels.js');
const { RX, RX_LEVELS } = globalThis;
const L = (id) => RX_LEVELS.LEVELS.find(l => l.id === id);

export const SOLUTIONS = {
  1: [{ when: { kind: 'event', id: 'presale' }, then: { kind: 'buy', amount: 100 }, mode: 'once' }, { when: { kind: 'every', n: 8, from: 0 }, then: { kind: 'claim' }, mode: 'recurring' }],
  2: [{ when: { kind: 'signal', id: 'eth', op: '<', value: 1800 }, then: { kind: 'sell', amount: 'all' }, mode: 'once' }, { when: { kind: 'signal', id: 'eth', op: '<', value: 1600 }, then: { kind: 'buy', amount: 10 }, mode: 'once' }],
  3: [{ when: { kind: 'webcall', id: 'rain', every: 4, from: 0, op: '>', value: 50 }, then: { kind: 'payout', amount: 200 }, mode: 'once' }],
  4: [{ when: { kind: 'signal', id: 'aapl', op: 'moves', value: 0.5 }, then: { kind: 'publish' }, mode: 'recurring' }],
  5: [{ when: { kind: 'signal', id: 'ratio', op: '<', value: 120 }, then: { kind: 'partial' }, mode: 'recurring' }],
  6: [{ when: { kind: 'webcall', id: 'judge', every: 2, from: 0, op: '==', value: 'pass' }, then: { kind: 'pay' }, mode: 'once' }, { when: { kind: 'block', at: 12, and: { kind: 'signal', id: 'status', op: '==', value: 'waiting' } }, then: { kind: 'refund' }, mode: 'once' }],
  7: [{ when: { kind: 'every', n: 5, from: 4 }, then: { kind: 'coupon' }, mode: 'recurring' }, { when: { kind: 'signal', id: 'missed', op: '>', value: 0 }, then: { kind: 'escalate' }, mode: 'once' }],
  8: [{ when: { kind: 'webcall', id: 'policy', every: 4, from: 0, op: '==', value: 'pass' }, then: { kind: 'approve' }, mode: 'recurring' }, { when: { kind: 'fired', card: 0, after: 0 }, then: { kind: 'pay' }, mode: 'recurring' }],
  9: [{ when: { kind: 'every', n: 4, from: 4 }, then: { kind: 'publish' }, mode: 'recurring' }, { when: { kind: 'every', n: 6, from: 4 }, then: { kind: 'rebalance' }, mode: 'recurring' }, { when: { kind: 'every', n: 10, from: 4 }, then: { kind: 'claim' }, mode: 'recurring' }],
  10: [{ when: { kind: 'block', at: 14 }, then: { kind: 'settle' }, mode: 'once' }, { when: { kind: 'dropped', card: 0 }, then: { kind: 'settle' }, mode: 'recurring' }],
};
const OPTS = { 9: { routing: 30 } };

for (const lv of RX_LEVELS.LEVELS) {
  test(`level ${lv.id} ${lv.name}: reference solution earns three stars`, () => {
    const r = RX.runAll(lv, SOLUTIONS[lv.id], OPTS[lv.id] || {});
    const detail = r.runs.map(x => x.goals.map(g => `${g.id}:${g.ok ? 'ok' : 'FAIL'}@${g.at}/${g.par} ${g.note}`).join(' | ') + ` used ${x.used} late ${x.lateness}`).join(' || ');
    assert.equal(r.stars, 3, detail);
    for (const c of SOLUTIONS[lv.id]) assert.deepEqual(RX.validate(lv, c), [], 'solution card must validate');
    assert.ok((SOLUTIONS[lv.id].length) <= lv.maxCards, 'solution fits the card limit');
  });
  test(`level ${lv.id}: no rules means no stars`, () => {
    const r = RX.runAll(lv, [], OPTS[lv.id] || {});
    assert.equal(r.stars, 0);
  });
}

test('level 2: a late stop loss gets one star less', () => {
  const cards = [{ when: { kind: 'signal', id: 'eth', op: '<', value: 1700 }, then: { kind: 'sell', amount: 'all' }, mode: 'once' }, SOLUTIONS[2][1]];
  const r = RX.runAll(L(2), cards);
  assert.equal(r.runs[0].goals[0].ok, false);
});

test('level 3: polling every block runs out of credits before the storm', () => {
  const cards = [{ when: { kind: 'webcall', id: 'rain', every: 1, from: 0, op: '>', value: 50 }, then: { kind: 'payout', amount: 200 }, mode: 'once' }];
  const r = RX.run(L(3), cards);
  assert.equal(r.all, false);
  assert.ok(r.trace.some(t => t.notes.some(n => /no credits/.test(n.text))));
});

test('level 4: publishing every block breaks the thrift goal', () => {
  const r = RX.run(L(4), [{ when: { kind: 'every', n: 1, from: 0 }, then: { kind: 'publish' }, mode: 'recurring' }]);
  assert.equal(r.goals[1].ok, false);
});

test('level 5: closing the position fails the alive goal', () => {
  const r = RX.run(L(5), [{ when: { kind: 'signal', id: 'ratio', op: '<', value: 120 }, then: { kind: 'close' }, mode: 'once' }]);
  assert.equal(r.goals[2].ok, false);
});

test('level 6: refunding without the status guard fails the delivery scenario', () => {
  const cards = [SOLUTIONS[6][0], { when: { kind: 'block', at: 12 }, then: { kind: 'refund' }, mode: 'once' }];
  const r = RX.runAll(L(6), cards);
  assert.equal(r.runs[0].all, false); assert.equal(r.runs[1].all, true);
});

test('level 8: paying on a schedule without the check pays a flagged recipient', () => {
  const r = RX.run(L(8), [{ when: { kind: 'every', n: 4, from: 2 }, then: { kind: 'pay' }, mode: 'recurring' }]);
  assert.equal(r.goals[1].ok, false);
});

test('level 9: a thin routing fraction misses jobs, a fat one keeps too little', () => {
  assert.equal(RX.runAll(L(9), SOLUTIONS[9], { routing: 10 }).all, false);
  const fat = RX.runAll(L(9), SOLUTIONS[9], { routing: 80 });
  assert.equal(fat.runs[0].goals[1].ok, false);
});

test('level 10: a settle without a retry rule is dropped at the handover', () => {
  const r = RX.run(L(10), [SOLUTIONS[10][0]]);
  assert.equal(r.all, false);
  assert.ok(r.trace[15].executed.some(e => e.result === 'dropped'));
  const full = RX.run(L(10), SOLUTIONS[10]);
  assert.equal(full.state.settlements, 1);
  assert.ok(full.trace.slice(18).every(t => t.executed.length === 0), 'the retry rule stops once the resubmission lands');
});

test('legacy keeper is slower or fails on level 2 for most seeds', () => {
  let worse = 0;
  for (let seed = 1; seed <= 20; seed++) { const r = RX.run(L(2), SOLUTIONS[2], { legacy: true, seed }); if (!r.all || r.lateness > 0) worse++; }
  assert.ok(worse >= 12, `keeper worse in ${worse}/20`);
});

test('daily puzzles are solvable by a sensible player for every template', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const d = RX_LEVELS.daily('2026-10-' + String((seed % 28) + 1).padStart(2, '0'), seed);
    let cards;
    if (d.id === 2) { const stop = +d.goals[0].text.match(/under (\d+)/)[1], rebuy = +d.goals[1].text.match(/under (\d+)/)[1]; cards = [{ when: { kind: 'signal', id: 'eth', op: '<', value: stop }, then: { kind: 'sell', amount: 'all' }, mode: 'once' }, { when: { kind: 'signal', id: 'eth', op: '<', value: rebuy }, then: { kind: 'buy', amount: 10 }, mode: 'once' }]; }
    else cards = SOLUTIONS[d.id];
    const r = RX.runAll(d, cards);
    assert.ok(r.all, `daily seed ${seed} template ${d.id}: ${r.runs[0].goals.map(g => g.id + ':' + g.ok + ' ' + g.note).join(', ')}`);
  }
});

test('validate reports missing pieces', () => {
  assert.ok(RX.validate(L(1), { when: { kind: 'signal', id: 'eth' }, then: {} }).length >= 2);
  assert.deepEqual(RX.validate(L(1), SOLUTIONS[1][0]), []);
});
