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

Simulation coverage exercises base → train → attack → resolve → reward → report → replay and persistence restart. A Playwright browser contract suite (`pnpm test:browser`) exercises the production build end to end: economy, construction, capacity limits, three-wave deployment with the charge limit, commander ability, autonomous battle with measured health-bar decay, retreat, report reconciliation, reload persistence, legacy save migration, tamper fail-safety, and a mobile-viewport loop. Automated browser evidence is not a substitute for human playtesting.

## Platform

Web: Chromium/Firefox and low-end mobile browser, responsive orientations, localStorage behavior, tap/drag/pinch input, and console-error capture. The client smoke should cover the complete colony-to-second-attack loop.

Android: phone, tablet, foldable, API target, safe areas, touch, suspend/resume, back navigation, crash and thermal session.

## Manual UX gate

Blind testers must complete the first attack, identify their deployment choices, and recover from a loss without support instructions.
