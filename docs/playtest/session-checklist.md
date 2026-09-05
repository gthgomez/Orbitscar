# Organizer session checklist

## Environment

- [ ] `pnpm install --frozen-lockfile` completed cleanly
- [ ] `pnpm check` green (typecheck, content, 23 unit tests, build)
- [ ] Production preview running: `pnpm build:web && pnpm --filter @orbitscar/web exec vite preview --port 4173`
- [ ] `http://localhost:4173` loads to "Home colony"
- [ ] DevTools open (Console visible), window maximized
- [ ] Fresh save: `localStorage.clear()` then reload
- [ ] Observation form ready (printed or second window)

## During the session

- [ ] Say only the scripted setup line
- [ ] Log timestamps on the observation form as they happen
- [ ] Do not answer gameplay questions; note them instead
- [ ] If the client errors: screenshot + copy
      `localStorage.getItem("orbitscar_colony_v3")` before touching anything
- [ ] Do not suggest a second attack

## After the session

- [ ] Complete the debrief questions in order
- [ ] File the observation form next to this checklist
- [ ] Clear `localStorage` before the next tester
- [ ] After all five sessions: fill the item-10 scoring table and record the
      verdict in the vertical-slice doc

## Return path

Bring the five forms (or transcriptions) back to the repository:
`docs/playtest/sessions/<date>-tester<N>.md`, then update
`docs/roadmap/vertical-slice.md` item 10 with the measured results. Until
then the gate remains honestly marked BLOCKED_ON_HUMAN_PLAYTEST.
