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
