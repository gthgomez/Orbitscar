# Visual Client Boundary

`apps/web` is a Phaser 3 + TypeScript client bundled by Vite. Phaser owns the tactical board, camera, pointer/touch input, deployment geography, and event presentation; the DOM command surface owns accessible menus and state transitions. `@orbitscar/simulation` owns validation, colony state, command chronology, spatial movement, combat, result classification, persistence reconciliation, and replay digests.

The playable client uses a 1200x800 logical arena with responsive resize. Desktop and touch input share tap selection, drag pan, wheel/two-pointer pinch zoom, snap-grid placement, and deployment-zone selection. The player-facing command surface does not depend on hover; simulation diagnostics remain in event hashes and the read-only replay surface. Live deployments, reinforcements, commander activation, retreat, reports, and replay all consume the deterministic command/event contract.

The static browser smoke test is intentionally served from the built output because the managed browser sandbox can reject esbuild child-process creation during Vite development. The production bundle itself builds successfully.

Current known presentation limitation: original SVGs cover a small set of entities; remaining unit and defense silhouettes are drawn procedurally. The client has synthesized Web Audio cues and a persisted mute control. A local authority API exists in `apps/server` with direct integration coverage, but the browser colony still uses local saves and does not call that API. There is no OAuth/remote hosting or Android wrapper. Battle playback follows the deterministic simulation clock; pause and speed controls are not implemented.
