# Visual Client Boundary

`apps/web` is a Phaser 3 + TypeScript client bundled by Vite. Phaser owns the tactical board, camera, pointer/touch input, deployment geography, and event presentation; the DOM command surface owns accessible menus and state transitions. `@orbitscar/simulation` owns validation, colony state, command chronology, spatial movement, combat, result classification, persistence reconciliation, and replay digests.

The playable slice uses a 1200x800 logical arena with responsive resize. Desktop and touch input share click/tap selection, drag pan, wheel/pinch zoom, snap-grid placement, and deployment-zone selection. The player-facing command surface does not depend on hover; simulation diagnostics remain in event hashes and the read-only replay surface.

The static browser smoke test is intentionally served from the built output because the managed browser sandbox can reject esbuild child-process creation during Vite development. The production bundle itself builds successfully.

Current known presentation limitation: the visual kit is still authored geometry rather than a final asset pack, there is no audio, remote authority, or Android wrapper, and replay speed is fixed to the deterministic simulation clock.
