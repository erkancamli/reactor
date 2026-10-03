# Reactor: design notes

Subject: a puzzle game that teaches Rialo's reactive transactions. The player writes rules (when this, then that) that the chain
evaluates at the end of every block, and watches the chain react to the world without a bot in between.
Audience: the Rialo community, on phones and desktops, sessions of one to three minutes per level.

## Tokens
- ink #0a0a0a (page), slab #15171a (panels), rail #26292e (hairlines, gutters)
- paper #e8e3d5 (text), mute #8d8a82 (secondary text)
- glacier #9fd3e8 (the one accent: a rule that fired, the chain reacting)
- amber #f2b84b (waiting, pending webcall, the keeper bot catching up)
- signal #ff5c5c (dropped, rejected, failed goal)
Fonts: Space Grotesk for interface and headlines, JetBrains Mono for rule cards, block tape and the chain log (they are code).

## Layout
Desktop: a workbench in three columns. Left: the world (signals ticking, events, webcall responses). Center: the rules, a ledger
of when/then rows with a status gutter like a debugger. Right: the chain (state, credits, log). A block tape runs across the top,
run controls sit under the rules. Phone: the same three as tabs under a sticky block tape, run bar fixed at the bottom.
Title: the hero is a live rule watching a live ticker and firing; no stat row, no gradient.

## Principles
- The reaction flash is the one bold moment: at block end the chain column pulses glacier and the fired rule slides into the log.
- Rows, not cards. Hairlines encode containment, the gutter encodes status. One radius (6px) for buttons only.
- Numbering only where there is a sequence: blocks.
- Copy in plain verbs: Run, Step, Reset, Add rule. Errors say what to change.
- Legacy mode is amber and slow, never mocked in copy; the numbers do the talking.
