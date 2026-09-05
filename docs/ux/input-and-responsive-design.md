# Project Orbitscar — Input and Responsive Design

**Status:** UX V0.1

## Orientation decision

Use **landscape-first** for colony placement and combat because the tactical board needs width for safe zones, range overlays, and a report timeline. Support portrait for queue, report, profile, and research surfaces where a single-column layout is useful. Do not letterbox or force a rotation during a player’s action; show a clear “rotate for combat” affordance only if a future portrait combat mode is not yet ready.

## Mobile gestures

| Gesture | Use | Safeguard |
|---|---|---|
| Tap | select, inspect, confirm | 48dp target, visible selected state |
| Drag | pan board, move building, choose drop zone | drag preview and cancel gutter |
| Pinch | zoom colony/sector | clamp zoom; preserve selected target |
| Long press | open contextual inspector | never the only route to a critical action |
| Two-finger pan | optional map pan when a unit is selected | no destructive action |
| Swipe | report timeline or card carousel | buttons remain available |
| Back/system gesture | cancel modal or return | unsaved placement confirmation |

## Desktop equivalents

- Mouse drag = pan/place; wheel = zoom.
- Hover previews are additive only; tap/click is authoritative.
- Right-click opens inspector or cancel menu, never the only path.
- Keyboard: `B` build, `R` reports, `F` forces, `M` sector, `Esc` cancel, `Space` pause in PvE/replay.
- Keyboard shortcuts must have visible menu alternatives.

## Form factors

Phone: one-handed reachable action rail and condensed cards.

Tablet/foldable: persistent inspector rail and wider report timeline.

Desktop/laptop: larger board, optional side-by-side scout/report panels, no extra combat mechanics.

## Performance budgets

- First interactive shell ≤3 seconds on a mid-range mobile browser over a warm cache; measure rather than assume.
- Combat target 60 fps on target mid Android, graceful 30 fps mode under load.
- Effects mode must reduce particles, shadows, and screen shake without hiding event labels.
- No hover-only information; no 1px map target.

## V0.3 implementation note

The Phaser scene now supports tap selection, drag pan, wheel zoom, two-pointer pinch zoom, snap-grid placement preview, and deployment-zone selection with three active pointers. The DOM command surface uses keyboard-accessible buttons with visible alternatives. Scrolling and browser certification on representative mobile devices remain verification work, not a completed claim.

## Readability preference

The top bar exposes a single persisted Low Effects toggle (`colony.settings.reducedMotion`). Low effects throttles the tactical battle redraw cadence so motion is calmer, while target identity, damage and hit meaning, deployment markers, destroyed-state rendering, battle progress, and report meaning are all preserved. The simulation authority is unaffected; only presentation cadence changes. OS-level `prefers-reduced-motion` is not yet auto-detected and remains a documented follow-up.
