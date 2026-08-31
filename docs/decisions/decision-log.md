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
## D-005 — single Orbitscar combat contract

- Question: How should content and simulation share targeting, deployment, and replay semantics?
- Alternatives: retain legacy string priorities; embed balance in the resolver; use a shared runtime-validated content schema and explicit command stream.
- Evidence: legacy content contained incompatible terms and the previous resolver reused stack quantities. The hardened tests reject unknown selectors, fractional counts, reuse, duplicate commands, and out-of-window ticks.
- Choice: use `packages/content/src/schema.ts`, content-backed identifiers, explicit quantities, canonical `tick -> sequence -> commandId` ordering, and a versioned SHA-256 digest.
- Downside: the prototype cannot consume old fixture shapes without migration, and the simulation package now has one small workspace dependency on content types.
- Reconsider when: the battle rules stop being pure or a second independent game proves it needs the same schema.

## D-006 — Phaser for first visual combat client

- Question: Which client technology should test spatial battle agency?
- Alternatives: Godot, React UI renderer, custom Canvas/WebGL client, Phaser 3.
- Evidence: Phaser provides a focused WebGL/Canvas game loop and TypeScript browser path; Godot web export remains viable but has web/mobile constraints; React is not a real-time renderer. See [architecture-decision-record.md](../architecture/architecture-decision-record.md).
- Choice: Phaser 3 + TypeScript + Vite for this prototype, with simulation kept renderer-independent.
- Downside: Android packaging and WebView behavior remain unverified, and the bundle is currently over Vite's 500 kB warning threshold.
- Reconsider when: the battle slice fails on low-end Android or Phaser cannot sustain the measured entity/event budget.
