# Orbitscar human playtest handoff

**Status: BLOCKED_ON_HUMAN_PLAYTEST.** Everything automatable around the blind
test is prepared here; the remaining gate requires real humans and cannot be
fabricated. Do not record session data until sessions actually happen.

## What is already proven without humans

- 23 unit tests, content validation, root+web typecheck, production build.
- 10-spec Playwright browser contract on the production build: complete
  colony-to-breach loop, deployment charge limits, capacity refusal, commander
  ability, measured health-bar decay, retreat, report reconciliation, reload
  persistence, legacy save migration, tamper fail-safety, every authored
  encounter, and a mobile-viewport run.
- 1,344-run deterministic combat evaluation with zero invariant violations
  (`packages/evaluation/FINDINGS.md`).

## What only humans can answer (vertical-slice item 10)

- Do five blind testers reach a second attack (target: ≥60%)?
- Can ≥60% explain at least one counter to a defense after one session?
- Is the colony-to-breach loop legible without narration?
- Does the dominant strategy found by the harness (immediate mass deployment
  of line riggers) *feel* degenerate in play?

## Package contents

| File | Purpose |
| --- | --- |
| `protocol.md` | Session script, task order, what not to say, stop conditions |
| `observation-form.md` | One copy per tester; fill during/after the session |
| `session-checklist.md` | Organizer setup checklist per session |

## Running a session

1. Follow `session-checklist.md` to prepare the room and the build.
2. Serve the production build: `pnpm build:web && pnpm --filter @orbitscar/web exec vite preview --port 4173`, then open `http://localhost:4173`.
3. Clear the save between testers: DevTools → `localStorage.clear()` → reload.
4. Follow `protocol.md`; record on `observation-form.md`.

Automated tests are not a substitute for these sessions and make no claims
about fun, legibility, or desire to replay.
