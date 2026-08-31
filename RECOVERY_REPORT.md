# Orbitscar recovery and clean-room foundation report

Audit date: 2026-08-30. This report records the repository separation, recovery, revalidation, and combat-readiness work.

## FINAL_VERDICT

**ORBITSCAR_ISOLATED_AND_READY**

The identity error is corrected, the independent foundation exists, and Orbitscar's own dependency installation, content validation, typecheck, Vitest suite, and headless fixture run pass. The managed shell still produces `spawn EPERM` for esbuild, but the same commands pass through the approved outside-sandbox execution path.

## TIDEFORGE_CONTAMINATION

Observed against `2524e9983623a7f04aec63da05c1c1f54817a1d8`:

| File | Exact contamination | Resolution |
|---|---|---|
| `packages/combat/src/index.ts` | 15-line re-export of the Orbitscar module from an existing Tideforge package. Existing Tideforge imports and logic were otherwise unchanged. | Removed. File now matches the baseline. |
| `pnpm-workspace.yaml` | pnpm added `allowBuilds: esbuild: set this to true or false`. | Removed. File now matches the baseline. |
| `packages/combat/src/orbitscar.ts` | New clean-room module stored inside Tideforge’s combat package. | Reimplemented under `Orbitscar/packages/simulation`; original copied to `docs/recovered/legacy/tideforge-orbitscar.ts`. |
| `packages/combat/src/orbitscar.test.ts` | New Orbitscar test stored inside Tideforge’s combat package. | Recovered and rewritten under Orbitscar; exact prior copy retained in legacy recovery. |
| `packages/content/data/orbitscar-v0/balance.json` | New Orbitscar data stored inside Tideforge’s content package. | Copied into Orbitscar; exact prior copy retained in legacy recovery. |
| Campaign docs and review ZIP/checksum | New untracked research/design/package artifacts at the Tideforge root. | Copied into Orbitscar; removed from Tideforge after provenance capture. |

No Tideforge source, existing tests, balance schema, app config, CI file, or content was changed by the recovery. The existing `@tideforge/content` dependency belongs to Tideforge’s original combat module; Orbitscar does not use it.

## PRESERVED_TIDEFORGE_WORK

**Observed:** Tideforge status is clean; `git diff --stat 2524e9983623a7f04aec63da05c1c1f54817a1d8` returns no changes; branch remains `main`; HEAD remains `2524e9983623a7f04aec63da05c1c1f54817a1d8`; origin remains `https://github.com/gthgomez/TideforgeEmpires.git`.

The separate `TideforgeEmpires-cmv1` worktree was not modified. The untracked `C:\Workspace\oss-tideforge-work` directory was not modified. No reset, checkout, force push, commit, or history rewrite was used.

## EXTRACTED_ORBITSCAR_WORK

- 43 previous campaign research/design/adversarial/architecture/UX/art/economy/security/testing/roadmap documents were recovered.
- The prior research remains under the corresponding `docs/` categories.
- Prior Tideforge-anchored repository/architecture records are preserved under `docs/recovered/legacy/`.
- The combat foundation was rewritten as `packages/simulation/src/orbitscar.ts`.
- A standalone fixture runner exists at `packages/simulation/src/cli.ts`.
- Declarative content is under `packages/content/data/orbitscar-v0/balance.json`.
- Content validation exists at `packages/content/src/validate.ts`.
- A standalone pnpm workspace, TypeScript config, Vitest config, README, license decision, and lockfile were created.

## DISCARDED_OR_REWRITTEN_WORK

- The Orbitscar export graft in Tideforge was discarded because it violated repository ownership.
- The old Orbitscar module was not copied unchanged as the authoritative implementation. It was rewritten to add explicit target priorities, outcome summaries, snapshot hashes, duration, destruction, and a CLI-oriented result.
- No generic shared library was extracted. The abstraction is too product-specific and only one project currently needs it.
- No visual assets were migrated or generated.

## RESEARCH_STATUS

Still valid as hypotheses:

- Scoutable colonies, direct deployment, readable autonomous combat, defensive layout, short attacks, deterministic replay, and connected territory.
- The strongest candidate niche is short, readable base breaches connected to meaningful alliance geography.
- Market evidence shows a large and competitive strategy category, not guaranteed demand. [Sensor Tower market evidence](https://sensortower.com/blog/2025-state-of-mobile-consumers-usd150-billion-spent-on-mobile-highlights)

Reclassified:

- The previous “keep the existing TypeScript/React/Vite/Hono/PostgreSQL foundation” decision was repository-biased and is no longer authoritative.
- Edgeworld evidence remains useful for abstract system archaeology, but community revival material is sentiment evidence, not product-market proof.
- Godot remains credible but has WebGL 2 Compatibility and mobile-web constraints. [Godot Web export](https://docs.godotengine.org/en/4.5/tutorials/export/exporting_for_web.html)

## ARCHITECTURE_REASSESSMENT

Previous conclusion: retain Tideforge’s TypeScript/React/Vite/Hono/PostgreSQL structure and add Orbitscar beside it.

Independent conclusion: use a standalone TypeScript workspace with **Phaser 3 for the game renderer/input layer**, a pure `@orbitscar/simulation` package, and a custom TypeScript modular backend later. React is not the real-time renderer. Capacitor is the Android packaging candidate after web/mobile performance is measured. Godot and Nakama are explicit reconsideration paths, not current dependencies.

Phaser provides WebGL with Canvas fallback and TypeScript support. [Phaser documentation](https://docs.phaser.io/phaser/getting-started/what-is-phaser)

## SECOND-PASS DIFFERENCES

| Question | Result |
|---|---|
| Research-derived decisions | Direct deployment, scout-before-attack, defensive layouts, short battles, deterministic replay, and connected territory. |
| Tideforge-influenced decisions | Keeping the existing repo/package topology, exporting through `@tideforge` packages, and assuming the current web stack should own the new client. |
| Concepts too similar to Tideforge | Generic base building and asynchronous combat are abstract ideas; Tideforge-specific medieval/aquatic content is excluded. |
| Mechanics changed | The scope is now combat-first; alliance/MMO systems are downstream. Target priority and replay outputs are explicit. |
| Architecture changed | Yes: Phaser game client, pure simulation, independent package scope, backend deferred. |
| Art direction changed | No fundamental change; the industrial orbital-frontier direction remains original and is now independent of Tideforge art. |
| Scope changed | Reduced. No MMO, monetization, live ops, or giant territory map before combat validation. |

## ORBITSCAR_STATE

- Path: `C:\Workspace\Project_Games\Orbitscar`
- Git: initialized with branch `main`; no commit exists yet because commit authorization was not provided.
- Remote: none.
- Working tree: uncommitted recovery and foundation artifacts only.
- Package manager: pnpm `11.19.0`, pinned in `package.json`; `pnpm-lock.yaml` generated offline.
- Production/configuration scan: zero Tideforge references in packages, fixtures, and package configuration. Boundary mentions in README/recovery docs are intentional prohibitions.

## COMBAT_FOUNDATION

The isolated simulation supports:

- Canonical input ordering.
- Seeded deterministic damage.
- Explicit target-priority tags.
- Deployment-capacity and charge validation.
- Battle events.
- Full/partial/defeat result tiers.
- Destroyed structures, surviving units, damage summaries, duration ticks, snapshot hashes, canonical hash, and outcome hash.
- JSON fixture execution without rendering.

It is still a first-slice sandbox. It does not yet model pathfinding, defensive firing, unit casualties, retreat, resource extraction, or network authority.

## DETERMINISM_RESULTS

- Strict TypeScript compilation of `orbitscar.ts`, CLI, and content validator: **PASS**.
- Compiled fixture smoke run: **PASS**; output was a deterministic partial result with 1,200 ticks, two destroyed defenses, two surviving unit types, eight events, and outcome hash `10dd83c5`.
- Re-running the compiled resolver with identical input is covered by the focused Vitest test source. The approved outside-sandbox verification installed dependencies successfully, and `pnpm test` passed all 3 tests.

## TEST_RESULTS

| Command | Result | Evidence |
|---|---|---|
| `pnpm install --ignore-scripts` | PASS | Approved outside-sandbox run installed 55 packages; lockfile passed supply-chain policy. |
| `pnpm install --lockfile-only --offline` | PASS | Generated independent `pnpm-lock.yaml` with pnpm 11.19.0. |
| `pnpm validate:content` | PASS | Returned 3 resources, 6 buildings, 10 units, 2 commanders. |
| `pnpm typecheck` | PASS | Exit 0. |
| `pnpm test` | PASS | 1 file and 3 tests passed. |
| `pnpm simulate -- fixtures/battle_fixture.json` | PASS | Returned deterministic partial result, 1,200 ticks, two destroyed defenses, eight events, hash `10dd83c5`. |
| Direct TypeScript compile of independent source set | PASS | Exit 0; no Tideforge import. |
| Compiled content validator + headless fixture CLI | PASS | Validator and CLI returned expected output. |
| Tideforge `git diff` against baseline | PASS | Empty diff and clean status. |

## TOP_REMAINING_RISKS

- **P0:** The breach loop may still be “drop and watch” rather than strategic agency.
- **P0:** The prototype has not yet been tested with real players.
- **P1:** Android WebView/Capacitor performance is unproven.
- **P1:** Package installation and CI are not yet reproducible in this environment.
- **P1:** Target-priority rules need visual UX and more adversarial tests.
- **P1:** Server authority, economy, alliance rules, and territory remain specification-only.

## NEXT_CAMPAIGN

Run the **Orbitscar Combat Vertical Slice Campaign**:

1. Restore network/dependency installation and run the project’s own Vitest suite.
2. Implement a small Phaser arena with original debug geometry.
3. Add four building types, three defenses, four attacker units, one commander, three deployment charges, and one ability.
4. Expose target priorities visibly before and during combat.
5. Test at least five combat layouts and three player skill levels.
6. Kill or revise the product if players cannot explain why deployment timing and composition mattered.

## SHARED_TOOLING_POLICY

Current policy is recorded in [shared-tooling-policy.md](docs/architecture/shared-tooling-policy.md): keep simulation, content, rendering, and backend code local until a second project demonstrates genuine identical need.

## REVIEW_BUNDLE

The curated external-review bundle is `orbitscar-recovery-and-foundation-20260830.zip`; its adjacent `.sha256` file records the final checksum. The bundle excludes `.git`, dependency directories, build caches, generated junk, Tideforge game assets, and Edgeworld assets.
