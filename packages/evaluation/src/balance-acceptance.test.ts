import { describe, expect, it } from "vitest";
import balance from "@orbitscar/content/data/orbitscar-v0/balance.json" with { type: "json" };
import { parseOrbitscarContent } from "@orbitscar/content";
import { buildPlanInput, compositionsFor, timings, type Composition, type Timing, type Zone } from "./corpus.js";
import { runBattle, type RunRecord } from "./evaluate.js";

const content = parseOrbitscarContent(balance);
const encounters = Object.values(content.encounters);
const armedEncounters = encounters.filter((encounter) => encounter.structures.some((structure) => content.buildings[structure.buildingId].defenseId !== undefined));
const compositions: Composition[] = compositionsFor(content);
const timingById = new Map(timings.map((timing) => [timing.id, timing]));
const compositionById = new Map(compositions.map((composition) => [composition.id, composition]));
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

describe("Orbitscar balance scenario acceptance gates", () => {
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

  it("every defended encounter resists a universal all-in plan", () => {
    const replicas = 2;
    for (const encounter of armedEncounters) {
      const records: RunRecord[] = [];
      for (const composition of compositions)
        for (const zone of ["west", "north", "south", "east"] as const)
          for (let replica = 0; replica < replicas; replica += 1)
            records.push(scenario(encounter.id, composition.id, "immediate-mass", zone, false, compositionSeed(TIMING_SEED_BASE, replica)));
      const wins = attackerWins(records);
      expect(wins, `every immediate composition cleared ${encounter.id} from every approach in both seeds (${wins}/${records.length}); the encounter needs a real counterpressure matchup`).toBeLessThan(records.length);
    }
  }, 30_000);

  it("approach value varies by relay without a global side dominating", () => {
    const replicas = 2;
    const zones = ["west", "north", "south", "east"] as const;
    const ratesByZone = new Map<(typeof zones)[number], number[]>();
    for (const zone of zones) ratesByZone.set(zone, []);
    let targetBestCounts = Object.fromEntries(zones.map((zone) => [zone, 0])) as Record<(typeof zones)[number], number>;

    for (const encounter of armedEncounters) {
      const targetRates = Object.fromEntries(zones.map((zone) => {
        const records = compositions.flatMap((composition) => Array.from({ length: replicas }, (_, replica) => scenario(encounter.id, composition.id, "immediate-mass", zone, false, compositionSeed(TIMING_SEED_BASE, replica))));
        const rate = winRate(records);
        ratesByZone.get(zone)!.push(...records.map((record) => Number(record.winner === "attacker")));
        return [zone, rate];
      })) as Record<(typeof zones)[number], number>;
      const bestRate = Math.max(...Object.values(targetRates));
      for (const zone of zones) if (targetRates[zone] === bestRate) targetBestCounts[zone] += 1;
    }

    const globalRates = Object.fromEntries(zones.map((zone) => [zone, ratesByZone.get(zone)!.reduce((sum, win) => sum + win, 0) / ratesByZone.get(zone)!.length])) as Record<(typeof zones)[number], number>;
    const winsByZone = zones.map((zone) => ratesByZone.get(zone)!.reduce((sum, win) => sum + win, 0));
    const sampleSize = ratesByZone.get(zones[0])!.length;
    const gapWins = Math.max(...winsByZone) - Math.min(...winsByZone);
    expect(Object.values(targetBestCounts).every((count) => count > 0), `every approach should be a best or tied-best choice on at least one defended relay; observed ${JSON.stringify(targetBestCounts)}`).toBe(true);
    expect(Math.max(...Object.values(targetBestCounts)), `no approach should be best on most defended relays; observed ${JSON.stringify(targetBestCounts)}`).toBeLessThanOrEqual(6);
    // Compare integer wins so an exact 15% boundary does not fail from float rounding.
    expect(gapWins * 100, `global approach win-rate gap should remain within 15 points; observed ${JSON.stringify(globalRates)}`).toBeLessThanOrEqual(sampleSize * 15);
  }, 30_000);

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
  }, 30_000);

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
  }, 30_000);
});
