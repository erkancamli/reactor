// Reactor campaign: ten levels, each one built from a Rialo text. Every level says which text it comes from.
// Numbers in the worlds are invented for play; the mechanics follow the texts.
(function (root) {
  'use strict';
  const SRC = {
    intro: { label: 'Introducing Rialo: A Blockchain Built for the Real World', url: 'https://www.rialo.io/posts/introducing-rialo' },
    reactive: { label: 'Reactive Transactions: A Model for Native Automation on Rialo', url: 'https://www.rialo.io/posts/reactive-transactions-a-model-for-native-automation-on-rialo' },
    p1337: { label: 'Project 1337: The Recap', url: 'https://www.rialo.io/posts/project-1337' },
    sfs: { label: 'Stake for Service: A Better Way to Pay on Rialo', url: 'https://www.rialo.io/posts/stake-for-service' },
    scale: { label: 'Making the Agent Economy Simple and Safe with Rialo (SCALE)', url: 'https://www.rialo.io/posts/making-the-agent-economy-simple-and-safe-with-rialo' },
    rwa: { label: 'Rialo Makes Real World Assets Real', url: 'https://www.rialo.io/posts/rialo-makes-real-world-assets-real' },
    privacy: { label: 'Building Native Privacy for Real-World Blockchain Adoption', url: 'https://www.rialo.io/posts/building-native-privacy-for-real-world-blockchain-adoption' },
    gauss: { label: 'Rethinking Protocol Upgrades with Gauss', url: 'https://www.rialo.io/posts/rethinking-protocol-upgrades-with-gauss' },
    lending: { label: 'Upgrading the Consumer Lending Stack', url: 'https://www.rialo.io/posts/upgrading-the-consumer-lending-stack' },
    stable: { label: 'learn.rialo.io: Modeling Compliant Stablecoins on Rialo', url: 'https://learn.rialo.io/demos/stablecoins/' },
    devportal: { label: 'Rialo Dev Portal', url: 'https://www.rialo.io/for-devs' },
  };

  // helpers for scripted worlds
  const series = (n, f) => Array.from({ length: n + 1 }, (_, b) => f(b));
  const walk = (n, start, steps) => { const out = [start]; let v = start; for (let b = 1; b <= n; b++) { v += steps(b, v); out.push(Math.round(v * 100) / 100); } return out; };
  const clone = (o) => JSON.parse(JSON.stringify(o));

  const LEVELS = [
    // 1 ---------------------------------------------------------------- timers
    {
      id: 1, key: 'nightshift', name: 'Night shift', src: 'intro', blocks: 30, credits: 30, creditsPar: 11, latePar: 0, maxCards: 2,
      tag: 'Timers', lede: 'A presale opens at 3 AM. On most chains you set an alarm. On Rialo the contract sets the alarm.',
      brief: 'Rialo lets a contract sleep and wake on its own: a predicate on time or on an event is evaluated at the end of every block, and the action lands in the next one. Write a rule that buys when the presale opens, and one that claims rewards on a schedule.',
      triggers: ['block', 'every', 'event'],
      signals: {
        presale: { kind: 'event', label: 'Presale opens', at: [12] },
        close: { kind: 'event', label: 'Presale closes', at: [16] },
        rewards: { kind: 'state', label: 'Claimable rewards', unit: 'RLO', read: (s) => s.unclaimed },
      },
      init: () => ({ balance: 500, tokens: 0, unclaimed: 0, claimed: 0, claims: 0, open: false }),
      tick: (s, b) => { if (b === 12) s.open = true; if (b === 16) s.open = false; s.unclaimed += 2; },
      actions: {
        buy: { label: 'Buy tokens', params: ['amount'], cost: 5, apply: (s, a) => { if (!s.open) return { rejected: 'the presale is not open' }; const n = Math.min(Number(a.amount) || 0, 200); if (n <= 0) return { rejected: 'amount must be above zero' }; s.balance -= n; s.tokens += n; return { goal: 'buy', note: `bought ${n}` }; } },
        claim: { label: 'Claim rewards', cost: 2, apply: (s) => { if (s.unclaimed < 6) return { rejected: 'nothing worth claiming yet' }; s.claimed += s.unclaimed; s.unclaimed = 0; s.claims++; return { goal: 'claim', note: 'claimed' }; } },
      },
      goals: [
        { id: 'buy', text: 'Buy at least 100 tokens while the presale is open (blocks 12 to 15)', par: 13, check: (s, t, at) => ({ ok: s.tokens >= 100, at: at.buy ? at.buy[0] : null, note: s.tokens ? `${s.tokens} tokens` : 'nothing bought' }) },
        { id: 'claim', text: 'Claim rewards at least three times, never with fewer than 6 RLO waiting', par: 30, check: (s) => ({ ok: s.claims >= 3, at: 30, note: `${s.claims} claims` }) },
      ],
      legacy: { delay: [1, 4], drop: 0.5, congested: [12, 13, 14, 15, 16] },
      hint: 'A rule that fires on the "Presale opens" event lands its buy in block 13. A recurring rule every 8 blocks claims three times by block 30.',
    },
    // 2 ---------------------------------------------------------------- predicates on a feed
    {
      id: 2, key: 'stoploss', name: 'Stop loss', src: 'reactive', blocks: 30, credits: 30, creditsPar: 10, latePar: 0, maxCards: 2,
      tag: 'Predicates', lede: 'Stop loss and take profit logic that reacts immediately to oracle movements, eliminating race conditions between bots.',
      brief: 'A predicate can read a validator attested price. Sell everything the first time ETH closes under 1800, then buy 10 back once it is under 1600. No bot watches the chart; the chain does.',
      triggers: ['signal', 'block'],
      signals: {
        eth: { kind: 'feed', label: 'ETH price', unit: '$', series: [2000, 2010, 2025, 2040, 2030, 2015, 1990, 1960, 1930, 1900, 1870, 1840, 1815, 1805, 1790, 1795, 1810, 1830, 1820, 1780, 1720, 1660, 1610, 1570, 1540, 1520, 1535, 1550, 1560, 1580, 1600] },
        held: { kind: 'state', label: 'ETH held', read: (s) => s.eth },
      },
      init: () => ({ balance: 0, eth: 10, soldAt: null, boughtAt: null }),
      actions: {
        sell: { label: 'Sell ETH', params: ['amount'], cost: 4, apply: (s, a, c) => { const price = c.ctx.level.signals.eth.series[c.b]; const n = a.amount === 'all' ? s.eth : Math.min(Number(a.amount) || 0, s.eth); if (n <= 0) return { rejected: 'nothing to sell' }; s.eth -= n; s.balance += n * price; if (s.soldAt == null) s.soldAt = price; return { goal: 'sell', note: `sold ${n} at ${price}` }; } },
        buy: { label: 'Buy ETH', params: ['amount'], cost: 4, apply: (s, a, c) => { const price = c.ctx.level.signals.eth.series[c.b]; const n = Number(a.amount) || 0; if (n <= 0) return { rejected: 'amount must be above zero' }; if (s.balance < n * price) return { rejected: 'not enough balance' }; s.balance -= n * price; s.eth += n; if (s.boughtAt == null) s.boughtAt = price; return { goal: 'buy', note: `bought ${n} at ${price}` }; } },
      },
      goals: [
        { id: 'sell', text: 'Sell all 10 ETH the first time the price closes under 1800 (block 14, so the sale lands in block 15)', par: 15, check: (s, t, at) => ({ ok: s.soldAt != null && s.soldAt < 1800 && s.soldAt >= 1780 && (at.sell ? at.sell[0] : 99) <= 16, at: at.sell ? at.sell[0] : null }) },
        { id: 'buy', text: 'Buy at least 10 ETH back under 1600', par: 24, check: (s, t, at) => ({ ok: s.eth >= 10 && s.boughtAt != null && s.boughtAt < 1600, at: at.buy ? at.buy[0] : null }) },
      ],
      legacy: { delay: [1, 3], drop: 0.4, congested: [14, 15, 20, 21, 22] },
      hint: 'When ETH price < 1800 then sell all. When ETH price < 1600 then buy 10. Both once.',
    },
    // 3 ---------------------------------------------------------------- webcalls
    {
      id: 3, key: 'raincover', name: 'Rain cover', src: 'intro', blocks: 30, credits: 36, creditsPar: 29, latePar: 1, maxCards: 2,
      tag: 'Edge', lede: 'Pull live data anywhere with a one liner HTTPS call in your smart contract.',
      brief: 'A parametric crop insurance: the contract asks a weather API for rainfall and pays the farmer when a reading passes 50 mm. Every call costs credits, so the cadence matters: call too often and the budget is gone before the storm, too rarely and the payout is late.',
      triggers: ['webcall', 'every'],
      signals: {
        rain: { kind: 'webcall', label: 'Rainfall (weather API)', unit: 'mm', latency: 1, cost: 3, series: [4, 4, 5, 6, 6, 8, 9, 9, 12, 14, 15, 18, 22, 30, 41, 49, 58, 63, 66, 61, 55, 44, 30, 20, 12, 8, 6, 5, 4, 4, 3] },
        paid: { kind: 'state', label: 'Paid to farmer', unit: 'RLO', read: (s) => s.paid },
      },
      init: () => ({ balance: 1000, paid: 0, payouts: 0 }),
      actions: {
        payout: { label: 'Pay the farmer', params: ['amount'], cost: 5, apply: (s, a) => { const n = Number(a.amount) || 0; if (n <= 0) return { rejected: 'amount must be above zero' }; if (s.payouts >= 1) return { rejected: 'the policy pays once' }; s.balance -= n; s.paid += n; s.payouts++; return { goal: 'pay', note: `paid ${n}` }; } },
      },
      goals: [
        { id: 'pay', text: 'Pay the farmer 200 within three blocks of the first reading above 50 mm (block 16)', par: 19, check: (s, t, at) => ({ ok: s.paid >= 200 && at.pay && at.pay[0] <= 20, at: at.pay ? at.pay[0] : null }) },
        { id: 'budget', text: 'Finish with credits to spare: the policy must outlive the season', par: 30, check: (s, t) => ({ ok: t[t.length - 1].creditsLeft > 0, at: 30 }) },
      ],
      legacy: { delay: [1, 3], drop: 0.3, congested: [16, 17, 18] },
      hint: 'Call the weather API every 3 or 4 blocks (3 credits a call), when the reading is > 50 pay 200. Every block would cost 90 credits.',
    },
    // 4 ---------------------------------------------------------------- data streams
    {
      id: 4, key: 'tickerwall', name: 'Ticker wall', src: 'p1337', blocks: 40, credits: 30, creditsPar: 20, latePar: 0, maxCards: 2,
      tag: 'Stream', lede: 'Market prices fluctuate constantly by small amounts due to micro trades. A smoothing filter removes this jitter, so only meaningful changes are recorded.',
      brief: 'Project 1337 streamed thousands of tickers onchain and filtered the noise first. Keep the onchain AAPL price fresh: republish whenever the feed moves more than 0.5 percent from what you last published, and never let it drift beyond 1 percent for two blocks. Publishing every block burns the budget.',
      triggers: ['signal', 'every'],
      signals: {
        aapl: { kind: 'feed', label: 'AAPL feed', unit: '$', movesRef: 'onchain', series: walk(40, 225, (b) => { const jitter = ((b * 7919) % 13 - 6) * 0.03; const move = b === 6 ? 1.8 : b === 7 ? 0.6 : b === 14 ? -2.4 : b === 15 ? -0.9 : b === 22 ? 1.5 : b === 29 ? -1.2 : b === 30 ? -1.6 : b === 36 ? 2.1 : 0; return jitter + move; }) },
        onchain: { kind: 'state', label: 'Published price', unit: '$', read: (s) => s.published },
      },
      init: () => ({ published: 225, publishes: 0 }),
      actions: {
        publish: { label: 'Publish the price onchain', cost: 2, apply: (s, a, c) => { const v = c.ctx.level.signals.aapl.series[c.b]; s.published = v; s.publishes++; return { note: `published ${v}` }; } },
      },
      goals: [
        { id: 'fresh', text: 'The published price never drifts more than 1 percent from the feed for two blocks in a row', par: 40, check: (s, t) => { let run = 0, bad = 0; for (const row of t) { const d = Math.abs(row.values.aapl - row.state.published) / row.state.published * 100; run = d > 1 ? run + 1 : 0; if (run === 2) bad++; } return { ok: bad === 0, at: 40, note: bad ? `${bad} stale stretches` : '' }; } },
        { id: 'thrift', text: 'Publish at most 10 times in 40 blocks', par: 40, check: (s) => ({ ok: s.publishes <= 10, at: 40, note: `${s.publishes} publishes` }) },
      ],
      extraStar: (s) => s.publishes <= 8,
      legacy: { delay: [1, 2], drop: 0.3, congested: [6, 7, 14, 15, 30] },
      hint: 'One recurring rule: when AAPL feed moves more than 0.5 percent, publish. The rule remembers the last value it published.',
    },
    // 5 ---------------------------------------------------------------- lending risk
    {
      id: 5, key: 'liquidation', name: 'Liquidation desk', src: 'reactive', blocks: 30, credits: 40, creditsPar: 16, latePar: 0, maxCards: 3,
      tag: 'Lending', lede: 'Automatic collateral checks within every block, conditional partial liquidations based on real time state.',
      brief: 'A borrower posted collateral. The market moves every block. Keep the position healthy with partial liquidations when the ratio drops under 120 percent, and close it only if the ratio is about to pass under 100. Liquidating a healthy position is a failure too.',
      triggers: ['signal', 'every', 'block'],
      signals: {
        ratio: { kind: 'state', label: 'Collateral ratio', unit: '%', read: (s) => Math.round(s.ratio) },
        open: { kind: 'state', label: 'Position open', read: (s) => s.open ? 'yes' : 'no' },
      },
      init: () => ({ ratio: 160, open: true, partials: 0, badDebtBlocks: 0, overLiquidations: 0, closedAt: null, closedRatio: null }),
      tick: (s, b) => { if (!s.open) return; const d = [0, -3, -4, -5, -5, -6, -6, -5, -4, -3, -2, 2, 3, 2, 1, 0, -1, -3, -5, -8, -10, -9, -6, -2, 1, 2, 1, 0, 1, 1, 0][b] || 0; s.ratio += d; if (s.ratio < 100) s.badDebtBlocks++; },
      actions: {
        partial: { label: 'Liquidate 25 percent', cost: 4, apply: (s) => { if (!s.open) return { rejected: 'position already closed' }; if (s.ratio >= 125) { s.overLiquidations++; return { note: 'liquidated a healthy position', goal: 'over' }; } s.ratio += 14; s.partials++; return { note: 'partial liquidation, ratio +14', goal: 'partial' }; } },
        close: { label: 'Close the position', cost: 6, apply: (s, a, c) => { if (!s.open) return { rejected: 'position already closed' }; s.closedAt = c.b; s.closedRatio = s.ratio; if (s.ratio >= 110) s.overLiquidations++; s.open = false; return { note: `closed at ${Math.round(s.ratio)}` }; } },
      },
      goals: [
        { id: 'nobaddebt', text: 'The ratio never ends a block under 100 percent', par: 30, check: (s) => ({ ok: s.badDebtBlocks === 0, at: 30, note: s.badDebtBlocks ? `${s.badDebtBlocks} blocks under water` : '' }) },
        { id: 'nooverkill', text: 'Never liquidate while the ratio is 125 or more, never close above 110', par: 30, check: (s) => ({ ok: s.overLiquidations === 0, at: 30 }) },
        { id: 'alive', text: 'The position is still open at the end', par: 30, check: (s) => ({ ok: s.open, at: 30 }) },
      ],
      legacy: { delay: [1, 3], drop: 0.35, congested: [18, 19, 20, 21] },
      hint: 'A recurring rule: when collateral ratio < 120, liquidate 25 percent. It fires again on the next block if the ratio is still low. Closing is a trap here.',
    },
    // 6 ---------------------------------------------------------------- agents and SCALE
    {
      id: 6, key: 'agentlabor', name: 'Agent labor', src: 'scale', blocks: 20, credits: 48, creditsPar: 40, latePar: 0, maxCards: 3,
      tag: 'SCALE', lede: 'If the agent does not submit its work by the deadline, Rialo, via native timers, automatically refunds the escrow.',
      brief: 'A SCALE task: 100 RLO sit in escrow, an image agent has until block 12 to deliver, a judge agent checks the work. Pay the agent only after a pass verdict, refund if nothing arrives by the deadline. Your rules must work in both worlds: one where the agent delivers, one where it never does.',
      triggers: ['webcall', 'block', 'event', 'signal'],
      signals: {
        delivered: { kind: 'event', label: 'Agent delivered', at: [9] },
        judge: { kind: 'webcall', label: 'Judge agent verdict', latency: 3, cost: 3, series: (b, s) => (s.delivered ? 'pass' : 'nothing to judge') },
        status: { kind: 'state', label: 'Task status', read: (s) => s.status },
      },
      scenarios: [
        { name: 'The agent delivers in block 9' },
        { name: 'The agent never delivers', signals: { delivered: { kind: 'event', label: 'Agent delivered', at: [] }, judge: { kind: 'webcall', label: 'Judge agent verdict', latency: 3, cost: 3, series: () => 'nothing to judge' } } },
      ],
      init: () => ({ escrow: 100, status: 'waiting', delivered: false, paid: 0, refunded: 0, judged: 0, wrong: 0 }),
      tick: (s, b, ctx) => { if (ctx.level.signals.delivered.at.includes(b) && s.status === 'waiting') { s.delivered = true; s.status = 'delivered'; } },
      actions: {
        pay: { label: 'Pay the agent from escrow', cost: 3, apply: (s, a, c) => { if (s.escrow <= 0) return { rejected: 'escrow is empty' }; if (!s.delivered) { s.wrong++; } s.paid += s.escrow; s.escrow = 0; s.status = 'paid'; return { goal: 'pay', note: 'agent paid' }; } },
        refund: { label: 'Refund the client', cost: 3, apply: (s, a, c) => { if (s.escrow <= 0) return { rejected: 'escrow is empty' }; if (s.delivered) { s.wrong++; } s.refunded += s.escrow; s.escrow = 0; s.status = 'refunded'; return { goal: 'refund', note: 'client refunded' }; } },
      },
      goals: [
        { id: 'settle', text: 'The escrow is settled by block 16: paid after a pass verdict, or refunded at the block 12 deadline', par: 14, check: (s, t, at) => { const paidAt = at.pay ? at.pay[0] : null, refAt = at.refund ? at.refund[0] : null; const ok = s.delivered ? (s.paid > 0 && s.wrong === 0 && paidAt <= 16) : (s.refunded > 0 && s.wrong === 0 && refAt != null && refAt >= 12 && refAt <= 14); return { ok, at: s.delivered ? paidAt : refAt }; } },
        { id: 'fair', text: 'Never pay without delivery, never refund after a delivery', par: 20, check: (s) => ({ ok: s.wrong === 0, at: 20 }) },
      ],
      legacy: { delay: [1, 3], drop: 0.35, congested: [8, 9, 12, 13] },
      hint: 'Two rules: ask the judge agent every 2 blocks and pay when the verdict is pass (once). At block 12, and only if task status is still waiting, refund.',
    },
    // 7 ---------------------------------------------------------------- RWA servicing
    {
      id: 7, key: 'coupons', name: 'Coupon calendar', src: 'rwa', blocks: 30, credits: 40, creditsPar: 24, latePar: 0, maxCards: 3,
      tag: 'RWA', lede: 'Periodic coupon distribution, NAV recalculations, default detection and escalation workflows, all modeled directly onchain.',
      brief: 'A tokenised bond pays a 10 RLO coupon every 5 blocks from the issuer pool. The issuer tops the pool up with deposits. When a coupon comes due and the pool cannot cover it, escalate within one block: that is a default event. Pay what is due, never pay from an empty pool, and sound the alarm exactly once.',
      triggers: ['every', 'block', 'signal', 'event'],
      signals: {
        deposit: { kind: 'event', label: 'Issuer deposit', at: [2, 7, 12, 17] },
        pool: { kind: 'state', label: 'Issuer pool', unit: 'RLO', read: (s) => s.pool },
        missed: { kind: 'state', label: 'Coupons missed', read: (s) => s.missed },
      },
      init: () => ({ pool: 0, paid: 0, coupons: 0, escalations: 0, missed: 0, b: 0, dueBlocks: [5, 10, 15, 20, 25, 30], lastDueBlock: null, escalatedAt: null }),
      tick: (s, b, ctx) => { s.b = b; if (ctx.level.signals.deposit.at.includes(b)) s.pool += 10; if (s.dueBlocks.includes(b)) s.lastDueBlock = b; },
      actions: {
        coupon: { label: 'Pay the coupon', cost: 3, apply: (s, a, c) => { if (s.pool < 10) { s.missed++; return { rejected: 'pool cannot cover the coupon' }; } s.pool -= 10; s.paid += 10; s.coupons++; return { goal: 'coupon', note: 'coupon paid' }; } },
        escalate: { label: 'Escalate: declare default', cost: 2, apply: (s, a, c) => { if (s.pool >= 10) return { rejected: 'the pool can still pay, no default' }; s.escalations++; if (s.escalatedAt == null) s.escalatedAt = c.b; return { goal: 'escalate', note: 'default declared' }; } },
      },
      goals: [
        { id: 'coupons', text: 'Pay the four coupons the pool can cover (due at blocks 5, 10, 15, 20), each within one block of its due block', par: 21, check: (s, t, at) => { const ok = s.coupons === 4 && (at.coupon || []).every((b, i) => b <= [6, 11, 16, 21][i]); return { ok, at: at.coupon ? at.coupon[at.coupon.length - 1] : null }; } },
        { id: 'default', text: 'Escalate exactly once, within one block of the block 25 coupon the pool cannot cover', par: 26, check: (s) => ({ ok: s.escalations === 1 && s.escalatedAt != null && s.escalatedAt >= 25 && s.escalatedAt <= 27, at: s.escalatedAt }) },
      ],
      legacy: { delay: [1, 3], drop: 0.3, congested: [5, 10, 15, 20, 25] },
      hint: 'Every 5 blocks from block 4, pay the coupon (it lands on the due block). Then: when coupons missed > 0, escalate, once.',
    },
    // 8 ---------------------------------------------------------------- compliance and privacy
    {
      id: 8, key: 'policygate', name: 'Policy gate', src: 'stable', blocks: 32, credits: 50, creditsPar: 48, latePar: 0, maxCards: 3,
      tag: 'Compliance', lede: 'A stablecoin transfer fails because the transaction does not satisfy the configured compliance policy. Rialo blocks non compliant transactions during execution.',
      brief: 'A recurring 50 RLO payment goes out every 4 blocks, but each one must pass the policy check first, and the check runs privately: the chain learns pass or fail, not the data behind it. The recipient is flagged between blocks 14 and 21. Pay on every pass, never on a fail, never without a check.',
      triggers: ['every', 'webcall', 'fired'],
      signals: {
        policy: { kind: 'webcall', label: 'Policy check (private)', latency: 1, cost: 3, series: (b) => (b >= 12 && b <= 19 ? 'fail' : 'pass') },
        flagged: { kind: 'state', label: 'Recipient flagged', read: (s, b) => (b >= 14 && b <= 21 ? 'yes' : 'no') },
      },
      init: () => ({ payments: 0, blockedPayments: 0, unchecked: 0, lastCheck: null, lastVerdict: null, paidAt: [] }),
      actions: {
        pay: { label: 'Pay 50 RLO', cost: 4, apply: (s, a, c) => { const flagged = c.b >= 14 && c.b <= 21; const checked = s.lastCheck != null && c.b - s.lastCheck <= 2 && s.lastVerdict === 'pass'; if (!checked) s.unchecked++; if (flagged) { s.blockedPayments++; return { rejected: 'policy: recipient is flagged, payment blocked' }; } s.payments++; s.paidAt.push(c.b); return { goal: 'pay', note: 'paid 50' }; } },
        approve: { label: 'Record the pass verdict', cost: 0, apply: (s, a, c) => { s.lastCheck = c.b; s.lastVerdict = 'pass'; return { note: 'pass verdict recorded' }; } },
      },
      goals: [
        { id: 'paid', text: 'At least 6 payments land, each within two blocks of a pass verdict', par: 32, check: (s) => ({ ok: s.payments >= 6 && s.unchecked === 0, at: 32, note: s.unchecked ? `${s.unchecked} payments without a fresh check` : '' }) },
        { id: 'blocked', text: 'No payment is attempted while the recipient is flagged', par: 32, check: (s) => ({ ok: s.blockedPayments === 0, at: 32, note: s.blockedPayments ? `${s.blockedPayments} blocked attempts` : '' }) },
      ],
      legacy: { delay: [1, 2], drop: 0.3, congested: [14, 15, 22, 23] },
      hint: 'Rule 1: call the policy check every 4 blocks; when it says pass, record the pass verdict. Rule 2: when rule 1 fired 0 blocks ago, pay 50. A fail verdict never fires rule 1, so nothing pays.',
    },
    // 9 ---------------------------------------------------------------- stake for service
    {
      id: 9, key: 'selffunding', name: 'Self funding', src: 'sfs', blocks: 40, credits: null, creditsPar: null, latePar: 0, maxCards: 3,
      tag: 'Stake for Service', lede: 'A developer can deploy a service, endow it with a stake, and allow it to sustain itself autonomously for years.',
      brief: 'No budget this time: the contract pays for itself. 1000 RLO are staked and yield 4 RLO a block; the routing fraction you pick sends part of that yield to the ServicePaymaster as credits. Three recurring jobs must never miss, and every point of yield you do not route stays in the treasury.',
      triggers: ['every'],
      routing: true, // the level exposes a routing fraction slider (0 to 100)
      signals: {
        credits: { kind: 'state', label: 'Service credits', read: (s) => Math.floor(s.credits * 10) / 10 },
        treasury: { kind: 'state', label: 'Yield kept', unit: 'RLO', read: (s) => Math.round(s.kept * 10) / 10 },
      },
      init: () => ({ credits: 0, kept: 0, publishes: 0, rebalances: 0, claims: 0, missed: 0, routing: 0 }),
      tick: (s, b) => { const y = 4; s.credits += y * (s.routing / 100); s.kept += y * (1 - s.routing / 100); },
      actions: {
        publish: { label: 'Publish the price', cost: 0, price: 2, apply: (s) => { if (s.credits < 2) { s.missed++; return { rejected: 'no credits: job missed' }; } s.credits -= 2; s.publishes++; return { note: 'published' }; } },
        rebalance: { label: 'Rebalance the vault', cost: 0, price: 3, apply: (s) => { if (s.credits < 3) { s.missed++; return { rejected: 'no credits: job missed' }; } s.credits -= 3; s.rebalances++; return { note: 'rebalanced' }; } },
        claim: { label: 'Claim and restake', cost: 0, price: 1, apply: (s) => { if (s.credits < 1) { s.missed++; return { rejected: 'no credits: job missed' }; } s.credits -= 1; s.claims++; return { note: 'claimed' }; } },
      },
      goals: [
        { id: 'jobs', text: 'Publish every 4 blocks, rebalance every 6, claim every 10, from block 4 on, and never miss one', par: 40, check: (s) => ({ ok: s.missed === 0 && s.publishes >= 9 && s.rebalances >= 6 && s.claims >= 3, at: 40, note: s.missed ? `${s.missed} jobs missed` : `${s.publishes} publishes, ${s.rebalances} rebalances, ${s.claims} claims` }) },
        { id: 'kept', text: 'Keep at least 100 RLO of yield in the treasury', par: 40, check: (s) => ({ ok: s.kept >= 100, at: 40, note: `${Math.round(s.kept)} RLO kept` }) },
      ],
      extraStar: (s) => s.routing <= 35,
      legacy: { delay: [1, 2], drop: 0.2, congested: [12, 24, 36] },
      hint: 'The jobs cost about 1.1 credits a block on average; 4 RLO of yield a block means a routing fraction near 30 percent covers them with a small buffer.',
    },
    // 10 --------------------------------------------------------------- Gauss handover
    {
      id: 10, key: 'handover', name: 'Epoch change', src: 'gauss', blocks: 24, credits: 30, creditsPar: 16, latePar: 0, maxCards: 3,
      tag: 'Gauss', lede: 'Transactions ordered by the old configuration after the handover boundary exist in the consensus ordering, but the execution layer never sees them. They must be resubmitted under the new configuration.',
      brief: 'A validator set change is scheduled: the handover boundary falls in block 15, and anything the old configuration orders in blocks 15 and 16 is never executed. Your settlement of 300 RLO is due at block 15. Write the rule that notices a dropped transaction and resubmits it, so the money lands under the new epoch.',
      triggers: ['block', 'dropped', 'every'],
      epochAt: 17, dropAt: [15, 16],
      signals: {
        epoch: { kind: 'state', label: 'Epoch', read: (s, b) => (b >= 17 ? 2 : 1) },
        settled: { kind: 'state', label: 'Settled', unit: 'RLO', read: (s) => s.settled },
      },
      init: () => ({ settled: 0, settlements: 0 }),
      actions: {
        settle: { label: 'Settle 300 RLO', cost: 6, apply: (s) => { if (s.settled >= 300) return { rejected: 'already settled' }; s.settled += 300; s.settlements++; return { goal: 'settle', note: 'settled 300' }; } },
      },
      goals: [
        { id: 'settle', text: 'The 300 RLO settlement executes under epoch 2, by block 19', par: 17, check: (s, t, at) => ({ ok: s.settled === 300 && at.settle && at.settle[0] >= 17 && at.settle[0] <= 19, at: at.settle ? at.settle[0] : null }) },
        { id: 'once', text: 'It executes exactly once', par: 24, check: (s) => ({ ok: s.settlements === 1, at: 24 }) },
      ],
      legacy: { delay: [1, 3], drop: 0.5, congested: [15, 16, 17] },
      hint: 'Rule 1: at block 14, settle (it is ordered in block 15 and dropped). Rule 2: when rule 1 was dropped, settle again; make it recurring so it keeps trying until one lands.',
    },
  ];

  // daily puzzle templates: a level with a reseeded world
  function daily(dayKey, seed) {
    const r = RX.rng32(seed);
    const pick = [2, 3, 4, 5][seed % 4];
    const base = LEVELS.find(l => l.id === pick);
    const L = Object.assign({}, base, { signals: Object.assign({}, base.signals), daily: dayKey, name: base.name + ' (daily)' });
    if (pick === 2) {
      const start = 1900 + Math.round(r() * 300); const dip = 9 + Math.floor(r() * 5); const crash = 18 + Math.floor(r() * 4);
      const s = walk(30, start, (b) => (b < dip ? -6 - r() * 8 : b < dip + 3 ? -18 : b < crash ? 8 + r() * 8 : b < 27 ? -45 - r() * 25 : 2));
      L.signals.eth = Object.assign({}, base.signals.eth, { series: s });
      const stop = Math.round(s[dip + 1] / 10) * 10 + 10, rebuy = Math.round(Math.min(...s) / 10) * 10 + 60;
      L.brief = `Today's chart: sell all the first time ETH closes under ${stop}, then buy 10 back under ${rebuy}.`;
      L.goals = [
        { id: 'sell', text: `Sell all 10 ETH the first time the price closes under ${stop}`, par: s.findIndex(v => v < stop) + 1, check: (st, t, at) => ({ ok: st.soldAt != null && st.soldAt < stop && at.sell && at.sell[0] <= s.findIndex(v => v < stop) + 2, at: at.sell ? at.sell[0] : null }) },
        { id: 'buy', text: `Buy at least 10 ETH back under ${rebuy}`, par: s.findIndex(v => v < rebuy) + 1, check: (st, t, at) => ({ ok: st.eth >= 10 && st.boughtAt != null && st.boughtAt < rebuy, at: at.buy ? at.buy[0] : null }) },
      ];
    } else if (pick === 3) {
      const storm = 12 + Math.floor(r() * 10);
      const s = series(30, (b) => Math.round(4 + Math.max(0, 70 - Math.abs(b - storm - 2) * 9) * (b >= storm - 4 ? 1 : 0.1)));
      L.signals.rain = Object.assign({}, base.signals.rain, { series: s });
      const first = s.findIndex(v => v > 50);
      L.goals = [
        { id: 'pay', text: `Pay the farmer 200 within five blocks of the first reading above 50 mm (block ${first})`, par: first + 4, check: (st, t, at) => ({ ok: st.paid >= 200 && at.pay && at.pay[0] <= first + 6, at: at.pay ? at.pay[0] : null }) },
        base.goals[1],
      ];
    } else if (pick === 4) {
      const moves = {}; for (let i = 0; i < 7; i++) moves[3 + Math.floor(r() * 36)] = (r() - 0.5) * 5;
      L.signals.aapl = Object.assign({}, base.signals.aapl, { series: walk(40, 200 + Math.round(r() * 60), (b) => ((b * 7919) % 13 - 6) * 0.03 + (moves[b] || 0)) });
    } else if (pick === 5) {
      const deltas = series(30, (b) => (b === 0 ? 0 : Math.round((r() - 0.62) * 12)));
      L.tick = (s, b) => { if (!s.open) return; s.ratio += deltas[b]; if (s.ratio < 100) s.badDebtBlocks++; };
    }
    return L;
  }

  root.RX_LEVELS = { LEVELS, SRC, daily };
})(typeof window !== 'undefined' ? window : globalThis);
