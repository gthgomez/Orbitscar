# Blind test protocol

Audience: five testers who have never seen Orbitscar. One organizer. One
session per tester, target 20–30 minutes including debrief.

## Before the tester arrives

- Production build served at `http://localhost:4173` (see `README.md`).
- `localStorage` cleared; page freshly reloaded; window maximized.
- Observation form printed or opened in a second window.
- No commentary prepared. Do not explain systems in advance.

## Session script

1. **Setup (say exactly this):** "This is an early science-fiction strategy
   prototype. You command a small colony. The goal is up to you to figure
   out. Think out loud; I can't answer questions about how to play."
2. **Free exploration (≤10 min).** Say nothing except logging behavior. If
   the tester is completely stuck after 8 minutes with no colony action,
   offer the single hint: "Try the buttons on the colony panel."
3. **Attack prompt (only if they have not attacked):** "Pick a target and
   attack it when you feel ready."
4. **After the first battle report:** "You may keep playing however you
   like." (Do not suggest a second attack; the second attack is measured,
   not requested.)
5. **Debrief (5 min).** Questions in the observation form, in order.

## What the organizer records

- Timestamps: first construction, first training, first deployment, first
  report, second attack (or session end without one).
- Every moment of visible confusion, verbatim where possible.
- Whether the tester armed the ability, staged more than one wave, or used
  different deployment zones.
- Any console errors or visual glitches (DevTools open, console tab visible).

## Stop conditions

Tester may stop at any time. Organizer ends the session early if the client
crashes or the save visibly corrupts; capture the state (screenshot +
`localStorage.getItem("orbitscar_colony_v3")`) before restarting.

## Debrief question order (do not reorder)

1. "Walk me through what you were trying to do."
2. "What did you think the enemy defenses would do?"
3. "Name one way you could beat [structure they fought] next time." (item-10
   counter question — record their exact words)
4. "If you played again, what would you do differently?"
5. "What was the most confusing screen or moment?"
