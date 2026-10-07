import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseOrbitscarContent } from "@orbitscar/content";
import { appendOrbitscarCommand, authoritativeDigest, calculateOrbitscarReward, canonicalSerialize, hashOrbitscarCanonicalInput, parseOrbitscarBattleScenario, resolveOrbitscarBattle, validateOrbitscarInput, type OrbitscarBattleInput, type OrbitscarCommand } from "./orbitscar.js";
import { sha256Hex } from "./hash.js";

const content = parseOrbitscarContent(JSON.parse(readFileSync(resolve("packages/content/data/orbitscar-v0/balance.json"), "utf8")));
const scenario = JSON.parse(readFileSync(resolve("fixtures/battle_fixture.json"), "utf8"));

function inputWith(commands: OrbitscarCommand[], overrides: Partial<OrbitscarBattleInput> = {}): OrbitscarBattleInput {
  return { ...parseOrbitscarBattleScenario(scenario, content), rulesetVersion: content.rulesetVersion, commands, ...overrides };
}

const baseCommands: OrbitscarCommand[] = [
  { commandId: "drop", sequence: 1, tick: 0, type: "DEPLOY", payload: { zone: "west", position: { x: 100, y: 400 }, units: [{ unitId: "line_rigger", count: 2 }, { unitId: "ram_walker", count: 1 }] } },
  { commandId: "ability", sequence: 2, tick: 120, type: "COMMANDER_ABILITY", payload: { abilityId: "emergency_reroute", targetStructureId: "arc" } },
];

describe("Orbitscar deterministic spatial combat", () => {
  it("rejects battles longer than the supported simulation window", () => {
    expect(validateOrbitscarInput(inputWith([], { maxDurationTicks: 2400 })).ok).toBe(true);
    const result = validateOrbitscarInput(inputWith([], { maxDurationTicks: 2401 }));
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("maxDurationTicks must be at most 2400");
  });

  it("canonicalizes order and uses a collision-resistant replay digest", () => {
    const first = inputWith(baseCommands);
    const deployment = baseCommands[0] as Extract<OrbitscarCommand, { type: "DEPLOY" }>;
    const second = inputWith([{ ...baseCommands[1] }, { ...deployment, payload: { ...deployment.payload, units: [...deployment.payload.units].reverse() } }], { army: [...first.army].reverse(), structures: [...first.structures].reverse() });
    expect(canonicalSerialize(first)).not.toBe(canonicalSerialize(second));
    expect(authoritativeDigest(first)).not.toBe(authoritativeDigest(second));
    expect(hashOrbitscarCanonicalInput(first)).toBe(hashOrbitscarCanonicalInput(second));
    const changedRules = JSON.parse(JSON.stringify(content)); changedRules.units.line_rigger.power += 1;
    expect(hashOrbitscarCanonicalInput({ ...first, content: changedRules })).not.toBe(hashOrbitscarCanonicalInput(first));
    expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });

  it("does not spend commander activation when no deployed units can receive it", () => {
    const result = resolveOrbitscarBattle(inputWith([{ commandId: "ability", sequence: 1, tick: 0, type: "COMMANDER_ABILITY", payload: { abilityId: "emergency_reroute" } }], { maxDurationTicks: 10 }));
    expect(result.commanderUse.count).toBe(0);
    expect(result.events.some((event) => event.type === "ability")).toBe(false);
  });

  it("gives the second commander a distinct overcharge effect", () => {
    const drop: OrbitscarCommand = { commandId: "drop", sequence: 1, tick: 0, type: "DEPLOY", payload: { zone: "west", position: { x: 100, y: 400 }, units: [{ unitId: "ram_walker", count: 2 }] } };
    const ability: OrbitscarCommand = { commandId: "overcharge", sequence: 2, tick: 1, type: "COMMANDER_ABILITY", payload: { abilityId: "weapon_overcharge", targetStructureId: "arc" } };
    const armed = inputWith([drop, ability], { commanderId: "ion_kade", maxDurationTicks: 800 });
    const plain = inputWith([drop], { commanderId: "ion_kade", maxDurationTicks: 800 });
    const result = resolveOrbitscarBattle(armed);
    const baseline = resolveOrbitscarBattle(plain);
    expect(result.commanderUse.abilityId).toBe("weapon_overcharge");
    expect(result.events.some((event) => event.type === "ability" && event.entityId === "weapon_overcharge")).toBe(true);
    expect(result.events.some((event) => event.type === "unit_attacked" && event.targetId === "arc")).toBe(true);
    expect(result.outcomeHash).not.toBe(baseline.outcomeHash);
  });

  it("records scatter coil splash damage against clustered units", () => {
    const input = inputWith([{ commandId: "drop", sequence: 1, tick: 0, type: "DEPLOY", payload: { zone: "west", position: { x: 120, y: 400 }, units: [{ unitId: "line_rigger", count: 4 }] } }], {
      army: [{ unitId: "line_rigger", count: 4 }],
      structures: [
        { id: "scatter", buildingId: "scatter_coil", position: { x: 220, y: 400 } },
        { id: "relay", buildingId: "command_relay", position: { x: 1100, y: 400 } },
      ],
      maxDurationTicks: 100,
    });
    const result = resolveOrbitscarBattle(input);
    const coilImpacts = result.events.filter((event) => event.tick === 0 && event.targetId === "scatter" && event.type === "unit_damaged");
    expect(coilImpacts.length).toBeGreaterThan(1);
    expect(coilImpacts.map((event) => event.entityId)).toContain("line_rigger#0");
  });

  it("lets the snare lattice splash its declared air counter weakness across a drone cluster", () => {
    const input = inputWith([{ commandId: "drop", sequence: 1, tick: 0, type: "DEPLOY", payload: { zone: "west", position: { x: 120, y: 400 }, units: [{ unitId: "needle_drone", count: 4 }] } }], {
      army: [{ unitId: "needle_drone", count: 4 }],
      structures: [
        { id: "snare", buildingId: "snare_lattice", position: { x: 220, y: 400 } },
        { id: "relay", buildingId: "command_relay", position: { x: 1000, y: 400 } },
      ],
      maxDurationTicks: 1,
    });
    const result = resolveOrbitscarBattle(input);
    const snareImpacts = result.events.filter((event) => event.tick === 0 && event.targetId === "snare" && event.type === "unit_damaged");
    expect(snareImpacts.length).toBeGreaterThan(1);
    expect(snareImpacts.some((event) => (event.value ?? 0) >= 2)).toBe(true);
    expect(snareImpacts.some((event) => event.entityId !== snareImpacts[0]?.entityId && event.value === 1)).toBe(true);
  });

  it("restricts snare splash to air while retaining its fallback shot at ground units", () => {
    const input = inputWith([{ commandId: "drop", sequence: 1, tick: 0, type: "DEPLOY", payload: { zone: "west", position: { x: 120, y: 400 }, units: [{ unitId: "line_rigger", count: 2 }] } }], {
      army: [{ unitId: "line_rigger", count: 2 }],
      structures: [
        { id: "snare", buildingId: "snare_lattice", position: { x: 220, y: 400 } },
        { id: "relay", buildingId: "command_relay", position: { x: 1000, y: 400 } },
      ],
      maxDurationTicks: 1,
    });
    const result = resolveOrbitscarBattle(input);
    expect(result.events.some((event) => event.type === "defense_fired" && event.entityId === "snare")).toBe(true);
    expect(result.events.filter((event) => event.tick === 0 && event.targetId === "snare" && event.type === "unit_damaged")).toHaveLength(1);
  });

  it("makes a listed defensive counter deal more damage to that unit", () => {
    for (const matchup of [
      { unitId: "line_rigger", defenseId: "scatter_coil", buildingId: "scatter_coil" },
      { unitId: "pulse_marksman", defenseId: "arc_projector", buildingId: "arc_projector" },
    ]) {
      const drop: OrbitscarCommand = { commandId: "drop", sequence: 1, tick: 0, type: "DEPLOY", payload: { zone: "west", position: { x: 120, y: 400 }, units: [{ unitId: matchup.unitId, count: 1 }] } };
      const structures = [
        { id: "weapon", buildingId: matchup.buildingId, position: { x: 220, y: 400 } },
        { id: "relay", buildingId: "command_relay", position: { x: 1000, y: 400 } },
      ];
      const counterResult = resolveOrbitscarBattle(inputWith([drop], { army: [{ unitId: matchup.unitId, count: 1 }], structures, seed: 31, maxDurationTicks: 40 }));
      const uncoupledContent = structuredClone(content);
      uncoupledContent.units[matchup.unitId].counters = [];
      const uncoupledResult = resolveOrbitscarBattle(inputWith([drop], { army: [{ unitId: matchup.unitId, count: 1 }], structures, content: uncoupledContent, seed: 31, maxDurationTicks: 40 }));
      const counterHit = counterResult.events.find((event) => event.type === "unit_damaged" && event.targetId === "weapon");
      const ordinaryHit = uncoupledResult.events.find((event) => event.type === "unit_damaged" && event.targetId === "weapon");
      expect(counterHit?.value, `${matchup.unitId} should be vulnerable to ${matchup.defenseId}`).toBeGreaterThan(ordinaryHit?.value ?? 0);
    }
  });

  it("applies a defensive weakness multiplier to secondary splash victims", () => {
    const deploy = { commandId: "drop", sequence: 1, tick: 0, type: "DEPLOY" as const, payload: { zone: "west" as const, position: { x: 120, y: 400 }, units: [{ unitId: "line_rigger", count: 4 }] } };
    const structures = [{ id: "weapon", buildingId: "scatter_coil", position: { x: 220, y: 400 } }, { id: "relay", buildingId: "command_relay", position: { x: 1000, y: 400 } }];
    const weakResult = resolveOrbitscarBattle(inputWith([deploy], { army: [{ unitId: "line_rigger", count: 4 }], structures, maxDurationTicks: 19 }));
    const plainContent = structuredClone(content);
    plainContent.units.line_rigger.counters = [];
    const plainResult = resolveOrbitscarBattle(inputWith([deploy], { army: [{ unitId: "line_rigger", count: 4 }], structures, content: plainContent, maxDurationTicks: 19 }));
    const weakHits = weakResult.events.filter((event) => event.type === "unit_damaged" && event.targetId === "weapon");
    const plainHits = plainResult.events.filter((event) => event.type === "unit_damaged" && event.targetId === "weapon");
    const splashVictim = weakHits.find((event) => event.entityId !== weakHits[0]?.entityId);
    const plainSplashVictim = plainHits.find((event) => event.entityId === splashVictim?.entityId);
    expect(splashVictim?.value).toBeGreaterThan(plainSplashVictim?.value ?? 0);
  });

  it("records doctrines in the canonical snapshot and applies their combat specialization", () => {
    const drop = { commandId: "drop", sequence: 1, tick: 0, type: "DEPLOY" as const, payload: { zone: "west" as const, position: { x: 120, y: 400 }, units: [{ unitId: "line_rigger", count: 4 }] } };
    const army = [{ unitId: "line_rigger", count: 4 }];
    const relayOnly = [{ id: "relay", buildingId: "command_relay", position: { x: 400, y: 400 } }];
    const baseline = resolveOrbitscarBattle(inputWith([drop], { army, structures: relayOnly, maxDurationTicks: 1000 }));
    const poweredInput = inputWith([drop], { army, structures: relayOnly, attackerDoctrineId: "power", maxDurationTicks: 1000 });
    const powered = resolveOrbitscarBattle(poweredInput);
    expect(powered.canonicalHash).not.toBe(baseline.canonicalHash);
    expect(powered.events.find((event) => event.type === "defense_destroyed" && event.entityId === "relay")?.tick).toBeLessThan(baseline.events.find((event) => event.type === "defense_destroyed" && event.entityId === "relay")?.tick ?? Number.POSITIVE_INFINITY);
    const defenseScenario = [{ id: "relay", buildingId: "command_relay", position: { x: 900, y: 400 } }, { id: "arc", buildingId: "arc_projector", position: { x: 400, y: 400 } }];
    const breach = resolveOrbitscarBattle(inputWith([drop], { army, structures: defenseScenario, attackerDoctrineId: "breach", maxDurationTicks: 1000 }));
    const plainDefense = resolveOrbitscarBattle(inputWith([drop], { army, structures: defenseScenario, maxDurationTicks: 1000 }));
    expect(breach.events.find((event) => event.type === "defense_destroyed" && event.entityId === "arc")?.tick).toBeLessThan(plainDefense.events.find((event) => event.type === "defense_destroyed" && event.entityId === "arc")?.tick ?? Number.POSITIVE_INFINITY);
  });

  it("keeps identical seeds stable while allowing a different seed to alter stochastic damage", () => {
    const first = resolveOrbitscarBattle(inputWith(baseCommands, { seed: 17 }));
    const repeated = resolveOrbitscarBattle(inputWith(baseCommands, { seed: 17 }));
    const different = resolveOrbitscarBattle(inputWith(baseCommands, { seed: 18 }));
    expect(repeated.outcomeHash).toBe(first.outcomeHash);
    expect(different.outcomeHash).not.toBe(first.outcomeHash);
  });

  it("accepts only future sequential commands and reproduces the appended command log", () => {
    const first = { commandId: "first", sequence: 1, tick: 0, type: "DEPLOY" as const, payload: { zone: "west" as const, position: { x: 100, y: 400 }, units: [{ unitId: "line_rigger", count: 2 }] } };
    const initial = inputWith([first], { army: [{ unitId: "line_rigger", count: 4 }] });
    const reinforcement = { commandId: "second", sequence: 2, tick: 120, type: "DEPLOY" as const, payload: { zone: "north" as const, position: { x: 400, y: 100 }, units: [{ unitId: "line_rigger", count: 2 }] } };
    const updated = appendOrbitscarCommand(initial, reinforcement, 90);
    expect(updated.commands).toHaveLength(2);
    expect(resolveOrbitscarBattle(updated).outcomeHash).toBe(resolveOrbitscarBattle(updated).outcomeHash);
    expect(() => appendOrbitscarCommand(initial, { ...reinforcement, tick: 60 }, 60)).toThrow("stale");
    expect(() => appendOrbitscarCommand(initial, { ...reinforcement, sequence: 1 }, 90)).toThrow("sequence");
    expect(() => appendOrbitscarCommand(initial, { ...reinforcement, tick: 150 }, 90)).toThrow("ahead");
  });

  it("telegraphs a defense target and holds that target through its first shot", () => {
    const input = inputWith([
      { commandId: "probe", sequence: 1, tick: 0, type: "DEPLOY", payload: { zone: "west", position: { x: 150, y: 400 }, units: [{ unitId: "line_rigger", count: 1 }] } },
      { commandId: "reinforcement", sequence: 2, tick: 5, type: "DEPLOY", payload: { zone: "west", position: { x: 330, y: 400 }, units: [{ unitId: "line_rigger", count: 1 }] } },
    ], {
      army: [{ unitId: "line_rigger", count: 2 }],
      structures: [{ id: "relay", buildingId: "command_relay", position: { x: 1000, y: 360 } }, { id: "arc", buildingId: "arc_projector", position: { x: 400, y: 360 } }],
      maxDurationTicks: 30,
    });
    const result = resolveOrbitscarBattle(input);
    const aimed = result.events.find((event) => event.type === "defense_aimed" && event.entityId === "arc");
    const fired = result.events.find((event) => event.type === "defense_fired" && event.entityId === "arc");
    expect(aimed).toMatchObject({ tick: 0, targetId: "line_rigger#0" });
    expect(fired).toMatchObject({ tick: 0, targetId: "line_rigger#0" });
    expect(result.events.some((event) => event.type === "defense_fired" && event.entityId === "arc" && event.targetId === "line_rigger#0" && event.tick === 24)).toBe(true);
    expect(resolveOrbitscarBattle(input).outcomeHash).toBe(result.outcomeHash);
  });

  it("retargets safely after a locked unit is destroyed without resetting weapon cadence", () => {
    const pressuredContent = JSON.parse(JSON.stringify(content));
    pressuredContent.defenses.arc_projector.damage = 1000;
    const result = resolveOrbitscarBattle(inputWith([
      { commandId: "probe", sequence: 1, tick: 0, type: "DEPLOY", payload: { zone: "west", position: { x: 150, y: 400 }, units: [{ unitId: "line_rigger", count: 1 }] } },
      { commandId: "reinforcement", sequence: 2, tick: 5, type: "DEPLOY", payload: { zone: "west", position: { x: 330, y: 400 }, units: [{ unitId: "line_rigger", count: 1 }] } },
    ], {
      army: [{ unitId: "line_rigger", count: 2 }],
      structures: [{ id: "relay", buildingId: "command_relay", position: { x: 1000, y: 360 } }, { id: "arc", buildingId: "arc_projector", position: { x: 400, y: 360 } }],
      content: pressuredContent,
      maxDurationTicks: 55,
    }));
    const acquisitions = result.events.filter((event) => event.type === "defense_aimed" && event.entityId === "arc");
    expect(result.events.some((event) => event.type === "unit_destroyed" && event.entityId === "line_rigger#0" && event.tick === 0)).toBe(true);
    expect(acquisitions.map((event) => [event.tick, event.targetId])).toEqual([[0, "line_rigger#0"], [5, "line_rigger#1"]]);
    expect(result.events.some((event) => event.type === "defense_fired" && event.entityId === "arc" && event.targetId === "line_rigger#1" && event.tick === 24)).toBe(true);
  });

  it("keeps the battle open for legal reinforcements while selected reserves remain", () => {
    const pressuredContent = JSON.parse(JSON.stringify(content));
    pressuredContent.defenses.arc_projector.damage = 1000;
    const first = { commandId: "first", sequence: 1, tick: 0, type: "DEPLOY" as const, payload: { zone: "west" as const, position: { x: 100, y: 400 }, units: [{ unitId: "line_rigger", count: 1 }] } };
    const initial = inputWith([first], { army: [{ unitId: "line_rigger", count: 2 }], content: pressuredContent, maxDurationTicks: 200 });
    const result = resolveOrbitscarBattle(initial);
    expect(result.durationTicks).toBe(200);
    const reinforcement = { commandId: "second", sequence: 2, tick: 100, type: "DEPLOY" as const, payload: { zone: "north" as const, position: { x: 400, y: 100 }, units: [{ unitId: "line_rigger", count: 1 }] } };
    expect(resolveOrbitscarBattle(appendOrbitscarCommand(initial, reinforcement, 70)).deploymentUsage).toHaveLength(2);
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

  it("rejects a deployment that spawns units inside an occupied footprint", () => {
    const overlapping = inputWith([{ commandId: "inside", sequence: 1, tick: 0, type: "DEPLOY", payload: { zone: "east", position: { x: 930, y: 400 }, units: [{ unitId: "line_rigger", count: 1 }] } }]);
    expect(validateOrbitscarInput(overlapping).errors.join(" ")).toContain("deployment 'inside' intersects structure 'relay'");
  });

  it("requires the actual deployment point to match its declared approach", () => {
    const mislabeled = inputWith([{ commandId: "misroute", sequence: 1, tick: 0, type: "DEPLOY", payload: { zone: "west", position: { x: 1080, y: 400 }, units: [{ unitId: "line_rigger", count: 1 }] } }]);
    expect(validateOrbitscarInput(mislabeled).errors.join(" ")).toContain("outside the west approach zone");
  });

  it("makes deployment geography change target engagement and outcome", () => {
    const north = resolveOrbitscarBattle(inputWith([{ commandId: "drop", sequence: 1, tick: 0, type: "DEPLOY", payload: { zone: "north", position: { x: 400, y: 60 }, units: [{ unitId: "pulse_marksman", count: 2 }, { unitId: "line_rigger", count: 2 }] } }]));
    const south = resolveOrbitscarBattle(inputWith([{ commandId: "drop", sequence: 1, tick: 0, type: "DEPLOY", payload: { zone: "west", position: { x: 100, y: 400 }, units: [{ unitId: "pulse_marksman", count: 2 }, { unitId: "line_rigger", count: 2 }] } }]));
    expect(north.outcomeHash).not.toBe(south.outcomeHash);
    const northRoute = north.events.find((event) => event.type === "unit_moved");
    const westRoute = south.events.find((event) => event.type === "unit_moved");
    expect(northRoute?.position).not.toEqual(westRoute?.position);
  });

  it("routes units around structure footprints instead of walking through them", () => {
    const result = resolveOrbitscarBattle(inputWith([
      { commandId: "drop", sequence: 1, tick: 0, type: "DEPLOY", payload: { zone: "west", position: { x: 100, y: 400 }, units: [{ unitId: "line_rigger", count: 1 }] } },
      { commandId: "focus", sequence: 2, tick: 0, type: "COMMANDER_ABILITY", payload: { abilityId: "emergency_reroute", targetStructureId: "relay" } },
    ], {
      army: [{ unitId: "line_rigger", count: 1 }],
      structures: [
        { id: "relay", buildingId: "command_relay", position: { x: 900, y: 400 } },
        { id: "cradle-wall", buildingId: "drop_cradle", position: { x: 500, y: 360 } },
      ],
      maxDurationTicks: 500,
    }));
    const movement = result.events.filter((event) => event.type === "unit_moved");
    expect(movement.length).toBeGreaterThan(20);
    expect(movement.every((event) => !(event.position && event.position.x >= 500 && event.position.x < 580 && event.position.y >= 360 && event.position.y < 440))).toBe(true);
    expect(movement.some((event) => event.position && (event.position.y < 360 || event.position.y >= 440))).toBe(true);
  });

  it("replans a disconnected route after attackers destroy a blocking module", () => {
    const wall = Array.from({ length: 20 }, (_, index) => ({ id: `wall-${index}`, buildingId: "scatter_coil", position: { x: 480, y: index * 40 } }));
    const result = resolveOrbitscarBattle(inputWith([
      { commandId: "drop", sequence: 1, tick: 0, type: "DEPLOY", payload: { zone: "west", position: { x: 100, y: 400 }, units: [{ unitId: "pulse_marksman", count: 8 }, { unitId: "salvage_hauler", count: 1 }] } },
      { commandId: "focus", sequence: 2, tick: 30, type: "COMMANDER_ABILITY", payload: { abilityId: "emergency_reroute", targetStructureId: "wall-10" } },
    ], {
      army: [{ unitId: "pulse_marksman", count: 8 }, { unitId: "salvage_hauler", count: 1 }],
      structures: [{ id: "extractor", buildingId: "matter_extractor", position: { x: 900, y: 400 } }, { id: "relay", buildingId: "command_relay", position: { x: 1000, y: 400 } }, ...wall],
      deploymentCapacity: 10,
      maxDurationTicks: 1200,
    }));
    expect(result.events.some((event) => event.type === "defense_destroyed" && event.entityId === "wall-10")).toBe(true);
    expect(result.events.some((event) => event.type === "unit_moved" && event.entityId === "salvage_hauler#0" && event.targetId === "extractor" && (event.position?.x ?? 0) > 520)).toBe(true);
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
      { commandId: "ability", sequence: 3, tick: 600, type: "COMMANDER_ABILITY", payload: { abilityId: "emergency_reroute", targetStructureId: "relay" } },
    ]));
    expect(immediate.outcomeHash).not.toBe(delayed.outcomeHash);
    expect(immediate.commanderUse.count).toBe(1); expect(delayed.commanderUse.count).toBe(1);
  });

  it("makes composition observable against the same base and deployment plan", () => {
    const armor = resolveOrbitscarBattle(inputWith(baseCommands, { army: [{ unitId: "ram_walker", count: 2 }, { unitId: "line_rigger", count: 2 }] }));
    const ranged = resolveOrbitscarBattle(inputWith([
      { commandId: "drop", sequence: 1, tick: 0, type: "DEPLOY", payload: { zone: "west", position: { x: 100, y: 400 }, units: [{ unitId: "pulse_marksman", count: 2 }, { unitId: "needle_drone", count: 1 }] } },
      { commandId: "ability", sequence: 2, tick: 120, type: "COMMANDER_ABILITY", payload: { abilityId: "emergency_reroute", targetStructureId: "arc" } },
    ], { army: [{ unitId: "pulse_marksman", count: 2 }, { unitId: "needle_drone", count: 1 }] }));
    expect(armor.outcomeHash).not.toBe(ranged.outcomeHash);
    expect(armor.damageByEntity).not.toEqual(ranged.damageByEntity);
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
    expect(() => resolveOrbitscarBattle({ ...parseOrbitscarBattleScenario(bad, content), rulesetVersion: "other-ruleset-1" })).toThrow("rulesetVersion must match loaded content");
  });

  it("uses the authored encounter preview as the full-breach reward source of truth", () => {
    for (const encounter of Object.values(content.encounters)) {
      const input = { ...parseOrbitscarBattleScenario(scenario, content), structures: encounter.structures, rewardPreview: encounter.rewardPreview };
      expect(calculateOrbitscarReward(input, encounter.structures.map((structure) => structure.id))).toEqual(encounter.rewardPreview);
      expect(calculateOrbitscarReward(input, [])).toEqual({});
    }
  });

  it("records retreat as a deterministic command and ends the battle without salvage", () => {
    const result = resolveOrbitscarBattle(inputWith([
      { commandId: "drop", sequence: 1, tick: 0, type: "DEPLOY", payload: { zone: "west", position: { x: 100, y: 400 }, units: [{ unitId: "line_rigger", count: 1 }] } },
      { commandId: "retreat", sequence: 2, tick: 60, type: "RETREAT", payload: {} },
    ]));
    expect(result.retreated).toBe(true);
    expect(result.winner).toBe("defender");
    expect(result.loot).toEqual({});
    expect(result.events.some((event) => event.type === "battle_ended")).toBe(true);
  });
});
