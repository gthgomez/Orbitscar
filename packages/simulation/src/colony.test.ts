import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseOrbitscarContent } from "@orbitscar/content";
import { applyBattleResult, advanceColony, createColony, parseColonySave, placeColonyBuilding, serializeColony, trainUnits, upgradeColonyBuilding } from "./colony.js";
import { parseOrbitscarBattleScenario, resolveOrbitscarBattle } from "./orbitscar.js";

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
    const after = applyBattleResult(initial, battleInput, result);
    expect(after.reports).toHaveLength(1);
    expect(after.reserves.line_rigger).toBe(result.survivingUnits.line_rigger);
    expect(after.resources.alloy).toBeGreaterThanOrEqual(initial.resources.alloy);
    const serialized = serializeColony(after);
    expect(parseColonySave(serialized)).toEqual(after);
    const tampered = serialized.replace('"playerId":"test-player"', '"playerId":"intruder"');
    expect(() => parseColonySave(tampered)).toThrow("checksum mismatch");
    expect(applyBattleResult(after, battleInput, result)).toEqual(after);
  });
});
