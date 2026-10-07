# Orbitscar combat evaluation findings

## Initial prototype baseline — 2026-09-05

The first 1,344-run report below is historical. Its balance conclusions refer to ruleset 0.2.0 before the live command, splash, commander, and balance iterations described here.

## Follow-up iteration — 2026-10-07

The canonical balance test suite now runs all acceptance gates by default. The latest deterministic run passed 43 tests, including the formerly skipped line-rigger, zero-casualty, immediate-mass, and commander impact gates. The line-rigger's power was reduced from 5 to 3.75; the Glass Spine layout adds a second scatter coil; scatter coils now record data-driven splash damage; and Emergency Reroute reduces incoming damage while increasing movement speed. Ion Kade now uses a distinct weapon-overcharge ability. Evaluation commander commands run at tick 30 to represent an early live decision.

The fixed-timing staging guard now focuses on contested and severe matchups. It requires at least 50% win rate for staged play in at least one such matchup and requires staging to beat immediate mass in at least one. Cinder Yard remains a cautious onboarding target where a direct opening is appropriate. This is a focused balance acceptance set; it does not establish that every tactic is competitive in every encounter.

The post-change 1,344-run corpus completed twice, most recently after doctrine integration, with zero invariant violations and 1,200 unique outcome hashes. Neutral doctrine preserves the prior matchup aggregates: immediate timing 74.1%, half-half 46.1%, probe-reinforce 52.7%, and three waves 40.5%. Screen-line leads force archetypes at 79.2%, while several specialists are below 50%. Active gates guard against absolute sweeps but do not establish broad strategic parity. Next balance work should compare casualty and salvage efficiency by encounter and evaluate whether high aggregate win rates purchase poor tradeoffs. Human playtesting remains unverified. The splash regression currently verifies deterministic secondary impacts at the event level; a larger clustered-versus-separated balance study remains useful.

## Spatial navigation iteration — ruleset 0.3.0

Deterministic 40-unit-cell obstacle routing now uses building footprints, attack
range to structure edges, and the declared approach zone. Deployment validation
rejects squads whose actual spawn positions contradict the selected zone or
intersect a structure. Routes are cached by target, obstacle topology, unit
range, and starting cell; a change in surviving blockers invalidates the route.

The full 1,344-run corpus completed in 19.9 seconds with zero invariant
violations and 1,200 unique outcome hashes. Aggregate attacker win rates by
composition: air-harass 87.0%, screen-line 83.9%, ranged-fortress 76.6%,
anti-armor-punch 66.1%, skirmish-mix 62.0%, sabotage-strike 59.9%, and
salvage-raid 31.3%. Immediate mass remains strongest by timing at 78.0%;
half-half is 63.1%, probe-then-reinforce 69.9%, and three waves 55.7%. Zones
now have a strong effect: west 49.4%, north 66.7%, south 77.1%, and east 73.5%.
This is evidence that geometry and approach matter, and also evidence of
remaining balance risks: air-harass and screen-line lead broadly, and the west
approach underperforms sharply in the aggregate. These rates are evaluation
results, not human fun or strategy-parity evidence.

After moving obstacle topology signatures to a destruction-driven version
counter, the exact 1,344-run JSONL output remained byte-for-byte identical.

## PvE expansion iteration — 2026-10-07

Eight authored targets expanded the sequence to 11 encounters across cautious,
contested and severe bands. New-layout tests validate arena bounds and
non-overlapping footprints. An independent content review caught and fixed an
overlap in Shard Cairn before acceptance. Glasswake Gate exposes a tier-2
opponent behind a tier-1 access gate as an optional early challenge; its
opponent tier is validated separately from player access.

The 4,928-run ruleset 0.3.0 evaluation covered 2,464 plans × 2 seed replicas
with zero invariant violations and 4,400 unique outcome hashes. Aggregate
attacker win rates: screen-line 81.3%, air-harass 81.1%, ranged-fortress
74.0%, anti-armor-punch 71.7%, skirmish-mix 64.1%, sabotage-strike 59.5%,
and salvage-raid 37.6%. Timing rates: immediate mass 78.9%, probe-reinforce
71.9%, half-half 61.6%, and three waves 55.8%. Zone rates: west 55.0%, north
66.1%, east 72.6%, south 74.4%. Drift Lode is an undefended cache and won
100% as intended. Hollow Meridian initially won only 12.7%; removing one
redundant projector lane raised it to 36.2% in a follow-up 2,464-plan,
single-seed run with zero invariant violations. It remains a deliberately
severe end-tier encounter. These aggregate rates expose remaining composition
and approach imbalance and are not evidence of human fun or strategy parity.

Expanding the corpus made a single balance test file exceed Vitest's worker
update window. The acceptance tests were split into a separate file without
changing thresholds; the complete 60-test suite and production build pass.
The old three encounters still have legacy footprint overlaps and should be
cleaned up separately without changing their balance semantics.

## Battle report attribution iteration — 2026-10-07

The report readout now derives facts from recorded events. Defense contribution
uses applied `unit_damaged` and `unit_destroyed` values keyed to the firing
structure, so splash and reroute mitigation are represented. Attacker output
uses `unit_attacked` events, and the defense report matches the attacker to the
specific structure that received the reported damage. Deployment contribution
is grouped by deployment command; the opening wave and later reinforcements are
labeled distinctly. Commander activation is reported as an observed event, not
as a counterfactual claim. Counter guidance is labeled as intel suggestion.
Direct report tests cover offensive and defensive attribution. Human readability
and usefulness remain unvalidated by blind playtest.

## Declared unit weaknesses iteration — ruleset 0.4.0

Fresh review of `docs/design/units-and-commanders.md` exposed that `unit.counters`
describes defensive weapons that exploit a unit, not defenses that unit should
damage faster. The previous resolver ignored those declarations. The shared
resolver now applies 1.4× incoming direct and splash damage when a weapon listed
in the unit's weaknesses hits it. Content validation rejects unknown weapon IDs;
replay hashes include the changed ruleset/content; and the army screen names
scouted defenses that threaten each available unit.

Same-seed comparison: 4,928 plans (2,464 × 2 seed replicas), with zero
invariant violations and 4,400 unique outcome hashes before and after. Screen-line
win rate moved from 85.4% to 82.8%, while air-harass remained 83.2%; the gap
narrowed from 2.2 to 0.4 points. Full-breach zero-casualty outcomes decreased
from 24 to 18. Average losses rose 0.22 for screen-line and 0.30 for the
ranged-fortress plan. The timing gap remains: immediate mass is 80.0%,
probe-reinforce 71.8%, half-half 59.7%, and three waves 54.0%. Approach bias
also persists: west 53.2%, south 73.3%, east 72.9%. The change improves
counter readability and composition differentiation; it does not establish
broad strategy parity or human fun.

## Splash weakness rounding and introductory target pass — ruleset 0.5.0

A focused splash regression found that integer flooring could erase the 1.4×
listed weakness when the scatter coil's secondary hit was small. Direct hits keep
the 0.4.0 arithmetic. A matching weakness on a splash victim now adds at least
one point over the same mitigated ordinary hit when flooring would otherwise
make both values equal. The rule is applied per victim and remains deterministic.

The introductory Cinder Yard no longer includes the snare lattice; its Arc
Projector and Scatter Coil teach two different vulnerabilities, while later
encounters introduce the snare. The specialist viability guard now considers
each of the four selectable approaches and retains its 75% threshold, so it
checks whether the player can find a viable plan instead of requiring every
composition to use the west approach.

Same-seed comparison: 4,928 runs (2,464 plans × 2 seeds), zero invariant
violations, 4,400 unique outcome hashes. Win / average casualties / alloy:
screen-line 72.6% / 3.48 / 4.3; ranged-fortress 72.7% / 3.44 / 10.1;
anti-armor 70.9% / 2.30 / 1.0; air-harass 84.2% / 3.43 / 12.3;
skirmish-mix 59.5% / 3.58 / 4.8; salvage-raid 29.1% / 5.00 / 20.5;
sabotage-strike 59.2% / 4.81 / 8.5. Salvage-raids trade success rate for the
best alloy yield. The top screen-line versus air-harass gap is 11.6 points,
larger than in the 0.4.0 corpus. Timing remains biased toward immediate mass:
76.1% versus 68.9% for probe-reinforce and 53.2% for three waves. South/east
approaches lead west by about 19 points. There were 153 full breaches, including
24 zero-casualty full breaches; the only universally undefeated target is the
intentionally undefended Drift Lode. All five balance acceptance gates and all
five scenario guards pass, including specialist viability across approaches.
These measurements do not establish human fun or broad strategy parity.

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

## Historical note: deliberately not changed on 2026-09-05

Per the evidence-before-tuning rule, no balance values were touched. The two
candidate changes (nerf/broaden immediate-mass dominance; improve specialist
or commander value) each need a hypothesis, a bounded change, and a rerun of
this exact corpus before landing — and the human blind test should weigh in
on whether the dominant strategy *feels* degenerate in play, not just in
aggregates.
