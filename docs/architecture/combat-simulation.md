# Deterministic Combat Architecture

**Status:** ARCHITECTURE CONTRACT V0.1

## Canonical input

```text
BattleSeed
BaseSnapshot
ArmySnapshot
DeploymentEvents
AbilityEvents
RulesetVersion
```

Canonicalization sorts entities by stable IDs, normalizes numeric precision, rejects duplicate event sequence numbers, and serializes UTF-8 JSON with a documented schema version. The server stores the canonical hash with the result.

## Invariants

1. Same canonical inputs and ruleset version produce the same result and event stream.
2. The client cannot mint resources, units, capacity, victory, loot, or territory ownership.
3. Illegal deployments, stale snapshots, duplicate events, and out-of-window abilities are rejected.
4. Replay playback is read-only and cannot mutate inventory or outcome.
5. Historical replays remain tied to their ruleset version and content revision.
6. Every reward has one idempotency key and one authoritative ledger entry.
7. A destroyed entity cannot move, attack, generate loot, or receive a second destruction event.
8. Deployment capacity and reinforcement charges never become negative.
9. Target selection is stable: priority, distance, stable entity ID.
10. Simulation never reads wall-clock time except through an injected tick/time source.

## Server flow

Validate request → load immutable snapshot → canonicalize → simulate in pure package → persist result/event hash/ledger transaction → return report token. Client visualization consumes the report and events only.

## Replay and debugging

Store snapshots by content hash, event stream, ruleset version, and outcome hash. A compact replay may omit derived state when re-simulation is available; production must retain a fallback result for ruleset retirement.
