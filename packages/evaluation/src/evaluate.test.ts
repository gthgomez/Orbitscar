import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import balance from "@orbitscar/content/data/orbitscar-v0/balance.json" with { type: "json" };
import { parseOrbitscarContent } from "@orbitscar/content";
import { planDescriptors, runBattle, summarize } from "./evaluate.js";
import { resolveOrbitscarBattle } from "@orbitscar/simulation";

const content = parseOrbitscarContent(balance);

describe("Orbitscar evaluation harness", () => {
  it("keeps reactive policies out of default small fixed-timing matrices", () => {
    const encounter = content.encounters["glass-spine"];
    expect([...planDescriptors([encounter], content, ["west"], [false])].some((plan) => plan.descriptor.timingId === "reactive-counter-read")).toBe(false);
    expect([...planDescriptors([encounter], content, ["west"], [false], true)].some((plan) => plan.descriptor.timingId === "reactive-counter-read")).toBe(true);
  });

  it("builds a reactive reinforcement after the first observed defense shot", () => {
    const plan = [...planDescriptors([content.encounters["glass-spine"]], content, ["west"], [false], true)]
      .find((candidate) => candidate.descriptor.timingId === "reactive-counter-read")!;
    const built = plan.build(8123);
    const deploys = built.input.commands.filter((command) => command.type === "DEPLOY");
    expect(deploys).toHaveLength(2);
    if (deploys.length !== 2 || deploys[0].type !== "DEPLOY" || deploys[1].type !== "DEPLOY") return;
    const opening = { ...built.input, commands: [deploys[0]] };
    const preview = resolveOrbitscarBattle(opening);
    const firstAcquisition = preview.events.find((event) => event.type === "defense_aimed" && preview.events.some((later) => later.type === "defense_fired" && later.entityId === event.entityId && later.targetId === event.targetId && later.sequence > event.sequence));
    const observedShot = firstAcquisition && preview.events.find((event) => event.type === "defense_fired" && event.entityId === firstAcquisition.entityId && event.targetId === firstAcquisition.targetId && event.sequence > firstAcquisition.sequence);
    expect(observedShot).toBeDefined();
    expect(deploys[1].tick).toBe((observedShot?.tick ?? 0) + 1);
    expect(deploys[1].payload.zone).toBe("east");
  });

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
  }, 30_000);

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
  }, 15_000);

  it("reads the authored fixture compatibly", () => {
    const fixture = JSON.parse(readFileSync(resolve("fixtures/battle_fixture.json"), "utf8"));
    expect(content.rulesetVersion).toBe(fixture.rulesetVersion);
  });
});
