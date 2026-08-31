# Project Orbitscar

Project Orbitscar is an independent clean-room sci-fi strategy prototype. It is a distinct game from Tideforge Empires. This repository has no runtime dependency on Tideforge code, content, namespaces, assets, or configuration.

The working title is provisional and has not received trademark, domain, or store clearance.

## Current boundary

- `packages/simulation/` — deterministic, headless battle rules.
- `packages/content/` — declarative prototype content and validation.
- `fixtures/` — small reproducible battle inputs.
- `docs/` — recovered research plus independent product, architecture, UX, art, economy, security, testing, and roadmap records.

The immediate product gate is whether a short colony breach is fun. Alliances, live operations, monetization, and a persistent backend are deliberately deferred.

## Local commands

```text
pnpm install
pnpm validate:content
pnpm typecheck
pnpm test
pnpm simulate -- fixtures/battle_fixture.json
pnpm --filter @orbitscar/web build

The visual prototype lives in `apps/web` and is intentionally Phaser-only for real-time battle rendering; React is not a dependency.
```

The project is repo-ready but unpublished. Do not add Tideforge as a workspace, package source, Git submodule, or development dependency.
