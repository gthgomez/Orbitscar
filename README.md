# Project Orbitscar

Project Orbitscar is an independent clean-room sci-fi strategy prototype. It is a distinct game from Tideforge Empires. This repository has no runtime dependency on Tideforge code, content, namespaces, assets, or configuration.

The working title is provisional and has not received trademark, domain, or store clearance.

## Current boundary

- `packages/simulation/` — deterministic, headless battle and persistent-colony rules.
- `packages/content/` — declarative buildings, units, defenses, commanders, authored NPC targets, and validation.
- `fixtures/` — small reproducible battle inputs.
- `apps/web/` — Phaser tactical view plus an accessible DOM command surface for colony, target, army, deployment, replay, and report states.
- `docs/` — recovered research plus independent product, architecture, UX, art, economy, security, testing, and roadmap records.

The current product gate is a coherent local colony-to-breach loop: build, train, scout, compose, deploy, watch autonomous combat, read the report, and return with reconciled survivors and salvage. Alliances, live operations, monetization, and a persistent backend remain deliberately deferred.

## Local commands

```text
pnpm install
pnpm validate:content
pnpm typecheck
pnpm test
pnpm test:browser
pnpm evaluate -- --runs 1344 --out runs/eval-local
pnpm simulate -- fixtures/battle_fixture.json
pnpm --filter @orbitscar/web build
pnpm check

The browser client is intentionally Phaser-only for tactical rendering; React is not a dependency.
```

Human blind-test instrumentation lives in `docs/playtest/` (protocol, observation form, session checklist); the item-10 gate remains BLOCKED_ON_HUMAN_PLAYTEST until five real sessions are recorded.

The project is repo-ready but unpublished. Do not add Tideforge as a workspace, package source, Git submodule, or development dependency.

## License

Project Orbitscar is **proprietary**. This repository is public for viewing and
development transparency, but public visibility does not grant permission to
copy, modify, redistribute, sublicense, sell, commercially exploit, or create
derivative works from the project's original source, design, art, or content.
See [LICENSE.md](LICENSE.md).

Third-party dependencies (for example Phaser and Vite) remain under their own
license terms. The working title "Project Orbitscar" is provisional and has not
received trademark, domain, or store clearance.
