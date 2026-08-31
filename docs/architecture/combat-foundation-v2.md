# Orbitscar Combat Foundation V2

Status: implementation contract, 2026-08-30.

The resolver is a pure deterministic TypeScript module. Phaser, clocks, rendering, input, and networking are consumers of its results, never authorities over them.

## Canonical input

Each battle has a ruleset/content version, seed, arena bounds, commander, owned army stacks, structure placements, and one command stream. Commands are `DEPLOY`, `COMMANDER_ABILITY`, or `RETREAT`; every command has a unique `commandId`, globally unique integer `sequence`, integer `tick`, and validated payload. Canonical command order is `tick -> sequence -> commandId`.

Deployment payloads contain explicit `{unitId, count}` quantities. Validation simulates the reserve ledger in canonical command order, rejects fractional/negative quantities and reuse, and enforces per-charge capacity and charge count.

Targeting is an ordered rule list over the fixed content tags. Supported selectors are `tag`, `nearest`, `lowest_health`, and `any`. Legacy strings such as `low_health`, `nearest_defense`, and `depot` are not runtime vocabulary.

## Tick model

At each integer tick: commands at that tick execute in canonical order; living defenses fire if a target is in range; living attackers acquire a target, move on the deterministic axis with the larger remaining distance, or attack when in range and off cooldown. Defense iteration, attacker iteration, target ties, and event sequencing are all ID-stable.

Units are expanded into stable instance IDs (`unitId#ordinal`) at battle start. Damage is seeded and bounded. A dead unit or structure is removed from subsequent targeting and firing. The prototype has no physics, navmesh, status-effect stack, or wall-clock dependency.

`emergency_reroute` is a real effect: it assigns active units a chosen structure target and gives them a temporary speed increase. It has one commander charge and its tick is part of the canonical command stream.

## Replay identity

`canonicalReplayPayload` sorts semantically unordered army/structure collections and deployment stack entries, preserves ordered priority/command semantics, and uses `canonicalFormatVersion: 2`. `canonicalSerialize` recursively sorts object keys, normalizes negative zero, and rejects non-finite numbers. `fastStateHash` is a short debug hash. `authoritativeDigest` is SHA-256 over the canonical serialization and is used for replay/outcome identity.

## Invariants

- Same canonical input and ruleset produce the same outcome digest.
- A deployment cannot consume more reserve than exists or exceed capacity.
- Entity IDs and command identities are unique.
- All positions and ticks are inside the declared battle window.
- HP, reserves, and casualties never become negative.
- Destroyed entities cannot acquire targets, attack, or fire.
- A replay digest is tied to the canonical format and ruleset version.
- The local prototype proves simulation determinism only; it does not prove remote-server security.
