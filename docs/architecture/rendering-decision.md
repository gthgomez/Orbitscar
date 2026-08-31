# Rendering Decision

**Status:** ARCHITECTURE DECISION V0.1

| Option | Web | Android | Memory/download | Animation | Iteration | Longevity | Decision |
|---|---|---|---|---|---|---|---|
| Full 2D DOM/canvas | strong | strong via web wrapper | low | procedural/simple | fastest | medium | useful prototype |
| 2.5D authored sprites/canvas | strong if atlas-bounded | strong on mid devices | medium | authored + procedural | fast | high | **V1 choice** |
| Full real-time 3D | weaker web budget | variable | high | powerful but costly | slow | high | defer |

## Choice

Use a 2.5D renderer for V1: authored isometric sprites or lightweight canvas layers, fixed camera bands, deterministic layout coordinates, and a limited effect budget. This preserves the board readability and cosmetic hooks while keeping browser/mobile memory tractable.

## Attempt to disprove

2.5D fails if combat needs free camera elevation, continuous occlusion-aware pathing, or large unit counts with rich animation. It also fails if sprite production cannot maintain directional consistency. Run a rendering spike with 20 buildings, 10 units, 30 VFX, and a 96-node map before approving production art.

Godot remains technically credible, but its web export uses WebAssembly/WebGL2 and Compatibility rendering; native Android performs better, and threaded web exports add cross-origin isolation requirements. The current TypeScript/Vite repo already has browser UI/server foundations, so a Godot rewrite is not currently justified.

Sources:

- https://docs.godotengine.org/en/4.5/tutorials/export/exporting_for_web.html
- https://docs.godotengine.org/en/latest/tutorials/export/exporting_for_android.html
