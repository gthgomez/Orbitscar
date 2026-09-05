import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import balance from "@orbitscar/content/data/orbitscar-v0/balance.json" with { type: "json" };
import { parseOrbitscarContent } from "@orbitscar/content";
import { planDescriptors, runBattle, summarize } from "./evaluate.js";

const content = parseOrbitscarContent(balance);

describe("Orbitscar evaluation harness", () => {
  it("produces identical hashes for identical canonical inputs", () => {
    const plans = [...planDescriptors([content.encounters["cinder-yard"]], content, ["west"], [true])];
    const plan = plans[0].build(4242);
    const first = runBattle(content, content.encounters["cinder-yard"], plan, 0, false);
    const second = runBattle(content, content.encounters["cinder-yard"], plan, 0, false);
    expect(second.record.outcomeHash).toBe(first.record.outcomeHash);
    expect(second.record.canonicalHash).toBe(first.record.canonicalHash);
    expect(second.record.attackerCasualties).toEqual(first.record.attackerCasualties);
  });

  it("runs a small corpus across every authored encounter without invariant violations", () => {
    const encounters = Object.values(content.encounters);
    const records = [];
    let index = 0;
    for (const plan of planDescriptors(encounters, content, ["west", "south"], [false])) {
      const built = plan.build(9000 + index);
      records.push(runBattle(content, content.encounters[built.descriptor.encounterId], built, index, true).record);
      index += 1;
    }
    expect(records.length).toBeGreaterThanOrEqual(encounters.length * 7);
    const summary = summarize(records);
    expect(summary.invariantViolations, JSON.stringify(records.filter((r) => r.invariantViolations.length > 0)[0]?.invariantViolations)).toBe(0);
    for (const encounter of encounters) expect(records.some((record) => record.encounter === encounter.id), `${encounter.id} covered`).toBe(true);
    // every battle must terminate within the authored duration window
    for (const record of records) expect(record.durationTicks).toBeLessThanOrEqual(2400);
  });

  it("finds at least two materially different victorious plans against the introductory target", () => {
    const records = [];
    let index = 0;
    for (const plan of planDescriptors([content.encounters["cinder-yard"]], content, ["west", "north", "south", "east"], [false, true])) {
      const built = plan.build(7000 + index);
      records.push(runBattle(content, content.encounters["cinder-yard"], built, index, false).record);
      index += 1;
    }
    const winningCompositions = new Set(records.filter((record) => record.winner === "attacker").map((record) => record.composition));
    expect(winningCompositions.size, "multiple viable approaches exist").toBeGreaterThanOrEqual(2);
  });

  it("reads the authored fixture compatibly", () => {
    const fixture = JSON.parse(readFileSync(resolve("fixtures/battle_fixture.json"), "utf8"));
    expect(content.rulesetVersion).toBe(fixture.rulesetVersion);
  });
});
