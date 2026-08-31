# Visual Client Boundary

`apps/web` is a Phaser 3 + TypeScript client bundled by Vite. Phaser owns rendering, camera, pointer/touch input, debug overlays, HUD, and event presentation. `@orbitscar/simulation` owns validation, command chronology, spatial movement, combat, result classification, and replay digests.

The prototype uses a 1200x800 logical arena with responsive resize. Desktop input includes click selection, drag pan, wheel zoom, `D` debug toggle, and `R` restart. Touch uses the same pointer path and large in-canvas scenario/zone controls; no decision depends on hover.

The static browser smoke test is intentionally served from the built output because the managed browser sandbox can reject esbuild child-process creation during Vite development. The production bundle itself builds successfully.

Current known presentation limitation: event replay is a debug projection, labels are intentionally dense, and there is no asset, audio, remote authority, or Android wrapper.
