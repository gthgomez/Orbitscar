# Project Orbitscar — Sector and Alliance War

**Status:** DESIGN V0.1 — highest-risk system

## Topology decision

Use an authored graph with light procedural decoration: 96 nodes arranged into 8 sectors, each with 2–3 choke relays and 1 neutral objective. Edges represent travel/supply lanes. A pure grid is too visually familiar and creates diagonal ambiguity; a pure procedural graph risks uninteresting fronts. A graph supports authored geopolitical problems and clear adjacency rules.

## Node archetypes

- **Colony:** player-facing bases; personal progression remains persistent.
- **Mining field:** alliance resource contribution with contestable extraction windows.
- **Jump relay:** extends legal attack/reinforcement reach.
- **Sensor station:** reveals stale enemy movements and improves scouting confidence.
- **Fortress moon:** high-value seasonal objective with defensive preparation.
- **Archive station:** unlocks a temporary rules modifier or cosmetic story.
- **Alliance citadel:** seasonal coordination hub; cannot be bought and cannot permanently lock a player out.

## Supply and front rules

- An alliance may contest a node only if it is adjacent to owned territory or connected through an active relay.
- Territory has a **supply integrity** score. Every owned edge must be connected to a citadel or relay; isolated nodes become vulnerable and yield no bonus.
- Fronts are generated where two alliances have adjacent supplied nodes. Only front nodes can be attacked by default.
- A neutral buffer ring around new-player colonies prevents direct harassment during the first 72 hours and during relocation.
- Node ownership changes through a scheduled operation window plus a battle result; no instant sniping from a disconnected tile.
- Personal colony attacks use asynchronous snapshots and separate eligibility from territory ownership.

## Seasonal model

Recommended first season: **10 weeks** — long enough for diplomacy and fronts, short enough to reset monopolies before the map ossifies. A 12-week season is a later test if participation data shows insufficient time for smaller alliances.

Persistent: account, colony layout, units, commanders, research history, cosmetics, achievements, report library.

Seasonal: map ownership, node upgrades, supply integrity, alliance campaign score, seasonal modifiers, citadel state, territory rewards.

## Anti-monopoly and access controls

- Alliance territory soft-caps bonuses after the first 30 supplied nodes.
- Marginal bonuses favor underrepresented fronts, not raw map area.
- A leading alliance creates upkeep and exposed-front costs; owning everything is strategically expensive.
- Alliances may form limited non-aggression pacts, but rewards require active contested operations.
- New alliances receive a protected staging region and can participate in low-tier nodes mid-season.
- Inactive ownership decays into neutral after 72 hours without a garrison or contribution, with a warning period.
- Timezone windows rotate weekly and offer asynchronous “prepared operation” scoring for players who cannot attend.
- Account relocation cooldowns, contribution provenance, and device/account anomaly review reduce alt abuse.
- No permanent territory power; end-of-season rewards are cosmetics, titles, and archive access.

## Alliance roles

Default roles are **member**, **planner**, and **steward**. Permissions are narrow, logged, reversible, and have confirmation for destructive actions. The alliance board shows three suggested orders, not a full project-management tool.

## Kill criteria

Stop expanding the territory system if a 3–6 alliance playtest shows one alliance owns >55% of supplied nodes for two consecutive weeks, if >30% of players report alliance scheduling as work, or if solo players cannot find meaningful PvE within 72 hours.
