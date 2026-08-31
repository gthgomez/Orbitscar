import type { OrbitscarBattleInput, OrbitscarBattleResult, OrbitscarPosition } from "./orbitscar.js";
import type { OrbitscarContent, OrbitscarResourceBundle } from "@orbitscar/content";
import { authoritativeDigest, canonicalSerialize } from "./hash.js";

export const COLONY_SCHEMA_VERSION = 2;
export type ColonyBuilding = { id: string; buildingId: string; position: OrbitscarPosition; level: number; health: number };
export type ColonyReport = { id: string; createdAt: string; result: OrbitscarBattleResult };
export type ColonyState = { schemaVersion: number; playerId: string; createdAt: string; updatedAt: string; resources: Record<string, number>; buildings: ColonyBuilding[]; reserves: Record<string, number>; research: string[]; reports: ColonyReport[]; settings: { muted: boolean; reducedMotion: boolean } };
export type ColonySave = { schemaVersion: number; payload: ColonyState; checksum: string };

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function now(): string { return new Date().toISOString(); }
function sumBundle(left: Record<string, number>, right: OrbitscarResourceBundle): Record<string, number> { const result = { ...left }; for (const [id, amount] of Object.entries(right)) result[id] = (result[id] ?? 0) + amount; return result; }
function canAfford(resources: Record<string, number>, cost: OrbitscarResourceBundle): boolean { return Object.entries(cost).every(([id, amount]) => (resources[id] ?? 0) >= amount); }
function spend(resources: Record<string, number>, cost: OrbitscarResourceBundle): void { for (const [id, amount] of Object.entries(cost)) resources[id] = (resources[id] ?? 0) - amount; }
function overlap(a: ColonyBuilding, b: ColonyBuilding, content: OrbitscarContent): boolean { const af = content.buildings[a.buildingId].footprint; const bf = content.buildings[b.buildingId].footprint; return a.position.x < b.position.x + bf[0] * 40 && a.position.x + af[0] * 40 > b.position.x && a.position.y < b.position.y + bf[1] * 40 && a.position.y + af[1] * 40 > b.position.y; }

export function createColony(playerId: string, content: OrbitscarContent): ColonyState {
  const timestamp = now();
  return { schemaVersion: COLONY_SCHEMA_VERSION, playerId, createdAt: timestamp, updatedAt: timestamp, resources: Object.fromEntries(Object.keys(content.resources).map((id) => [id, id === "alloy" ? 500 : id === "volatile" ? 220 : 140])), buildings: [{ id: "command-relay-1", buildingId: "command_relay", position: { x: 440, y: 360 }, level: 1, health: content.buildings.command_relay.maxHealth }, { id: "matter-extractor-1", buildingId: "matter_extractor", position: { x: 280, y: 240 }, level: 1, health: content.buildings.matter_extractor.maxHealth }], reserves: {}, research: [], reports: [], settings: { muted: false, reducedMotion: false } };
}

export function placeColonyBuilding(state: ColonyState, buildingId: string, position: OrbitscarPosition, content: OrbitscarContent): ColonyState {
  const definition = content.buildings[buildingId]; if (!definition) throw new Error(`unknown building '${buildingId}'`); if (position.x < 0 || position.y < 0 || position.x + definition.footprint[0] * 40 > 1200 || position.y + definition.footprint[1] * 40 > 800) throw new Error("building is outside colony bounds"); if (state.buildings.some((building) => overlap(building, { id: "candidate", buildingId, position, level: 1, health: definition.maxHealth }, content))) throw new Error("building overlaps an existing structure"); if (!canAfford(state.resources, definition.cost)) throw new Error("insufficient resources"); const next = clone(state); spend(next.resources, definition.cost); next.buildings.push({ id: `${buildingId}-${next.buildings.length + 1}`, buildingId, position: { ...position }, level: 1, health: definition.maxHealth }); next.updatedAt = now(); return next;
}

export function upgradeColonyBuilding(state: ColonyState, buildingId: string, content: OrbitscarContent): ColonyState {
  const existing = state.buildings.find((building) => building.id === buildingId);
  if (!existing) throw new Error(`unknown colony building '${buildingId}'`);
  const definition = content.buildings[existing.buildingId];
  if (!definition) throw new Error(`unknown building '${existing.buildingId}'`);
  const cost: OrbitscarResourceBundle = Object.fromEntries(Object.entries(definition.cost).map(([resourceId, amount]) => [resourceId, Math.ceil(amount * (1 + existing.level * 0.5))]));
  if (!canAfford(state.resources, cost)) throw new Error("insufficient resources");
  const next = clone(state);
  spend(next.resources, cost);
  const upgraded = next.buildings.find((building) => building.id === buildingId);
  if (!upgraded) throw new Error(`unknown colony building '${buildingId}'`);
  upgraded.level += 1;
  upgraded.health = Math.ceil(definition.maxHealth * (1 + (upgraded.level - 1) * 0.25));
  next.updatedAt = now();
  return next;
}

export function advanceColony(state: ColonyState, ticks: number, content: OrbitscarContent): ColonyState {
  if (!Number.isInteger(ticks) || ticks < 0) throw new Error("ticks must be a non-negative integer"); const next = clone(state); const extractorCount = next.buildings.filter((building) => building.buildingId === "matter_extractor" && building.health > 0).length; const cycles = Math.floor(ticks / 30); next.resources.alloy = (next.resources.alloy ?? 0) + extractorCount * cycles * 3; next.resources.volatile = (next.resources.volatile ?? 0) + extractorCount * cycles; next.resources.signal = (next.resources.signal ?? 0) + extractorCount * cycles; next.updatedAt = now(); return next;
}

export function trainUnits(state: ColonyState, unitId: string, count: number, content: OrbitscarContent): ColonyState {
  const definition = content.units[unitId]; if (!definition) throw new Error(`unknown unit '${unitId}'`); if (!Number.isInteger(count) || count < 1) throw new Error("count must be a positive integer"); const cost: OrbitscarResourceBundle = {}; for (const [id, amount] of Object.entries(definition.cost)) cost[id] = amount * count; if (!canAfford(state.resources, cost)) throw new Error("insufficient resources"); const next = clone(state); spend(next.resources, cost); next.reserves[unitId] = (next.reserves[unitId] ?? 0) + count; next.updatedAt = now(); return next;
}

export function applyBattleResult(state: ColonyState, _input: OrbitscarBattleInput, result: OrbitscarBattleResult): ColonyState {
  if (state.reports.some((report) => report.result.outcomeHash === result.outcomeHash)) return clone(state);
  const deployed: Record<string, number> = {}; for (const usage of result.deploymentUsage) for (const entry of usage.units) deployed[entry.unitId] = (deployed[entry.unitId] ?? 0) + entry.count; for (const [unitId, count] of Object.entries(deployed)) if ((state.reserves[unitId] ?? 0) < count) throw new Error(`insufficient reserve for '${unitId}'`); const next = clone(state); for (const [unitId, count] of Object.entries(deployed)) { next.reserves[unitId] -= count; const survivors = Math.max(0, count - (result.attackerCasualties[unitId] ?? 0)); next.reserves[unitId] += survivors; } next.resources = sumBundle(next.resources, result.loot); next.reports.unshift({ id: `report-${next.reports.length + 1}`, createdAt: now(), result: clone(result) }); next.updatedAt = now(); return next;
}

export function serializeColony(state: ColonyState): string { const payload = clone(state); const save: ColonySave = { schemaVersion: COLONY_SCHEMA_VERSION, payload, checksum: authoritativeDigest(payload) }; return canonicalSerialize(save); }
export function parseColonySave(serialized: string): ColonyState { let parsed: unknown; try { parsed = JSON.parse(serialized); } catch { throw new Error("colony save is not valid JSON"); } if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("colony save must be an object"); const save = parsed as Partial<ColonySave>; if (save.payload === undefined || typeof save.checksum !== "string" || (save.schemaVersion !== 1 && save.schemaVersion !== COLONY_SCHEMA_VERSION)) throw new Error("unsupported colony save schema"); if (authoritativeDigest(save.payload) !== save.checksum) throw new Error("colony save checksum mismatch"); const payload = clone(save.payload); if (save.schemaVersion === 1) { payload.schemaVersion = COLONY_SCHEMA_VERSION; payload.settings = payload.settings ?? { muted: false, reducedMotion: false }; } return payload; }
