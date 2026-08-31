# Telemetry and Privacy

**Status:** OBSERVABILITY V0.1

## Events

`session_started`, `tutorial_step_completed`, `base_upgrade_started`, `base_upgrade_completed`, `first_scout`, `first_attack_started`, `attack_completed`, `attack_retreat`, `battle_loss`, `battle_desync`, `unit_used`, `commander_ability_used`, `defense_breached`, `defense_held`, `report_opened`, `replay_started`, `alliance_joined`, `alliance_order_completed`, `territory_attack_started`, `territory_capture`, `resource_faucet`, `resource_sink`, `client_crash`, `disconnect`.

Each event includes event ID, anonymous account ID, session ID, client version, ruleset version, platform/form factor, timestamp, and small typed properties. Do not collect message contents, contacts, precise location, advertising identifiers, or raw IP in game telemetry unless separately justified and disclosed.

## Derived metrics

- first-attack completion and second-attack start;
- time from scout to launch;
- plan diversity by unit composition and target layout;
- report/replay comprehension proxy;
- defense breach distribution;
- economy faucet/sink balance;
- alliance participation concentration;
- territory concentration and front turnover;
- crash-free sessions, load time, frame-time samples, desync rate.

Telemetry is diagnostic and aggregated for product decisions; it is not an authority source for battle results.
