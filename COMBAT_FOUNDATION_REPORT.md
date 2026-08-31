# Orbitscar Combat Foundation Report

Audit date: 2026-08-30. This report supersedes the stale Vitest sentence in the earlier recovery narrative for the combat stage.

## FINAL_VERDICT

**COMBAT_SLICE_READY_FOR_PLAYER_TESTING**

The first visual slice is playable as a local, deterministic Phaser debug arena. It is ready for blind human combat testing, not MMO production or security claims.

## FOUNDATION_FIXES

- Replaced incompatible target strings with one runtime-validated ordered rule vocabulary.
- Added content-backed definitions for six buildings, three defenses, ten units, two commanders, and one ability.
- Replaced deployment `unitIds` with explicit quantities and a reserve ledger.
- Replaced separate deployment/ability arrays with one canonical command stream.
- Added bounds, ID, count, capacity, command-window, ability, health, and cross-reference validation.
- Added deterministic spatial movement, range, cooldowns, target selection, casualties, defense fire, destruction, retreat, and a real reroute effect.
- Added recursive canonical serialization, short debug hashes, and portable SHA-256 authoritative digests.
- Upgraded the CLI with battle summaries and multi-scenario comparison output.
- Corrected the vertical-slice contract to distinguish local simulation authority from future remote server authority.

## SIMULATION_MODEL

The resolver expands owned stacks into stable unit instances, executes commands in `tick -> sequence -> commandId` order, then processes defense fire followed by attacker movement or attack on each tick. Distances use deterministic squared 2D distance; movement advances along the axis with greater remaining distance. Target priority is an explicit ordered list of tag/nearest/lowest-health/any selectors. Dead entities are removed from future selection and firing.

## DETERMINISM

`canonicalFormatVersion` is 2. Semantically unordered army, structure, and deployment collections are normalized before replay hashing. The authoritative digest is SHA-256 over canonical serialization; the test suite includes the standard empty-string SHA-256 vector and reordered-input equivalence.

## VISUAL_SLICE

`apps/web` contains a Phaser 3 + TypeScript + Vite arena with original colored debug geometry. It presents the fixed colony, three scenario buttons, four deployment-zone controls, restart, ability-now, debug toggle, target lines, range rings, target-priority text, reserves, battle status, outcome digest, event count, FPS, simulation tick rate, frame time, and entity count. Desktop supports click selection, drag pan, wheel zoom, `D`, and `R`; touch uses pointer selection/drag and pinch zoom.

## TACTICAL_DIFFERENCE_RESULTS

All scenarios use the same base and owned army.

| Strategy | Outcome | Duration | Casualties | Destroyed structures |
|---|---|---:|---|---|
| Frontal | attacker / full | 1228 | 2 line riggers, 1 needle drone | all 6 |
| Flank | attacker / partial | 993 | 2 line riggers | arc, cradle, relay, scatter, snare |
| Delayed | attacker / partial | 852 | 1 line rigger | arc, relay, scatter, snare |

Comparison returned `sameOutcome: false`, `differentDurations: true`, `differentCasualties: true`, and `differentStructures: true`. A same-base composition test also produces different authoritative outcomes.

## DROP_AND_WATCH_ADVERSARIAL_RESULT

Thoughtful interaction has a material simulation effect: legal changes to approach, staging, timing, and composition alter casualties, time, victory tier, and structure destruction. The result is **promising but not validated** because no external human testers participated. The next test must establish whether players understand and value those levers rather than merely observing different hashes.

## PERFORMANCE

Observed in the static browser smoke test at 1280x720: Phaser WebGL mounted one canvas with no current-tab console errors; the HUD reported approximately 60 FPS, nine entities, 30 simulation ticks/sec, and approximately 16.6 ms frame time during the opening seconds. The bundle is approximately 1.25 MB minified and Vite emits a chunk-size warning. This is a baseline, not a device certification.

## TEST_RESULTS

- `pnpm install --frozen-lockfile`: PASS; four-workspace lockfile verified.
- `pnpm run typecheck`: PASS.
- `pnpm run test`: PASS; 1 file, 9 tests.
- `pnpm run validate:content`: PASS; 3 resources, 6 buildings, 3 defenses, 10 units, 2 commanders.
- `pnpm run simulate -- fixtures/battle_fixture.json`: PASS; attacker/full, 1155 ticks, real casualties, SHA-256 outcome digest.
- `pnpm run simulate -- fixtures/scenario-frontal.json fixtures/scenario-flank.json fixtures/scenario-delayed.json`: PASS; all three legal and differentiated.
- `pnpm --filter @orbitscar/web exec tsc -p tsconfig.json --noEmit`: PASS.
- `pnpm --filter @orbitscar/web run build`: PASS; Vite chunk-size warning only.
- `git diff --check`: PASS.
- Browser smoke test against the static production bundle: PASS; Phaser/WebGL canvas visible and clean current-tab console.

## GIT_STATE

- Campaign starting state: `main`, no Orbitscar commit yet; recovery artifacts and the pre-hardening skeleton were uncommitted.
- Foundation baseline: `3fe60f2638d0ada4e14e56bf8359d7b95c1b6544`.
- Visual slice commit: `c9b814630417c746e69e22b20f24e00d89aec278`.
- Controls/instrumentation commit: `e4332d1570e6697f97776999fe32f9a8e7ecaf54`.
- Final branch: `main`; no remote and no push.
- Tideforge was not modified in this campaign; Orbitscar package/app/fixture scans contain no Tideforge production dependency.

## KNOWN_LIMITATIONS

- No production server, remote authority, authentication, anti-cheat, stale-snapshot checks, alliance systems, economy, or Android wrapper.
- The local resolver is trustworthy as a deterministic prototype, not proof of network security.
- The visual arena is debug geometry with dense labels and no sound, effects, final art, or polished replay UI.
- The delayed scenario can finish before later commands are needed; encounter tuning should make that consequence intentional and legible.
- Human comprehension, fun, retention, and mobile-device performance remain unproven.

## NEXT_RECOMMENDATION

**proceed to human combat testing**

Use the blind protocol in `docs/ux/first-combat-test-protocol.md`. Do not begin MMO, territory, monetization, or production-backend work until testers can explain at least one target counter and can intentionally change an outcome with deployment or timing.
