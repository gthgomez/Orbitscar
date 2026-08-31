# Verification summary

Access date: 2026-08-30. This records the commands actually run for the campaign; a blocked command is not represented as a passing test.

## Passed checks

- `node node_modules\\.pnpm\\typescript@5.9.3\\node_modules\\typescript\\bin\\tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --strict --skipLibCheck packages\\combat\\src\\orbitscar.ts` — exit 0. The isolated deterministic foundation type-checks.
- `node -e "...JSON.parse(balance.json)..."` — exit 0. The seed file has schema version 1, ruleset `orbitscar-v0`, 6 buildings, 10 units, and 2 commanders.
- `git diff --check` — exit 0 for tracked changes.

## Blocked or failed checks

- Baseline workspace scripts (`pnpm test`, `pnpm typecheck`, and web build) did not reach their test/build phases because pnpm attempted to reconcile an incomplete `node_modules` tree and required a TTY.
- `CI=true pnpm install --offline --frozen-lockfile` failed because the offline cache lacked the `@types/react` tarball.
- An escalated online `CI=true pnpm install --frozen-lockfile` reused some packages but ended with pnpm's ignored-builds error for `esbuild`; subsequent parallel attempts encountered registry connection failures. The install was not completed.
- Focused Vitest invocation failed before collection because Vite could not resolve `esbuild` from the incomplete install.
- Full combat package type-check is currently blocked by the incomplete workspace links: `packages/combat/src/index.ts` cannot resolve `@tideforge/content`.

## Scope and integrity checks

- The Orbitscar content and combat foundation are isolated from existing Tideforge content IDs and resolver logic.
- No Edgeworld assets, archives, SWF files, or copied screenshots were downloaded or added.
- `pnpm-workspace.yaml` was restored after pnpm 11 attempted to append an `allowBuilds` setting; it has no diff.
- No secrets or credential stores were read.
