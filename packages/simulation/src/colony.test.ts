import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseOrbitscarContent } from "@orbitscar/content";
import { applyBattleResult, advanceColony, beginColonySortie, collectColonyProduction, commandTierOf, createColony, parseColonySave, placeColonyBuilding, recordColonyScout, repairColonyBuilding, researchDoctrine, selectColonyCommander, serializeColony, trainUnits, upgradeColonyBuilding } from "./colony.js";
import { claimSectorNode } from "./sector.js";
import { parseOrbitscarBattleScenario, resolveOrbitscarBattle } from "./orbitscar.js";
import { authoritativeDigest } from "./hash.js";

const content = parseOrbitscarContent(JSON.parse(readFileSync(resolve("packages/content/data/orbitscar-v0/balance.json"), "utf8")));
const fixture = JSON.parse(readFileSync(resolve("fixtures/battle_fixture.json"), "utf8"));

describe("Orbitscar persistent colony loop", () => {
  it("allocates distinct reproducible seeds by target and persisted sortie sequence", () => {
    const initial = createColony("test-player", content);
    const first = beginColonySortie(initial, "cinder-yard");
    const next = beginColonySortie(first.colony, "cinder-yard");
    const otherTarget = beginColonySortie(first.colony, "drift-lode");
    expect(first.seed).toBe(beginColonySortie(initial, "cinder-yard").seed);
    expect(first.seed).not.toBe(next.seed);
    expect(first.seed).not.toBe(otherTarget.seed);
    expect(next.colony.sortieCount).toBe(2);
    expect(parseColonySave(serializeColony(next.colony)).sortieCount).toBe(2);
  });

  it("creates a bounded colony, spends declarative costs, and produces extractor income", () => {
    const initial = createColony("test-player", content);
    const starter = trainUnits(initial, "line_rigger", 3, content);
    const tierTwo = upgradeColonyBuilding(starter, "command-relay-1", content);
    const placed = placeColonyBuilding(tierTwo, "scatter_coil", { x: 120, y: 120 }, content);
    expect(placed.buildings).toHaveLength(3);
    expect(placed.resources.alloy).toBeLessThan(tierTwo.resources.alloy);
    const advanced = advanceColony(placed, 60, content);
    expect(advanced.resources.alloy).toBeGreaterThan(placed.resources.alloy);
    expect(() => placeColonyBuilding(advanced, "arc_projector", { x: 440, y: 360 }, content)).toThrow("overlaps");
  });

  it("collects only bounded elapsed-time production and caps storage", () => {
    const initial = createColony("test-player", content);
    const productionStart = Date.parse(initial.productionUpdatedAt);
    const partial = collectColonyProduction(initial, productionStart + 30_000, content);
    expect(partial.resources).toEqual(initial.resources);
    expect(partial.productionUpdatedAt).toBe(initial.productionUpdatedAt);
    const afterMinute = collectColonyProduction(partial, productionStart + 60_000, content);
    expect(afterMinute.resources.alloy - initial.resources.alloy).toBe(6);
    expect(collectColonyProduction(afterMinute, productionStart + 60_000, content).resources).toEqual(afterMinute.resources);
    const capped = collectColonyProduction(afterMinute, productionStart + 365 * 24 * 60 * 60 * 1000, content);
    expect(capped.resources.alloy).toBeLessThanOrEqual(600);
    expect(capped.resources.volatile).toBeLessThanOrEqual(300);
    expect(capped.resources.signal).toBeLessThanOrEqual(240);
    expect(() => collectColonyProduction(initial, productionStart - 1, content)).toThrow("clock");
  });

  it("extractor levels increase bounded production", () => {
    const initial = createColony("test-player", content);
    const start = Date.parse(initial.productionUpdatedAt);
    const upgraded = upgradeColonyBuilding(initial, "matter-extractor-1", content, start + 30_000);
    const base = collectColonyProduction(initial, start + 90_000, content);
    const improved = collectColonyProduction(upgraded, start + 90_000, content);
    expect(improved.resources.alloy - upgraded.resources.alloy).toBeGreaterThan(base.resources.alloy - initial.resources.alloy);
    expect(improved.resources.volatile - upgraded.resources.volatile).toBeGreaterThan(base.resources.volatile - initial.resources.volatile);
  });

  it("restores a fully depleted colony's disabled extractor through emergency salvage", () => {
    const colony = createColony("recovery-player", content);
    const failed = {
      ...colony,
      resources: { alloy: 0, volatile: 0, signal: 0 },
      buildings: colony.buildings.map((building) => building.buildingId === "matter_extractor" ? { ...building, health: 0 } : building),
    };
    const start = Date.parse(failed.productionUpdatedAt);
    const supplied = collectColonyProduction(failed, start + 3 * 60_000, content);
    expect(supplied.resources).toEqual({ alloy: 18, volatile: 6, signal: 3 });
    const repaired = repairColonyBuilding(supplied, "matter-extractor-1", content, start + 3 * 60_000);
    expect(repaired.buildings.find((building) => building.id === "matter-extractor-1")?.health).toBeGreaterThan(0);
  });

  it("migrates v3 saves without minting time or losing their previous timestamp", () => {
    const initial = createColony("test-player", content);
    const { productionUpdatedAt: _removed, ...oldPayload } = initial;
    const v3Payload = { ...oldPayload, schemaVersion: 3 };
    const legacySave = JSON.stringify({ schemaVersion: 3, payload: v3Payload, checksum: authoritativeDigest(v3Payload) });
    const migrated = parseColonySave(legacySave);
    expect(migrated.schemaVersion).toBe(10);
    expect(migrated.productionUpdatedAt).toBe(initial.updatedAt);
    expect(migrated.sector.securedNodeIds).toEqual([]);
    expect(migrated.sortieCount).toBe(0);
  });

  it("migrates a v8 colony by initializing its sortie sequence", () => {
    const initial = createColony("test-player", content);
    const { sortieCount: _removed, ...legacyPayload } = initial;
    const v8Payload = { ...legacyPayload, schemaVersion: 8 };
    const legacySave = JSON.stringify({ schemaVersion: 8, payload: v8Payload, checksum: authoritativeDigest(v8Payload) });
    const migrated = parseColonySave(legacySave);
    expect(migrated.schemaVersion).toBe(10);
    expect(migrated.sortieCount).toBe(0);
    expect(parseColonySave(serializeColony(migrated)).sortieCount).toBe(0);
  });

  it("persists commander selection and migrates legacy saves to Mara", () => {
    const initial = createColony("test-player", content);
    expect(initial.commanderId).toBe("mara_voss");
    const selected = selectColonyCommander(initial, "ion_kade", content);
    expect(selected.commanderId).toBe("ion_kade");
    expect(parseColonySave(serializeColony(selected)).commanderId).toBe("ion_kade");
    expect(() => selectColonyCommander(initial, "unknown", content)).toThrow("unknown commander");

    const { commanderId: _removed, ...legacyPayload } = initial;
    const v4Payload = { ...legacyPayload, schemaVersion: 4 };
    const legacySave = JSON.stringify({ schemaVersion: 4, payload: v4Payload, checksum: authoritativeDigest(v4Payload) });
    expect(parseColonySave(legacySave).commanderId).toBe("mara_voss");
  });

  it("allows one permanent doctrine choice and applies logistics to training costs", () => {
    const initial = createColony("test-player", content);
    expect(() => researchDoctrine(initial, "logistics", content)).toThrow("Command Tier 2");
    expect(() => upgradeColonyBuilding(initial, "command-relay-1", content)).toThrow("starter force");
    const starter = trainUnits(initial, "line_rigger", 3, content);
    const tierTwo = upgradeColonyBuilding(starter, "command-relay-1", content);
    const researched = researchDoctrine(tierTwo, "logistics", content);
    expect(researched.doctrineId).toBe("logistics");
    expect(researched.research).toContain("logistics");
    const trained = trainUnits(researched, "ram_walker", 1, content);
    expect(tierTwo.resources.alloy - researched.resources.alloy).toBe(content.doctrines.logistics.cost.alloy);
    expect(researched.resources.alloy - trained.resources.alloy).toBeLessThan(content.units.ram_walker.cost.alloy);
    expect(() => researchDoctrine(researched, "power", content)).toThrow("already committed");
    expect(() => researchDoctrine(initial, "unknown", content)).toThrow("unknown doctrine");
    expect(parseColonySave(serializeColony(researched)).doctrineId).toBe("logistics");
  });

  it("trains persistent reserves and rejects unaffordable batches", () => {
    const initial = createColony("test-player", content);
    const trained = trainUnits(initial, "line_rigger", 3, content);
    expect(trained.reserves.line_rigger).toBe(3);
    expect(() => trainUnits({ ...trained, resources: { alloy: 0, volatile: 0, signal: 0 } }, "line_rigger", 1, content)).toThrow("insufficient");
  });

  it("uses Command Relay level to gate later units and buildings", () => {
    const initial = createColony("test-player", content);
    expect(() => trainUnits(initial, "needle_drone", 1, content)).toThrow("Command Tier 2");
    expect(() => placeColonyBuilding(initial, "scatter_coil", { x: 120, y: 120 }, content)).toThrow("Command Tier 2");
    expect(() => upgradeColonyBuilding(initial, "command-relay-1", content)).toThrow("starter force");
    const starter = trainUnits(initial, "line_rigger", 3, content);
    const tierTwo = upgradeColonyBuilding(starter, "command-relay-1", content);
    expect(tierTwo.buildings.find((building) => building.id === "command-relay-1")?.level).toBe(2);
    expect(() => placeColonyBuilding(tierTwo, "command_relay", { x: 760, y: 120 }, content)).toThrow("unique");
    const duplicateRelays = { ...tierTwo, buildings: [...tierTwo.buildings, { id: "extra-relay", buildingId: "command_relay", position: { x: 760, y: 120 }, level: 2, health: 275 }] };
    const { scoutedTargets: _scoutedTargets, completedObjectives: _completedObjectives, ...preObjectiveState } = duplicateRelays;
    const legacyPayload = { ...preObjectiveState, schemaVersion: 6 };
    const legacySave = JSON.stringify({ schemaVersion: 6, payload: legacyPayload, checksum: authoritativeDigest(legacyPayload) });
    const migrated = parseColonySave(legacySave);
    expect(migrated.buildings.filter((building) => building.buildingId === "command_relay")).toHaveLength(1);
    expect(migrated.buildings.find((building) => building.buildingId === "command_relay")?.level).toBe(2);
    expect(migrated.buildings.some((building) => building.buildingId === "matter_extractor")).toBe(true);
    expect(migrated.resources).toEqual(duplicateRelays.resources);
    expect(commandTierOf(migrated)).toBe(2);
    expect(trainUnits(tierTwo, "needle_drone", 1, content).reserves.needle_drone).toBe(1);
    expect(placeColonyBuilding(tierTwo, "scatter_coil", { x: 120, y: 120 }, content).buildings).toHaveLength(3);
    expect(() => recordColonyScout(tierTwo, "quiet-orbit", content)).toThrow("Command Tier 3");
    const tierThree = upgradeColonyBuilding(tierTwo, "command-relay-1", content);
    expect(commandTierOf(tierThree)).toBe(3);
    expect(trainUnits(tierThree, "relay_drone", 1, content).reserves.relay_drone).toBe(1);
    const onFrontier = claimSectorNode(tierThree, "cinder-yard", "attacker", content);
    expect(recordColonyScout(onFrontier, "quiet-orbit", content).scoutedTargets).toContain("quiet-orbit");
    expect(() => upgradeColonyBuilding(tierThree, "command-relay-1", content)).toThrow("maximum");
  });

  it("tracks the first-session objectives from real colony actions and persists them", () => {
    let colony = createColony("test-player", content);
    colony = placeColonyBuilding(colony, "arc_projector", { x: 120, y: 120 }, content);
    expect(colony.completedObjectives).toContain("first-defense");
    colony = trainUnits(colony, "line_rigger", 3, content);
    expect(colony.completedObjectives).toContain("starter-force");
    colony = recordColonyScout(colony, "cinder-yard", content);
    expect(colony.completedObjectives).toContain("first-scout");
    const input = parseOrbitscarBattleScenario(fixture, content);
    const battleInput = { ...input, army: [{ unitId: "line_rigger", count: 3 }], commands: [{ commandId: "drop", sequence: 1, tick: 0, type: "DEPLOY" as const, payload: { zone: "west" as const, position: { x: 100, y: 400 }, units: [{ unitId: "line_rigger", count: 3 }] } }] };
    const result = resolveOrbitscarBattle(battleInput);
    colony = applyBattleResult(colony, battleInput, result, "tutorial-attack", "cinder-yard");
    expect(colony.completedObjectives).toContain("first-sortie");
    expect(colony.sector.securedNodeIds.includes("cinder-yard")).toBe(result.winner === "attacker");
    expect(parseColonySave(serializeColony(colony)).completedObjectives).toEqual(colony.completedObjectives);
  });

  it("upgrades an installed module with scaled cost and integrity", () => {
    const initial = createColony("test-player", content);
    const upgraded = upgradeColonyBuilding(initial, "matter-extractor-1", content);
    expect(upgraded.buildings.find((building) => building.id === "matter-extractor-1")?.level).toBe(2);
    expect(upgraded.buildings.find((building) => building.id === "matter-extractor-1")?.health).toBe(119);
    expect(upgraded.resources.alloy).toBeLessThan(initial.resources.alloy);
  });

  it("round-trips tamper-detected saves and reconciles casualties, survivors, loot, and reports", () => {
    const initial = trainUnits(createColony("test-player", content), "line_rigger", 3, content);
    const input = parseOrbitscarBattleScenario(fixture, content);
    const battleInput = { ...input, army: [{ unitId: "line_rigger", count: 3 }], commands: [{ commandId: "drop", sequence: 1, tick: 0, type: "DEPLOY" as const, payload: { zone: "west" as const, position: { x: 100, y: 400 }, units: [{ unitId: "line_rigger", count: 3 }] } }] };
    const result = resolveOrbitscarBattle(battleInput);
    const after = applyBattleResult(initial, battleInput, result, "attempt-1");
    expect(after.reports).toHaveLength(1);
    expect(after.reserves.line_rigger).toBe(result.survivingUnits.line_rigger);
    expect(after.resources.alloy).toBeGreaterThanOrEqual(initial.resources.alloy);
    const serialized = serializeColony(after);
    expect(parseColonySave(serialized)).toEqual(after);
    const tampered = serialized.replace('"playerId":"test-player"', '"playerId":"intruder"');
    expect(() => parseColonySave(tampered)).toThrow("checksum mismatch");
    expect(applyBattleResult(after, battleInput, result, "attempt-1")).toEqual(after);
  });

  it("settles identical deterministic results twice when they are separate attempts", () => {
    const initial = trainUnits(createColony("test-player", content), "line_rigger", 6, content);
    const input = parseOrbitscarBattleScenario(fixture, content);
    const battleInput = { ...input, army: [{ unitId: "line_rigger", count: 3 }], commands: [{ commandId: "drop", sequence: 1, tick: 0, type: "DEPLOY" as const, payload: { zone: "west" as const, position: { x: 100, y: 400 }, units: [{ unitId: "line_rigger", count: 3 }] } }] };
    const result = resolveOrbitscarBattle(battleInput);
    const once = applyBattleResult(initial, battleInput, result, "attempt-a");
    const twice = applyBattleResult(once, battleInput, result, "attempt-b");
    expect(result.outcomeHash).toBe(resolveOrbitscarBattle(battleInput).outcomeHash);
    expect(once.reports).toHaveLength(1);
    expect(twice.reports).toHaveLength(2);
    expect(twice.reserves.line_rigger).toBe(initial.reserves.line_rigger - (result.attackerCasualties.line_rigger ?? 0) * 2);
    expect(applyBattleResult(twice, battleInput, result, "attempt-b")).toEqual(twice);
  });

  it("keeps undeployed reserve units when a plan resolves after its first wave", () => {
    const initial = trainUnits(createColony("test-player", content), "line_rigger", 6, content);
    const input = parseOrbitscarBattleScenario(fixture, content);
    const battleInput = { ...input, army: [{ unitId: "line_rigger", count: 6 }], commands: [{ commandId: "drop", sequence: 1, tick: 0, type: "DEPLOY" as const, payload: { zone: "west" as const, position: { x: 100, y: 400 }, units: [{ unitId: "line_rigger", count: 3 }] } }] };
    const result = resolveOrbitscarBattle(battleInput);
    const after = applyBattleResult(initial, battleInput, result, "partial-plan");
    expect(after.reserves.line_rigger).toBe(6 - (result.attackerCasualties.line_rigger ?? 0));
  });
});
