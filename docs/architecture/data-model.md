# Data Model

**Status:** ARCHITECTURE V0.1

All persistent records include `id`, `schema_version`, `created_at`, `updated_at`, and an audit/source reference where state is player-impacting. IDs are opaque UUIDs or stable content IDs; clients never choose authoritative ownership.

## Core entities

| Entity | Key fields |
|---|---|
| account | id, auth_provider_ref, created_at, last_seen, privacy_flags |
| player_progress | account_id, base_tier, account_xp, tutorial_step, season_id |
| base | id, owner_id, layout_version, command_tier, protection_until |
| building | id, base_id, content_id, slot, level, state, health |
| resource_ledger | id, owner_id, resource, delta, reason, idempotency_key |
| research | owner_id, node_id, level, ruleset_version |
| unit_inventory | owner_id, unit_id, available, wounded, reserved |
| commander | owner_id, commander_id, unlock_source, loadout_version |
| army_loadout | id, owner_id, unit_entries, commander_id, capacity |
| battle | id, attacker_id, defender_id, snapshot_hash, ruleset_version, status, outcome_hash |
| battle_event | battle_id, seq, tick, type, canonical_payload |
| replay | battle_id, snapshot_ref, event_ref, ruleset_version, integrity_hash |
| alliance | id, name, emblem_id, role_policy, season_id |
| alliance_member | alliance_id, account_id, role, joined_at, contribution |
| alliance_permission_audit | alliance_id, actor_id, action, target, timestamp |
| sector | id, season_id, topology_version |
| sector_node | id, sector_id, node_type, owner_alliance_id, supply_integrity, state |
| sector_edge | sector_id, from_node, to_node, active, contested |
| seasonal_state | season_id, start_at, end_at, ruleset_version, phase |
| cosmetic | id, content_id, owner_id, acquisition_source |
| achievement | owner_id, achievement_id, earned_at |
| objective | owner_id, objective_id, state, progress, ruleset_version |

## Versioning and migrations

- Content definitions are immutable by version; new balance values create a new ruleset.
- Persistent schemas migrate forward with idempotent, tested migrations.
- Battle records are never rewritten; reports point to the ruleset/content versions used.
- Season reset affects ownership/progress tables only through a transaction with a snapshot and reconciliation report.
- Store ledger entries append-only; corrections are compensating entries.
