import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseOrbitscarContent } from "@orbitscar/content";
import { applyBattleResult, advanceColony, collectColonyProduction, createColony, parseColonySave, placeColonyBuilding, serializeColony, trainUnits, upgradeColonyBuilding } from "./colony.js";
import { parseOrbitscarBattleScenario, resolveOrbitscarBattle } from "./orbitscar.js";
import { authoritativeDigest } from "./hash.js";

const content = parseOrbitscarContent(JSON.parse(readFileSync(resolve("packages/content/data/orbitscar-v0/balance.json"), "utf8")));
const fixture = JSON.parse(readFileSync(resolve("fixtures/battle_fixture.json"), "utf8"));

describe("Orbitscar persistent colony loop", () => {
  it("creates a bounded colony, spends declarative costs, and produces extractor income", () => {
    const initial = createColony("test-player", content);
    const placed = placeColonyBuilding(initial, "scatter_coil", { x: 120, y: 120 }, content);
    expect(placed.buildings).toHaveLength(3);
    expect(placed.resources.alloy).toBeLessThan(initial.resources.alloy);
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

  it("migrates v3 saves without minting time or losing their previous timestamp", () => {
    const initial = createColony("test-player", content);
    const { productionUpdatedAt: _removed, ...oldPayload } = initial;
    const v3Payload = { ...oldPayload, schemaVersion: 3 };
    const legacySave = JSON.stringify({ schemaVersion: 3, payload: v3Payload, checksum: authoritativeDigest(v3Payload) });
    const migrated = parseColonySave(legacySave);
    expect(migrated.schemaVersion).toBe(4);
    expect(migrated.productionUpdatedAt).toBe(initial.updatedAt);
  });

  it("trains persistent reserves and rejects unaffordable batches", () => {
    const initial = createColony("test-player", content);
    const trained = trainUnits(initial, "line_rigger", 3, content);
    expect(trained.reserves.line_rigger).toBe(3);
    expect(() => trainUnits({ ...trained, resources: { alloy: 0, volatile: 0, signal: 0 } }, "ram_walker", 1, content)).toThrow("insufficient");
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
