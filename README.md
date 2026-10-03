# Reactor

Write the rules. Watch the chain react.

Reactor is a fan made puzzle game about [Rialo](https://rialo.io)'s reactive transactions. Every rule you write is a predicate the chain evaluates at the end of each block; when it holds, the action lands in the next block. No bot, no keeper, no cron job in between. Ten levels, each built from one Rialo text, plus a daily puzzle and a leaderboard.

It is not affiliated with Rialo or Subzero Labs. The mechanics follow Rialo's published texts; the numbers in each world are invented for play.

## How a level works

A level is a world that moves block by block: price feeds, events, API responses that arrive after a delay, and a chain state. You write up to three rules of the form "when X, then Y", once or recurring. Run it and read the chain log.

- Triggers: a block ends, every N blocks, an event happens, a value compares, an API answer compares, another rule fired, a rule was dropped at a handover. A second condition can be attached with "and also".
- Actions are the level's own: buy, sell, pay, liquidate, publish, settle and so on. Each one costs credits.
- Credits stand in for Stake for Service: every action and every API call spends some, and a rule that holds with no credits left is skipped.
- Stars: one when every goal is met, two when credits stay within par, three when nothing is late (and a level specific extra, like the routing fraction in level 9).
- Keeper bot: switch it on and the same rules run the old way, through an offchain watcher that sees each block late and sometimes fails to land a transaction in congestion. The result sheet always shows both.

## The campaign

| # | Level | Teaches | From |
| --- | --- | --- | --- |
| 1 | Night shift | timers and events: a contract that sets its own alarm | Introducing Rialo |
| 2 | Stop loss | predicates on a validator attested feed | Reactive Transactions |
| 3 | Rain cover | an API call inside the contract, and what polling costs | Introducing Rialo (Edge) |
| 4 | Ticker wall | filtering a data stream before publishing it | Project 1337 |
| 5 | Liquidation desk | per block collateral checks and partial liquidations | Reactive Transactions |
| 6 | Agent labor | SCALE: escrow, deadline, a judge agent, two scenarios | Making the Agent Economy Simple and Safe |
| 7 | Coupon calendar | RWA servicing: coupons, deposits, default detection | Rialo Makes Real World Assets Real |
| 8 | Policy gate | a private compliance check before every payment | learn.rialo.io, compliant stablecoins |
| 9 | Self funding | Stake for Service: a routing fraction that pays for the contract | Stake for Service |
| 10 | Epoch change | Gauss: transactions dropped at the handover and resubmitted | Rethinking Protocol Upgrades with Gauss |

The daily puzzle reseeds one of the worlds (stop loss, rain cover, ticker wall, liquidation desk) from the UTC day; everyone gets the same chart.

## Leaderboard

Player names live on the game's own server: a name is claimed once, the device that claimed it gets a key, and only posts carrying that key count for that name. The server never trusts a score: it receives the rules, runs the same engine, and posts the score it computes. A rule set is a few dozen bytes, so the proof travels with the post.

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/register` | POST | Claim a player name; returns the device key |
| `/api/scores?stage=n` | GET | Level n board (1 to 10) |
| `/api/scores?stage=all` | GET | Overall: best per level added up |
| `/api/scores?stage=daily[&day=YYYY-MM-DD]` | GET | The daily board |
| `/api/scores` | POST | `{ handle, key, stage, day?, cards, routing? }`; the server runs the rules |

## Project layout

```
src/index.html      the page: title, workbench, rule editor, results, leaderboard client
src/engine.js       the simulation: blocks, signals, predicates, actions, credits, the keeper bot, scoring
src/levels.js       the ten levels and the daily puzzle generator
src/i18n-tr.js      Turkish text
netlify/functions/leaderboard.mjs   the API (Netlify Functions + Netlify Blobs)
scripts/build.mjs   inlines the engine and levels, ships the scripts as one hashed file
test/               engine, level and API tests; a local dev server
```

## Run it

```
npm install
npm run build && npm run dev     # http://localhost:8790 with an in memory leaderboard
npm test
```

Deploy on Netlify: connect the repository, build command `npm run build`, publish directory `dist`. Netlify Blobs needs no setup; the API generates its own secret on first use (`RUN_SECRET` in the environment overrides it).

## Language

English and Turkish. The first visit follows the browser language; the TR / EN button switches at any time. Share texts stay in English.

## Sources

- [Introducing Rialo: A Blockchain Built for the Real World](https://www.rialo.io/posts/introducing-rialo)
- [Reactive Transactions: A Model for Native Automation on Rialo](https://www.rialo.io/posts/reactive-transactions-a-model-for-native-automation-on-rialo)
- [Project 1337: The Recap](https://www.rialo.io/posts/project-1337)
- [Stake for Service: A Better Way to Pay on Rialo](https://www.rialo.io/posts/stake-for-service)
- [Making the Agent Economy Simple and Safe with Rialo](https://www.rialo.io/posts/making-the-agent-economy-simple-and-safe-with-rialo)
- [Rialo Makes Real World Assets Real](https://www.rialo.io/posts/rialo-makes-real-world-assets-real)
- [Building Native Privacy for Real-World Blockchain Adoption](https://www.rialo.io/posts/building-native-privacy-for-real-world-blockchain-adoption)
- [Rethinking Protocol Upgrades with Gauss](https://www.rialo.io/posts/rethinking-protocol-upgrades-with-gauss)
- [learn.rialo.io: Modeling Compliant Stablecoins on Rialo](https://learn.rialo.io/demos/stablecoins/)
- [Rialo Dev Portal](https://www.rialo.io/for-devs)

## Bugs, ideas and license

Bugs and ideas: write to [@ekinoks_26](https://x.com/ekinoks_26) on X. MIT license, see LICENSE. Rialo and the Rialo name belong to their owners; this is a fan project.
