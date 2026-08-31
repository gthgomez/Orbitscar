# Project Orbitscar preproduction index

This folder is the continuity entry point for the clean-room sci-fi strategy campaign. The repository still contains the earlier Tideforge Empires implementation and historical design material; the Orbitscar documents define a separate product direction and intentionally do not rewrite that existing game.

## Read first

1. [Repository state](00-repository-state.md)
2. [Market thesis](../research/market-thesis.md)
3. [Product red team](../adversarial/product-red-team.md)
4. [Game design document](../design/game-design-document.md)
5. [Architecture decision record](../architecture/architecture-decision-record.md)
6. [Vertical slice](../roadmap/vertical-slice.md)
7. [Agent backlog](../roadmap/agent-backlog.md)
8. [Decision log](../decisions/decision-log.md)
9. [Unknowns](../research/unknowns.md)

## Campaign result

The evidence supports a **conditional continuation**: the narrow attack loop and contiguous territory concept are promising design hypotheses, but demand, combat fun, and the ability to sustain cosmetics-first monetization remain unproven. The next gate is a playable combat vertical slice with deterministic replay tests and external player research.

## Implementation boundary

The initial code foundation is isolated in `packages/combat/src/orbitscar.ts` and `packages/content/data/orbitscar-v0/balance.json`. It is a deterministic sandbox contract, not a production combat system, and is not wired into the existing Tideforge content or UI.
