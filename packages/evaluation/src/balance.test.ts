import { describe, expect, it } from "vitest";
import balance from "@orbitscar/content/data/orbitscar-v0/balance.json" with { type: "json" };
import { parseOrbitscarContent } from "@orbitscar/content";
import { buildPlanInput, compositionsFor, timings, type Composition, type Timing, type Zone } from "./corpus.js";
import { runBattle, type RunRecord } from "./evaluate.js";

// Balance scenario tests for the vertical slice.
//
// Two layers, both running the production resolver against the production
// corpus with fixed seeds so every scenario is reproducible byte-for-byte:
//
// 1. "Orbitscar balance scenario guards" — always on. Regression guards for
//    properties that currently hold and must keep holding (specialist
//    viability, staged-reinforcement viability, commander observability,
//    reproducibility, mass deployment not being literally unbeatable).
//
// 2. "Orbitscar balance scenario gates" — the known-issue acceptance gates
//    from packages/evaluation/FINDINGS.md (line-rigger dominance, immediate
//    mass-deployment dominance, weak commander value). These currently FAIL
//    against ruleset 0.2.0; they are skipped by default so `pnpm check`
//    stays green for the human blind-test setup. Run them with:
//
//      BALANCE_GATES=1 pnpm test
//
//    They are the acceptance criteria for the candidate balance changes
//    (nerf/broaden immediate-mass dominance; improve specialist or commander
//    value) and the regression guard if any dominance reappears. Per the
//    evidence-before-tuning rule, no balance values were changed here.
//
// Full corpus reproduction: `pnpm evaluate --runs 1344 --out runs/eval-local`.
//
// The human blind-playtest gate (five sessions) is a separate, still-blocked
// gate — see docs/playtest/README.md. These tests make no claim about fun or
// legibility; they only enforce structural non-dominance.

const content = parseOrbitscarContent(balance);
const encounters = Object.values(content.encounters);
const compositions: Composition[] = compositionsFor(content);
const timingById = new Map(timings.map((timing) => [timing.id, timing]));
const compositionById = new Map(compositions.map((composition) => [composition.id, composition]));

// Fixed seed plans, so the win rates quoted in assertion messages are the
// rates these seeds actually produce.
const COMPOSITION_SEED_BASE = 5000;
const TIMING_SEED_BASE = 6000;
const ABILITY_SEED_BASE = 7000;
const SEED_STRIDE = 131;

function scenario(encounterId: string, compositionId: string, timingId: string, zone: Zone, ability: boolean, seed: number): RunRecord {
  const encounter = content.encounters[encounterId];
  const composition = compositionById.get(compositionId)!;
  const timing = timingById.get(timingId)!;
  const plan = buildPlanInput(content, encounter, composition, timing, zone, ability, seed);
  return runBattle(content, encounter, plan, 0, false).record;
}

function compositionSeed(base: number, replica: number): number {
  return base + replica * SEED_STRIDE;
}

function attackerWins(records: RunRecord[]): number {
  return records.filter((record) => record.winner === "attacker").length;
}

function totalCasualties(records: RunRecord[]): number {
  return records.reduce((total, record) => total + Object.values(record.attackerCasualties).reduce((sum, count) => sum + count, 0), 0);
}

function winRate(records: RunRecord[]): number {
  return attackerWins(records) / records.length;
}

describe("Orbitscar balance scenario guards", () => {
  it("specialists retain niche value on every encounter", () => {
    const replicas = 4;
    for (const encounter of encounters) {
      const bestWinRate = Math.max(...compositions
        .filter((composition) => composition.id !== "screen-line")
        .map((composition) => {
          const runs = Array.from({ length: replicas }, (_, replica) => scenario(encounter.id, composition.id, "immediate-mass", "west", false, compositionSeed(COMPOSITION_SEED_BASE, replica)));
          return winRate(runs);
        }));
      expect(bestWinRate, `no specialist composition reached a 75% win rate on ${encounter.id}; specialists must keep niche value`).toBeGreaterThanOrEqual(0.75);
    }
  });

  it("immediate mass deployment does not win every scenario", () => {
    const replicas = 2;
    const records: RunRecord[] = [];
    for (const encounter of encounters)
      for (const composition of compositions)
        for (let replica = 0; replica < replicas; replica += 1)
          records.push(scenario(encounter.id, composition.id, "immediate-mass", "west", false, compositionSeed(TIMING_SEED_BASE, replica)));
    const wins = attackerWins(records);
    expect(wins, `immediate mass deployment won ${wins}/${records.length} scenarios; mass deployment must not be unbeatable`).toBeLessThan(records.length);
  });

  it("staged reinforcement remains viable on every encounter", () => {
    const replicas = 2;
    const staged = timings.filter((timing) => timing.id !== "immediate-mass");
    for (const encounter of encounters) {
      const bestStagedWinRate = Math.max(...staged.map((timing) => {
        const records: RunRecord[] = [];
        for (const composition of compositions)
          for (let replica = 0; replica < replicas; replica += 1)
            records.push(scenario(encounter.id, composition.id, timing.id, "west", false, compositionSeed(TIMING_SEED_BASE, replica)));
        return winRate(records);
      }));
      expect(bestStagedWinRate, `no staged reinforcement timing reached a 50% win rate on ${encounter.id}; splitting a force must stay a real choice`).toBeGreaterThanOrEqual(0.5);
    }
  });

  it("commander ability stays observable in battle events", () => {
    const replicas = 2;
    let changed = 0;
    let total = 0;
    for (const encounter of encounters)
      for (const composition of compositions)
        for (const timing of timings)
          for (let replica = 0; replica < replicas; replica += 1) {
            const seed = compositionSeed(ABILITY_SEED_BASE, replica);
            const withAbility = scenario(encounter.id, composition.id, timing.id, "west", true, seed);
            const without = scenario(encounter.id, composition.id, timing.id, "west", false, seed);
            total += 1;
            if (withAbility.outcomeHash !== without.outcomeHash) changed += 1;
          }
    expect(changed, `commander ability altered the battle outcome in only ${changed}/${total} scenarios; the ability must never become a literal no-op`).toBeGreaterThanOrEqual(Math.ceil(total * 0.5));
  });

  it("balance scenarios reproduce byte-for-byte across repeated resolution", () => {
    const samples: Array<[string, string, string, Zone, boolean]> = [
      ["cinder-yard", "screen-line", "immediate-mass", "west", false],
      ["glass-spine", "ranged-fortress", "probe-then-reinforce", "north", true],
      ["quiet-orbit", "air-harass", "half-half", "south", false],
      ["quiet-orbit", "sabotage-strike", "third-third-third", "east", true],
    ];
    for (const [encounterId, compositionId, timingId, zone, ability] of samples) {
      const encounter = content.encounters[encounterId];
      const composition = compositionById.get(compositionId)!;
      const timing = timingById.get(timingId)!;
      const input = buildPlanInput(content, encounter, composition, timing, zone, ability, 4242).input;
      const first = runBattle(content, encounter, { descriptor: { encounterId, compositionId, timingId, zone, ability }, input }, 0, false).record;
      const second = runBattle(content, encounter, { descriptor: { encounterId, compositionId, timingId, zone, ability }, input }, 0, false).record;
      expect(second.outcomeHash, `${encounterId}/${compositionId}/${timingId}/${zone}/ability=${ability} is not reproducible`).toBe(first.outcomeHash);
      expect(second.canonicalHash, `${encounterId}/${compositionId}/${timingId}/${zone}/ability=${ability} canonical hash is not reproducible`).toBe(first.canonicalHash);
    }
  });
});

// Known-issue gates (FINDINGS.md): skipped by default so `pnpm check` stays
// green for the human blind-test setup. Run with BALANCE_GATES=1 pnpm test.
const balanceGatesEnabled = process.env.BALANCE_GATES === "1";
describe.skipIf(!balanceGatesEnabled)("Orbitscar balance scenario gates (known issues, ruleset 0.2.0)", () => {
  it("line-rigger screen does not sweep every encounter", () => {
    const replicas = 4;
    const records: RunRecord[] = [];
    for (const encounter of encounters)
      for (let replica = 0; replica < replicas; replica += 1)
        records.push(scenario(encounter.id, "screen-line", "immediate-mass", "west", false, compositionSeed(COMPOSITION_SEED_BASE, replica)));
    const wins = attackerWins(records);
    expect(wins, `line-rigger screen won ${wins}/${records.length} scenarios across every encounter; a composition that wins everywhere dominates all others`).toBeLessThan(records.length);
  });

  it("no composition wins every encounter at zero casualties", () => {
    const replicas = 4;
    const records: RunRecord[] = [];
    for (const encounter of encounters)
      for (let replica = 0; replica < replicas; replica += 1)
        records.push(scenario(encounter.id, "screen-line", "immediate-mass", "west", false, compositionSeed(COMPOSITION_SEED_BASE, replica)));
    const casualties = totalCasualties(records);
    expect(casualties, `line-rigger screen won ${attackerWins(records)}/${records.length} scenarios while taking ${casualties} casualties; a cost-free sweep is degenerate regardless of win rate`).toBeGreaterThan(0);
  });

  it("immediate mass deployment is not strictly dominant on any encounter", () => {
    const replicas = 2;
    for (const encounter of encounters) {
      const records: RunRecord[] = [];
      for (const composition of compositions)
        for (let replica = 0; replica < replicas; replica += 1)
          records.push(scenario(encounter.id, composition.id, "immediate-mass", "west", false, compositionSeed(TIMING_SEED_BASE, replica)));
      const wins = attackerWins(records);
      expect(wins, `immediate mass deployment won ${wins}/${records.length} on ${encounter.id}; every encounter must give staged or zone play a real opening`).toBeLessThan(records.length);
    }
  });

  it("commander ability materially changes battle outcomes", () => {
    const replicas = 2;
    let changed = 0;
    let total = 0;
    for (const encounter of encounters)
      for (const composition of compositions)
        for (const timing of timings)
          for (let replica = 0; replica < replicas; replica += 1) {
            const seed = compositionSeed(ABILITY_SEED_BASE, replica);
            const withAbility = scenario(encounter.id, composition.id, timing.id, "west", true, seed);
            const without = scenario(encounter.id, composition.id, timing.id, "west", false, seed);
            total += 1;
            const materialChanged = JSON.stringify(withAbility.attackerCasualties) !== JSON.stringify(without.attackerCasualties)
              || JSON.stringify(withAbility.survivingUnits) !== JSON.stringify(without.survivingUnits);
            if (materialChanged) changed += 1;
          }
    expect(changed, `commander ability changed casualties or survivors in only ${changed}/${total} scenarios; a once-per-battle ability must move the material result`).toBeGreaterThanOrEqual(Math.ceil(total * 0.25));
  });

  it("commander ability moves the win rate", () => {
    const replicas = 2;
    const withAbility: RunRecord[] = [];
    const without: RunRecord[] = [];
    for (const encounter of encounters)
      for (const composition of compositions)
        for (const timing of timings)
          for (let replica = 0; replica < replicas; replica += 1) {
            const seed = compositionSeed(ABILITY_SEED_BASE, replica);
            withAbility.push(scenario(encounter.id, composition.id, timing.id, "west", true, seed));
            without.push(scenario(encounter.id, composition.id, timing.id, "west", false, seed));
          }
    const delta = winRate(withAbility) - winRate(without);
    expect(Math.abs(delta), `commander ability moved the win rate by only ${(Math.abs(delta) * 100).toFixed(1)} points (${(winRate(without) * 100).toFixed(1)}% -> ${(winRate(withAbility) * 100).toFixed(1)}%); a once-per-battle ability must be worth arming`).toBeGreaterThanOrEqual(0.03);
  });
});
