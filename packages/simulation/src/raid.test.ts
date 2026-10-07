import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseOrbitscarContent } from "@orbitscar/content";
import { applyColonyDefenseResult, createColony, placeColonyBuilding, repairColonyBuilding, selectColonyCommander } from "./colony.js";
import { buildColonyRaidInput } from "./raid.js";
import { resolveOrbitscarBattle } from "./orbitscar.js";

const content = parseOrbitscarContent(JSON.parse(readFileSync(resolve("packages/content/data/orbitscar-v0/balance.json"), "utf8")));

describe("colony raid loop", () => {
  it("converts the live colony layout into the authoritative battle snapshot", () => {
    const colony = placeColonyBuilding(createColony("defender", content), "scatter_coil", { x: 120, y: 320 }, content);
    const input = buildColonyRaidInput(colony, "scavenger_swarm", 40, content);
    expect(input.structures.map(({ id }) => id).sort()).toEqual(colony.buildings.map(({ id }) => id).sort());
    expect(input.army.length).toBeGreaterThan(0);
    const first = resolveOrbitscarBattle(input);
    expect(resolveOrbitscarBattle(input).outcomeHash).toBe(first.outcomeHash);
    expect(first.events.some((event) => event.type === "defense_fired")).toBe(true);
    const altered = { ...colony, buildings: colony.buildings.map((building) => building.id === "scatter_coil-3" ? { ...building, position: { x: 900, y: 700 } } : building) };
    expect(resolveOrbitscarBattle(buildColonyRaidInput(altered, "scavenger_swarm", 40, content)).baseSnapshotHash).not.toBe(first.baseSnapshotHash);
  });

  it("uses the colony's selected commander in deterministic defense snapshots", () => {
    const colony = selectColonyCommander(createColony("defender", content), "ion_kade", content);
    const input = buildColonyRaidInput(colony, "signal_harvest", 43, content);
    expect(input.commanderId).toBe("ion_kade");
    expect(input.commands[0].type).toBe("DEPLOY");
  });

  it("settles raid damage once and lets the owner repair a disabled structure", () => {
    const colony = placeColonyBuilding(createColony("defender", content), "scatter_coil", { x: 120, y: 320 }, content);
    const input = buildColonyRaidInput(colony, "breach_column", 18, content);
    const result = resolveOrbitscarBattle(input);
    const after = applyColonyDefenseResult(colony, input, result, "raid-18");
    expect(after.reports).toHaveLength(1);
    expect(after.reports[0].input).toEqual(input);
    expect(after.buildings.some((building) => building.health < colony.buildings.find((entry) => entry.id === building.id)!.health)).toBe(true);
    expect(applyColonyDefenseResult(after, input, result, "raid-18")).toEqual(after);
    const damaged = after.buildings.find((building) => building.health < content.buildings[building.buildingId].maxHealth);
    expect(damaged).toBeDefined();
    const repaired = repairColonyBuilding(after, damaged!.id, content);
    expect(repaired.buildings.find((building) => building.id === damaged!.id)!.health).toBeGreaterThan(damaged!.health);
    expect(repaired.resources.alloy).toBeLessThan(after.resources.alloy);
  });
});
