# Scope Review

**Status:** ACTIVE

| Milestone | Systems | Assets/content | Backend/ops | Exit evidence |
|---|---|---|---|---|
| Prototype | deterministic combat, placement, one report | debug geometry, 4 units, 3 defenses, 1 commander | local-only | strangers repeat attack |
| Vertical slice | colony placement, scout, async snapshot, repair, replay | 4 buildings, 4 units, 3 defenses, 1 biome | in-process server | acceptance in `docs/roadmap/vertical-slice.md` |
| Closed alpha | account, economy, 10 units, 2 commanders, PvE, reports | 18 buildings, initial UI/audio | hosted server, telemetry, moderation basics | cohort retention and security tests |
| Public beta | alliances, small sector, cosmetics, support | authored scenarios and seasonal pass | backups, alerts, migration drills, store compliance | 30-day stability and fairness |
| 1.0 | seasonal territory, social tools, content cadence | several biomes, VFX/audio polish | SLOs, anti-abuse, customer support | season test with rollback |

## MUST

Combat fun test, deterministic rules, server authority, readable placement, reports/replays, solo PvE path, fair resource model, phone/browser performance budget, originality review.

## SHOULD

Alliance territory, cosmetic identity, asynchronous alliance orders, defense simulator, light narrative archive, account recovery.

## LATER

Seasonal variants, spectator sharing, more biomes, limited co-op operations, tablet/desktop enhancement, creator tools.

## DO NOT BUILD YET

Real-money purchases, gacha, 50+ units, real-time PvP, procedural galaxy, world chat, full diplomacy, multiple currencies, microservices, native Godot rewrite, custom 3D pipeline, voice chat.

## Main scope traps

1. Building territory before combat is fun.
2. Treating “MMO” as a launch requirement instead of an architectural option.
3. Making every unit/building fully animated before readability is proven.
4. Adding social/admin tools faster than the core player loop.
5. Letting current Tideforge medieval content and new sci-fi content share IDs or lore by accident.
