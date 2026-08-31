# Balance Harness

**Status:** TESTING V0.1

## Purpose

Run headless, seeded battles using the same pure rules package as the server. The harness must support army-vs-base, unit-vs-defense, archetype matchups, thousands of seeds, and regression comparison against a frozen ruleset.

## Inputs

- `balance.json` content data;
- base layout snapshot;
- army composition and commander;
- deployment plan;
- `BattleSeed`;
- ruleset/content version.

## Outputs

JSONL per battle: seed, ruleset, winner/outcome, duration, units lost, structures disabled, loot extracted, ability events, event hash, and invariant violations.

## Required reports

- matchup win-rate matrix with confidence interval;
- power-gap vs counter quality;
- deployment-zone sensitivity;
- defense archetype coverage;
- economy cost per expected outcome;
- distribution of battle durations and stalemates.

## Stop conditions

Fail CI when a frozen matchup moves more than 5 percentage points without a baseline update, any invariant is violated, or a unit has no viable counter in the defined roster.
