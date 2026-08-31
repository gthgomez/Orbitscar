# Project Orbitscar — Building Roster

**Status:** DESIGN V0.1 — original archetypes, not Edgeworld replicas

Footprints use a logical 1×1 grid cell for a 64-unit planning tile. Art targets are silhouette goals only.

| ID | Category | Purpose | Footprint | Upgrade role | Attack-priority implication | Silhouette / animation | Cosmetic hook |
|---|---|---|---:|---|---|---|---|
| command_relay | Core | Command cap, unlocks, defeat anchor | 3×3 | expands grid and deployment budget | highest-value objective | split-ring mast, rotating signal | colony centerpiece |
| habitation_ring | Core | crew capacity and repair workforce | 2×2 | raises offline buffer and repair rate | utility after defenses | lit ring modules | habitat themes |
| matter_extractor | Economy | produces alloy feedstock | 2×2 | output and storage buffer | loot target | drilling arm and dust plume | machine skins |
| volatile_condensor | Economy | produces volatile fuel | 2×2 | output and conversion efficiency | high-risk fuel target | vertical condenser fins | emission colors |
| signal_reclaimer | Economy | produces signal fragments | 2×1 | research input and intel quality | utility target | antenna field | hologram kit |
| depot | Economy | stores normal resources | 2×2 | protection and capacity | loot target | low armored block | crate/paint kits |
| power_spine | Economy | routes energy to buildings | 1×3 | grid capacity and redundancy | disables connected cluster | glowing segmented conduit | conduit material |
| infantry_foundry | Military | trains ground squads | 2×2 | queue speed and unlocks | production target | low wide press | industrial skins |
| walker_bay | Military | trains armored walkers | 3×2 | queue speed and chassis tiers | production target | open gantry with crane | chassis paint |
| drone_fabricator | Military | trains autonomous drones | 2×1 | queue slots and flight tiers | production target | vertical launch rack | drone trails |
| drop_cradle | Military | stores deployment charges | 2×2 | breach capacity and placement anchors | core support target | suspended hex frame | drop effects |
| signal_lab | Research | power/logistics research | 2×2 | unlock branch depth | utility target | dish cluster and screens | lab lighting |
| tactics_lab | Research | breach/defense research | 2×2 | counter and ability upgrades | utility target | asymmetric analysis tower | data overlays |
| arc_projector | Defense | long-range single-target beam | 2×2 | range and pierce choices | prioritizes walkers | forked emitter, charge cycle | beam color |
| scatter_coil | Defense | short-range anti-swarm burst | 1×1 | cone and cooldown choices | prioritizes infantry | squat coil, recoil | muzzle style |
| snare_lattice | Defense | slows and redirects ground units | 2×1 | area and duration | utility/control priority | floor lattice, pulsing nodes | grid pattern |
| interceptor_nest | Defense | anti-air and anti-drone | 2×2 | salvo and tracking choices | prioritizes drones | folded launch petals | interceptor color |
| phase_jammer | Defense | hides allies and disrupts abilities | 2×2 | radius and uptime | utility-first target | dark prismatic cage | refraction theme |
| repair_bay | Utility | repairs adjacent structures between attacks | 2×2 | throughput and emergency charge | support target | articulated repair arms | maintenance crews |
| sensor_mast | Utility | improves scouting and warns of attacks | 1×2 | intel depth and warning | utility target | telescoping mast | antenna banners |

The roster contains 21 entries; the vertical slice uses 4: command relay, matter extractor, drop cradle, and one chosen defense set. Alpha may cut to 18 by deferring habitation ring, power spine, and repair bay if they do not create distinct decisions.

## Building rules

- A building’s footprint and target priority are visible before construction.
- Upgrades can change behavior at tiers 4 and 8; pure numerical tiers are capped.
- Any building that can be destroyed has a clear disabled state and repair consequence.
- No visual tier should be a one-to-one reconstruction of an archived game asset.
