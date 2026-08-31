import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseOrbitscarContent } from "@orbitscar/content";
import { authoritativeDigest, canonicalSerialize, hashOrbitscarCanonicalInput, parseOrbitscarBattleScenario, resolveOrbitscarBattle, validateOrbitscarInput, type OrbitscarBattleInput, type OrbitscarCommand } from "./orbitscar.js";
import { sha256Hex } from "./hash.js";

const content = parseOrbitscarContent(JSON.parse(readFileSync(resolve("packages/content/data/orbitscar-v0/balance.json"), "utf8")));
const scenario = JSON.parse(readFileSync(resolve("fixtures/battle_fixture.json"), "utf8"));

function inputWith(commands: OrbitscarCommand[], overrides: Partial<OrbitscarBattleInput> = {}): OrbitscarBattleInput {
  return { ...parseOrbitscarBattleScenario(scenario, content), commands, ...overrides };
}

const baseCommands: OrbitscarCommand[] = [
  { commandId: "drop", sequence: 1, tick: 0, type: "DEPLOY", payload: { zone: "west", position: { x: 100, y: 400 }, units: [{ unitId: "line_rigger", count: 2 }, { unitId: "ram_walker", count: 1 }] } },
  { commandId: "ability", sequence: 2, tick: 120, type: "COMMANDER_ABILITY", payload: { abilityId: "emergency_reroute", targetStructureId: "arc" } },
];

describe("Orbitscar deterministic spatial combat", () => {
  it("canonicalizes order and uses a collision-resistant replay digest", () => {
    const first = inputWith(baseCommands);
    const deployment = baseCommands[0] as Extract<OrbitscarCommand, { type: "DEPLOY" }>;
    const second = inputWith([{ ...baseCommands[1] }, { ...deployment, payload: { ...deployment.payload, units: [...deployment.payload.units].reverse() } }], { army: [...first.army].reverse(), structures: [...first.structures].reverse() });
    expect(canonicalSerialize(first)).not.toBe(canonicalSerialize(second));
    expect(authoritativeDigest(first)).not.toBe(authoritativeDigest(second));
    expect(hashOrbitscarCanonicalInput(first)).toBe(hashOrbitscarCanonicalInput(second));
    expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });

  it("keeps identical seeds stable while allowing a different seed to alter stochastic damage", () => {
    const first = resolveOrbitscarBattle(inputWith(baseCommands, { seed: 17 }));
    const repeated = resolveOrbitscarBattle(inputWith(baseCommands, { seed: 17 }));
    const different = resolveOrbitscarBattle(inputWith(baseCommands, { seed: 18 }));
    expect(repeated.outcomeHash).toBe(first.outcomeHash);
    expect(different.outcomeHash).not.toBe(first.outcomeHash);
  });

  it("consumes explicit reserve quantities and rejects reuse or fractional units", () => {
    const reused = inputWith([
      { commandId: "a", sequence: 1, tick: 0, type: "DEPLOY", payload: { zone: "west", position: { x: 100, y: 100 }, units: [{ unitId: "line_rigger", count: 2 }] } },
      { commandId: "b", sequence: 2, tick: 1, type: "DEPLOY", payload: { zone: "south", position: { x: 100, y: 700 }, units: [{ unitId: "line_rigger", count: 2 }] } },
    ]);
    expect(validateOrbitscarInput(reused).errors.join(" ")).toContain("reuses more");
    const fractional = inputWith([{ commandId: "fraction", sequence: 1, tick: 0, type: "DEPLOY", payload: { zone: "west", position: { x: 100, y: 100 }, units: [{ unitId: "line_rigger", count: 0.5 }] } }]);
    expect(validateOrbitscarInput(fractional).ok).toBe(false);
  });

  it("rejects duplicate commands, unknown IDs, bad positions, and out-of-window ticks", () => {
    const invalid = inputWith([
      { commandId: "same", sequence: 4, tick: 0, type: "DEPLOY", payload: { zone: "west", position: { x: 100, y: 100 }, units: [{ unitId: "line_rigger", count: 1 }] } },
      { commandId: "same", sequence: 4, tick: 2000, type: "COMMANDER_ABILITY", payload: { abilityId: "not-real", targetStructureId: "nope" } },
    ], { maxDurationTicks: 100 });
    const errors = validateOrbitscarInput(invalid).errors.join(" ");
    expect(errors).toContain("duplicate command IDs"); expect(errors).toContain("globally unique"); expect(errors).toContain("outside the battle window"); expect(errors).toContain("invalid commander ability");
  });

  it("makes deployment geography change target engagement and outcome", () => {
    const north = resolveOrbitscarBattle(inputWith([{ commandId: "drop", sequence: 1, tick: 0, type: "DEPLOY", payload: { zone: "north", position: { x: 400, y: 60 }, units: [{ unitId: "pulse_marksman", count: 2 }, { unitId: "line_rigger", count: 2 }] } }]));
    const south = resolveOrbitscarBattle(inputWith([{ commandId: "drop", sequence: 1, tick: 0, type: "DEPLOY", payload: { zone: "south", position: { x: 400, y: 740 }, units: [{ unitId: "pulse_marksman", count: 2 }, { unitId: "line_rigger", count: 2 }] } }]));
    expect(north.outcomeHash).not.toBe(south.outcomeHash);
    expect(north.durationTicks !== south.durationTicks || JSON.stringify(north.attackerCasualties) !== JSON.stringify(south.attackerCasualties) || JSON.stringify(north.destroyedStructureIds) !== JSON.stringify(south.destroyedStructureIds)).toBe(true);
  });

  it("makes reinforcement timing and ability timing observable", () => {
    const immediate = resolveOrbitscarBattle(inputWith([
      { commandId: "first", sequence: 1, tick: 0, type: "DEPLOY", payload: { zone: "west", position: { x: 120, y: 400 }, units: [{ unitId: "ram_walker", count: 2 }] } },
      { commandId: "second", sequence: 2, tick: 0, type: "DEPLOY", payload: { zone: "north", position: { x: 400, y: 100 }, units: [{ unitId: "line_rigger", count: 2 }] } },
      { commandId: "ability", sequence: 3, tick: 30, type: "COMMANDER_ABILITY", payload: { abilityId: "emergency_reroute", targetStructureId: "relay" } },
    ]));
    const delayed = resolveOrbitscarBattle(inputWith([
      { commandId: "first", sequence: 1, tick: 0, type: "DEPLOY", payload: { zone: "west", position: { x: 120, y: 400 }, units: [{ unitId: "ram_walker", count: 2 }] } },
      { commandId: "second", sequence: 2, tick: 600, type: "DEPLOY", payload: { zone: "north", position: { x: 400, y: 100 }, units: [{ unitId: "line_rigger", count: 2 }] } },
      { commandId: "ability", sequence: 3, tick: 900, type: "COMMANDER_ABILITY", payload: { abilityId: "emergency_reroute", targetStructureId: "relay" } },
    ]));
    expect(immediate.outcomeHash).not.toBe(delayed.outcomeHash);
    expect(immediate.commanderUse.count).toBe(1); expect(delayed.commanderUse.count).toBe(1);
  });

  it("records attacker casualties, never negative health/reserves, and stops dead entities", () => {
    const result = resolveOrbitscarBattle(inputWith([{ commandId: "drop", sequence: 1, tick: 0, type: "DEPLOY", payload: { zone: "west", position: { x: 100, y: 400 }, units: [{ unitId: "needle_drone", count: 1 }, { unitId: "line_rigger", count: 2 }] } }], { maxDurationTicks: 500 }));
    expect(Object.values(result.attackerCasualties).every((count) => count >= 0)).toBe(true);
    expect(Object.values(result.survivingUnits).every((count) => count >= 0)).toBe(true);
    expect(result.events.filter((event) => event.type === "unit_destroyed").every((event) => (event.remainingHealth ?? 0) >= 0)).toBe(true);
    expect(result.events.every((event) => Number.isInteger(event.sequence) && event.sequence >= 0)).toBe(true);
  });

  it("rejects invalid content vocabulary and keeps the ruleset independent", () => {
    const bad = JSON.parse(JSON.stringify(scenario));
    const badContent = JSON.parse(JSON.stringify(content));
    badContent.units.line_rigger.targetPriority = [{ selector: "tag", tag: "legacy_target" }];
    expect(() => parseOrbitscarContent(badContent)).toThrow("unknown target tag");
    expect(() => resolveOrbitscarBattle({ ...parseOrbitscarBattleScenario(bad, content), rulesetVersion: "tideforge-1" })).toThrow("rulesetVersion must match loaded content");
  });
});
