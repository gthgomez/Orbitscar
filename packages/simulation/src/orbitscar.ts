import type { OrbitscarContent, OrbitscarTargetPriority, OrbitscarTargetTag } from "@orbitscar/content";
import { authoritativeDigest, canonicalSerialize, fastStateHash } from "./hash.js";

export const CANONICAL_FORMAT_VERSION = 2;
export type OrbitscarPosition = { x: number; y: number };
export type OrbitscarArena = { width: number; height: number };
export type OrbitscarArmyEntry = { unitId: string; count: number };
export type OrbitscarStructurePlacement = { id: string; buildingId: string; position: OrbitscarPosition; level?: number; currentHealth?: number };
export type OrbitscarDeploymentZone = "north" | "south" | "west" | "east";
export type OrbitscarDeployPayload = { zone: OrbitscarDeploymentZone; position: OrbitscarPosition; units: OrbitscarArmyEntry[] };
export type OrbitscarAbilityPayload = { abilityId: string; targetStructureId?: string };
export type OrbitscarCommand =
  | { commandId: string; sequence: number; tick: number; type: "DEPLOY"; payload: OrbitscarDeployPayload }
  | { commandId: string; sequence: number; tick: number; type: "COMMANDER_ABILITY"; payload: OrbitscarAbilityPayload }
  | { commandId: string; sequence: number; tick: number; type: "RETREAT"; payload: Record<string, never> };
export type OrbitscarBattleInput = { canonicalFormatVersion: number; rulesetVersion: string; seed: number; maxDurationTicks: number; arena: OrbitscarArena; deploymentCapacity: number; maxDeploymentCharges: number; commanderId: string; attackerDoctrineId?: string; defenderDoctrineId?: string; army: OrbitscarArmyEntry[]; structures: OrbitscarStructurePlacement[]; commands: OrbitscarCommand[]; rewardPreview: Record<string, number>; content: OrbitscarContent };
export type OrbitscarBattleEvent = { sequence: number; tick: number; type: "battle_started" | "deployed" | "ability" | "unit_moved" | "unit_attacked" | "unit_damaged" | "unit_destroyed" | "defense_aimed" | "defense_lock_lost" | "defense_fired" | "defense_damaged" | "defense_destroyed" | "battle_ended"; entityId?: string; targetId?: string; value?: number; remainingHealth?: number; position?: OrbitscarPosition };
export type OrbitscarDeploymentUsage = { commandId: string; tick: number; capacityUsed: number; units: OrbitscarArmyEntry[] };
export type OrbitscarBattleResult = { canonicalFormatVersion: number; rulesetVersion: string; seed: number; winner: "attacker" | "defender" | "draw"; victoryTier: "full" | "partial" | "defeat"; retreated: boolean; durationTicks: number; attackerCasualties: Record<string, number>; survivingUnits: Record<string, number>; destroyedStructureIds: string[]; loot: Record<string, number>; damageByEntity: Record<string, number>; deploymentUsage: OrbitscarDeploymentUsage[]; commanderUse: { commanderId: string; abilityId: string; count: number }; eventCount: number; events: OrbitscarBattleEvent[]; baseSnapshotHash: string; armySnapshotHash: string; canonicalHash: string; outcomeHash: string };
export type OrbitscarValidation = { ok: boolean; errors: string[] };

const MAX_BATTLE_UNITS = 100;

type BattleUnit = { id: string; unitId: string; tags: OrbitscarTargetTag[]; counters: string[]; targetPriority: OrbitscarTargetPriority[]; maxHealth: number; health: number; power: number; bonusDamageVsDefenses: number; range: number; speed: number; cadence: number; position: OrbitscarPosition; nextAttackTick: number; status: "reserve" | "active" | "destroyed" | "retreated"; forcedTargetId?: string; route?: { targetId: string; topologyVersion: number; waypoints: OrbitscarPosition[]; index: number }; boostedUntil: number; overchargedUntil: number };
type BattleStructure = { id: string; buildingId: string; defenseId?: string; tags: OrbitscarTargetTag[]; health: number; maxHealth: number; position: OrbitscarPosition; weapon?: { range: number; damage: number; cadence: number; splashRadius: number; splashDamageMultiplier: number; targetPriority: OrbitscarTargetPriority[]; nextAttackTick: number; lockedTargetId?: string } };

const COUNTER_DAMAGE_MULTIPLIER = 1.4;

function stableCompare(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }
function isInteger(value: unknown): value is number { return typeof value === "number" && Number.isInteger(value); }
function duplicate(values: string[]): boolean { return new Set(values).size !== values.length; }
function validPosition(position: unknown, arena: OrbitscarArena): position is OrbitscarPosition {
  if (typeof position !== "object" || position === null || Array.isArray(position)) return false;
  const candidate = position as { x?: unknown; y?: unknown };
  return typeof candidate.x === "number" && Number.isFinite(candidate.x) && typeof candidate.y === "number" && Number.isFinite(candidate.y) && candidate.x >= 0 && candidate.y >= 0 && candidate.x <= arena.width && candidate.y <= arena.height;
}
function commandCompare(a: OrbitscarCommand, b: OrbitscarCommand): number { return a.tick - b.tick || a.sequence - b.sequence || stableCompare(a.commandId, b.commandId); }
function sortedArmy(army: OrbitscarArmyEntry[]): OrbitscarArmyEntry[] { return [...army].map((entry) => ({ ...entry })).sort((a, b) => stableCompare(a.unitId, b.unitId)); }
function sortedStructures(structures: OrbitscarStructurePlacement[]): OrbitscarStructurePlacement[] { return [...structures].map((structure) => ({ ...structure, position: { ...structure.position } })).sort((a, b) => stableCompare(a.id, b.id)); }
function canonicalCommand(command: OrbitscarCommand): OrbitscarCommand {
  if (command.type === "DEPLOY") return { ...command, payload: { ...command.payload, position: { ...command.payload.position }, units: sortedArmy(command.payload.units) } };
  if (command.type === "COMMANDER_ABILITY") return { ...command, payload: { ...command.payload } };
  return { ...command, payload: {} };
}
export function canonicalizeOrbitscarInput(input: OrbitscarBattleInput): OrbitscarBattleInput { return { ...input, attackerDoctrineId: input.attackerDoctrineId ?? "none", defenderDoctrineId: input.defenderDoctrineId ?? "none", arena: { ...input.arena }, army: sortedArmy(input.army), structures: sortedStructures(input.structures), commands: input.commands.map(canonicalCommand).sort(commandCompare) }; }
export function canonicalReplayPayload(input: OrbitscarBattleInput): unknown { const canonical = canonicalizeOrbitscarInput(input); return { canonicalFormatVersion: canonical.canonicalFormatVersion, rulesetVersion: canonical.rulesetVersion, contentDigest: authoritativeDigest(canonical.content), seed: canonical.seed, maxDurationTicks: canonical.maxDurationTicks, arena: canonical.arena, deploymentCapacity: canonical.deploymentCapacity, maxDeploymentCharges: canonical.maxDeploymentCharges, commanderId: canonical.commanderId, attackerDoctrineId: canonical.attackerDoctrineId, defenderDoctrineId: canonical.defenderDoctrineId, army: canonical.army, structures: canonical.structures, commands: canonical.commands, rewardPreview: canonical.rewardPreview }; }
export function hashOrbitscarCanonicalInput(input: OrbitscarBattleInput): string { return authoritativeDigest(canonicalReplayPayload(input)); }
function distanceSquared(a: OrbitscarPosition, b: OrbitscarPosition): number { const x = a.x - b.x; const y = a.y - b.y; return x * x + y * y; }
function priorityMatches(priority: OrbitscarTargetPriority, tags: readonly string[]): boolean { return priority.selector === "any" || priority.tag === undefined || tags.includes(priority.tag); }
function chooseStructure(unit: BattleUnit, structures: BattleStructure[]): BattleStructure | undefined {
  const alive = structures.filter((structure) => structure.health > 0);
  for (const priority of unit.targetPriority) {
    const candidates = alive.filter((structure) => priorityMatches(priority, structure.tags));
    if (candidates.length > 0) {
      return [...candidates].sort((a, b) => {
        if (priority.selector === "lowest_health") return a.health - b.health || distanceSquared(unit.position, a.position) - distanceSquared(unit.position, b.position) || stableCompare(a.id, b.id);
        return distanceSquared(unit.position, a.position) - distanceSquared(unit.position, b.position) || stableCompare(a.id, b.id);
      })[0];
    }
  }
  return [...alive].sort((a, b) => distanceSquared(unit.position, a.position) - distanceSquared(unit.position, b.position) || stableCompare(a.id, b.id))[0];
}
function chooseUnit(structure: BattleStructure, units: BattleUnit[]): BattleUnit | undefined {
  const alive = units.filter((unit) => unit.status === "active" && unit.health > 0);
  if (!structure.weapon) return undefined;
  for (const priority of structure.weapon.targetPriority) { const candidates = alive.filter((unit) => priorityMatches(priority, unit.tags)); if (candidates.length > 0) return [...candidates].sort((a, b) => distanceSquared(structure.position, a.position) - distanceSquared(structure.position, b.position) || stableCompare(a.id, b.id))[0]; }
  return [...alive].sort((a, b) => distanceSquared(structure.position, a.position) - distanceSquared(structure.position, b.position) || stableCompare(a.id, b.id))[0];
}
function moveToward(current: OrbitscarPosition, target: OrbitscarPosition, speed: number): OrbitscarPosition { const dx = target.x - current.x; const dy = target.y - current.y; if (Math.abs(dx) >= Math.abs(dy)) return { x: current.x + Math.sign(dx) * Math.min(Math.abs(dx), speed), y: current.y }; return { x: current.x, y: current.y + Math.sign(dy) * Math.min(Math.abs(dy), speed) }; }
const NAV_TILE = 40;
type NavCell = { x: number; y: number };
function cellKey(cell: NavCell): string { return `${cell.x},${cell.y}`; }
function structureRect(structure: BattleStructure, content: OrbitscarContent): { left: number; top: number; right: number; bottom: number } {
  const footprint = content.buildings[structure.buildingId].footprint;
  return { left: structure.position.x, top: structure.position.y, right: structure.position.x + footprint[0] * NAV_TILE, bottom: structure.position.y + footprint[1] * NAV_TILE };
}
function pointToRectDistanceSquared(point: OrbitscarPosition, rect: { left: number; top: number; right: number; bottom: number }): number {
  const dx = Math.max(rect.left - point.x, 0, point.x - rect.right);
  const dy = Math.max(rect.top - point.y, 0, point.y - rect.bottom);
  return dx * dx + dy * dy;
}
function routePath(unit: BattleUnit, target: BattleStructure, structures: BattleStructure[], arena: OrbitscarArena, content: OrbitscarContent): OrbitscarPosition[] {
  const columns = Math.ceil(arena.width / NAV_TILE); const rows = Math.ceil(arena.height / NAV_TILE);
  const rects = structures.filter((structure) => structure.health > 0 && structure.id !== target.id).map((structure) => structureRect(structure, content));
  const blocked = (cell: NavCell): boolean => {
    const left = cell.x * NAV_TILE; const top = cell.y * NAV_TILE; const right = Math.min(arena.width, left + NAV_TILE); const bottom = Math.min(arena.height, top + NAV_TILE);
    return rects.some((rect) => left < rect.right && right > rect.left && top < rect.bottom && bottom > rect.top);
  };
  const start = { x: Math.min(columns - 1, Math.max(0, Math.floor(unit.position.x / NAV_TILE))), y: Math.min(rows - 1, Math.max(0, Math.floor(unit.position.y / NAV_TILE))) };
  const queue: NavCell[] = [start]; const previous = new Map<string, string | null>([[cellKey(start), null]]); let goal: NavCell | undefined;
  const targetRect = structureRect(target, content); const attackRangeSquared = unit.range * unit.range;
  const neighbors = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }];
  for (let index = 0; index < queue.length; index += 1) {
    const cell = queue[index]; const center = { x: Math.min(arena.width, cell.x * NAV_TILE + NAV_TILE / 2), y: Math.min(arena.height, cell.y * NAV_TILE + NAV_TILE / 2) };
    if (pointToRectDistanceSquared(center, targetRect) <= attackRangeSquared) { goal = cell; break; }
    for (const delta of neighbors) {
      const next = { x: cell.x + delta.x, y: cell.y + delta.y }; const key = cellKey(next);
      if (next.x < 0 || next.y < 0 || next.x >= columns || next.y >= rows || previous.has(key) || (blocked(next) && cellKey(next) !== cellKey(start))) continue;
      previous.set(key, cellKey(cell)); queue.push(next);
    }
  }
  if (!goal || cellKey(goal) === cellKey(start)) return [];
  const reversed: NavCell[] = []; let key: string | null | undefined = cellKey(goal);
  while (key !== null && key !== undefined && key !== cellKey(start)) { const [x, y] = key.split(",").map(Number); reversed.push({ x, y }); key = previous.get(key); }
  return reversed.reverse().map((cell) => ({ x: Math.min(arena.width, cell.x * NAV_TILE + NAV_TILE / 2), y: Math.min(arena.height, cell.y * NAV_TILE + NAV_TILE / 2) }));
}
function deploymentZoneContains(zone: OrbitscarDeploymentZone, position: OrbitscarPosition, arena: OrbitscarArena): boolean {
  if (zone === "west") return position.x < arena.width / 3;
  if (zone === "east") return position.x >= arena.width * 2 / 3;
  if (zone === "north") return position.y < arena.height / 3;
  if (zone === "south") return position.y >= arena.height * 2 / 3;
  return false;
}
function deploymentSpawnPosition(position: OrbitscarPosition, index: number, arena: OrbitscarArena): OrbitscarPosition {
  return { x: Math.max(0, Math.min(arena.width, position.x + (index % 3) * 12)), y: Math.max(0, Math.min(arena.height, position.y + Math.floor(index / 3) * 12)) };
}
function nextRandom(seed: number): { seed: number; value: number } { const next = (seed + 0x6d2b79f5) >>> 0; let value = next; value = Math.imul(value ^ (value >>> 15), value | 1); value ^= value + Math.imul(value ^ (value >>> 7), value | 61); return { seed: next, value: ((value ^ (value >>> 14)) >>> 0) / 4294967296 }; }
function addDamage(damageByEntity: Record<string, number>, id: string, damage: number): void { damageByEntity[id] = (damageByEntity[id] ?? 0) + damage; }

export function validateOrbitscarInput(input: OrbitscarBattleInput): OrbitscarValidation {
  const errors: string[] = []; const content = input.content; const structureIds = input.structures.map((entry) => entry.id); const commandIds = input.commands.map((command) => command.commandId); const sequences = input.commands.map((command) => command.sequence); const deployCommands = input.commands.filter((command) => command.type === "DEPLOY"); const abilityCommands = input.commands.filter((command) => command.type === "COMMANDER_ABILITY");
  if (input.canonicalFormatVersion !== CANONICAL_FORMAT_VERSION) errors.push(`canonicalFormatVersion must be ${CANONICAL_FORMAT_VERSION}`);
  if (!input.rulesetVersion || input.rulesetVersion !== content.rulesetVersion) errors.push("rulesetVersion must match loaded content");
  if (!isInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff) errors.push("seed must be an unsigned integer");
  if (!isInteger(input.maxDurationTicks) || input.maxDurationTicks <= 0) errors.push("maxDurationTicks must be a positive integer");
  if (!isInteger(input.deploymentCapacity) || input.deploymentCapacity < 0) errors.push("deploymentCapacity must be a non-negative integer");
  if (!isInteger(input.maxDeploymentCharges) || input.maxDeploymentCharges < 0) errors.push("maxDeploymentCharges must be a non-negative integer");
  if (!Number.isFinite(input.arena.width) || !Number.isFinite(input.arena.height) || input.arena.width <= 0 || input.arena.height <= 0) errors.push("arena dimensions must be positive finite numbers");
  if (!content.commanders[input.commanderId]) errors.push("unknown commander"); if (!content.doctrines[input.attackerDoctrineId ?? "none"]) errors.push("unknown attacker doctrine"); if (!content.doctrines[input.defenderDoctrineId ?? "none"]) errors.push("unknown defender doctrine");
  for (const [resourceId, amount] of Object.entries(input.rewardPreview)) if (!Number.isFinite(amount) || amount < 0) errors.push(`rewardPreview.${resourceId} must be a non-negative finite number`);
  if (duplicate(input.army.map((entry) => entry.unitId))) errors.push("army contains duplicate unit IDs"); if (duplicate(structureIds)) errors.push("structures contain duplicate IDs"); if (duplicate(commandIds)) errors.push("commands contain duplicate command IDs"); if (new Set(sequences).size !== sequences.length) errors.push("command sequence numbers must be globally unique");
  if (input.commands.some((command) => !isInteger(command.sequence) || command.sequence < 0)) errors.push("command sequence must be a non-negative integer"); if (input.commands.some((command) => !isInteger(command.tick) || command.tick < 0 || command.tick > input.maxDurationTicks)) errors.push("command tick is outside the battle window"); if (deployCommands.length > input.maxDeploymentCharges) errors.push("deployment charge limit exceeded"); if (abilityCommands.length > (content.commanders[input.commanderId]?.charges ?? 0)) errors.push("commander ability charge limit exceeded");
  for (const entry of input.army) { if (!content.units[entry.unitId]) errors.push(`army references unknown unit '${entry.unitId}'`); if (!isInteger(entry.count) || entry.count < 0) errors.push(`army count for '${entry.unitId}' must be a non-negative integer`); }
  if (input.army.reduce((total, entry) => total + (isInteger(entry.count) && entry.count > 0 ? entry.count : 0), 0) > MAX_BATTLE_UNITS) errors.push(`army exceeds ${MAX_BATTLE_UNITS} unit simulation limit`);
  for (const structure of input.structures) { const building = content.buildings[structure.buildingId]; if (!building) errors.push(`structure '${structure.id}' references unknown building '${structure.buildingId}'`); if (!validPosition(structure.position, input.arena)) errors.push(`structure '${structure.id}' has an invalid position`); if (structure.level !== undefined && (!isInteger(structure.level) || structure.level < 1 || structure.level > 20)) errors.push(`structure '${structure.id}' has invalid level`); const structureMaxHealth = building === undefined ? 0 : building.maxHealth * (1 + ((structure.level ?? 1) - 1) * 0.25); if (structure.currentHealth !== undefined && (!Number.isFinite(structure.currentHealth) || structure.currentHealth < 0 || structure.currentHealth > structureMaxHealth)) errors.push(`structure '${structure.id}' has invalid currentHealth`); }
  const reserves = new Map(input.army.map((entry) => [entry.unitId, entry.count]));
  for (const command of input.commands) {
    if (command.type === "DEPLOY") {
      const { payload } = command;
      if (!validPosition(payload.position, input.arena)) errors.push(`deployment '${command.commandId}' has an invalid position`);
      if (!deploymentZoneContains(payload.zone, payload.position, input.arena)) errors.push(`deployment '${command.commandId}' position is outside the ${payload.zone} approach zone`);
      if (duplicate(payload.units.map((entry) => entry.unitId))) errors.push(`deployment '${command.commandId}' contains duplicate unit IDs`);
      let capacity = 0; let spawnIndex = 0; let intersects = false; let outsideZone = false;
      for (const entry of payload.units) {
        const definition = content.units[entry.unitId];
        if (!definition) { errors.push(`deployment '${command.commandId}' references unknown unit '${entry.unitId}'`); continue; }
        if (!isInteger(entry.count) || entry.count <= 0) errors.push(`deployment '${command.commandId}' count for '${entry.unitId}' must be a positive integer`);
        const remaining = reserves.get(entry.unitId) ?? 0;
        if (isInteger(entry.count) && entry.count > remaining) errors.push(`deployment '${command.commandId}' reuses more '${entry.unitId}' than remains in reserve`);
        if (!isInteger(entry.count) || entry.count <= 0) continue;
        capacity += entry.count * definition.capacity;
        reserves.set(entry.unitId, remaining - entry.count);
        for (let index = 0; index < entry.count && spawnIndex < MAX_BATTLE_UNITS && !intersects && !outsideZone; index += 1, spawnIndex += 1) {
          const spawn = deploymentSpawnPosition(payload.position, spawnIndex, input.arena);
          if (!deploymentZoneContains(payload.zone, spawn, input.arena)) {
            errors.push(`deployment '${command.commandId}' squad extends outside the ${payload.zone} approach zone`);
            outsideZone = true;
            break;
          }
          const occupied = input.structures.find((structure) => {
            const footprint = content.buildings[structure.buildingId]?.footprint;
            return footprint !== undefined && spawn.x >= structure.position.x && spawn.x < structure.position.x + footprint[0] * NAV_TILE && spawn.y >= structure.position.y && spawn.y < structure.position.y + footprint[1] * NAV_TILE;
          });
          if (occupied) {
            errors.push(`deployment '${command.commandId}' intersects structure '${occupied.id}'`);
            intersects = true;
          }
        }
      }
      if (capacity > input.deploymentCapacity) errors.push(`deployment '${command.commandId}' exceeds deployment capacity`);
    } else if (command.type === "COMMANDER_ABILITY") { const commander = content.commanders[input.commanderId]; if (!commander || commander.abilityId !== command.payload.abilityId || !content.abilities[command.payload.abilityId]) errors.push(`command '${command.commandId}' references an invalid commander ability`); if (command.payload.targetStructureId !== undefined && !structureIds.includes(command.payload.targetStructureId)) errors.push(`command '${command.commandId}' references an unknown structure target`); }
  }
  return { ok: errors.length === 0, errors };
}

/** Append one deterministic live command after the simulation has advanced to currentTick. */
export function appendOrbitscarCommand(input: OrbitscarBattleInput, command: OrbitscarCommand, currentTick: number): OrbitscarBattleInput {
  if (!isInteger(currentTick) || currentTick < 0 || currentTick >= input.maxDurationTicks) throw new Error("current tick is outside the active battle window");
  const existingValidation = validateOrbitscarInput(input);
  if (!existingValidation.ok) throw new Error(`INVALID_BATTLE_INPUT: ${existingValidation.errors.join(", ")}`);
  const canonical = canonicalizeOrbitscarInput(input);
  const last = canonical.commands.at(-1);
  if (command.tick <= currentTick || (last !== undefined && command.tick <= last.tick)) throw new Error("stale or out-of-order battle command tick");
  if (command.tick > currentTick + 30) throw new Error("battle command is too far ahead of the live tick");
  const nextSequence = Math.max(0, ...canonical.commands.map((entry) => entry.sequence)) + 1;
  if (command.sequence !== nextSequence) throw new Error(`battle command sequence must be ${nextSequence}`);
  if (canonical.commands.some((entry) => entry.commandId === command.commandId)) throw new Error("battle command ID must be unique");
  const next = { ...canonical, commands: [...canonical.commands, canonicalCommand(command)] };
  const validation = validateOrbitscarInput(next);
  if (!validation.ok) throw new Error(`INVALID_BATTLE_COMMAND: ${validation.errors.join(", ")}`);
  return next;
}

export function calculateOrbitscarReward(input: Pick<OrbitscarBattleInput, "rewardPreview" | "structures" | "content">, destroyedStructureIds: readonly string[]): Record<string, number> {
  const destroyed = new Set(destroyedStructureIds);
  const rewardStructures = input.structures.filter((structure) => {
    const building = input.content.buildings[structure.buildingId];
    return building?.targetTags.includes("resource") || building?.targetTags.includes("economy");
  });
  if (rewardStructures.length === 0) return {};
  const multiplier = Math.min(1, rewardStructures.filter((structure) => destroyed.has(structure.id)).length / rewardStructures.length);
  return Object.fromEntries(Object.entries(input.rewardPreview).map(([resourceId, amount]) => [resourceId, Math.floor(amount * multiplier)]).filter(([, amount]) => typeof amount === "number" && amount > 0));
}

function instantiateUnit(definition: OrbitscarContent["units"][string], id: string, doctrine: OrbitscarContent["doctrines"][string]): BattleUnit { return { id, unitId: definition.id, tags: [...definition.targetTags], counters: [...definition.counters], targetPriority: [...definition.targetPriority], maxHealth: definition.health, health: definition.health, power: definition.power * doctrine.unitDamageMultiplier, bonusDamageVsDefenses: doctrine.bonusDamageVsDefenses, range: definition.range, speed: definition.speed, cadence: definition.cadence, position: { x: 0, y: 0 }, nextAttackTick: 0, status: "reserve", boostedUntil: 0, overchargedUntil: 0 }; }

export function resolveOrbitscarBattle(input: OrbitscarBattleInput): OrbitscarBattleResult {
  const validation = validateOrbitscarInput(input); if (!validation.ok) throw new Error(`INVALID_BATTLE_INPUT: ${validation.errors.join(", ")}`);
  const canonical = canonicalizeOrbitscarInput(input); const content = canonical.content;
  const attackerDoctrine = content.doctrines[canonical.attackerDoctrineId ?? "none"]; const defenderDoctrine = content.doctrines[canonical.defenderDoctrineId ?? "none"]; const structures: BattleStructure[] = canonical.structures.map((placement) => { const building = content.buildings[placement.buildingId]; if (!building) throw new Error(`INVALID_BATTLE_INPUT: unknown building '${placement.buildingId}'`); const level = placement.level ?? 1; const levelScale = 1 + (level - 1) * 0.25; const baseHealth = building.maxHealth * levelScale; const weaponDefinition = building.defenseId === undefined ? undefined : content.defenses[building.defenseId]; const maxHealth = baseHealth * defenderDoctrine.defenseHealthMultiplier; const healthRatio = placement.currentHealth === undefined ? 1 : Math.min(1, placement.currentHealth / baseHealth); return { id: placement.id, buildingId: placement.buildingId, ...(building.defenseId === undefined ? {} : { defenseId: building.defenseId }), tags: [...building.targetTags], maxHealth, health: maxHealth * healthRatio, position: { ...placement.position }, weapon: weaponDefinition === undefined ? undefined : { ...weaponDefinition, damage: weaponDefinition.damage * (1 + (level - 1) * 0.15) * defenderDoctrine.defenseDamageMultiplier, range: weaponDefinition.range * (1 + (level - 1) * 0.05), targetPriority: [...weaponDefinition.targetPriority], nextAttackTick: 0 } }; });
  const units: BattleUnit[] = []; const casualties: Record<string, number> = Object.fromEntries(canonical.army.map((entry) => [entry.unitId, 0])); for (const entry of canonical.army) { const definition = content.units[entry.unitId]; if (!definition) throw new Error(`INVALID_BATTLE_INPUT: unknown unit '${entry.unitId}'`); for (let index = 0; index < entry.count; index += 1) units.push(instantiateUnit(definition, `${entry.unitId}#${index}`, attackerDoctrine)); }
  const events: OrbitscarBattleEvent[] = [{ sequence: 0, tick: 0, type: "battle_started" }]; const damageByEntity: Record<string, number> = {}; const deploymentUsage: OrbitscarDeploymentUsage[] = []; const routeCache = new Map<string, OrbitscarPosition[]>(); let topologyVersion = 0; let eventSequence = 1; let randomSeed = canonical.seed; let battleEnded = false; let retreat = false; let commanderUse = 0; let commandIndex = 0;
  const pushEvent = (event: Omit<OrbitscarBattleEvent, "sequence">): void => { events.push({ ...event, sequence: eventSequence++ }); }; const aliveStructures = (): BattleStructure[] => structures.filter((structure) => structure.health > 0); const coreAlive = (): boolean => structures.some((structure) => structure.tags.includes("core") && structure.health > 0); const activeUnits = (): BattleUnit[] => units.filter((unit) => unit.status === "active" && unit.health > 0);
  for (let tick = 0; tick <= canonical.maxDurationTicks && !battleEnded; tick += 1) {
    while (commandIndex < canonical.commands.length && canonical.commands[commandIndex].tick === tick) { const command = canonical.commands[commandIndex++]; if (command.type === "DEPLOY") { let localIndex = 0; let capacityUsed = 0; for (const entry of command.payload.units) { const reserve = units.filter((unit) => unit.unitId === entry.unitId && unit.status === "reserve").slice(0, entry.count); for (const unit of reserve) { unit.status = "active"; unit.position = deploymentSpawnPosition(command.payload.position, localIndex++, canonical.arena); unit.nextAttackTick = tick; capacityUsed += content.units[entry.unitId].capacity; pushEvent({ tick, type: "deployed", entityId: unit.id, position: { ...unit.position } }); } } deploymentUsage.push({ commandId: command.commandId, tick, capacityUsed, units: sortedArmy(command.payload.units) }); } else if (command.type === "COMMANDER_ABILITY") { const active = activeUnits(); if (active.length > 0) { const ability = content.abilities[command.payload.abilityId]; const chosen = command.payload.targetStructureId ?? chooseStructure(active[0], aliveStructures())?.id; for (const unit of active) { unit.forcedTargetId = chosen; if (ability.kind === "reroute") unit.boostedUntil = tick + ability.durationTicks; else unit.overchargedUntil = tick + ability.durationTicks; } commanderUse += 1; pushEvent({ tick, type: "ability", entityId: command.payload.abilityId, targetId: chosen }); } } else { retreat = true; for (const unit of activeUnits()) unit.status = "retreated"; battleEnded = true; } }
    if (battleEnded) break; if (!coreAlive() || (units.length > 0 && activeUnits().length === 0 && commandIndex >= canonical.commands.length && !(units.some((unit) => unit.status === "reserve") && deploymentUsage.length < canonical.maxDeploymentCharges))) { battleEnded = true; break; }
    for (const structure of structures.filter((candidate) => candidate.weapon && candidate.health > 0)) {
      const weapon = structure.weapon;
      if (!weapon) continue;
      let target = weapon.lockedTargetId === undefined ? undefined : units.find((unit) => unit.id === weapon.lockedTargetId && unit.status === "active" && unit.health > 0);
      if (target && distanceSquared(structure.position, target.position) > weapon.range * weapon.range) {
        pushEvent({ tick, type: "defense_lock_lost", entityId: structure.id, targetId: target.id });
        weapon.lockedTargetId = undefined;
        target = undefined;
      } else if (!target && weapon.lockedTargetId !== undefined) {
        pushEvent({ tick, type: "defense_lock_lost", entityId: structure.id, targetId: weapon.lockedTargetId });
        weapon.lockedTargetId = undefined;
      }
      if (!target) {
        target = chooseUnit(structure, units);
        if (!target || distanceSquared(structure.position, target.position) > weapon.range * weapon.range) continue;
        weapon.lockedTargetId = target.id;
        pushEvent({ tick, type: "defense_aimed", entityId: structure.id, targetId: target.id, position: { ...target.position } });
      }
      if (tick < weapon.nextAttackTick) continue;
      weapon.nextAttackTick = tick + weapon.cadence;
      const roll = nextRandom(randomSeed); randomSeed = roll.seed;
      const baseDamage = Math.max(1, Math.floor(weapon.damage * (0.9 + roll.value * 0.2)));
      const splashTargets = units.filter((unit) => unit !== target && unit.status === "active" && unit.health > 0 && weapon.splashRadius > 0 && distanceSquared(target.position, unit.position) <= weapon.splashRadius * weapon.splashRadius);
      pushEvent({ tick, type: "defense_fired", entityId: structure.id, targetId: target.id, value: baseDamage });
      for (const [victim, rawDamage, isSplash] of [[target, baseDamage, false] as const, ...splashTargets.map((unit) => [unit, Math.max(1, Math.floor(baseDamage * weapon.splashDamageMultiplier)), true] as const)]) {
        const counterMultiplier = structure.defenseId !== undefined && victim.counters.includes(structure.defenseId) ? COUNTER_DAMAGE_MULTIPLIER : 1;
        const boostMultiplier = victim.boostedUntil > tick ? 0.55 : 1;
        const ordinaryDamage = Math.max(1, Math.floor(rawDamage * boostMultiplier));
        let damage = Math.max(1, Math.floor(rawDamage * counterMultiplier * boostMultiplier));
        if (isSplash && counterMultiplier > 1) damage = Math.max(damage, ordinaryDamage + 1);
        victim.health = Math.max(0, victim.health - damage);
        addDamage(damageByEntity, victim.id, damage);
        pushEvent({ tick, type: victim.health <= 0 ? "unit_destroyed" : "unit_damaged", entityId: victim.id, targetId: structure.id, value: damage, remainingHealth: victim.health, position: { ...victim.position } });
        if (victim.health <= 0) { victim.status = "destroyed"; casualties[victim.unitId] = (casualties[victim.unitId] ?? 0) + 1; }
      }
    }
    for (const unit of activeUnits()) { const target = unit.forcedTargetId === undefined ? chooseStructure(unit, aliveStructures()) : structures.find((structure) => structure.id === unit.forcedTargetId && structure.health > 0) ?? chooseStructure(unit, aliveStructures()); if (!target) continue; const commanderAbility = content.abilities[content.commanders[canonical.commanderId].abilityId]; const speed = unit.speed + (unit.boostedUntil > tick && commanderAbility.kind === "reroute" ? commanderAbility.magnitude : 0); const targetRect = structureRect(target, content); if (pointToRectDistanceSquared(unit.position, targetRect) > unit.range * unit.range) { const obstacles = aliveStructures(); if (!unit.route || unit.route.targetId !== target.id || unit.route.topologyVersion !== topologyVersion) { const startCell = `${Math.floor(unit.position.x / NAV_TILE)},${Math.floor(unit.position.y / NAV_TILE)}`; const cacheKey = JSON.stringify([target.id, topologyVersion, unit.range, startCell]); let waypoints = routeCache.get(cacheKey); if (!waypoints) { waypoints = routePath(unit, target, obstacles, canonical.arena, content); routeCache.set(cacheKey, waypoints); } unit.route = { targetId: target.id, topologyVersion, waypoints, index: 0 }; } const waypoint = unit.route.waypoints[unit.route.index]; if (waypoint) { const nextPosition = moveToward(unit.position, waypoint, speed); if (nextPosition.x !== unit.position.x || nextPosition.y !== unit.position.y) { unit.position = nextPosition; pushEvent({ tick, type: "unit_moved", entityId: unit.id, targetId: target.id, position: { ...unit.position } }); } if (unit.position.x === waypoint.x && unit.position.y === waypoint.y) unit.route.index += 1; } } else if (tick >= unit.nextAttackTick) { unit.nextAttackTick = tick + unit.cadence; const roll = nextRandom(randomSeed); randomSeed = roll.seed; const multiplier = unit.overchargedUntil > tick && commanderAbility.kind === "overcharge" ? 1 + commanderAbility.magnitude : 1; const doctrineMultiplier = target.tags.includes("defense") ? unit.bonusDamageVsDefenses : 1; const damage = Math.max(1, Math.floor(unit.power * doctrineMultiplier * multiplier * (0.9 + roll.value * 0.2))); target.health = Math.max(0, target.health - damage); addDamage(damageByEntity, target.id, damage); pushEvent({ tick, type: "unit_attacked", entityId: unit.id, targetId: target.id, value: damage }); pushEvent({ tick, type: target.health <= 0 ? "defense_destroyed" : "defense_damaged", entityId: target.id, targetId: unit.id, value: damage, remainingHealth: target.health, position: { ...target.position } }); if (target.health <= 0) topologyVersion += 1; } }
    if (!coreAlive()) battleEnded = true;
  }
  const durationTicks = battleEnded ? Math.min(canonical.maxDurationTicks, Math.max(0, ...events.map((event) => event.tick))) : canonical.maxDurationTicks; const destroyedStructureIds = structures.filter((structure) => structure.health <= 0).map((structure) => structure.id).sort(stableCompare); const survivingUnits: Record<string, number> = {}; for (const entry of canonical.army) survivingUnits[entry.unitId] = entry.count - (casualties[entry.unitId] ?? 0); const winner: OrbitscarBattleResult["winner"] = retreat || coreAlive() ? "defender" : "attacker"; const victoryTier: OrbitscarBattleResult["victoryTier"] = winner === "attacker" ? destroyedStructureIds.length === structures.length ? "full" : "partial" : destroyedStructureIds.length > 0 ? "partial" : "defeat";
  const loot = calculateOrbitscarReward(canonical, destroyedStructureIds);
  pushEvent({ tick: durationTicks, type: "battle_ended", value: winner === "attacker" ? 1 : 0 }); const resultBase = { canonicalFormatVersion: CANONICAL_FORMAT_VERSION, rulesetVersion: canonical.rulesetVersion, seed: canonical.seed, winner, victoryTier, retreated: retreat, durationTicks, attackerCasualties: casualties, survivingUnits, destroyedStructureIds, loot, damageByEntity, deploymentUsage, commanderUse: { commanderId: canonical.commanderId, abilityId: content.commanders[canonical.commanderId].abilityId, count: commanderUse }, eventCount: events.length, events, baseSnapshotHash: authoritativeDigest(sortedStructures(canonical.structures)), armySnapshotHash: authoritativeDigest(canonical.army), canonicalHash: hashOrbitscarCanonicalInput(canonical) };
  return { ...resultBase, outcomeHash: authoritativeDigest(resultBase) };
}

export function parseOrbitscarBattleScenario(value: unknown, content: OrbitscarContent): OrbitscarBattleInput {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("battle scenario must be an object"); const raw = value as Record<string, unknown>; const stringValue = (key: string): string => { const candidate = raw[key]; if (typeof candidate !== "string" || candidate.trim().length === 0) throw new Error(`${key} must be a non-empty string`); return candidate; }; const integerValue = (key: string, minimum: number): number => { const candidate = raw[key]; if (!isInteger(candidate) || candidate < minimum) throw new Error(`${key} must be an integer >= ${minimum}`); return candidate; }; const arenaValue = raw.arena; if (typeof arenaValue !== "object" || arenaValue === null || Array.isArray(arenaValue)) throw new Error("arena must be an object"); const arena = arenaValue as Record<string, unknown>; const army = raw.army; const structures = raw.structures; const commands = raw.commands; if (!Array.isArray(army) || !Array.isArray(structures) || !Array.isArray(commands)) throw new Error("army, structures, and commands must be arrays"); const rewardPreview = raw.rewardPreview === undefined ? {} : raw.rewardPreview; if (typeof rewardPreview !== "object" || rewardPreview === null || Array.isArray(rewardPreview)) throw new Error("rewardPreview must be an object"); return { canonicalFormatVersion: integerValue("canonicalFormatVersion", 1), rulesetVersion: stringValue("rulesetVersion"), seed: integerValue("seed", 0), maxDurationTicks: integerValue("maxDurationTicks", 1), arena: { width: Number(arena.width), height: Number(arena.height) }, deploymentCapacity: integerValue("deploymentCapacity", 0), maxDeploymentCharges: integerValue("maxDeploymentCharges", 0), commanderId: stringValue("commanderId"), army: army as OrbitscarArmyEntry[], structures: structures as OrbitscarStructurePlacement[], commands: commands as OrbitscarCommand[], rewardPreview: rewardPreview as Record<string, number>, content };
}

export { authoritativeDigest, canonicalSerialize, fastStateHash };
