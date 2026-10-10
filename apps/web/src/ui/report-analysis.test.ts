import { describe, expect, it } from "vitest";
import balance from "@orbitscar/content/data/orbitscar-v0/balance.json" with { type: "json" };
import { parseOrbitscarContent } from "@orbitscar/content";
import type { OrbitscarBattleResult } from "@orbitscar/simulation";
import { analyzeBattleReport } from "./report-analysis.js";

const content = parseOrbitscarContent(balance);
const target = content.encounters["glass-spine"];

function result(events: OrbitscarBattleResult["events"]): OrbitscarBattleResult {
  return {
    canonicalFormatVersion: 2,
    rulesetVersion: content.rulesetVersion,
    seed: 123,
    winner: "attacker",
    victoryTier: "partial",
    retreated: false,
    durationTicks: 80,
    attackerCasualties: { needle_drone: 1 },
    survivingUnits: { line_rigger: 2, needle_drone: 1 },
    destroyedStructureIds: ["projector"],
    loot: { alloy: 12 },
    damageByEntity: { extractor: 30, "extractor-2": 20, "needle_drone#1": 20 },
    deploymentUsage: [
      { commandId: "drop-1", tick: 0, capacityUsed: 5, units: [{ unitId: "line_rigger", count: 1 }] },
      { commandId: "drop-2", tick: 30, capacityUsed: 4, units: [{ unitId: "needle_drone", count: 1 }] },
    ],
    commanderUse: { commanderId: "mara_voss", abilityId: "emergency_reroute", count: 1 },
    eventCount: events.length,
    events,
    baseSnapshotHash: "base",
    armySnapshotHash: "army",
    canonicalHash: "canonical",
    outcomeHash: "outcome",
  };
}

describe("battle report analysis", () => {
  it("records a reinforcement arriving during a defense wind-up", () => {
    const report = analyzeBattleReport(result([
      { sequence: 1, tick: 0, type: "defense_aimed", entityId: "arc", targetId: "line_rigger#1" },
      { sequence: 2, tick: 8, type: "deployed", entityId: "needle_drone#1" },
      { sequence: 3, tick: 24, type: "defense_fired", entityId: "arc", targetId: "line_rigger#1", value: 12 },
    ]), "attack", target, content);
    expect(report.recordedFacts.join(" ")).toContain("acquired Line Rigger at tick 0 and first hit at tick 24; a reinforcement arrived during that wind-up at tick 8");
  });

  it("starts report wind-up timing again after a defense loses and reacquires its target", () => {
    const report = analyzeBattleReport(result([
      { sequence: 1, tick: 0, type: "defense_aimed", entityId: "arc", targetId: "line_rigger#1" },
      { sequence: 2, tick: 5, type: "defense_lock_lost", entityId: "arc", targetId: "line_rigger#1" },
      { sequence: 3, tick: 8, type: "defense_aimed", entityId: "arc", targetId: "line_rigger#1" },
      { sequence: 4, tick: 26, type: "defense_fired", entityId: "arc", targetId: "line_rigger#1", value: 12 },
    ]), "attack", target, content);
    const fact = report.recordedFacts.find((entry) => entry.includes("acquired Line Rigger"));
    expect(fact).toContain("at tick 8 and first hit at tick 26");
    expect(fact).not.toContain("at tick 0");
  });

  it("attributes damage, kills, deployments, and commander actions to recorded events", () => {
    const report = analyzeBattleReport(result([
      { sequence: 1, tick: 0, type: "deployed", entityId: "line_rigger#1" },
      { sequence: 2, tick: 10, type: "defense_fired", entityId: "arc", targetId: "line_rigger#1", value: 12 },
      { sequence: 3, tick: 11, type: "unit_damaged", entityId: "line_rigger#1", targetId: "arc", value: 12 },
      { sequence: 4, tick: 30, type: "deployed", entityId: "needle_drone#1" },
      { sequence: 5, tick: 35, type: "ability", entityId: "emergency_reroute", targetId: "arc" },
      { sequence: 6, tick: 40, type: "unit_attacked", entityId: "line_rigger#1", targetId: "extractor", value: 15 },
      { sequence: 7, tick: 45, type: "unit_destroyed", entityId: "needle_drone#1", targetId: "arc", value: 12 },
      { sequence: 8, tick: 50, type: "defense_destroyed", entityId: "arc", targetId: "line_rigger#1" },
    ]), "attack", target, content);
    expect(report.recordedFacts.join(" ")).toContain("Arc Projector dealt 24 recorded damage and destroyed 1 unit");
    expect(report.recordedFacts.join(" ")).toContain("Line Rigger dealt 15 recorded structure damage");
    expect(report.recordedFacts.join(" ")).toContain("Reinforcement 1 dealt 0 recorded damage");
    expect(report.recordedFacts.join(" ")).toContain("Emergency Reroute was activated at tick 35, focused on Arc Projector");
  });

  it("reports defensive damage and attacker pressure without reversing damage attribution", () => {
    const report = analyzeBattleReport(result([
      { sequence: 1, tick: 0, type: "defense_fired", entityId: "arc", targetId: "needle_drone#1", value: 18 },
      { sequence: 2, tick: 5, type: "unit_damaged", entityId: "needle_drone#2", targetId: "arc", value: 12 },
      { sequence: 3, tick: 10, type: "unit_attacked", entityId: "line_rigger#1", targetId: "extractor", value: 20 },
      { sequence: 4, tick: 11, type: "unit_attacked", entityId: "line_rigger#1", targetId: "extractor", value: 10 },
      { sequence: 5, tick: 12, type: "unit_attacked", entityId: "ram_walker#1", targetId: "extractor-2", value: 25 },
      { sequence: 6, tick: 13, type: "unit_destroyed", entityId: "needle_drone#1", targetId: "arc", value: 18 },
    ]), "defense", target, content);
    expect(report.recordedFacts.join(" ")).toContain("Arc Projector dealt 30 recorded damage and destroyed 1 raider");
    expect(report.recordedFacts.join(" ")).toContain("Matter Extractor took 30 recorded damage from Line Rigger");
    expect(report.recordedFacts.join(" ")).not.toContain("Needle Drone dealt the most recorded damage");
  });
});
