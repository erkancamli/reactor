# Review pass

You are the second pair of eyes on quiz questions another writer produced. Read INSTRUCTIONS.md first (the schema and rules), then the source files that your assigned question file quotes (field `file`, all under txt/), then every question in the file.

For every question decide:

- `keep`: correct, unambiguous, follows the rules.
- `fix`: worth keeping but something needs to change. Supply the complete corrected object in `fixed` (all fields, not a diff). Typical fixes: a distractor that is actually also true or arguable according to the source; a question with two defensible answers; a correct option that is clearly the longest or most detailed while the distractors are short (rebalance lengths, do not change the facts); a `why` that states something the source does not; clumsy English; a `noise` statement that is only vaguely false; a `fill` whose distractors are a different kind of thing than the answer; a `q` that gives away the answer.
- `drop`: not fixable (fact not actually supported by `ev`, trivial or generic knowledge, answer depends on outside knowledge, duplicate of another question in the file).

Hard checks, go through them for every question:
1. Does `ev` alone prove that the first option (or `truth`, or the `steps` order) is right? If you need the rest of the article to be sure, pick a better `ev` (verbatim, same word limits) in a fix.
2. Is each distractor false according to the source? If the source supports a distractor too, fix or drop.
3. Would a well read Rialo follower find the question fair? No trick wording.
4. Dash rule: no en or em dashes, no spaced hyphens; hyphenated compounds only if that exact word exists in the source texts.
5. Lengths: q 160, options 90 (fill options 60), why 220, s 150, steps 70, ev 6 to 45 words (order up to 70).
6. Fixed objects must keep the same `id`, `type`, `file`.

Write your verdicts as JSON Lines to the review path you were given, one line per question, in this shape:

{"id":"a_x","verdict":"keep"}
{"id":"a_y","verdict":"fix","reason":"distractor 3 also true per paragraph on credits","fixed":{...complete object...}}
{"id":"a_z","verdict":"drop","reason":"generic blockchain knowledge"}

Every id in the source file must appear exactly once. After writing, run `python3 apply_review.py <questions file> <review file>` which prints the verification result of the fixed set; if it reports bad lines, correct your fixed objects until it reports 0 bad. Write nothing else to disk. Reply with counts of keep, fix, drop and a two line summary of the most common problems.
