import type { OrbitscarContent, OrbitscarEncounterDefinition } from "@orbitscar/content";
import { resolveOrbitscarBattle, validateOrbitscarInput, type OrbitscarBattleInput, type OrbitscarBattleResult } from "@orbitscar/simulation";
import type { Zone } from "./corpus.js";
import { buildPlanInput, compositionsFor, timings, type PlanDescriptor } from "./corpus.js";

export type RunRecord = {
  run: number;
  seed: number;
  encounter: string;
  composition: string;
  timing: string;
  zone: Zone;
  ability: boolean;
  winner: "attacker" | "defender" | "draw";
  victoryTier: "full" | "partial" | "defeat";
  retreated: boolean;
  durationTicks: number;
  attackerCasualties: Record<string, number>;
  survivingUnits: Record<string, number>;
  destroyedStructureIds: string[];
  loot: Record<string, number>;
  commanderUse: number;
  eventCount: number;
  canonicalHash: string;
  outcomeHash: string;
  invariantViolations: string[];
  validationErrors: string[];
};

export function runBattle(content: OrbitscarContent, encounter: OrbitscarEncounterDefinition, plan: ReturnType<typeof buildPlanInput>, runIndex: number, checkDeterminism: boolean): { record: RunRecord; input: OrbitscarBattleInput; result: OrbitscarBattleResult } {
  const { descriptor, input } = plan;
  const validation = validateOrbitscarInput(input);
  const violations: string[] = [];
  const result = resolveOrbitscarBattle(input);
  if (!validation.ok) violations.push(...validation.errors.map((error) => `validation: ${error}`));
  // deployment contract invariants
  const deployCommands = input.commands.filter((command) => command.type === "DEPLOY");
  if (deployCommands.length > input.maxDeploymentCharges) violations.push("deployment charges exceeded");
  for (const usage of result.deploymentUsage) if (usage.capacityUsed > input.deploymentCapacity) violations.push(`wave capacity ${usage.capacityUsed} exceeded ${input.deploymentCapacity}`);
  // army conservation: survivors + casualties must equal the committed army per unit
  for (const entry of input.army) {
    const survivors = result.survivingUnits[entry.unitId] ?? 0;
    const casualties = result.attackerCasualties[entry.unitId] ?? 0;
    if (survivors + casualties !== entry.count) violations.push(`army conservation failed for '${entry.unitId}': ${survivors}+${casualties} != ${entry.count}`);
  }
  for (const [resourceId, amount] of Object.entries(result.loot)) if (amount < 0) violations.push(`negative loot for '${resourceId}'`);
  if (result.eventCount !== result.events.length) violations.push("event count mismatch");
  if (checkDeterminism) {
    const replay = resolveOrbitscarBattle(input);
    if (replay.outcomeHash !== result.outcomeHash || replay.canonicalHash !== result.canonicalHash) violations.push("determinism: repeated resolution diverged");
  }
  const record: RunRecord = {
    run: runIndex,
    seed: input.seed,
    encounter: descriptor.encounterId,
    composition: descriptor.compositionId,
    timing: descriptor.timingId,
    zone: descriptor.zone,
    ability: descriptor.ability,
    winner: result.winner,
    victoryTier: result.victoryTier,
    retreated: result.retreated,
    durationTicks: result.durationTicks,
    attackerCasualties: result.attackerCasualties,
    survivingUnits: result.survivingUnits,
    destroyedStructureIds: result.destroyedStructureIds,
    loot: result.loot,
    commanderUse: result.commanderUse.count,
    eventCount: result.eventCount,
    canonicalHash: result.canonicalHash,
    outcomeHash: result.outcomeHash,
    invariantViolations: violations,
    validationErrors: validation.ok ? [] : validation.errors,
  };
  return { record, input, result };
}

export type EvaluationSummaryGroup = {
  encounter: string;
  composition: string;
  timing: string;
  zone: string;
  ability: boolean;
  runs: number;
  attackerWins: number;
  fullBreaches: number;
  winRate: number;
  averageDurationTicks: number;
  averageCasualties: number;
  averageDestroyed: number;
  averageLootAlloy: number;
};

export function summarize(records: RunRecord[]): { groups: EvaluationSummaryGroup[]; totalRuns: number; invariantViolations: number; uniqueOutcomeHashes: number } {
  const byKey = new Map<string, RunRecord[]>();
  for (const record of records) {
    const key = `${record.encounter}|${record.composition}|${record.timing}|${record.zone}|${record.ability}`;
    const bucket = byKey.get(key) ?? [];
    bucket.push(record);
    byKey.set(key, bucket);
  }
  const groups: EvaluationSummaryGroup[] = [...byKey.entries()].map(([key, bucket]) => {
    const [encounter, composition, timing, zone, ability] = key.split("|");
    const attackerWins = bucket.filter((record) => record.winner === "attacker").length;
    const fullBreaches = bucket.filter((record) => record.victoryTier === "full").length;
    const average = (selector: (record: RunRecord) => number) => bucket.reduce((total, record) => total + selector(record), 0) / bucket.length;
    return {
      encounter,
      composition,
      timing,
      zone,
      ability: ability === "true",
      runs: bucket.length,
      attackerWins,
      fullBreaches,
      winRate: attackerWins / bucket.length,
      averageDurationTicks: Math.round(average((record) => record.durationTicks)),
      averageCasualties: Math.round(average((record) => Object.values(record.attackerCasualties).reduce((total, count) => total + count, 0)) * 10) / 10,
      averageDestroyed: Math.round(average((record) => record.destroyedStructureIds.length) * 10) / 10,
      averageLootAlloy: Math.round(average((record) => record.loot.alloy ?? 0) * 10) / 10,
    };
  });
  return {
    groups,
    totalRuns: records.length,
    invariantViolations: records.filter((record) => record.invariantViolations.length > 0).length,
    uniqueOutcomeHashes: new Set(records.map((record) => record.outcomeHash)).size,
  };
}

export function* planDescriptors(encounters: OrbitscarEncounterDefinition[], content: OrbitscarContent, zones: Zone[], withAbility: boolean[]): Generator<{ descriptor: PlanDescriptor; build: (seed: number) => ReturnType<typeof buildPlanInput> }> {
  const compositions = compositionsFor(content);
  for (const encounter of encounters)
    for (const composition of compositions)
      for (const timing of timings)
        for (const zone of zones)
          for (const ability of withAbility)
            yield { descriptor: { encounterId: encounter.id, compositionId: composition.id, timingId: timing.id, zone, ability }, build: (seed: number) => buildPlanInput(content, encounter, composition, timing, zone, ability, seed) };
}
