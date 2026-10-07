import type { OrbitscarContent } from "@orbitscar/content";
import { createColony, parseColonySave, serializeColony, type ColonyState } from "@orbitscar/simulation";

export const storageKey = "orbitscar_colony_v5";
const legacyStorageKey = "orbitscar_colony_v4";
const olderStorageKey = "orbitscar_colony_v3";
const older2StorageKey = "orbitscar_colony_v2";
const oldestStorageKey = "orbitscar_colony_v1";

export function loadColony(content: OrbitscarContent): ColonyState {
  try {
    const saved = window.localStorage.getItem(storageKey) ?? window.localStorage.getItem(legacyStorageKey) ?? window.localStorage.getItem(olderStorageKey) ?? window.localStorage.getItem(older2StorageKey) ?? window.localStorage.getItem(oldestStorageKey);
    if (saved === null) return createColony("local-player", content);
    const colony = parseColonySave(saved);
    const completed = new Set(colony.completedObjectives);
    const doctrineId = content.doctrines[colony.doctrineId] ? colony.doctrineId : "none";
    const commanderId = content.commanders[colony.commanderId] ? colony.commanderId : "mara_voss";
    if (colony.buildings.some((building) => content.buildings[building.buildingId]?.defenseId)) completed.add("first-defense");
    if (Object.values(colony.reserves).reduce((sum, count) => sum + count, 0) >= 3 || colony.reports.some((report) => report.kind === "attack")) completed.add("starter-force");
    if (colony.scoutedTargets.length > 0 || colony.reports.some((report) => report.kind === "attack")) completed.add("first-scout");
    if (colony.reports.some((report) => report.kind === "attack")) completed.add("first-sortie");
    if (colony.buildings.some((building) => building.buildingId === "command_relay" && building.level >= 2)) completed.add("command-tier-2");
    if (doctrineId !== "none") completed.add("first-doctrine");
    return { ...colony, commanderId, doctrineId, completedObjectives: [...completed] };
  } catch {
    return createColony("local-player", content);
  }
}

export function persistColony(colony: ColonyState, message: string): { message: string } {
  try {
    window.localStorage.setItem(storageKey, serializeColony(colony));
    return { message };
  } catch {
    return { message: "Local save unavailable; this session is still playable." };
  }
}
