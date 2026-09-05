import type { OrbitscarContent, OrbitscarEncounterDefinition } from "@orbitscar/content";
import type { OrbitscarArmyEntry, OrbitscarBattleInput, OrbitscarCommand } from "@orbitscar/simulation";

export type Zone = "west" | "north" | "south" | "east";

export const ARENA = { width: 1200, height: 800 };
export const ZONES: Zone[] = ["west", "north", "south", "east"];
export const MAX_DEPLOYMENT_CHARGES = 3;
export const DEPLOYMENT_CAPACITY = 10;

const ZONE_POSITIONS: Record<Zone, { x: number; y: number }> = {
  west: { x: 120, y: 400 },
  north: { x: 420, y: 90 },
  south: { x: 420, y: 710 },
  east: { x: 1080, y: 400 },
};

/** Candidate force archetypes, each within the 10-capacity deployment budget. */
export type Composition = { id: string; description: string; units: OrbitscarArmyEntry[] };

export function compositionsFor(content: OrbitscarContent): Composition[] {
  const capacity = (units: OrbitscarArmyEntry[]) => units.reduce((total, entry) => total + (content.units[entry.unitId]?.capacity ?? 0) * entry.count, 0);
  const candidates: Composition[] = [
    { id: "screen-line", description: "Eight line riggers in a dense screen", units: [{ unitId: "line_rigger", count: 8 }] },
    { id: "ranged-fortress", description: "Ranged marksmen behind a shield carrier", units: [{ unitId: "pulse_marksman", count: 7 }, { unitId: "shield_carrier", count: 1 }] },
    { id: "anti-armor-punch", description: "Ram walkers with a rigger escort", units: [{ unitId: "ram_walker", count: 2 }, { unitId: "line_rigger", count: 2 }] },
    { id: "air-harass", description: "Needle drone swarm avoiding ground fire", units: [{ unitId: "needle_drone", count: 9 }] },
    { id: "skirmish-mix", description: "Flank walkers, riggers, and a drone", units: [{ unitId: "skirmish_walker", count: 2 }, { unitId: "line_rigger", count: 3 }, { unitId: "needle_drone", count: 1 }] },
    { id: "salvage-raid", description: "Haulers escorted by riggers for economy raids", units: [{ unitId: "salvage_hauler", count: 3 }, { unitId: "line_rigger", count: 4 }] },
    { id: "sabotage-strike", description: "Saboteurs and marksmen hunting defenses", units: [{ unitId: "signal_saboteur", count: 2 }, { unitId: "pulse_marksman", count: 6 }] },
  ];
  for (const candidate of candidates) {
    const total = capacity(candidate.units);
    if (total > DEPLOYMENT_CAPACITY) throw new Error(`composition '${candidate.id}' exceeds deployment capacity: ${total}`);
    for (const entry of candidate.units) if (!content.units[entry.unitId]) throw new Error(`composition '${candidate.id}' references unknown unit '${entry.unitId}'`);
  }
  return candidates;
}

/** Reinforcement timings: immediate mass deployment vs staged or delayed reinforcement. */
export type Timing = { id: string; description: string; waveFractions: number[]; delayedSecondWaveTick?: number };

export const timings: Timing[] = [
  { id: "immediate-mass", description: "Everything in one wave at tick 0", waveFractions: [1] },
  { id: "half-half", description: "Two even waves at tick 0 and 600", waveFractions: [0.5, 0.5] },
  { id: "probe-then-reinforce", description: "Small probe, main force at tick 900", waveFractions: [0.25, 0.75], delayedSecondWaveTick: 900 },
  { id: "third-third-third", description: "Three waves at 0 / 600 / 1200", waveFractions: [1 / 3, 1 / 3, 1 / 3] },
];

export function splitArmy(units: OrbitscarArmyEntry[], fractions: number[]): OrbitscarArmyEntry[][] {
  const waves: OrbitscarArmyEntry[][] = fractions.map(() => []);
  const remaining = new Map(units.map((entry) => [entry.unitId, entry.count]));
  fractions.forEach((fraction, index) => {
    const isLast = index === fractions.length - 1;
    for (const entry of units) {
      const left = remaining.get(entry.unitId) ?? 0;
      const count = isLast ? left : Math.floor(entry.count * fraction);
      if (count > 0) { waves[index].push({ unitId: entry.unitId, count }); remaining.set(entry.unitId, left - count); }
    }
  });
  return waves.filter((wave) => wave.length > 0);
}

export type PlanDescriptor = { encounterId: string; compositionId: string; timingId: string; zone: Zone; ability: boolean };

export type PlanInput = { descriptor: PlanDescriptor; input: OrbitscarBattleInput };

/** Build the canonical battle input for a plan using the exact production resolver contract. */
export function buildPlanInput(content: OrbitscarContent, encounter: OrbitscarEncounterDefinition, composition: Composition, timing: Timing, zone: Zone, ability: boolean, seed: number): PlanInput {
  const waves = splitArmy(composition.units, timing.waveFractions);
  if (waves.length > MAX_DEPLOYMENT_CHARGES) throw new Error(`plan needs ${waves.length} charges`);
  const commands: OrbitscarCommand[] = waves.map((units, index) => ({
    commandId: `wave-${index + 1}`,
    sequence: index + 1,
    tick: index === 0 ? 0 : (timing.delayedSecondWaveTick ?? 600) * (index === 1 ? 1 : index),
    type: "DEPLOY" as const,
    payload: { zone: index === 0 ? zone : index === 1 && timing.delayedSecondWaveTick !== undefined ? oppositeZone(zone) : zone, position: { ...ZONE_POSITIONS[index === 0 ? zone : index === 1 && timing.delayedSecondWaveTick !== undefined ? oppositeZone(zone) : zone] }, units },
  }));
  const abilityTarget = encounter.structures.find((structure) => content.buildings[structure.buildingId]?.defenseId !== undefined)?.id;
  if (ability) commands.push({ commandId: "commander-reroute", sequence: commands.length + 1, tick: 300, type: "COMMANDER_ABILITY" as const, payload: { abilityId: content.commanders.mara_voss.abilityId, targetStructureId: abilityTarget } });
  const input: OrbitscarBattleInput = {
    canonicalFormatVersion: 2,
    rulesetVersion: content.rulesetVersion,
    seed,
    maxDurationTicks: 2400,
    arena: { ...ARENA },
    deploymentCapacity: DEPLOYMENT_CAPACITY,
    maxDeploymentCharges: MAX_DEPLOYMENT_CHARGES,
    commanderId: "mara_voss",
    rewardPreview: { ...encounter.rewardPreview },
    army: composition.units.map((entry) => ({ ...entry })),
    structures: encounter.structures.map((structure) => ({ ...structure, position: { ...structure.position } })),
    commands,
    content,
  };
  return { descriptor: { encounterId: encounter.id, compositionId: composition.id, timingId: timing.id, zone, ability }, input };
}

function oppositeZone(zone: Zone): Zone {
  switch (zone) {
    case "west": return "east";
    case "east": return "west";
    case "north": return "south";
    case "south": return "north";
  }
}
