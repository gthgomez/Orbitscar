# Orbitscar combat evaluation findings — 2026-09-05

First T-001 baseline: **1,344 deterministic runs** (672 plans × 2 seed replicas)
across all three authored encounters, seven force archetypes, four reinforcement
timings, four approach zones, with and without the commander ability. Zero
invariant violations; every 25th run re-resolved with identical hashes.

Reproduce with:

```
pnpm evaluate --runs 1344 --seed-base 10000 --out runs/eval-2026-09-05
```

Identical seeds reproduce these results byte-for-byte (deterministic resolver).

## Answers to the campaign questions

**Multiple viable approaches — YES.** Against the introductory target
(cinder-yard), at least three archetypes win reliably: screen-line (100%),
air-harass (75%), anti-armor-punch (78%). sabotage-strike is a situational
specialist: 94% at glass-spine but 27–38% elsewhere.

**Deployment geography — measurable, modest.** Overall win rate by zone:
west 73%, north 76%, south 74%, east 80%. South produces the most full
breaches (24% vs 6–10% elsewhere) because its approach lands nearest the
extractor ring while staying outside the arc projector's first contact.
Geography changes outcomes but is not yet decisive.

**Reinforcement timing — immediate mass deployment dominates.** Win rates:
immediate-mass 96% (avg 694 ticks), probe-then-reinforce 88%, half-half 65%,
third-third-third 55%. Splitting a force into piecemeal waves currently
*helps the defender*: later waves arrive into pre-alerted defenses. The
vertical-slice promise that "timing changes the result" is true — in the
wrong direction for interesting choices.

**Defensive archetypes — differentiated but lopsided.** pulse_marksman heavy
forces bleed badly (3.8 average losses/run): the arc projector outranges them
(260 vs 150). needle_drone swarms lose ~3.8 drones to the snare lattice's
air-first targeting. line_riggers are the most survivable unit everywhere.

**Unit relevance — line_rigger looks universally dominant.** The 8-rigger
screen wins 100% at every encounter at the lowest capacity cost. Specialists
currently pay capacity for niche value. This is the strongest balance signal
in the corpus.

**Commander ability — nearly irrelevant tonight.** Emergency Reroute changes
overall win rate by ~1 point (76% vs 75%) at its fixed tick-300/magnitude-2
configuration.

**Battle length — healthy.** Only 1 of 1,344 runs hit the 2,400-tick cap;
the modal battle ends in 600–1,200 ticks (20–40 s of replay).

**Determinism — clean.** 0 invariant violations across the corpus; 652/672
plans produce the same winner across both seed replicas (20 are genuinely
seed-sensitive close fights).

## Deliberately NOT changed tonight

Per the evidence-before-tuning rule, no balance values were touched. The two
candidate changes (nerf/broaden immediate-mass dominance; improve specialist
or commander value) each need a hypothesis, a bounded change, and a rerun of
this exact corpus before landing — and the human blind test should weigh in
on whether the dominant strategy *feels* degenerate in play, not just in
aggregates.
