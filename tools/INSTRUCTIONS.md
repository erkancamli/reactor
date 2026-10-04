# Rialo quiz question writing

You are writing questions for a fan made Rialo knowledge game. Players are crypto natives who follow Rialo (@RialoHQ). Every question must be answerable from the source texts in `txt/` and nothing else. Every question carries a verbatim quote (`ev`) from its source file that proves the answer. A script checks that the quote exists verbatim in that file; a question whose quote is not found is thrown away, so copy quotes exactly (you may trim at word boundaries, never paraphrase).

Read your assigned source files in full first. Then write the questions as JSON Lines into your output file, one JSON object per line, no blank lines, no comments.

## Common fields (every question)

- `id`: `<yourprefix>_<short>` with only lowercase letters, digits, underscore, at most 24 chars, unique.
- `type`: one of `mcq`, `noise`, `fill`, `order`.
- `topic`: one of `company`, `reactive`, `edge`, `stream`, `stake`, `agents`, `scale`, `rwa`, `privacy`, `markets`, `economics`, `gauss`, `systems`, `devs`, `playground`. Use the file's default topic from `srcmap.json` unless the question is clearly about another topic (for example a reactive transaction fact inside the agent economy post gets `reactive`).
- `file`: the exact source file name in `txt/`.
- `diff`: 1 (anyone who skimmed the post), 2 (read it properly), 3 (remembers details, numbers, exact terms).
- `why`: one sentence, at most 220 characters, that explains the right answer in plain words. It is shown to the player after answering, together with the quote and the link to the post, so make it teach something.
- `ev`: the verbatim quote from `file`, 6 to 45 words (order type: up to 70 words). Must prove the correct answer on its own.

## Type specific fields

### mcq
- `q`: the question, at most 160 characters, ends with a question mark.
- `a`: exactly 4 options, the FIRST one is correct (the game shuffles). Each at most 90 characters. Distractors must be wrong according to the source, plausible to a crypto native, similar in length and tone to the correct one. No "all of the above", no "none of the above", no "both A and B".

### noise  (true or false rapid fire, framed in the game as "signal or noise")
- `s`: a single declarative statement about Rialo, at most 150 characters, no question mark.
- `truth`: `true` if the statement is correct according to the source, `false` if it is a fabrication.
- A false statement must be a clear factual contradiction of `ev` (a changed number, a swapped role, a reversed claim), not a vague or arguable one. Half of your noise items true, half false. Do not make false ones obviously silly; they should sound like something a careless reader would repeat.

### fill  (blank in a quote)
- `q`: a sentence from or close to the quote with one blank written as `____`, at most 160 characters. The blank is a key term or number.
- `a`: exactly 4 options, the FIRST is correct and must appear verbatim in `ev`. Distractors are real terms or numbers of the same kind (other numbers, other technical terms), at most 60 characters each.

### order  (put the steps in sequence)
- `q`: what is being ordered, at most 140 characters, for example "Put the lifecycle of a reactive transaction in order."
- `steps`: 4 or 5 short strings in the CORRECT order, each at most 70 characters. The source must actually describe this sequence; `ev` must show it.

## Rules of quality

1. Rialo specific. A question a smart person could answer without ever reading Rialo material is bad (unless it is a `diff` 1 warm up, allow at most 15% of your set to be that). Prefer the surprising: numbers, named things (Gauss, Stream, Project 1337, Stake for Service, SCALE, kelvin, RLO, Edge, Playground RP), mechanisms, and claims that distinguish Rialo from other chains.
2. Spread questions across the whole text, not just the opening paragraphs.
3. Never ask "what is the title of the post" or who the author is. Never ask about dates unless the text makes the date meaningful.
4. No negative mcq questions ("Which is NOT..."), that is what `noise` is for.
5. No question may depend on another question.
6. Plain English, no hype words, no marketing tone. Write like a sharp quiz master.
7. Dash rule: never use en dashes or em dashes (– —) anywhere, and never a spaced hyphen ( - ). A hyphen inside a compound word is allowed only if that exact hyphenated word appears in the source texts (for example real-world, off-chain, end-to-end). When unsure, rewrite without the hyphen.
8. Do not invent facts in `why`. If the source does not say it, neither do you.
9. Keep the correct option from being the longest or the most detailed every time. Vary.
10. Numbers written as in the source (10x, 1e9, 1,000, 50%).

## Mix

For N questions: about 55% mcq, 30% noise, 10% fill, 5% order (at least one order question per writer if the material has any sequence). Difficulty roughly 30% diff 1, 45% diff 2, 25% diff 3.

## Output

Write only the JSONL file at the path you were given. When done, reply with the count per type and anything in the source you found ambiguous. Do not write anything else to disk.

Example lines:

{"id":"a_predicate","type":"mcq","topic":"reactive","file":"post_reactive-transactions-a-model-for-native-automation-on-rialo.md","diff":2,"q":"When does Rialo evaluate the predicate of a reactive transaction?","a":["At the end of every block","Only when a user pings the contract","Once per epoch","Whenever a validator is idle"],"why":"Validators check every registered predicate at the end of each block, so a reaction never waits for an outside bot.","ev":"<verbatim quote from the file>"}
{"id":"a_kelvin","type":"noise","topic":"stake","file":"post_stake-for-service.md","diff":2,"s":"One RLO equals one million kelvin.","truth":false,"why":"The smallest unit is kelvin and one RLO is one billion kelvin, not one million.","ev":"<verbatim quote from the file>"}
{"id":"a_blank1","type":"fill","topic":"stream","file":"post_project-1337.md","diff":1,"q":"Project 1337 was the public test of ____, Rialo's data streaming layer.","a":["Stream","Edge","Gauss","Beacon"],"why":"...","ev":"<verbatim quote from the file>"}
{"id":"a_order1","type":"order","topic":"gauss","file":"post_rethinking-protocol-upgrades-with-gauss.md","diff":3,"q":"Order the steps of a Gauss handover.","steps":["...","...","...","..."],"why":"...","ev":"<verbatim quote from the file, up to 70 words>"}
