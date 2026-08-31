# Project Orbitscar — Economy Model

**Status:** BALANCE SEED V0.1 — illustrative, not final tuning

## Resources

| Resource | Faucets | Sinks | Storage | Design role |
|---|---|---|---|---|
| Alloy | extractor, PvE salvage, territory node | buildings, walkers, repairs | depot | construction/material bottleneck |
| Volatile | condenser, missions, safe extraction | energy routing, training, abilities | depot | tempo and operational choice |
| Signal | reclaimer, scouting, reports, archive nodes | research, intel refresh, alliance orders | signal lab | information progression |
| Prism (premium) | none in combat | cosmetics and optional noncombat convenience | account wallet | never a battle input |

## Economy rules

- Faucets are server-created ledger entries with source IDs; sinks consume an exact reason code.
- Resource balances may never go negative.
- Storage protection means a loss cannot erase a player’s ability to play the next action.
- Upgrade costs use a gently increasing curve with branch choices, not exponential walls.
- Unit losses use repair/material costs bounded to a daily budget; a failed attack must not create a multi-day lockout.
- Alliance contributions grant shared progress and personal non-power recognition.

## Initial simulation targets

The machine-readable seed is `packages/content/data/orbitscar-v0/balance.json`.

| Player | Daily active time | Day 1 normal-resource net | Day 7 normal-resource net | Expected decision |
|---|---:|---:|---:|---|
| Casual | 10 min | positive | positive | one upgrade or two small trains |
| Active | 30 min | positive | positive | two attacks plus research |
| Optimized | 90 min | positive but storage-limited | positive with diminishing returns | more choices, not runaway power |
| Solo | 20 min | same as active before alliance bonuses | viable PvE progression | alliance is optional |

These are acceptance targets for a headless simulator, not observed outcomes. Day 30 and season economics remain unknown until the combat/balance harness exists.
