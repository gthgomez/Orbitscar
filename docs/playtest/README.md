# Orbitscar human playtest handoff

**Status: BLOCKED_ON_HUMAN_PLAYTEST.** Everything automatable around the blind
test is prepared here; the remaining gate requires real humans and cannot be
fabricated. Do not record session data until sessions actually happen.

## What is already proven without humans

- 33 unit tests, content validation, root+web typecheck, production build.
- 10-spec Playwright browser contract on the production build: complete
  colony-to-breach loop, deployment charge limits, capacity refusal, commander
  ability, measured health-bar decay, retreat, report reconciliation, reload
  persistence, legacy save migration, tamper fail-safety, every authored
  encounter, and a mobile-viewport run.
- 1,344-run deterministic combat evaluation with zero invariant violations
  (`packages/evaluation/FINDINGS.md`).
- 10 deterministic balance scenario tests (`packages/evaluation/src/balance.test.ts`)
  covering line-rigger dominance, mass-deployment dominance, and commander
  value. Five always-on regression guards protect properties that currently
  hold; five known-issue gates currently FAIL against ruleset 0.2.0,
  reproducing the documented dominance issues as executable evidence. The
  known-issue gates are skipped by default so `pnpm check` stays green for
  session setup — run them explicitly with `BALANCE_GATES=1 pnpm test`. They
  are the acceptance criteria for the candidate balance changes and the
  regression guard if any dominance reappears. These tests make no claim
  about fun or legibility.

## What only humans can answer (vertical-slice item 10)

- Do five blind testers reach a second attack (target: ≥60%)?
- Can ≥60% explain at least one counter to a defense after one session?
- Is the colony-to-breach loop legible without narration?
- Does the dominant strategy found by the harness (immediate mass deployment
  of line riggers) *feel* degenerate in play? (Structurally, it is confirmed
  degenerate: the line-rigger screen wins 12/12 measured scenarios at zero
  casualties, and immediate mass deployment wins 14/14 on two of three
  encounters — see `packages/evaluation/src/balance.test.ts`.)

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
