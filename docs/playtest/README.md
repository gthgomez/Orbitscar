# Orbitscar human playtest handoff

**Status: BLOCKED_ON_HUMAN_PLAYTEST.** Everything automatable around the blind
test is prepared here; the remaining gate requires real humans and cannot be
fabricated. Do not record session data until sessions actually happen.

## Historical vertical-slice evidence

- 33 unit tests, content validation, root+web typecheck, production build.
- The earlier vertical-slice branch had a 10-spec Playwright contract. That
  suite predates current V1 progression and spatial-combat changes and is not
  current browser-certification evidence.
- 1,344-run deterministic combat evaluation with zero invariant violations
  (`packages/evaluation/FINDINGS.md`).
- Deterministic balance gates are active by default and passed after the
  ruleset 0.3.0 spatial-navigation changes. They guard selected absolute
  failures; aggregate strategy parity remains unproven.
- V1 automated browser certification passed 14/14 against a production build.
  The expanded suite covers onboarding, economy, progression, raids,
  authority/rival attacks, live commands, migration, accessibility, and mobile
  touch placement; see `docs/campaign/full-game/STATUS.md` for evidence.
  Automation does not replace blind human sessions.

## What only humans can answer (vertical-slice item 10)

- Do five blind testers reach a second attack (target: ≥60%)?
- Can ≥60% explain at least one counter to a defense after one session?
- Is the colony-to-breach loop legible without narration?
- Does the remaining high aggregate win rate for immediate mass deployment
  and line-rigger screens feel degenerate in play? The current acceptance
  gates prevent universal sweeps but do not establish broad strategy parity;
  see `packages/evaluation/FINDINGS.md` for the last measured corpus.

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
