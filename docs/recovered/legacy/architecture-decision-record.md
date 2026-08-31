# Architecture Decision Record

**Status:** ADR V0.1 — reversible decisions
**Access date:** 2026-08-30

## Context

The current repo is a TypeScript/Vite/Hono/PostgreSQL monorepo with a pure deterministic combat package. The product is primarily asynchronous, browser-playable, and needs Android distribution later. A backend rewrite before combat validation would increase risk without proving the thesis.

## Decision

- **Client:** continue TypeScript + React/Vite for the current browser-first foundation; isolate game-board rendering behind a renderer interface.
- **Mobile:** validate responsive web/PWA first; evaluate a Capacitor Android shell only after the vertical slice meets performance/input gates. Do not claim native mobile readiness yet.
- **Server:** continue custom TypeScript/Hono + PostgreSQL for asynchronous state, battle snapshots, reports, territory jobs, and audit ledgers.
- **Simulation:** pure TypeScript package with versioned ruleset, seeded RNG, canonical serialization, and no UI imports.
- **Nakama:** keep as a candidate for social/realtime primitives only if custom alliance/chat/notifications cost exceeds the benefit. It supports authoritative runtime, groups, chat, leaderboards, and matchmaker, but does not remove the need to define game rules or operate data migrations.
- **Rendering:** 2.5D sprite/canvas V1; no full 3D requirement.
- **Deployment:** one server process plus PostgreSQL first; add queues/workers only when measured load or job isolation requires them.

## Alternatives rejected for now

| Alternative | Why not now |
|---|---|
| Godot + GDScript rewrite | Strong native game fit, but duplicates current browser/client work and web export constraints remain; revisit after renderer spike. |
| Nakama-first | Good social primitives, but custom async battle/economy rules remain and migration would be premature. |
| Go backend | Strong ops/performance option, but loses current TypeScript shared DTO/test velocity. |
| Microservices | Adds deployment/observability cost before player value is proven. |

## Reconsideration triggers

- Browser render spike misses performance budget on two target devices.
- Capacitor shell cannot meet Android input, signing, or Play requirements.
- Custom server maintenance exceeds 25% of engineering time for two milestones.
- Alliance chat/presence requires capabilities unavailable without a specialized service.
- Server simulation throughput or memory becomes the measured bottleneck.

## Sources

- Godot web export: https://docs.godotengine.org/en/4.5/tutorials/export/exporting_for_web.html
- Godot Android export: https://docs.godotengine.org/en/latest/tutorials/export/exporting_for_android.html
- Nakama concepts: https://heroiclabs.com/docs/nakama/concepts/
- Nakama authoritative multiplayer: https://heroiclabs.com/docs/nakama/concepts/multiplayer/authoritative/
- Nakama groups/chat/leaderboards: https://heroiclabs.com/nakama/
