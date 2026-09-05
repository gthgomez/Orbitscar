import type { OrbitscarArmyEntry, OrbitscarBattleInput, OrbitscarBattleResult, OrbitscarPosition } from "@orbitscar/simulation";

export const MAX_DEPLOYMENT_CHARGES = 3;
export type GameMode = "colony" | "targets" | "army" | "deployment" | "battle" | "report";
export type Zone = "west" | "north" | "south" | "east";
export type Wave = { zone: Zone; units: OrbitscarArmyEntry[] };
export type ReplayState = { input: OrbitscarBattleInput; result: OrbitscarBattleResult; attemptId: string; startedAt: number; eventIndex: number; done: boolean };
export type AttackPlan = { selectedArmy: Record<string, number>; waveDraft: Record<string, number>; selectedZone: Zone; waves: Wave[]; abilityArmed: boolean };
export type GameSession = { mode: GameMode; plan: AttackPlan; replay?: ReplayState };

export const zonePositions: Record<Zone, OrbitscarPosition> = {
  west: { x: 120, y: 400 },
  north: { x: 420, y: 90 },
  south: { x: 420, y: 710 },
  east: { x: 1080, y: 400 },
};

export function createGameSession(): GameSession {
  return { mode: "colony", plan: { selectedArmy: {}, waveDraft: {}, selectedZone: "west", waves: [], abilityArmed: false } };
}

export function clearAttackPlan(session: GameSession): GameSession {
  return { ...session, mode: "colony", replay: undefined, plan: { selectedArmy: {}, waveDraft: {}, selectedZone: "west", waves: [], abilityArmed: false } };
}

export function beginArmyComposition(session: GameSession): GameSession {
  return { ...clearAttackPlan(session), mode: "army" };
}

export function beginDeployment(session: GameSession): GameSession {
  return { ...session, mode: "deployment", replay: undefined, plan: { ...session.plan, waveDraft: { ...session.plan.selectedArmy }, selectedZone: "west", waves: [], abilityArmed: false } };
}

export function restartPlan(session: GameSession): GameSession {
  return { ...session, mode: "deployment", replay: undefined, plan: { ...session.plan, waveDraft: { ...session.plan.selectedArmy }, selectedZone: "west", waves: [], abilityArmed: false } };
}

export function cancelDeployment(session: GameSession): GameSession {
  return { ...clearAttackPlan(session), mode: "targets" };
}

export function attackAgain(session: GameSession): GameSession {
  return beginArmyComposition(session);
}

export function startBattle(session: GameSession, replay: ReplayState): GameSession {
  return { ...session, mode: "battle", replay };
}

export function showReport(session: GameSession): GameSession {
  return session.replay?.done ? { ...session, mode: "report" } : session;
}

export function countStaged(waves: readonly Wave[], unitId: string): number {
  return waves.reduce((total, wave) => total + (wave.units.find((entry) => entry.unitId === unitId)?.count ?? 0), 0);
}

export function canStageWave(session: GameSession): boolean {
  return session.plan.waves.length < MAX_DEPLOYMENT_CHARGES;
}
