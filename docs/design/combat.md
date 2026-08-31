# Project Orbitscar — Combat Specification

**Status:** DESIGN V0.1 — vertical-slice contract

## Pre-battle

1. Choose a target and read its snapshot age, visible buildings, estimated resource exposure, and legal deployment zones.
2. Select up to one commander and a force under `DeploymentCapacity`.
3. Choose a declared intent: **break core**, **extract resources**, or **test defense**. Intent affects scoring and retreat recommendation, not hidden enemy stats.
4. Confirm three deployment charges. Each charge has a location, unit list, and client sequence number.
5. Server validates snapshot ownership/version, unit ownership, capacity, target eligibility, and cooldowns.

## Battle

- Target duration: 90–120 seconds; hard retreat at 150 seconds.
- Units execute movement, targeting, attacks, and limited abilities from the ruleset.
- Player agency is limited to three deployment charges, one commander ability, and one optional retreat.
- Reinforcement location is selected from highlighted legal zones; destroyed or occupied zones are rejected.
- A unit cannot be retargeted manually every frame; the player chooses composition and timing, not RTS micromanagement.
- PvE supports pause/speed in local visualization only; authoritative elapsed time and events remain server-defined.
- PvP replay is observational and cannot change the result.

## Victory and partial outcomes

| Outcome | Requirement | Result |
|---|---|---|
| Breach | Command relay disabled | full win, capped loot, defense damage |
| Extraction | Declared resource goal met and retreat succeeds | partial win, lower loot, limited damage |
| Repelled | Force retreats or all drops fail | no loot, learning report, unit losses according to rules |
| Timeout | No breach by hard limit | defender holds, attacker may retain surviving units |

Buildings have disabled/repair states rather than permanent account destruction. The first release does not burn player colonies or erase research.

## Deterministic event order

At each fixed simulation tick:

1. accept validated player events for the tick;
2. apply ability and deployment events in sequence order;
3. update movement and collision;
4. choose targets from stable sort `(priority, distance, entity_id)`;
5. resolve attacks and status effects;
6. apply destruction/repair transitions;
7. emit canonical events and advance the seed stream.

## Independent design justifications

- Capacity exists to make “what to bring” matter and to bound server/replay size.
- Reinforcement charges exist to create tempo decisions without RTS micromanagement.
- Scouting exists to turn uncertainty into a resource and make reports actionable.
- Retreat exists to protect time and preserve partial agency, not to sell a paid escape.
- Declared intent exists to prevent one attack from optimizing every reward at once.

## Balance guardrails

- A 20% power gap must not guarantee a win if composition/layout counters are valid.
- A new player’s first three PvE targets must expose at least two viable plans.
- No defensive archetype may be both universal and the best loot protector.
- Ability timing may swing a close battle, never erase a hard counter.
