import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseOrbitscarContent } from "./schema.js";

const source = JSON.parse(readFileSync(resolve("packages/content/data/orbitscar-v0/balance.json"), "utf8")) as Record<string, any>;

describe("Orbitscar progression content", () => {
  it("validates player access tiers separately from NPC opponent tiers", () => {
    const content = parseOrbitscarContent(source);
    expect(content.encounters["cinder-yard"].requiredTier).toBe(1);
    expect(content.encounters["cinder-yard"].opponentTier).toBe(2);
    expect(content.encounters["quiet-orbit"].requiredTier).toBe(3);
  });

  it("rejects impossible player tiers and NPC structures above their declared tier", () => {
    const invalidUnitTier = structuredClone(source);
    invalidUnitTier.units.relay_drone.requiredTier = 4;
    expect(() => parseOrbitscarContent(invalidUnitTier)).toThrow("requiredTier must be <= 3");

    const invalidOpponentTier = structuredClone(source);
    invalidOpponentTier.encounters["cinder-yard"].opponentTier = 1;
    expect(() => parseOrbitscarContent(invalidOpponentTier)).toThrow("above opponentTier");
  });
});
