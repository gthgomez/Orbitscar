# Decision Log

**Status:** ACTIVE

## D-001 — Narrow the product to the breach loop

- **Question:** Should this be a broad mobile 4X MMO from day one?
- **Alternatives:** full 4X first; base-attack-first; single-player tactical prototype.
- **Evidence:** Edgeworld’s strongest evidence centers on scout/place/autonomous battle/report; current competitors already own broad alliance/4X scale; red-team rates scope as P0.
- **Choice:** base-attack-first, with territory as a later multiplier.
- **Why:** directly tests the highest-value and most falsifiable hypothesis.
- **Downside:** may discover the market wants social scale more than combat.
- **Reconsider when:** blind testers fail to repeat attacks or territory tests show stronger pull.

## D-002 — Use Project Orbitscar as provisional codename

- **Question:** What working title should the clean-room design use?
- **Alternatives:** retain Tideforge Empires; use a public brand now; use an internal codename.
- **Evidence:** current repo contains medieval Tideforge fiction; branding was not part of the validated research.
- **Choice:** internal codename `Project Orbitscar`; no public branding claim.
- **Why:** separates the sci-fi clean-room direction from existing content and avoids premature identity lock.
- **Downside:** creates a naming migration later.
- **Reconsider when:** legal/title/domain review and user testing are complete.

## D-003 — Retain TypeScript/Vite/Hono/PostgreSQL for now

- **Question:** Should the project rewrite to Godot/Nakama immediately?
- **Alternatives:** Godot client + custom backend; Godot + Nakama; current web stack; Go backend.
- **Evidence:** current repo already has web/server/deterministic combat foundations; Godot web has WebGL2/Compatibility and threaded-export deployment constraints; Nakama still requires custom authoritative rules.
- **Choice:** additive TypeScript clean-room package and renderer boundary; revisit after slice performance.
- **Why:** lowest-regret path to test combat and browser reach.
- **Downside:** 2.5D rendering may be less ergonomic than a game engine.
- **Reconsider when:** renderer spike or Android shell misses measured budgets.

## D-004 — 10-week seasonal relay graph

- **Question:** How should alliance territory be structured?
- **Alternatives:** persistent grid; pure hex; procedural graph; authored graph with procedural decoration; no territory.
- **Evidence:** adjacency is validated across Edgeworld and current competitors; monopoly and admin risks are high.
- **Choice:** authored 96-node graph, supply integrity, front-only attacks, 10-week season.
- **Why:** makes geography legible and reversible while limiting map drift.
- **Downside:** 96 nodes may be too small/large for a real population.
- **Reconsider when:** 3–6 alliance map test produces concentration or insufficient fronts.
