# Tactical Scenario Evidence

Command used: `pnpm simulate -- fixtures/scenario-frontal.json fixtures/scenario-flank.json fixtures/scenario-delayed.json`.

All three scenarios use the same six-structure base and owned army. They differ only in deployment geometry, reinforcement timing, and commander timing.

| Scenario | Result | Duration | Casualties | Structures destroyed |
|---|---|---:|---|---|
| Frontal | attacker / full | 1228 ticks | 2 line riggers, 1 needle drone | arc, cradle, extractor, relay, scatter, snare |
| Flank | attacker / partial | 993 ticks | 2 line riggers | arc, cradle, relay, scatter, snare |
| Delayed | attacker / partial | 852 ticks | 1 line rigger | arc, relay, scatter, snare |

Observed conclusion: the current fixture does not converge to one outcome. Geography and timing change casualties, completion time, victory tier, and structure destruction. This is prototype evidence, not human product validation. The delayed case ended before later commands were needed because the first wave breached the relay; that is itself a useful follow-up question for encounter tuning.

## Drop-and-watch adversarial result

The trivial strategy is not a single universal baseline because the three scenarios have different legal command streams. In the current test set, replacing a staged flank with a west-front deployment changes the outcome tier and damage profile. This is evidence against a pure power check, but not yet proof of satisfying agency: a human must still demonstrate that they can predict and intentionally cause the difference.
