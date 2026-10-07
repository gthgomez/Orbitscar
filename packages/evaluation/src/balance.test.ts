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
// Deterministic acceptance guards for specialist viability, staged
// reinforcement value, commander impact, and strategy non-dominance. They
// run in the default `pnpm check` suite against the production resolver.
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

function winRate(records: RunRecord[]): number {
  return attackerWins(records) / records.length;
}

describe("Orbitscar balance scenario guards", () => {
  it("specialists retain niche value from a viable approach on every encounter", () => {
    const replicas = 4;
    for (const encounter of encounters) {
      const specialistRates = compositions
        .filter((composition) => composition.id !== "screen-line")
        .flatMap((composition) => (["west", "north", "south", "east"] as const).map((zone) => {
          const runs = Array.from({ length: replicas }, (_, replica) => scenario(encounter.id, composition.id, "immediate-mass", zone, false, compositionSeed(COMPOSITION_SEED_BASE, replica)));
          return { id: `${composition.id}/${zone}`, rate: winRate(runs) };
        }));
      const best = Math.max(...specialistRates.map(({ rate }) => rate));
      expect(best, `no specialist composition/approach reached a 75% win rate on ${encounter.id} (${specialistRates.map(({ id, rate }) => `${id}=${Math.round(rate * 100)}%`).join(", ")}); specialist planning must retain a viable counter`).toBeGreaterThanOrEqual(0.75);
    }
  }, 60_000);

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

  it("staged reinforcement remains viable on contested and severe encounters", () => {
    const replicas = 2;
    const staged = timings.filter((timing) => timing.id !== "immediate-mass");
    // Cinder Yard is an introductory cautious target that should reward a
    // simple first breach. Require staged viability where sustained defense
    // and overlapping lanes make a reactive reserve decision useful.
    let viableEncounterCount = 0;
    let stagedUpsideEncounterCount = 0;
    for (const encounter of encounters.filter((entry) => entry.difficulty !== "cautious")) {
      const bestStagedWinRate = Math.max(...staged.map((timing) => {
        const records: RunRecord[] = [];
        for (const composition of compositions)
          for (let replica = 0; replica < replicas; replica += 1)
            records.push(scenario(encounter.id, composition.id, timing.id, "west", false, compositionSeed(TIMING_SEED_BASE, replica)));
        return winRate(records);
      }));
      if (bestStagedWinRate >= 0.5) viableEncounterCount += 1;
      const immediateRecords: RunRecord[] = [];
      for (const composition of compositions)
        for (let replica = 0; replica < replicas; replica += 1)
          immediateRecords.push(scenario(encounter.id, composition.id, "immediate-mass", "west", false, compositionSeed(TIMING_SEED_BASE, replica)));
      if (bestStagedWinRate > winRate(immediateRecords)) stagedUpsideEncounterCount += 1;
    }
    expect(viableEncounterCount, "staged reinforcement must be viable in at least one contested-or-severe matchup").toBeGreaterThan(0);
    expect(stagedUpsideEncounterCount, "at least one contested-or-severe matchup must reward staging over immediate mass").toBeGreaterThan(0);
  }, 30_000);

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
  }, 30_000);

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
