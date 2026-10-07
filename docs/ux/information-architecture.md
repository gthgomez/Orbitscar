# Project Orbitscar — Information Architecture

**Status:** UX V0.1

## Primary navigation

Current client navigation is `COLONY` · `TARGETS` · `ARMY`. The sector is a target-selection surface; alliance/crew navigation is deferred.

The three destinations map to the current player questions: “How is my colony?” “Where can I attack?” and “What can I deploy?” Reports, research, objectives, and the relay map remain contextual. Crew coordination is not part of the current client.

## Surface map

| Surface | Entry | Primary action | Secondary |
|---|---|---|---|
| Base HUD | BASE | select/inspect/place | resources, alerts, objectives |
| Build catalog | selected empty plot | place | filter, compare, footprint |
| Research | command relay / objectives | choose branch | requirements, preview |
| Production | selected foundry/bay | queue unit | queue reorder, capacity |
| Forces | FORCES | create loadout | commander, modules, unit rules |
| Scout | target card | request intel | snapshot age, confidence |
| Attack setup | target card | confirm breach | loot intent, legal zones |
| Battle HUD | attack | deploy/intervene/retreat | speed/pause only in PvE/replay |
| Reports | post-battle / BASE alert | open timeline | replay, share, rematch |
| Defense simulator | reports / BASE | test layout | scenario selector |
| Sector map | SECTOR | inspect/contest node | filters, front legend |
| Alliance | ALLIANCE | read/accept order | members, diplomacy, contributions |
| Objectives | persistent compact card | choose next task | history |
| Cosmetics | profile/base context | equip identity | preview, social visibility |
| Settings | profile | configure | accessibility, account, privacy |

## Information hierarchy

1. Current threat or opportunity.
2. What can be done now.
3. Cost, risk, and expected consequence.
4. Long-term progress.

The colony/sector remains visually dominant. Critical text is paired with a plain-language label; icons are not the sole language. Colony, Targets, and Army are implemented primary destinations. Contextual research, objectives, battle reports/replays, the relay sector, and a local authority profile switch are implemented. In authority mode, the selected profile owns colony actions and PvE settlement; rival nodes expose versioned defender snapshots and submit the completed deterministic command stream for authoritative settlement. Cosmetics and alliance/crew features remain deferred.
