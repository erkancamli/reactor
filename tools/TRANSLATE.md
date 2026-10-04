# Turkish translation of quiz questions

You translate English quiz questions about Rialo into natural Turkish for Turkish speaking crypto players. The player should feel the question was written in Turkish by a Turkish crypto native, not translated. Rewrite freely as long as the meaning and the facts stay identical.

Input: a JSONL file of questions (fields per INSTRUCTIONS.md: type mcq/noise/fill/order/source). Output: a JSONL file with one line per input id, in the same order, with ONLY these fields:

- `id`: same as input
- `q`: Turkish question (mcq, fill, order, source). For `fill` keep exactly one blank written as `____`.
- `s`: Turkish statement (noise)
- `a`: Turkish options in the SAME order as the input (first one is still the correct one). For `source` type, do NOT translate the options, copy the English post titles verbatim.
- `steps`: Turkish steps in the SAME order (order type)
- `why`: Turkish explanation, one sentence, at most 230 characters

Rules:
1. Terms that are names stay as they are: Rialo, Stream, Gauss, Edge, REX, Project 1337, Stake for Service (SfS), SCALE, Playground, RP, RLO, kelvin, TEE, MPC, FHE, ZK, DKG, API, RPC, CDK, Agent Registry, Rialo Predict, Rialo Learn, Subzero Labs, CBOE, Bloomberg, Massive, Cash App, Block, SoFi, Maple, Goldfinch, LoaderV4, RISC-V, PolkaVM, eBPF, Ed25519, BIP44, HPKE, WASM. Use Turkish suffixes with an apostrophe (Rialo'nun, Stream'de, SCALE'in).
2. Common crypto words used in Turkish communities stay in their usual Turkish community form: blok, zincir, işlem (transaction), validatör, stake, airdrop, cüzdan, token, oracle (oracle stays), akıllı sözleşme, ön satış, likidite, kaldıraç, teminat, escrow (escrow stays), keeper botu, gas (gas stays), fee → ücret, slashing stays, finality → kesinleşme, latency → gecikme, throughput → işlem hacmi, predicate → koşul, reactive transaction → reaktif işlem, webcall → web çağrısı, handover → devir, epoch stays, inner log / outer log → iç günlük / dış günlük, consistency → tutarlılık, concurrency control → eşzamanlılık denetimi, optimistic / pessimistic → iyimser / kötümser, double marginalization → çifte marjinalleşme, supermodularity → süpermodülerlik, private credit → özel kredi, servicer → servis sağlayıcı, covenant → sözleşme koşulu, threshold signature → eşik imzası, key share → anahtar payı, prediction market → tahmin piyasası, resolution → sonuçlandırma, custodial wallet → emanet cüzdan, points → puan.
3. Numbers, percentages, units and quoted identifiers stay exactly as in English (10x, 1e9, 50ms, 1,000 → 1.000 is NOT allowed, keep 1,000 as written; keep $ amounts as written).
4. Dash rule: never use en dashes or em dashes (– —) and never a spaced hyphen ( - ). Avoid hyphenated compounds entirely in Turkish (write "gerçek dünya", "zincir dışı", "uçtan uca").
5. Natural Turkish: short sentences, active voice, no word by word structures like "... olan bir ... midir?" when a simpler form exists. Questions end with a question mark; noise statements do not.
6. Keep each option roughly as long as its English counterpart; do not make the correct option stand out.
7. Length limits: q 170, s 160, options 95 (fill options 60), steps 75, why 230.
8. Do not add or remove facts.

Run `python3 verify_tr.py <english file> <turkish file>` and fix everything it reports until it prints 0 problems. Write nothing else to disk. Reply with the line count and anything that was hard to render in Turkish.
