# Repository State — Preproduction Campaign

**Status:** OBSERVED baseline
**Captured:** 2026-08-30 (America/Chicago)
**Campaign:** Original Edgeworld-inspired sci-fi strategy game

## Target and boundary

| Field | Evidence |
|---|---|
| Workspace | `C:\Workspace` |
| Catalog | `C:\Workspace\config\workspace-products.json` lists `tideforge-empires` at `Project_Games/TideforgeEmpires` |
| Target repo | `C:\Workspace\Project_Games\TideforgeEmpires` |
| Git boundary | `git -C C:\Workspace\Project_Games\TideforgeEmpires rev-parse --show-toplevel` → `C:/Workspace/Project_Games/TideforgeEmpires` |
| Branch | `main` |
| Starting HEAD | `2524e9983623a7f04aec63da05c1c1f54817a1d8` |
| Origin | `https://github.com/gthgomez/TideforgeEmpires.git` |
| Default branch | `main` (catalog row and current branch; not independently queried from the remote API) |
| Starting relation | `main...origin/main [ahead 4, behind 3]` |
| Starting worktree | Clean: `git status --short --branch` reported no file changes |
| Target worktrees | No additional Tideforge worktree was found in the target-specific inspection |

## Existing project shape

Observed at the target root:

- pnpm workspace monorepo (`pnpm-workspace.yaml`)
- TypeScript packages under `packages/*`
- Vite/React web client under `apps/web`
- Hono/Node server under `apps/server`
- PostgreSQL schema at `schema.sql` with an in-memory fallback
- Pure deterministic combat package at `packages/combat`
- Content data package at `packages/content`
- `.github/` CI directory
- Existing `node_modules/` is present but pnpm attempted module reconciliation during baseline verification

No Godot `project.godot` marker exists in the canonical repo. The preferred Godot hypothesis is therefore an unverified alternative, not the current implementation baseline.

## Existing product state

The README describes Tideforge Empires as a multiplayer web MMORTS MVP beta with an existing async city-builder, map combat, alliances, reports, and deterministic `resolveBattle`. The current branch history contains a medieval/aquatic content direction and a recent Sovereign-abstraction deletion. Those documents and content IDs are **historical project data**, not automatically authoritative for this sci-fi redefinition.

The nearby `TideforgeEmpires-cmv1` directory is a separate Git checkout on `feat/tideforge-closed-mockup-v1` at `3b0a265eda8309a2c5b1752061bcc25bc7241c20`. It was not modified. The untracked root directory `C:\Workspace\oss-tideforge-work` was also not modified.

## Existing docs/assets/tooling

- Existing design docs: `docs/design/`
- Existing content data: `packages/content/data/`
- Existing web art placeholder/readme surfaces: `apps/web/public/`
- Existing CI: `.github/`
- Existing license signal: README states private/unpublished and all rights reserved unless otherwise stated; no standalone `LICENSE` file was observed at the target root.
- Existing asset-generation tooling: no project-local AGES configuration or dedicated provenance pipeline was observed during the shallow inventory. This is an evidence gap, not proof that workspace-level tooling cannot be reused.

## Verification baseline

Commands attempted before campaign edits:

| Command | Result | Evidence |
|---|---|---|
| `pnpm test` | **FAIL before tests** | pnpm aborted automatic modules-directory removal with `[ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY]` |
| `pnpm typecheck` | **FAIL before typecheck** | Same pnpm module-reconciliation failure |
| `pnpm --filter @tideforge/web build` | **FAIL before build** | Same pnpm module-reconciliation failure |

These are baseline-environment failures, not evidence of a product-code regression. A CI/offline install retry is required before claiming verification.

## Preservation and scope rules

- Do not reset, stash, delete, merge, push, or overwrite the pre-existing target history.
- Do not modify `TideforgeEmpires-cmv1` or `oss-tideforge-work` as part of this campaign.
- Do not read or copy `.env` contents. Only `.env.example` may be inspected for configuration shape.
- New campaign work is additive under `docs/`, campaign-specific machine-readable data, and low-regret simulation foundations after design decisions stabilize.
- This report is a snapshot; rerun Git probes before release work.

## Classification

```text
Step 0 classification
Target: C:\Workspace\Project_Games\TideforgeEmpires
Catalog on-path: C:\Workspace\config\workspace-products.json
Git toplevel: C:\Workspace\Project_Games\TideforgeEmpires
Workspace manifest: pnpm-workspace.yaml
Profile: workspace-catalog (outer), monorepo (inner)
Overlay: games
Ambiguity: none after target inspection; canonical active catalog row selected
```
