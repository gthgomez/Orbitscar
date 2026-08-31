# Orbitscar verification summary

Audit date: 2026-08-30. This file records commands actually run against the independent root.

## Passed

- Repository search found no `@tideforge/*`, Tideforge path, or Tideforge package reference in Orbitscar source/configuration.
- `pnpm install --ignore-scripts` — **PASS** outside the managed shell; lockfile passed supply-chain policy and installed 55 packages.
- `pnpm validate:content` — **PASS**; 3 resources, 6 buildings, 10 units, 2 commanders.
- `pnpm typecheck` — **PASS**.
- `pnpm test` — **PASS**; 1 file, 3 tests.
- `pnpm simulate -- fixtures/battle_fixture.json` — **PASS**; deterministic partial result, 1,200 ticks, two destroyed defenses, eight events, outcome hash `10dd83c5`.
- No Edgeworld assets, dependency cache, build output, or secret is part of the source boundary or review bundle.

The managed shell produced `spawn EPERM` for esbuild, so the install, Vitest, content, and CLI commands were rerun through the approved outside-sandbox path. That is an environment execution constraint, not a project test failure.
