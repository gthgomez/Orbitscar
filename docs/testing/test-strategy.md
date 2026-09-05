# Test Strategy

**Status:** TESTING V0.1

## Unit tests

- resource faucet/sink formulas;
- target priority and stable tie-breaks;
- placement legality and footprint overlap;
- pathing decisions and blocked routes;
- cooldowns, abilities, and repair;
- upgrade requirements and content-version resolution.

## Determinism tests

Same canonical seed/input/ruleset → byte-equivalent event stream, result, and hash. Run across Node versions used in CI where practical.

## Security/property tests

- no negative inventory;
- rewards cannot duplicate;
- deployment cap never exceeded;
- destroyed objects cannot attack;
- stale/duplicate events rejected;
- ownership invariants preserved during capture;
- replay cannot mutate state.

## Integration (current status)

Simulation coverage exercises base → train → attack → resolve → reward → report → replay and persistence restart. A browser smoke flow is the next certification gate; this local prototype has no account or PostgreSQL store.

## Platform

Web: Chromium/Firefox and low-end mobile browser, responsive orientations, localStorage behavior, tap/drag/pinch input, and console-error capture. The client smoke should cover the complete colony-to-second-attack loop.

Android: phone, tablet, foldable, API target, safe areas, touch, suspend/resume, back navigation, crash and thermal session.

## Manual UX gate

Blind testers must complete the first attack, identify their deployment choices, and recover from a loss without support instructions.
