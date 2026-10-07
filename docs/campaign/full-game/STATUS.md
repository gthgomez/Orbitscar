# Orbitscar V1 Campaign Status

- **Current milestone:** 3 — colony defense is integrated; progressing toward incremental combat.
- **Completed:** checkout audit; campaign mission/plan; bounded elapsed-time production, caps, extractor-level yield and schema v4 migration; same-colony raid snapshot, three raid archetypes, defense fire, persisted damage/report, repair, archived replay snapshots, report list/replay, and level-scaled defense stats.
- **Branch:** `fix/balance-scenario-tests`.
- **Evidence:** latest `pnpm check` passed: typechecks, content validation (3 resources, 6 buildings, 3 defenses, 10 units, 2 commanders, 3 encounters), 33 tests passed/5 pre-existing known-balance gates skipped, and production web build. Targeted economy/raid tests and full evaluation corpus passed (1,344 runs, 0 invariant violations). No browser automation has been run.
- **Known failures:** explicit `BALANCE_GATES=1` baseline: line-rigger wins 12/12 with zero losses; immediate mass wins 14/14 on Glass Spine; ability changes material outcomes 10/168 and win rate +1.8 points. These remain acceptance failures and are still skipped. The build warns the main JS chunk is ~1.28 MB (354 kB gzip).
- **Next actions:** implement incremental append-at-tick commands and live reinforcement/commander decisions; then resolve dominant strategies and make balance gates always-on. Continue with research/unlocks, PvE breadth, server, sector, presentation, then final browser certification.
- **Blockers:** none known. Human playtest evidence is unavailable and remains unverified.
- **Deviations:** economy uses bounded local elapsed time (four-hour catch-up) as an offline-friendly V1 substitute; asynchronous server and territory remain future campaign milestones. Browser testing remains deferred as required.
