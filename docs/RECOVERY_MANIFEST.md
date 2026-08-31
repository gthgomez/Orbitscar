# Recovery manifest

Audit date: 2026-08-30. Source boundary: `C:\Workspace\Project_Games\TideforgeEmpires`. Baseline: `2524e9983623a7f04aec63da05c1c1f54817a1d8`.

## Classification

| Class | Artifacts | Disposition |
|---|---|---|
| A — pre-existing Tideforge user work | No current tracked or untracked delta artifact could be proven to belong here. Existing tracked Tideforge source/docs and the separate `TideforgeEmpires-cmv1` checkout were preserved untouched. | Preserve in Tideforge; not copied. |
| B — Orbitscar research/design | The 43 campaign documents under `docs/adversarial`, `docs/architecture`, `docs/art`, `docs/decisions`, `docs/design`, `docs/economy`, `docs/preproduction`, `docs/research`, `docs/roadmap`, `docs/security`, `docs/testing`, and `docs/ux`. | Copied into this independent project; the independent ADR and recovery entrypoints supersede only their old Tideforge-specific framing. |
| C — Orbitscar implementation | `packages/combat/src/orbitscar.ts`, `packages/combat/src/orbitscar.test.ts`, `packages/content/data/orbitscar-v0/balance.json`, and the Orbitscar export graft in `packages/combat/src/index.ts`. | Pure module/data recovered; Tideforge package export rewritten away during restoration. |
| D — generic tooling candidate | None proven. The prior module is product-specific and is not centralized. | Defer extraction until a second product demonstrates identical need. |
| E — unknown / do not touch | `pnpm-workspace.yaml` added `allowBuilds: esbuild: set this to true or false`; this is an install-tool side effect, not product work. | Restore to baseline after capture. |

## Exact tracked delta

Against the baseline SHA, Git reported exactly:

- `M packages/combat/src/index.ts` — 15-line Orbitscar re-export graft.
- `M pnpm-workspace.yaml` — two-line pnpm-generated `allowBuilds` setting.

The baseline file contents confirm the workspace file originally contained only the `apps/*` and `packages/*` package globs.

## Exact untracked campaign artifacts

All untracked files listed below were created during the prior campaign on 2026-08-30 and are copied or represented in this repository:

- Research: `docs/research/edgeworld-archaeology.md`, `edgeworld-screen-inventory.md`, `inspiration-transformation-ledger.md`, `player-memory-and-demand.md`, `competitive-landscape.md`, `competitive-feature-matrix.csv`, `market-thesis.md`, `unknowns.md`.
- Design: `docs/design/game-design-document.md`, `buildings.md`, `units-and-commanders.md`, `combat.md`, `sector-and-alliance-war.md`, `onboarding.md`, `cosmetics.md`.
- Architecture/security/testing: `docs/architecture/*`, `docs/security/game-threat-model.md`, `docs/testing/*`.
- Adversarial/roadmap: `docs/adversarial/*`, `docs/roadmap/*`, `docs/decisions/decision-log.md`.
- UX/art/economy: `docs/ux/*`, `docs/art/*`, `docs/economy/*`.
- Continuity/package artifacts: `docs/preproduction/*`, `edgeworld-successor-preproduction-review-20260830.zip`, and its `.sha256` file.
- Implementation: `packages/combat/src/orbitscar.ts`, `orbitscar.test.ts`, and `packages/content/data/orbitscar-v0/balance.json`.

## Provenance conclusion

Observed evidence supports treating the entire current untracked set as prior Orbitscar campaign output, with the pnpm workspace edit as a separate generated side effect. No current delta was classified as pre-existing Tideforge work. This conclusion is based on the exact baseline diff, file names, consistent creation timestamps, and the prior campaign record; it is not a claim about files outside the current delta.
