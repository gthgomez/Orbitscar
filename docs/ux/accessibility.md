# Project Orbitscar — Accessibility

**Status:** UX V0.1

- Use shape, pattern, labels, and iconography in addition to color for alliance-friendly, hostile, neutral, and selected states.
- Provide text scaling to 200% without clipping critical actions; large-screen layout must reflow.
- Minimum touch target: 48dp; recommended spacing: 8dp between targets.
- Offer reduced motion, low effects, no screen shake, and reduced flashing modes.
- Maintain WCAG-informed contrast for text and interactive boundaries; verify on both dark terrain and bright effects.
- Every combat state has a visual event label and optional audio/haptic cue.
- Audio cues are redundant; gameplay never requires sound.
- Support screen-reader labels on DOM controls and an event-log alternative for canvas-only views.
- Avoid rapid color cycling and keep sustained flashing below safe limits.
- Provide left/right-handed action rail placement and remappable shortcuts.
- Pause and replay views allow the player to inspect combat at their own pace.
