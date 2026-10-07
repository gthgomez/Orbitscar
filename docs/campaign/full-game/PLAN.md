# Orbitscar V1 Campaign Plan

## Ordered milestones and dependencies

1. **Truthful baseline and economy** — Inspect current loop, migrations, checks, balance gates and assets. Replace artificial click income with bounded time/progression production, real extractor upgrade effects, storage limits and safe catch-up. Acceptance: no repeated-click faucet, nonnegative capped resources, malformed/large elapsed time bounded, upgrades alter production, failures remain recoverable. Verify: unit/property tests, migration tests, typechecks, content validation.
2. **Progression and onboarding** — Add command tiers, unlock pacing, meaningful four-theme research/doctrine choices, objectives that reveal systems, and first-session guidance using real systems. Acceptance: fresh save offers a short clear path; choices unlock gameplay and cannot soft-lock. Verify: progression and save migration tests, content validation. Current evidence: six real-action objectives, tiered content/scouting, 54 passing tests, and schema 7 migration preserving old duplicate-relay saves by keeping the highest-level relay.
3. **Colony defense and geometry** — Translate a player's colony into authoritative battle snapshots; deterministic NPC raids, actual defense fire, damage/recovery, defensive reports/replay. Make layout, structures and upgrades matter. Verify: headless raids, layout/path tests, settlement idempotence.
4. **Incremental deterministic combat and commanders** — Add tick advancement plus validated ordered commands, live deployment/reinforcements, commander choice and intervention, retreat, replay from snapshot/seed/commands. Acceptance: stale, duplicate and out-of-order commands rejected; exact replay hashes reproduce. Verify: command/property/replay tests and client typecheck.
5. **Balance and spatial combat** — Use the evaluation corpus to remove screen spam, zero-loss universal strategies and immediate-mass dominance; strengthen specialists, staged play, commanders and approach geography. Add deterministic navigation/chokes/ranges shared by attack and defense. Verify: all gates always-on and evaluation corpus evidence.
6. **Reports and PvE campaign** — Causal reports grounded in events; 10–12 meaningful encounters with authored layouts/modifiers and multiple raid archetypes; survivor/reward loop and repeat attacks. Verify: data validation, progression, report/replay tests and corpus.
7. **Asynchronous rival foundation** — Local server/API with versioned authoritative snapshots, command validation, idempotent settlement/rewards and persisted reports; multiple local identities. Verify: direct API integration/security tests.
8. **Relay sector and crews** — Connected graph, ownership, supply/adjacency, solo progression and snowball controls; minimal role/order/contribution crew rules if needed. Verify: deterministic graph, permission, and territory tests.
9. **Presentation, accessibility, robustness** — Integrate original art, readable silhouettes/effects, responsive accessible controls/reports/objectives/sector, performance bounds, save validation, production build. Verify all browser-free checks and build.
10. **Final browser certification and adversarial review** — Only after all prior non-browser gates pass, run/expand Playwright against production build at desktop and phone sizes; fix and rerun. Review from player, design, balance, mobile, accessibility, security, maintenance and QA perspectives. Document human playtest gate honestly.

## Architectural decisions

- The deterministic simulation remains the only combat rules engine for client, evaluation, replay and server.
- Battle truth is initial snapshot + seed + ordered commands; presentation consumes authoritative events/results.
- Local asynchronous server is sufficient; no cloud credentials or commercial hosting required.
- Save changes are versioned and migrated; economy elapsed time is capped and clock rollback cannot mint resources.
- Content stays validated/data-driven where practical; do not expand the roster to mask balance or depth issues.
- Browser automation is prohibited until final certification; Linux-side tests, typechecks, validation, evaluation and production builds are the continuous evidence.

## Intentionally deferred

Real OAuth, commercial deployment, payments, monetization, gacha, energy systems, public chat, large roster/cosmetics catalog, Kubernetes/microservices, app packaging, and human playtest claims. Human blind-playtest evidence remains a handoff if testers are unavailable.
