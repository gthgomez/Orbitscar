import type { OrbitscarBattleInput, OrbitscarBattleResult, OrbitscarPosition } from "./orbitscar.js";
import type { OrbitscarContent, OrbitscarResourceBundle } from "@orbitscar/content";
import { authoritativeDigest, canonicalSerialize } from "./hash.js";

export const COLONY_SCHEMA_VERSION = 7;
export const MAX_ECONOMY_CATCHUP_MS = 4 * 60 * 60 * 1000;
export const RESOURCE_CAPS: Readonly<Record<string, number>> = { alloy: 600, volatile: 300, signal: 240 };
export type ColonyBuilding = { id: string; buildingId: string; position: OrbitscarPosition; level: number; health: number };
export type ColonyReport = { id: string; attemptId: string; createdAt: string; kind: "attack" | "defense"; input?: OrbitscarBattleInput; result: OrbitscarBattleResult };
export const MAX_COLONY_REPORTS = 50;
export type ColonyState = { schemaVersion: number; playerId: string; createdAt: string; updatedAt: string; productionUpdatedAt: string; resources: Record<string, number>; buildings: ColonyBuilding[]; reserves: Record<string, number>; research: string[]; doctrineId: string; commanderId: string; scoutedTargets: string[]; completedObjectives: string[]; reports: ColonyReport[]; settings: { muted: boolean; reducedMotion: boolean } };
export type ColonySave = { schemaVersion: number; payload: ColonyState; checksum: string };

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function now(): string { return new Date().toISOString(); }
function sumBundle(left: Record<string, number>, right: OrbitscarResourceBundle): Record<string, number> { const result = { ...left }; for (const [id, amount] of Object.entries(right)) result[id] = (result[id] ?? 0) + amount; return result; }
function canAfford(resources: Record<string, number>, cost: OrbitscarResourceBundle): boolean { return Object.entries(cost).every(([id, amount]) => (resources[id] ?? 0) >= amount); }
function spend(resources: Record<string, number>, cost: OrbitscarResourceBundle): void { for (const [id, amount] of Object.entries(cost)) resources[id] = (resources[id] ?? 0) - amount; }
function overlap(a: ColonyBuilding, b: ColonyBuilding, content: OrbitscarContent): boolean { const af = content.buildings[a.buildingId].footprint; const bf = content.buildings[b.buildingId].footprint; return a.position.x < b.position.x + bf[0] * 40 && a.position.x + af[0] * 40 > b.position.x && a.position.y < b.position.y + bf[1] * 40 && a.position.y + af[1] * 40 > b.position.y; }

export function createColony(playerId: string, content: OrbitscarContent): ColonyState {
  const timestamp = now();
  return { schemaVersion: COLONY_SCHEMA_VERSION, playerId, createdAt: timestamp, updatedAt: timestamp, productionUpdatedAt: timestamp, resources: Object.fromEntries(Object.keys(content.resources).map((id) => [id, id === "alloy" ? 500 : id === "volatile" ? 220 : 140])), buildings: [{ id: "command-relay-1", buildingId: "command_relay", position: { x: 440, y: 360 }, level: 1, health: content.buildings.command_relay.maxHealth }, { id: "matter-extractor-1", buildingId: "matter_extractor", position: { x: 280, y: 240 }, level: 1, health: content.buildings.matter_extractor.maxHealth }], reserves: {}, research: [], doctrineId: "none", commanderId: "mara_voss", scoutedTargets: [], completedObjectives: [], reports: [], settings: { muted: false, reducedMotion: false } };
}

function markObjective(state: ColonyState, objectiveId: string): void { if (!state.completedObjectives.includes(objectiveId)) state.completedObjectives.push(objectiveId); }

export function commandTierOf(state: ColonyState): number {
  const relays = state.buildings.filter((building) => building.buildingId === "command_relay");
  const level = relays.reduce((highest, relay) => Number.isInteger(relay.level) ? Math.max(highest, relay.level) : highest, 1);
  return Math.min(3, Math.max(1, level));
}

export function recordColonyScout(state: ColonyState, targetId: string, content: OrbitscarContent): ColonyState {
  const target = content.encounters[targetId];
  if (!target) throw new Error(`unknown scout target '${targetId}'`);
  if (target.requiredTier > commandTierOf(state)) throw new Error(`scouting target requires Command Tier ${target.requiredTier}`);
  const next = clone(state);
  if (!next.scoutedTargets.includes(targetId)) {
    if ((next.resources.signal ?? 0) < 5) throw new Error("insufficient signal for scouting");
    next.resources.signal -= 5;
    next.scoutedTargets.push(targetId);
  }
  markObjective(next, "first-scout");
  next.updatedAt = now();
  return next;
}

export function selectColonyCommander(state: ColonyState, commanderId: string, content: OrbitscarContent): ColonyState {
  if (!content.commanders[commanderId]) throw new Error(`unknown commander '${commanderId}'`);
  const next = clone(state);
  next.commanderId = commanderId;
  next.updatedAt = now();
  return next;
}

export function researchDoctrine(state: ColonyState, doctrineId: string, content: OrbitscarContent): ColonyState {
  const doctrine = content.doctrines[doctrineId];
  if (!doctrine || doctrine.theme === "none") throw new Error(`unknown doctrine '${doctrineId}'`);
  if (commandTierOf(state) < doctrine.requiredTier) throw new Error(`doctrine research requires Command Tier ${doctrine.requiredTier}`);
  if (state.doctrineId !== "none") throw new Error("doctrine already committed; this choice is permanent");
  if (!canAfford(state.resources, doctrine.cost)) throw new Error("insufficient resources for doctrine research");
  const next = clone(state);
  spend(next.resources, doctrine.cost);
  next.research.push(doctrineId);
  next.doctrineId = doctrineId;
  markObjective(next, "first-doctrine");
  next.updatedAt = now();
  return next;
}

export function placeColonyBuilding(state: ColonyState, buildingId: string, position: OrbitscarPosition, content: OrbitscarContent, atMs = Date.now()): ColonyState {
  state = settleColonyProduction(state, atMs, content);
  const definition = content.buildings[buildingId]; if (buildingId === "command_relay" && state.buildings.some((building) => building.buildingId === "command_relay")) throw new Error("Command Relay is unique to this colony"); if (!definition) throw new Error(`unknown building '${buildingId}'`); if (definition.requiredTier > commandTierOf(state)) throw new Error(`building requires Command Tier ${definition.requiredTier}`); if (position.x < 0 || position.y < 0 || position.x + definition.footprint[0] * 40 > 1200 || position.y + definition.footprint[1] * 40 > 800) throw new Error("building is outside colony bounds"); if (state.buildings.some((building) => overlap(building, { id: "candidate", buildingId, position, level: 1, health: definition.maxHealth }, content))) throw new Error("building overlaps an existing structure"); if (!canAfford(state.resources, definition.cost)) throw new Error("insufficient resources"); const next = clone(state); spend(next.resources, definition.cost); next.buildings.push({ id: `${buildingId}-${next.buildings.length + 1}`, buildingId, position: { ...position }, level: 1, health: definition.maxHealth }); if (definition.defenseId) markObjective(next, "first-defense"); next.updatedAt = now(); return next;
}

export function upgradeColonyBuilding(state: ColonyState, buildingId: string, content: OrbitscarContent, atMs = Date.now()): ColonyState {
  state = settleColonyProduction(state, atMs, content);
  const existing = state.buildings.find((building) => building.id === buildingId);
  if (!existing) throw new Error(`unknown colony building '${buildingId}'`);
  const highestRelayLevel = state.buildings.filter((building) => building.buildingId === "command_relay").reduce((highest, relay) => Math.max(highest, relay.level), 1);
  if (existing.buildingId === "command_relay" && existing.level < highestRelayLevel) throw new Error("upgrade the highest-level Command Relay first");
  if (existing.buildingId === "command_relay" && existing.level === 1 && !state.completedObjectives.includes("starter-force")) throw new Error("train a starter force before upgrading Command Tier");
  const definition = content.buildings[existing.buildingId];
  if (existing.buildingId === "command_relay" && existing.level >= 3) throw new Error("Command Tier is already at maximum");
  if (!definition) throw new Error(`unknown building '${existing.buildingId}'`);
  const cost: OrbitscarResourceBundle = Object.fromEntries(Object.entries(definition.cost).map(([resourceId, amount]) => [resourceId, Math.ceil(amount * (1 + existing.level * 0.5))]));
  if (!canAfford(state.resources, cost)) throw new Error("insufficient resources");
  const next = clone(state);
  spend(next.resources, cost);
  const upgraded = next.buildings.find((building) => building.id === buildingId);
  if (!upgraded) throw new Error(`unknown colony building '${buildingId}'`);
  upgraded.level += 1;
  upgraded.health = Math.ceil(definition.maxHealth * (1 + (upgraded.level - 1) * 0.25));
  if (upgraded.buildingId === "command_relay" && upgraded.level >= 2) markObjective(next, "command-tier-2");
  next.updatedAt = now();
  return next;
}

function addProduction(state: ColonyState, minutes: number): ColonyState {
  const next = clone(state);
  const extractorPower = next.buildings
    .filter((building) => building.buildingId === "matter_extractor" && building.health > 0)
    .reduce((sum, building) => sum + 1 + (building.level - 1) * 0.5, 0);
  for (const [resourceId, ratePerMinute] of Object.entries({ alloy: 6, volatile: 2, signal: 2 })) {
    const cap = RESOURCE_CAPS[resourceId] ?? Number.MAX_SAFE_INTEGER;
    next.resources[resourceId] = Math.min(cap, (next.resources[resourceId] ?? 0) + Math.floor(extractorPower * ratePerMinute * minutes));
  }
  next.updatedAt = now();
  return next;
}

/** Deterministic game-time production used by simulations and fixtures. */
export function advanceColony(state: ColonyState, ticks: number, _content: OrbitscarContent): ColonyState {
  if (!Number.isInteger(ticks) || ticks < 0) throw new Error("ticks must be a non-negative integer");
  return addProduction(state, Math.floor(ticks / 30));
}

/** Settle old production rates before a building level, footprint, or health change. */
export function settleColonyProduction(state: ColonyState, atMs: number, content: OrbitscarContent): ColonyState {
  const next = collectColonyProduction(state, atMs, content);
  next.productionUpdatedAt = new Date(atMs).toISOString();
  next.updatedAt = new Date(atMs).toISOString();
  return next;
}

/** Collect production accrued since the last collection; no click can mint time or exceed storage. */
export function collectColonyProduction(state: ColonyState, atMs: number, _content: OrbitscarContent): ColonyState {
  if (!Number.isFinite(atMs) || atMs < 0) throw new Error("collection clock must be a valid timestamp");
  const previous = Date.parse(state.productionUpdatedAt);
  if (!Number.isFinite(previous) || atMs < previous) throw new Error("collection clock cannot move backwards");
  const elapsedMs = atMs - previous;
  const boundedMs = Math.min(elapsedMs, MAX_ECONOMY_CATCHUP_MS);
  const minutes = Math.floor(boundedMs / 60_000);
  const next = addProduction(state, minutes);
  if (elapsedMs >= MAX_ECONOMY_CATCHUP_MS) next.productionUpdatedAt = new Date(atMs).toISOString();
  else next.productionUpdatedAt = new Date(previous + minutes * 60_000).toISOString();
  return next;
}

export function trainUnits(state: ColonyState, unitId: string, count: number, content: OrbitscarContent): ColonyState {
  const definition = content.units[unitId]; if (!definition) throw new Error(`unknown unit '${unitId}'`); if (definition.requiredTier > commandTierOf(state)) throw new Error(`unit requires Command Tier ${definition.requiredTier}`); if (!Number.isInteger(count) || count < 1) throw new Error("count must be a positive integer"); const multiplier = content.doctrines[state.doctrineId]?.trainingCostMultiplier ?? 1; const cost: OrbitscarResourceBundle = {}; for (const [id, amount] of Object.entries(definition.cost)) cost[id] = Math.ceil(amount * count * multiplier); if (!canAfford(state.resources, cost)) throw new Error("insufficient resources"); const next = clone(state); spend(next.resources, cost); next.reserves[unitId] = (next.reserves[unitId] ?? 0) + count; if (Object.values(next.reserves).reduce((sum, reserve) => sum + reserve, 0) >= 3) markObjective(next, "starter-force"); next.updatedAt = now(); return next;
}

export function applyBattleResult(state: ColonyState, input: OrbitscarBattleInput, result: OrbitscarBattleResult, attemptId: string): ColonyState {
  if (attemptId.trim().length === 0) throw new Error("attemptId must be a non-empty string");
  if (state.reports.some((report) => report.attemptId === attemptId)) return clone(state);
  state = settleColonyProduction(state, Date.now(), input.content);
  const deployed: Record<string, number> = {};
  for (const usage of result.deploymentUsage) {
    for (const entry of usage.units) deployed[entry.unitId] = (deployed[entry.unitId] ?? 0) + entry.count;
  }
  for (const [unitId, count] of Object.entries(deployed)) {
    const casualties = result.attackerCasualties[unitId] ?? 0;
    const survivors = result.survivingUnits[unitId];
    const armyCount = input.army.find((entry) => entry.unitId === unitId)?.count ?? count;
    if (!Number.isInteger(count) || count < 0 || (state.reserves[unitId] ?? 0) < count) throw new Error(`insufficient reserve for '${unitId}'`);
    if (!Number.isInteger(casualties) || casualties < 0 || casualties > count) throw new Error(`invalid casualties for '${unitId}'`);
    if (!Number.isInteger(armyCount) || armyCount < count) throw new Error(`army reconciliation failed for '${unitId}'`);
    if (survivors !== undefined && (!Number.isInteger(survivors) || survivors < 0 || survivors > armyCount || survivors !== armyCount - casualties)) throw new Error(`survivor reconciliation failed for '${unitId}'`);
  }
  const next = clone(state);
  for (const [unitId, count] of Object.entries(deployed)) {
    next.reserves[unitId] -= count;
    next.reserves[unitId] += count - (result.attackerCasualties[unitId] ?? 0);
  }
  if (Object.keys(deployed).length > 0) markObjective(next, "first-sortie");
  next.resources = sumBundle(next.resources, result.loot);
  for (const [resourceId, cap] of Object.entries(RESOURCE_CAPS)) next.resources[resourceId] = Math.min(cap, next.resources[resourceId] ?? 0);
  next.reports.unshift({ id: attemptId, attemptId, createdAt: now(), kind: "attack", input: clone(input), result: clone(result) });
  next.reports = next.reports.slice(0, MAX_COLONY_REPORTS);
  next.updatedAt = now();
  return next;
}

export function applyColonyDefenseResult(state: ColonyState, input: OrbitscarBattleInput, result: OrbitscarBattleResult, attemptId: string, atMs = Date.now()): ColonyState {
  if (attemptId.trim().length === 0) throw new Error("attemptId must be a non-empty string");
  if (state.reports.some((report) => report.attemptId === attemptId)) return clone(state);
  state = settleColonyProduction(state, atMs, input.content);
  const next = clone(state);
  const defenseHealthMultiplier = input.content.doctrines[input.defenderDoctrineId ?? "none"]?.defenseHealthMultiplier ?? 1;
  next.buildings = next.buildings.map((building) => ({ ...building, health: Math.max(0, building.health - (result.damageByEntity[building.id] ?? 0) / defenseHealthMultiplier) }));
  next.reports.unshift({ id: attemptId, attemptId, createdAt: now(), kind: "defense", input: clone(input), result: clone(result) });
  next.reports = next.reports.slice(0, MAX_COLONY_REPORTS);
  next.updatedAt = now();
  return next;
}

export function repairColonyBuilding(state: ColonyState, buildingId: string, content: OrbitscarContent, atMs = Date.now()): ColonyState {
  state = settleColonyProduction(state, atMs, content);
  const building = state.buildings.find((entry) => entry.id === buildingId);
  if (!building) throw new Error(`unknown colony building '${buildingId}'`);
  const definition = content.buildings[building.buildingId];
  if (!definition) throw new Error(`unknown building '${building.buildingId}'`);
  const maxHealth = definition.maxHealth * (1 + (building.level - 1) * 0.25);
  if (building.health >= maxHealth) throw new Error("building does not need repair");
  const missingRatio = (maxHealth - building.health) / maxHealth;
  const cost = Object.fromEntries(Object.entries(definition.cost).map(([resourceId, amount]) => [resourceId, Math.ceil(amount * missingRatio * 0.35)]));
  if (!canAfford(state.resources, cost)) throw new Error("insufficient resources");
  const next = clone(state);
  spend(next.resources, cost);
  const repaired = next.buildings.find((entry) => entry.id === buildingId)!;
  repaired.health = maxHealth;
  next.updatedAt = now();
  return next;
}

export function serializeColony(state: ColonyState): string { const payload = clone(state); const save: ColonySave = { schemaVersion: COLONY_SCHEMA_VERSION, payload, checksum: authoritativeDigest(payload) }; return canonicalSerialize(save); }
export function parseColonySave(serialized: string): ColonyState {
  let parsed: unknown;
  try { parsed = JSON.parse(serialized); } catch { throw new Error("colony save is not valid JSON"); }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("colony save must be an object");
  const save = parsed as Partial<ColonySave>;
  if (save.payload === undefined || typeof save.checksum !== "string" || ![1, 2, 3, 4, 5, 6, COLONY_SCHEMA_VERSION].includes(save.schemaVersion ?? -1)) throw new Error("unsupported colony save schema");
  if (authoritativeDigest(save.payload) !== save.checksum) throw new Error("colony save checksum mismatch");
  const payload = clone(save.payload);
  if (!Array.isArray(payload.buildings)) throw new Error("colony save contains malformed buildings");
  // Older saves allowed duplicate Command Relays. Keep the strongest relay (first on ties)
  // so legacy colonies retain their tier without preserving duplicate command structures.
  if ((save.schemaVersion ?? 0) < COLONY_SCHEMA_VERSION) {
    const relays = payload.buildings.filter((building) => building.buildingId === "command_relay");
    if (relays.length > 1) {
      const keep = relays.reduce((best, relay) => relay.level > best.level ? relay : best);
      let kept = false;
      payload.buildings = payload.buildings.filter((building) => {
        if (building.buildingId !== "command_relay") return true;
        if (!kept && building.id === keep.id) { kept = true; return true; }
        return false;
      });
    }
  }
  payload.schemaVersion = COLONY_SCHEMA_VERSION;
  payload.commanderId = payload.commanderId ?? "mara_voss";
  payload.doctrineId = payload.doctrineId ?? "none";
  payload.scoutedTargets = payload.scoutedTargets ?? [];
  payload.completedObjectives = payload.completedObjectives ?? [];
  payload.settings = payload.settings ?? { muted: false, reducedMotion: false };
  payload.productionUpdatedAt = payload.productionUpdatedAt ?? payload.updatedAt ?? payload.createdAt;
  payload.reports = (payload.reports ?? []).map((report, index) => ({ ...report, kind: report.kind ?? "attack", attemptId: report.attemptId ?? report.id ?? `legacy-attempt-${index + 1}` }));
  return payload;
}
