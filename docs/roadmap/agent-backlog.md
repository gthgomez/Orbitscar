# Agent-Ready Backlog

**Status:** BACKLOG V0.1

Each task is intentionally small enough for an independent agent and names its non-goals.

## Research/design

| ID | Objective | Files likely involved | Dependencies | Acceptance / non-goals | Risk / artifact |
|---|---|---|---|---|---|
| R-001 | Run blind combat demand test | `docs/roadmap/vertical-slice.md`, test notes | slice | 5+ testers, record second-plan rate; no marketing claims | medium / playtest report |
| R-002 | Review title/logo collisions | `docs/design/game-design-document.md` | none | document search URLs; no public registration | low / naming note |
| D-001 | Freeze clean-room content IDs | `packages/content/data/orbitscar-v0` | ledger | schema validates; no current medieval IDs changed | medium / content contract |
| D-002 | Define first NPC base layouts | `docs/design/combat.md`, balance data | D-001 | two viable plans; no PvP balance | medium / scenario fixtures |

## Simulation/client

| ID | Objective | Files likely involved | Dependencies | Acceptance / non-goals | Risk / artifact |
|---|---|---|---|---|---|
| S-001 | Add canonical Orbitscar battle types | `packages/combat/src/orbitscar.ts` | D-001 | serialize/validate deterministic inputs; no UI | medium / pure module |
| S-002 | Add seeded event resolver | `packages/combat/src/orbitscar.ts`, tests | S-001 | same input/hash twice; no current resolver changes | high / tests |
| C-001 | Build placement sandbox | `apps/web/src/...` | D-002 | touch/mouse placement and preview; no alliance screens | medium / slice UI |
| C-002 | Build replay/report viewer | `apps/web/src/...` | S-002 | read-only event timeline; no outcome mutation | medium / report UI |

## Backend/security

| ID | Objective | Files likely involved | Dependencies | Acceptance / non-goals | Risk / artifact |
|---|---|---|---|---|---|
| B-001 | Add battle request validation boundary | `apps/server/src/...` | S-001 | reject stale/capacity/duplicate events; no auth rewrite | high / API contract tests |
| B-002 | Add reward idempotency ledger fixture | `apps/server/src/...` | B-001 | duplicate request has no second reward; no purchases | high / integration tests |
| B-003 | Threat-model review of current routes | `docs/security/game-threat-model.md` | repo inspection | findings with route evidence; no broad refactor | high / security review |

## UX/assets/testing/infrastructure

| ID | Objective | Files likely involved | Dependencies | Acceptance / non-goals | Risk / artifact |
|---|---|---|---|---|---|
| U-001 | Implement semantic UI tokens | `apps/web/src/...` | IA doc | token names used by slice; no visual clone | low / token module |
| A-001 | Create original debug asset pack | `apps/web/public/art/orbitscar` | art bible | generated/handmade SVG/flat shapes with provenance; no Edgeworld refs | low / provenance pack |
| T-001 | Add headless balance command | `packages/combat`, scripts | S-002 | 1k seeded runs and JSONL summary; no CI threshold yet | medium / harness |
| T-002 | Add responsive browser smoke | `.github`, web e2e | C-001 | desktop/mobile viewport checks; no store test | medium / e2e |
| I-001 | Make CI run campaign data/schema checks | `.github/workflows/ci.yml` | D-001 | validate JSON; do not alter existing workflow semantics without review | medium / CI patch |
| I-002 | Verify Android shell option | `docs/architecture/architecture-decision-record.md` | phase 2 | measured Capacitor/Godot spike; no production shell | medium / decision update |
