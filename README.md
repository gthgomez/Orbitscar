# Project Orbitscar

Project Orbitscar is an independent clean-room sci-fi strategy prototype. It is a distinct game from Tideforge Empires. This repository has no runtime dependency on Tideforge code, content, namespaces, assets, or configuration.

> **Status: proprietary.** This repository is public for source visibility and
> transparency. It is **not open source** — there is no license grant to reuse,
> modify, or redistribute this code. See [LICENSE](LICENSE).

The working title is provisional and has not received trademark, domain, or store clearance.

## Current boundary

- `packages/simulation/` — deterministic, headless battle and persistent-colony rules.
- `packages/content/` — declarative buildings, units, defenses, commanders, authored NPC targets, and validation.
- `fixtures/` — small reproducible battle inputs.
- `apps/web/` — Phaser tactical view plus an accessible DOM command surface for colony, target, army, deployment, replay, and report states.
- `apps/server/` — loopback-only local authority for persistent profiles, versioned defender snapshots, validated rival attacks, and idempotent report settlement.
- `docs/` — recovered research plus independent product, architecture, UX, art, economy, security, testing, and roadmap records.

The local product loop includes colony development, scouting, live command combat, reports, defensive raids, and a persistent profile API. The web client can connect to that loopback authority for server-owned colony actions, PvE settlement, and attacks against versioned rival snapshots. The rival API is a closed-alpha development service; it has no accounts, remote network exposure, or production hosting.

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
pnpm --filter @orbitscar/server dev
pnpm check
```

The browser client is intentionally Phaser-only for tactical rendering; React is not a dependency.

## Local rival authority

For the authority-backed browser flow, run the server and web client in two
terminals:

```text
pnpm --filter @orbitscar/server dev
pnpm --filter @orbitscar/web dev
```

Open the Vite URL and choose **Local profiles**. Create or load a profile ID;
the selected server profile owns all colony mutations and battle settlement,
while the solo save remains separate. Rival outposts are initialized on first
inspection under their fixed local IDs (`local-rival-drift`,
`local-rival-ember`, and `local-rival-meridian`). The web dev/preview proxy
routes `/api` to the loopback server. A production static host needs an
equivalent reverse proxy to the local authority.

The server binds to `127.0.0.1:4179` and stores versioned data at
`.orbitscar/server-state.json` by default. Set `ORBITSCAR_PORT` or
`ORBITSCAR_DATABASE` to change the local port or save path. It supports:

- `POST /profiles` to create a local profile;
- `GET /profiles/:id` and `GET /profiles/:id/snapshot` to inspect an identity
  and receive a versioned, hashed base snapshot;
- `GET /profiles/:id/sector` to inspect connected PvE and rival relay nodes;
- `POST /profiles/:id/actions` for validated `TRAIN`, `BUILD`, `UPGRADE`,
  `RESEARCH`, `COMMANDER`, `SCOUT`, `COLLECT`, and `REPAIR` actions;
- `POST /profiles/:id/campaign-attacks` to resolve scouted PvE sorties through
  the shared simulation and claim a connected relay when its command core falls;
- `POST /attacks` with attacker/defender versions, the defender snapshot hash,
  an army drawn from server reserves, and an ordered command stream. The
  server builds the battle input and resolves it through the shared simulation.
  Set `sectorNodeId` to attack the matching local rival relay; the defender ID
  must match that node and the node must be connected to the attacker frontier;
- `GET /attacks/:id` to retrieve a persisted deterministic report and replay.

Mutations require an idempotency `requestId` and expected profile version.
Attacks settle both colonies atomically and reject stale snapshots, invalid
capacity, unknown units, and client-supplied results. Direct HTTP integration
tests exercise multiple local profiles, concurrent attacks, duplicate
settlement, PvE campaign progression, restart persistence, and replay
reproduction. This API is not configured for public network use. Run one
server process per database path.
The local authority retains the latest 10,000 idempotency records and 250
attack reports; profile and defender snapshot versions reject replayed stale
mutations after an old idempotency record expires.

Human blind-test instrumentation lives in `docs/playtest/` (protocol, observation form, session checklist); the item-10 gate remains BLOCKED_ON_HUMAN_PLAYTEST until five real sessions are recorded.

The project is repo-ready but unpublished. Do not add Tideforge as a workspace, package source, Git submodule, or development dependency.

## License

Project Orbitscar is **proprietary**. This repository is public for viewing and
development transparency, but public visibility does not grant permission to
copy, modify, redistribute, sublicense, sell, commercially exploit, or create
derivative works from the project's original source, design, art, or content.
See [LICENSE](LICENSE).

Third-party dependencies (for example Phaser and Vite) remain under their own
license terms. The working title "Project Orbitscar" is provisional and has not
received trademark, domain, or store clearance.
