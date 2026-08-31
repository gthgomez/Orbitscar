# Project Orbitscar — Vertical Slice

**Status:** ACCEPTANCE CONTRACT V0.1

## Slice question

Is constructing a small base and directly attacking one base fun, legible, and repeatable for a new player?

## Included

- One colony plinth with snap-grid placement.
- Four buildings: command relay, matter extractor, drop cradle, one selected defense.
- Three defense archetypes: arc projector, scatter coil, snare lattice.
- Four units: line rigger, pulse marksman, ram walker, needle drone.
- One commander: Mara Voss with Emergency Reroute.
- Three resources with stub faucets/sinks.
- One authored NPC base with two viable attack plans.
- Scout snapshot with confidence/staleness.
- Three deployment charges and one reinforcement action.
- One ability, win/partial/retreat/loss states.
- Deterministic battle seed, event stream, result hash, and read-only replay.
- Post-battle report with losses, structures, plan summary, and next-action hint.

## Acceptance criteria

1. A new player can place four buildings in under 3 minutes with visible footprint/cost.
2. The same input seed produces byte-equivalent result/event hash in two runs.
3. At least two compositions can win the NPC base through different deployment choices.
4. A player can scout, plan, deploy, use the ability, and finish in 10 minutes or less.
5. Report identifies which defense/placement caused the outcome.
6. A failed battle does not corrupt resources, unit ownership, or base layout.
7. Illegal placement, capacity overflow, duplicate event, and invalid ability are rejected by the local simulation authority adapter. Stale-snapshot rejection is a future remote-server acceptance criterion because this slice has no production server or versioned remote snapshots.
8. Web keyboard/mouse and touch input both complete the flow.
9. Low-effects mode preserves target tags, drops, hit events, and report meaning.
10. Five blind testers: ≥60% start a second attack and ≥60% explain one counter.

## Explicit exclusions

No alliance chat, territory capture, real-money purchase, gacha, live matchmaking, Postgres migration, full art pack, or 10-unit roster in the slice.

## Kill criteria

Pause production if the attack reads as a power check, if no second-plan behavior appears, if the board is unreadable at phone scale, or if the slice requires a backend feature not justified by the acceptance question.
