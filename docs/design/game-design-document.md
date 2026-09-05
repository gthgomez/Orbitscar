# Project Orbitscar — Game Design Document

**Status:** PRODUCT DEFINITION V0.1 — provisional, post-research
**Access date:** 2026-08-30
**Working title:** Project Orbitscar. Name search was only a light web collision check; trademark, domain, and store clearance remain open.

## One-sentence pitch

Project Orbitscar is a cross-platform asynchronous strategy game where players build a compact orbital salvage colony, scout rival fortresses, deploy a capacity-limited breach force, time a few interventions, and fight for connected relay territory without buying combat power.

## Player fantasy

You are the shift commander of a fragile colony at the edge of a failed transit network. Your satisfaction comes from making a readable plan under incomplete information, watching it work, and leaving a better defense for the next visitor—not from managing a spreadsheet or collecting a roster of superior heroes.

## Design pillars

1. **The colony is a battlefield.** Placement, exposure, power, and protection create real choices.
2. **Deployment is commitment.** Capacity and limited reinforcement windows make composition and drop location matter.
3. **Territory creates stories.** Alliances fight over connected relays and supply lanes, not only leaderboards.
4. **Progress respects time.** Short sessions are complete plays; long-term plans never block the first useful decision.

## Core loop

Build and route power → collect and convert → research a counter → train a compact force → scout → choose a breach plan → deploy → intervene → review the signed report → adjust colony or force → contest a relay when ready.

## Session loops

| Session | Promise |
|---|---|
| 2 minutes | Claim production, inspect alerts, queue one short plan, review a report |
| 10 minutes | Scout, attack one NPC/rival base, make one layout change |
| 30 minutes | Run two attacks, test a defense in simulator, coordinate an alliance order |
| Daily | Two or three meaningful attacks, research/training decisions, one map contribution |
| Weekly | Frontline operation window, alliance planning, report review, cosmetic/social showcase |
| Seasonal | 10-week relay campaign with authored topology, new node rules, and non-power prestige rewards |

## Progression

- **Base:** 12 command tiers in the first release, with a compact footprint expansion at tiers 4, 8, and 12.
- **Account:** unlocks tutorials, cosmetics, replay tools, and optional challenge modifiers; does not grant raw PvP power outside earned research.
- **Units:** 10 conventional units with sidegrades and explicit counters; levels are capped per season band.
- **Commanders:** 2 operational specialists, each with one active ability and one passive doctrine; no random acquisition.
- **Research:** four branches—power, logistics, breach, defense—with mutually exclusive capstone choices per season.
- **Alliance:** coordination capacity, shared intel archive, and territory logistics; no alliance-wide paid combat multiplier.
- **Territory:** seasonal access, relay services, and campaign score; personal colony remains persistent.
- **Cosmetics:** colony themes, silhouettes/paint kits, commander wear, deployment/replay effects, banners, profile identity.

## Early-game reveal

| Time | Player learns |
|---|---|
| 5 minutes | Place a power source and one production building; see cost and footprint before commit |
| 15 minutes | Train two counters and defend against a scripted probe |
| 1 hour | Scout and attack an NPC base; use one ability; receive a report |
| Day 1 | Move one defense, replay a loss, join or decline a low-pressure expedition |
| Day 3 | Choose a research branch and make a second colony-layout plan |
| Day 7 | Reach first relay-adjacent operation and understand seasonal map stakes |

## Constraints

- No gacha, combat loot boxes, exclusive dominant unit, energy system, or monetized warps.
- No more than three base resources in the first economy.
- No social requirement for solo PvE and personal progression.
- No real-time PvP in the first slice; asynchronous snapshots only.
- No 50-unit content plan before a repeat-playtest proves the ten-unit roster is insufficient.

## Success metrics for the first product test

- First attack completion ≥70% among new testers.
- Second attack started by ≥50% after viewing the report.
- ≥60% can name one counter relationship without a wiki.
- Median attack setup under 90 seconds; median battle under 120 seconds.
- No pay-to-win perception in a build with no purchases; test wording separately later.
- Former Edgeworld players identify broad lineage while rating “not a remake” ≥4/5.

These are decision thresholds, not market facts.

## Remediation doctrine (V0.3)

Preserve the persistent colony rhythm, scout → compose → deploy, capacity-constrained forces, multiple reinforcement opportunities, autonomous battle, meaningful layout, battle reports, and the future alliance/territory layer. Modernize visual fidelity, performance, responsive input, information architecture, onboarding, accessibility, replay clarity, fairness, and the monetization philosophy. Do not copy names, lore, exact art, UI chrome, sounds, maps, values, factions, assets, code, or one-to-one expressive counterparts.

The current local slice implements the colony loop, deterministic staged deployment, replay/report, explicit retreat, and local settlement. Live mid-battle reinforcement, alliance/territory, backend authority, audio, and final art remain planned rather than complete.
