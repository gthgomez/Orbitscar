import type { OrbitscarContent } from "@orbitscar/content";
import type { ColonyState } from "./colony.js";
import type { OrbitscarBattleInput, OrbitscarDeploymentZone } from "./orbitscar.js";

export type ColonyRaidArchetype = "scavenger_swarm" | "breach_column" | "signal_harvest";
export const COLONY_RAID_ARCHETYPES: readonly ColonyRaidArchetype[] = ["scavenger_swarm", "breach_column", "signal_harvest"];
const raidForces: Record<ColonyRaidArchetype, Array<{ unitId: string; count: number }>> = {
  scavenger_swarm: [{ unitId: "line_rigger", count: 4 }, { unitId: "needle_drone", count: 2 }],
  breach_column: [{ unitId: "ram_walker", count: 1 }, { unitId: "line_rigger", count: 2 }],
  signal_harvest: [{ unitId: "signal_saboteur", count: 2 }, { unitId: "needle_drone", count: 2 }],
};
const escalatedRaidForces: Record<ColonyRaidArchetype, Array<{ unitId: string; count: number }>> = {
  scavenger_swarm: [{ unitId: "line_rigger", count: 6 }, { unitId: "needle_drone", count: 2 }],
  breach_column: [{ unitId: "ram_walker", count: 1 }, { unitId: "line_rigger", count: 4 }],
  signal_harvest: [{ unitId: "signal_saboteur", count: 2 }, { unitId: "needle_drone", count: 4 }],
};
const veteranRaidForces: Record<ColonyRaidArchetype, Array<{ unitId: string; count: number }>> = {
  scavenger_swarm: [{ unitId: "line_rigger", count: 6 }, { unitId: "needle_drone", count: 4 }],
  breach_column: [{ unitId: "ram_walker", count: 2 }, { unitId: "line_rigger", count: 2 }],
  signal_harvest: [{ unitId: "signal_saboteur", count: 4 }, { unitId: "needle_drone", count: 2 }],
};
const zones: OrbitscarDeploymentZone[] = ["west", "north", "south", "east"];
const positions = [
  { x: 35, y: 400 },
  { x: 600, y: 35 },
  { x: 600, y: 765 },
  { x: 1165, y: 400 },
] as const;

export function colonyRaidIntensity(colony: Pick<ColonyState, "defensiveEngagements">): 1 | 2 | 3 {
  if (!Number.isSafeInteger(colony.defensiveEngagements) || colony.defensiveEngagements < 0) throw new Error("invalid defensive engagement count");
  return Math.min(3, Math.floor(colony.defensiveEngagements / 3) + 1) as 1 | 2 | 3;
}

export function buildColonyRaidInput(colony: ColonyState, archetype: ColonyRaidArchetype, seed: number, content: OrbitscarContent): OrbitscarBattleInput {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error("raid seed must be an unsigned integer");
  const baseArmy = raidForces[archetype];
  if (!baseArmy) throw new Error(`unknown raid archetype '${archetype}'`);
  const escalation = colonyRaidIntensity(colony) - 1;
  const army = escalation === 0 ? baseArmy : escalation === 1 ? escalatedRaidForces[archetype] : veteranRaidForces[archetype];
  const zoneIndex = seed % zones.length;
  return {
    canonicalFormatVersion: 2,
    rulesetVersion: content.rulesetVersion,
    seed,
    maxDurationTicks: 2400,
    arena: { width: 1200, height: 800 },
    deploymentCapacity: 10,
    maxDeploymentCharges: 1,
    commanderId: colony.commanderId,
    defenderDoctrineId: colony.doctrineId,
    army: army.map((entry) => ({ ...entry })),
    structures: colony.buildings.map((building) => ({ id: building.id, buildingId: building.buildingId, position: { ...building.position }, level: building.level, currentHealth: building.health })),
    commands: [{ commandId: `raid-${seed}`, sequence: 1, tick: 0, type: "DEPLOY", payload: { zone: zones[zoneIndex], position: { ...positions[zoneIndex] }, units: army.map((entry) => ({ ...entry })) } }],
    rewardPreview: {},
    content,
  };
}
