import { describe, expect, it } from "vitest";
import {
  canonicalizeOrbitscarInput,
  hashOrbitscarCanonicalInput,
  resolveOrbitscarBattle,
  validateOrbitscarInput,
  type OrbitscarBattleInput,
} from "./orbitscar.js";

function fixture(): OrbitscarBattleInput {
  return {
    rulesetVersion: "0.1.0",
    seed: 7,
    deploymentCapacity: 10,
    maxDeploymentCharges: 2,
    units: [
      { id: "ram", role: "anti_structure", count: 2, capacity: 4, power: 20, targetTags: ["core"] },
      { id: "screen", role: "screen", count: 2, capacity: 1, power: 3, targetTags: ["defense"] },
    ],
    defenses: [
      { id: "core-1", role: "core", health: 30, targetTags: ["core"] },
      { id: "arc-1", role: "defense", health: 30, targetTags: ["defense"] },
    ],
    deployments: [{ sequence: 1, tick: 1, dropId: "drop-a", unitIds: ["ram", "screen"], zone: "north" }],
    abilities: [{ sequence: 2, tick: 2, abilityId: "emergency_reroute" }],
  };
}

describe("Orbitscar deterministic combat foundation", () => {
  it("canonicalizes order and hashes equivalent inputs identically", () => {
    const a = fixture();
    const b = { ...fixture(), units: [...fixture().units].reverse(), deployments: [...fixture().deployments] };
    expect(canonicalizeOrbitscarInput(a)).toEqual(canonicalizeOrbitscarInput(b));
    expect(hashOrbitscarCanonicalInput(a)).toBe(hashOrbitscarCanonicalInput(b));
  });

  it("rejects duplicate events, unknown units, and capacity overflow", () => {
    const invalid = {
      ...fixture(),
      deploymentCapacity: 1,
      deployments: [
        { sequence: 1, tick: 1, dropId: "a", unitIds: ["missing"], zone: "north" },
        { sequence: 1, tick: 2, dropId: "b", unitIds: ["ram"], zone: "south" },
      ],
    };
    const result = validateOrbitscarInput(invalid);
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      "deployment sequence numbers must be unique",
      "army exceeds deployment capacity",
      "deployment references unknown unit",
    ]));
  });

  it("returns a reproducible event stream and attacker result", () => {
    const first = resolveOrbitscarBattle(fixture());
    const second = resolveOrbitscarBattle(fixture());
    expect(first).toEqual(second);
    expect(first.winner).toBe("attacker");
    expect(first.events.at(-1)?.type).toBe("battle_ended");
    expect(first.canonicalHash).toMatch(/^[0-9a-f]{8}$/);
  });
});
