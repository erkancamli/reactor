# Reactor

Twelve questions. One block a day.

Reactor is a fan made knowledge game about [Rialo](https://rialo.io). Every question is lifted from a Rialo post, a [Rialo Learn](https://learn.rialo.io) page, the [Playground](https://playground.rialo.io) or the rialo-cdk docs, and every answer comes back with the exact line that proves it and a link to the source. It is not affiliated with Rialo or Subzero Labs.

## Modes

- **Daily Block.** Twelve questions, the same for everyone, once a day per player name. Right answers fill your block with transactions, wrong ones leave noise. The clock runs on the server and the score is computed there, so the board is honest. Daily, weekly and all time leaderboards; ranks cool down as your total grows, a nod to Subzero Labs and to kelvin (Ambient, Frost at 2,000, Subzero at 8,000, Zero Kelvin at 20,000).
- **Sprint.** Ninety seconds of rapid questions, as many rounds as you like. With a player name it is refereed by the server (questions served one at a time, clock and score kept there) and ranked on a weekly Sprint board; without a name it plays unranked on the device.
- **Replay.** A finished Daily Block can be replayed unranked to practise the misses.
- **Block streak.** Consecutive days with a finished Daily Block, shown on the boards.
- **Atlas.** Study by topic with no clock. Mastery counts the questions you have answered right at least once.

## Mechanics borrowed from Rialo

| In the game | In Rialo |
| --- | --- |
| Stake 1x, 2x or 3x before answering; 3x triples the points and costs 300 if wrong | Stake for Service turns stake into a payment stream; here your stake is your confidence |
| Webcall: pull the source line onto the screen, that question pays half | Edge webcalls pull web data into a transaction |
| Filter: drop two wrong options | Stream filters noise out of market data (Project 1337) |
| Handover: skip a question, keep your streak | A transaction carried across a Gauss handover |
| Signal or noise: a statement is true or fabricated | Signal versus noise in the data pipeline |

## Question types

Pick one (four options), fill the blank, signal or noise, put the steps in order, and "which post says this". Each question carries `ev`, a verbatim quote from its source, a `why` explanation, a topic and a difficulty. The bank is in `data/questions.en.jsonl` with Turkish in `data/questions.tr.jsonl`; `tools/verify.py` and `tools/verify_tr.py` check every line (quote found verbatim in the source text, lengths, option counts, no dashes). The writing and review rules are in `tools/INSTRUCTIONS.md`, `tools/REVIEW.md` and `tools/TRANSLATE.md`. Source texts are not committed; see `data/sources.json` for where each file came from.

## Scoring

Base points by difficulty (100, 150, 200 for pick one and fill; 80 to 120 for signal or noise; 200 to 300 for ordering; 150 to 250 for "which post"), up to +50% for a fast answer, +10% per consecutive right answer up to +50%, times the stake. A wrong answer or a timeout costs the stake penalty (0, 100 or 300) and resets the streak. All of it lives in `shared/rules.mjs`, which both the page and the server use.

## Run it

```
npm install
npm run build      # data/*.jsonl -> data/bank.mjs and dist/
npm test           # rules and API tests with an in-memory store
npm run dev        # http://localhost:8790 with the real API handler
```

Deploys to Netlify: `netlify.toml` builds `dist/` and bundles `netlify/functions/api.mjs`, which keeps players, runs and boards in Netlify Blobs (store `reactor`). No environment variables are required; a signing secret is generated on first use.

## API

- `POST /api/register {handle}` claims a name, returns a device key
- `POST /api/daily/start {handle, key}` starts or resumes today's run
- `POST /api/daily/lifeline {run, key, i, lifeline}` webcall, filter or handover
- `POST /api/daily/answer {run, key, i, answer, stake}` judges one question and serves the next
- `GET /api/board?which=today|week|all`, `GET /api/me?handle=`, `GET /api/daily/run?run=`

## Credits

Made by ecamli ([@ekinoks_26](https://x.com/ekinoks_26)). MIT license. Rialo, Subzero Labs and the quoted texts belong to their authors.
