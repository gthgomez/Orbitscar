# Game Threat Model

**Status:** SECURITY V0.1

Assume modified APKs, browser tampering, scripted clients, replayed requests, clock spoofing, and colluding accounts.

| Threat | Impact | Control |
|---|---|---|
| forged resource/inventory update | economy loss | server ledger, no client balance authority |
| premium currency mint | financial loss | server-only grants, append-only ledger, idempotency |
| forged battle result | competitive/economy loss | server simulation and signed report hash |
| impossible deployment | unfair result | snapshot/version/capacity validation |
| replayed reward request | duplication | one-time battle reward key and transaction constraint |
| time spoof/speed hack | instant progression | server time, bounded queue claims, audit anomalies |
| alliance permission escalation | territory/data loss | role policy server-side, audit log, confirm/revoke |
| botting | population/economy distortion | rate limits, behavior flags, review before sanctions |
| alt collusion | map/loot abuse | cooldowns, contribution provenance, anomaly scoring |
| report tampering | trust loss | immutable canonical event hash and ruleset version |
| chat abuse | player harm | moderation, rate limits, report/block/mute, retention limits |

## Security invariants

- Never expose service credentials to client code.
- Never accept client-declared inventory, ownership, victory, rank, loot, or time completion.
- Every mutation is authorized against current server state and an idempotency key.
- Reject stale writes instead of last-write-wins for battle/territory state.
- Log privileged/admin actions separately and require environment-gated authorization.
- Do not use anti-cheat telemetry to silently punish without a review path.

## Verification

Contract tests submit malformed payloads, duplicate rewards, impossible capacities, invalid alliance roles, stale snapshots, and forged clocks. Property tests assert no negative balances and no duplicate authoritative effects.
