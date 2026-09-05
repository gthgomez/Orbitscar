import type { OrbitscarContent } from "@orbitscar/content";
import { createColony, parseColonySave, serializeColony, type ColonyState } from "@orbitscar/simulation";

export const storageKey = "orbitscar_colony_v3";
const legacyStorageKey = "orbitscar_colony_v2";
const oldestStorageKey = "orbitscar_colony_v1";

export function loadColony(content: OrbitscarContent): ColonyState {
  try {
    const saved = window.localStorage.getItem(storageKey) ?? window.localStorage.getItem(legacyStorageKey) ?? window.localStorage.getItem(oldestStorageKey);
    return saved === null ? createColony("local-player", content) : parseColonySave(saved);
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

