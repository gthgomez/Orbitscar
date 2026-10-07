import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseOrbitscarContent } from "@orbitscar/content";
import { createColony, parseOrbitscarBattleScenario, recordColonyScout, resolveOrbitscarBattle, type OrbitscarBattleInput } from "@orbitscar/simulation";
import { createGameSession, type GameSession } from "../state/game-session.js";
import { renderApp, type RenderContext } from "./render.js";

const content = parseOrbitscarContent(JSON.parse(readFileSync(resolve("packages/content/data/orbitscar-v0/balance.json"), "utf8")));

function render(context: Partial<RenderContext> & Pick<RenderContext, "session" | "colony">): string {
  const root = { innerHTML: "" } as HTMLElement;
  renderApp({ root, content, selectedTarget: content.encounters["cinder-yard"], notice: "", ...context });
  return root.innerHTML;
}

describe("first-session UI and scouting", () => {
  it("exposes the saved sound preference as an accessible mute toggle", () => {
    const colony = { ...createColony("fresh", content), settings: { muted: true, reducedMotion: false } };
    const html = render({ colony, session: createGameSession() });
    expect(html).toContain('data-action="toggle-audio" aria-pressed="true"');
    expect(html).toContain("Sound off");
  });

  it("leads a fresh colony through its next real objective and only shows Tier 1 training", () => {
    const html = render({ colony: createColony("fresh", content), session: createGameSession() });
    expect(html).toContain("Install a defense");
    expect(html).toContain("Objective 1 of 6");
    expect(html).not.toContain("Scout a relay");
    expect(html).toContain('data-action="build:arc_projector"');
    expect(html).toContain("Line Rigger");
    expect(html).not.toContain("needle drone");
    expect(html).not.toContain("relay drone");
    expect(html).toContain('<details class="colony-operations">');
    expect(html).not.toContain('<details class="colony-operations" open>');
    expect(html).toContain('data-action="targets" disabled');
    expect(html).toContain('data-action="army" disabled');
  });

  it("keeps the colony operations disclosure open across UI rerenders", () => {
    const root = { innerHTML: "", querySelector: () => ({ open: true }) } as unknown as HTMLElement;
    renderApp({ root, content, selectedTarget: content.encounters["cinder-yard"], notice: "", colony: createColony("open-operations", content), session: createGameSession() });
    expect(root.innerHTML).toContain('<details class="colony-operations" open>');
  });

  it("shows raid escalation and the remaining defended engagements before the next band", () => {
    const fresh = render({ colony: createColony("fresh-raid", content), session: createGameSession() });
    expect(fresh).toContain("Raid intensity 1/3");
    expect(fresh).toContain("3 defensive engagements until the next increase");
    const pressured = render({ colony: { ...createColony("pressured-raid", content), defensiveEngagements: 5 }, session: createGameSession() });
    expect(pressured).toContain("Raid intensity 2/3");
    expect(pressured).toContain("1 defensive engagement until the next increase");
  });

  it("explains emergency salvage when every extractor is disabled", () => {
    const colony = createColony("recovery-colony", content);
    colony.buildings = colony.buildings.map((building) => building.buildingId === "matter_extractor" ? { ...building, health: 0 } : building);
    const html = render({ colony, session: createGameSession() });
    expect(html).toContain("Emergency salvage is active: 6 alloy, 2 volatile, and 1 signal per minute");
  });

  it("keeps exact layouts and counters hidden until signal is spent to scout", () => {
    const colony = createColony("fresh", content);
    const session = { ...createGameSession(), mode: "targets" as const };
    const unknown = render({ colony, session });
    expect(unknown).toContain('aria-label="Relay sector map showing connected frontier, secured, and rival nodes"');
    expect(unknown).toContain("RIVAL DRIFT EXCHANGE");
    expect(unknown).toContain("cinder-yard");
    expect(unknown).toContain("Scout target · 5 SIG");
    expect(unknown).toContain("Signal shadow");
    expect(unknown).not.toContain("Counter hints:");
    expect(unknown).not.toContain("scatter-node");
    expect(unknown).toContain('data-action="army" disabled');

    const scouted = recordColonyScout(colony, "cinder-yard", content);
    const revealed = render({ colony: scouted, session });
    expect(revealed).not.toContain("Suggested units:");
    expect(revealed).toContain("Known unit vulnerabilities:");
    expect(revealed).toContain("Line Rigger → Scatter Coil");
    expect(revealed).toContain("scatter (190 range)");
    expect(revealed).toContain('data-action="army"');
    expect(revealed).not.toContain('data-action="army" disabled');
  });

  it("shows unit weaknesses from the scouted target while composing", () => {
    const colony = recordColonyScout(createColony("fresh", content), "cinder-yard", content);
    const session = { ...createGameSession(), mode: "army" as const };
    const html = render({ colony, session });
    expect(html).toContain("Vulnerable to Scatter Coil");
    expect(html).toContain("Vulnerable to Arc Projector");
  });

  it("shows event-derived casualties, disabled defenses, and salvage during a live attack", () => {
    const fixture = JSON.parse(readFileSync(resolve("fixtures/battle_fixture.json"), "utf8"));
    const base = parseOrbitscarBattleScenario(fixture, content);
    const input: OrbitscarBattleInput = {
      ...base,
      maxDurationTicks: 100,
      deploymentCapacity: 10,
      army: [{ unitId: "pulse_marksman", count: 8 }],
      rewardPreview: { alloy: 36, volatile: 14, signal: 6 },
      structures: [
        { id: "relay", buildingId: "command_relay", position: { x: 900, y: 360 } },
        { id: "extractor", buildingId: "matter_extractor", position: { x: 240, y: 360 }, currentHealth: 1 },
        { id: "arc", buildingId: "arc_projector", position: { x: 450, y: 360 } },
      ],
      commands: [
        { commandId: "drop", sequence: 1, tick: 0, type: "DEPLOY" as const, payload: { zone: "west" as const, position: { x: 120, y: 360 }, units: [{ unitId: "pulse_marksman", count: 8 }] } },
      ],
    };
    const result = resolveOrbitscarBattle(input);
    const eventIndex = result.events.findIndex((event) => event.type === "defense_destroyed" && event.entityId === "extractor") + 1;
    const session: GameSession = {
      ...createGameSession(),
      mode: "battle" as const,
      plan: { ...createGameSession().plan, selectedArmy: { pulse_marksman: 8 }, waveDraft: { pulse_marksman: 0 } },
      replay: { kind: "attack" as const, input, result, attemptId: "live-readout", startedAt: 0, eventIndex, done: false },
    };
    const html = render({ colony: createColony("readout", content), session });
    const confirmed = result.events.slice(0, eventIndex).filter((event) => event.type === "unit_destroyed").length;
    expect(html).toContain(`Confirmed casualties: ${confirmed}`);
    expect(html).toContain("Defenses disabled: 0");
    expect(html).toContain("Salvage potential: Alloy 36 · Volatile 14 · Signal 6");
    const battleHtml = render({ colony: createColony("readout-log", content), session: { ...session, replay: { ...session.replay!, eventIndex: result.events.length } } });
    expect(battleHtml).not.toMatch(/unit_[a-z]+|defense_[a-z]+|#[0-9]+/);
    expect(battleHtml).toContain("Battle concluded.");
    expect(battleHtml).toContain('class="event-log" aria-live="off"');
    expect(battleHtml).toContain('role="status" aria-live="polite"');

    const retreatInput: OrbitscarBattleInput = { ...input, commands: [...input.commands, { commandId: "retreat", sequence: 2, tick: 1, type: "RETREAT", payload: {} }] };
    const retreatResult = resolveOrbitscarBattle(retreatInput);
    const retreatSession: GameSession = { ...session, replay: { ...session.replay!, input: retreatInput, result: retreatResult } };
    const retreatHtml = render({ colony: createColony("retreat-readout", content), session: retreatSession });
    expect(retreatHtml).toContain("Salvage on withdrawal: none");
    expect(retreatHtml).not.toContain("Alloy 36 · Volatile 14 · Signal 6");
  });

  it("requires settling an unarchived report before starting another attack", () => {
    const fixture = JSON.parse(readFileSync(resolve("fixtures/battle_fixture.json"), "utf8"));
    const input: OrbitscarBattleInput = parseOrbitscarBattleScenario(fixture, content);
    const replay = { kind: "attack" as const, input, result: resolveOrbitscarBattle(input), attemptId: "unsettled-report", startedAt: 0, eventIndex: 0, done: true };
    const pending = render({ colony: createColony("pending-report", content), session: { ...createGameSession(), mode: "report", replay } });
    expect(pending).toContain('data-action="return-home"');
    expect(pending).not.toContain('data-action="attack-again"');
    expect(pending).toContain("Settle this report before planning another attack");

    const archived = render({ colony: createColony("archived-report", content), session: { ...createGameSession(), mode: "report", replay: { ...replay, archived: true } } });
    expect(archived).toContain('data-action="attack-again"');
  });
});
