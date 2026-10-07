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

  it("provides a substantial set of distinct authored PvE layouts", () => {
    const content = parseOrbitscarContent(source);
    const encounters = Object.values(content.encounters);
    const layouts = new Set(encounters.map((encounter) => JSON.stringify(encounter.structures.map((structure) => [structure.buildingId, structure.position.x, structure.position.y]).sort())));
    expect(encounters.length).toBeGreaterThanOrEqual(10);
    expect(layouts.size).toBeGreaterThanOrEqual(10);
    expect(new Set(encounters.map((encounter) => encounter.difficulty)).size).toBe(3);
  });

  it("keeps every authored encounter footprint inside the arena and separated", () => {
    const content = parseOrbitscarContent(source);
    for (const encounter of Object.values(content.encounters)) {
      const id = encounter.id;
      const structures = encounter.structures;
      for (const structure of structures) {
        const [width, height] = content.buildings[structure.buildingId].footprint;
        expect(structure.position.x).toBeGreaterThanOrEqual(0);
        expect(structure.position.y).toBeGreaterThanOrEqual(0);
        expect(structure.position.x + width * 40).toBeLessThanOrEqual(1200);
        expect(structure.position.y + height * 40).toBeLessThanOrEqual(800);
      }
      for (let i = 0; i < structures.length; i += 1) {
        const a = structures[i];
        const [aw, ah] = content.buildings[a.buildingId].footprint;
        for (const b of structures.slice(i + 1)) {
          const [bw, bh] = content.buildings[b.buildingId].footprint;
          const overlaps = a.position.x < b.position.x + bw * 40
            && a.position.x + aw * 40 > b.position.x
            && a.position.y < b.position.y + bh * 40
            && a.position.y + ah * 40 > b.position.y;
          expect(overlaps, `${id}: ${a.id} overlaps ${b.id}`).toBe(false);
        }
      }
    }
  });

  it("keeps directional structure labels and scout text consistent with mirrored layouts", () => {
    const content = parseOrbitscarContent(source);
    for (const encounter of Object.values(content.encounters)) {
      for (const structure of encounter.structures) {
        const centerY = structure.position.y + content.buildings[structure.buildingId].footprint[1] * 20;
        if (structure.id.startsWith("upper-")) expect(centerY, `${encounter.id}/${structure.id} should be north of the arena midline`).toBeLessThan(400);
        if (structure.id.startsWith("lower-")) expect(centerY, `${encounter.id}/${structure.id} should be south of the arena midline`).toBeGreaterThan(400);
      }
    }
    for (const id of ["glass-spine", "glasswake-gate", "salt-spool", "morrow-gate", "hollow-meridian"]) {
      expect(content.encounters[id].description, `${id} orientation-neutral scout text`).not.toMatch(/\b(upper|lower|north|south)\b/i);
    }
    expect(content.encounters["hollow-meridian"].description).toMatch(/one long-range projector/i);
    expect(content.encounters["hollow-meridian"].description).toMatch(/two scatter coils/i);
  });

  it("rejects impossible player tiers and NPC structures above their declared tier", () => {
    const invalidUnitTier = structuredClone(source);
    invalidUnitTier.units.relay_drone.requiredTier = 4;
    expect(() => parseOrbitscarContent(invalidUnitTier)).toThrow("requiredTier must be <= 3");

    const invalidOpponentTier = structuredClone(source);
    invalidOpponentTier.encounters["cinder-yard"].opponentTier = 1;
    expect(() => parseOrbitscarContent(invalidOpponentTier)).toThrow("above opponentTier");
  });

  it("rejects unit counters that do not name a defensive weapon", () => {
    const invalidCounter = structuredClone(source);
    invalidCounter.units.pulse_marksman.counters = ["missing_weapon"];
    expect(() => parseOrbitscarContent(invalidCounter)).toThrow("unknown counter 'missing_weapon'");
  });
});
