# Project Orbitscar — Units and Commanders

**Status:** DESIGN V0.1

Targeting is a visible player-facing language: `Defense → Utility → Any`, `Air → Any`, or `Nearest → Low armor`. The exact rules are data, not hidden script behavior.

## Conventional units

| ID | Role | Counters / weaknesses | Target priority | Range / movement | Capacity | Silhouette / VFX |
|---|---|---|---|---|---:|---|
| line_rigger | durable infantry screen | scatter coil; low damage | Defense → Any | short / ground | 1 | broad loader frame, amber tracer |
| pulse_marksman | anti-utility ranged infantry | arc projector; fragile | Utility → Any | long / ground | 1 | tall optic pack, thin pulse |
| breach_medic | repairs nearby units | phase jammer; no burst | Any → Low health | short / ground | 2 | bright satchel, repair threads |
| signal_saboteur | disables a defense briefly | interceptor nest; low health | Defense → Utility | short / ground | 2 | asymmetric antenna, glitch arc |
| ram_walker | armored structure breaker | snare lattice; slow | Defense → Core | medium / ground | 4 | four-legged wedge, impact rings |
| skirmish_walker | mobile flank pressure | arc projector; light armor | Utility → Any | medium / ground | 3 | narrow reverse-joint chassis |
| shield_carrier | projects moving cover | phase jammer; weak alone | Nearest defense | short / ground | 3 | hex shield rib, refractive dome |
| salvage_hauler | extracts loot safely | any defense; no combat | Depot → Resource | short / ground | 2 | cargo sled, beacon tether |
| needle_drone | cheap air harassment | interceptor nest | Air → Utility | medium / air | 1 | dart silhouette, cyan streak |
| relay_drone | reinforcement anchor and intel | interceptor nest; no damage | Utility → Any | medium / air | 2 | floating ring, green link |

## Commanders

| ID | Identity | Active ability | Passive doctrine | Cost / risk |
|---|---|---|---|---|
| mara_voss | field logistics operator | **Emergency Reroute:** move one reinforcement drop point and refund 25% of its capacity once | **Prepared Lines:** first legal drop has a wider safe zone | 1 charge; cannot affect deployed units |
| ion_kade | signal warfare specialist | **Overwatch Ping:** reveal current defense target and expose its next target for 6 seconds | **Cold Read:** scout confidence decays 20% slower | 1 charge; no damage or stun |

Commanders are earned through objectives, never randomized. Their abilities modify information, positioning, or tempo; they do not supply a large raw-stat multiplier.

## Roster design rules

- Every unit has at least one clear answer and one useful niche.
- No unit is required for basic PvE completion.
- Silhouette and behavior remain readable at phone scale.
- Damage type, armor, and target tags are shown in plain language.
- Initial balance uses small integer parameters in machine-readable data, not UI code.
