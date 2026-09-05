import { describe, expect, it } from "vitest";
import { attackAgain, beginArmyComposition, beginDeployment, canStageWave, clearAttackPlan, createGameSession, MAX_DEPLOYMENT_CHARGES, restartPlan, showReport, startBattle, type ReplayState } from "./game-session.js";

describe("playable client session transitions", () => {
  it("clears replay state for attack again, restart, cancel, and a new deployment", () => {
    const replay = { input: {} as ReplayState["input"], result: {} as ReplayState["result"], attemptId: "a", startedAt: 0, eventIndex: 0, done: true } satisfies ReplayState;
    const session = startBattle(beginDeployment(beginArmyComposition(createGameSession())), replay);
    expect(showReport(session).mode).toBe("report");
    expect(attackAgain(session)).toMatchObject({ mode: "army", replay: undefined, plan: { waves: [] } });
    expect(restartPlan(session)).toMatchObject({ mode: "deployment", replay: undefined, plan: { waves: [] } });
    expect(clearAttackPlan(session)).toMatchObject({ mode: "colony", replay: undefined, plan: { waves: [] } });
  });

  it("exposes exactly three deployment charges", () => {
    const session = createGameSession();
    const threeWaveSession = { ...session, plan: { ...session.plan, waves: [{ zone: "west" as const, units: [] }, { zone: "north" as const, units: [] }, { zone: "south" as const, units: [] }] } };
    expect(MAX_DEPLOYMENT_CHARGES).toBe(3);
    expect(canStageWave(session)).toBe(true);
    expect(canStageWave(threeWaveSession)).toBe(false);
  });
});
