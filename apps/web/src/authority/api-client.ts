import type { OrbitscarStructurePlacement, ColonyState, OrbitscarBattleInput, OrbitscarBattleResult, OrbitscarCommand, OrbitscarArmyEntry, OrbitscarPosition } from "@orbitscar/simulation";
import { sha256Hex } from "@orbitscar/simulation";

export type AuthorityAction =
  | { type: "TRAIN"; unitId: string; count: number }
  | { type: "BUILD"; buildingId: string; position: OrbitscarPosition }
  | { type: "UPGRADE"; buildingId: string }
  | { type: "RESEARCH"; doctrineId: string }
  | { type: "COMMANDER"; commanderId: string }
  | { type: "SCOUT"; targetId: string }
  | { type: "COLLECT" }
  | { type: "REPAIR"; buildingId: string };

export type AuthorityProfile = { profileId: string; version: number; colony: ColonyState };
export type AuthoritySnapshot = { profileId: string; version: number; snapshotHash: string; snapshotId: string; structures: OrbitscarStructurePlacement[]; commandTier: number; doctrineId: string; updatedAt: number; contentRulesetVersion: string };
export type AuthoritySector = { profileId: string; version: number; nodes: Array<{ id: string; name: string; kind: "home" | "pve" | "rival"; status: string; rivalProfileId?: string; encounterId?: string }> };
export type RivalAttackRequest = { requestId: string; attackerId: string; defenderId: string; attackerVersion: number; snapshotVersion: number; snapshotHash: string; army: OrbitscarArmyEntry[]; commands: OrbitscarCommand[]; sectorNodeId?: string };
export type AuthorityAttack = { attackId: string; attackerId: string; defenderId: string; attackerVersion: number; defenderVersion: number; snapshotVersion: number; snapshotHash: string; sectorNodeId?: string; input: OrbitscarBattleInput; result: OrbitscarBattleResult };

export class AuthorityApiError extends Error {
  constructor(readonly status: number, message: string) { super(message); this.name = "AuthorityApiError"; }
}

export function deriveAuthorityAttackSeed(requestId: string, snapshotHash: string, attackerVersion: number): number {
  return Number.parseInt(sha256Hex(`${requestId}:${snapshotHash}:${attackerVersion}`).slice(0, 8), 16);
}

export function deriveAuthorityCampaignSeed(requestId: string, targetId: string, expectedVersion: number): number {
  return Number.parseInt(sha256Hex(`${requestId}:${targetId}:${expectedVersion}`).slice(0, 8), 16);
}

export function createAuthorityClient(baseUrl = "/api", fetcher: typeof fetch = fetch) {
  const root = baseUrl.replace(/\/$/, "");
  async function request<T>(path: string, method = "GET", payload?: unknown): Promise<T> {
    const response = await fetcher(`${root}${path}`, {
      method,
      headers: payload === undefined ? undefined : { "content-type": "application/json" },
      body: payload === undefined ? undefined : JSON.stringify(payload),
    });
    let data: unknown;
    try { data = await response.json(); } catch { data = undefined; }
    if (!response.ok) {
      const message = typeof data === "object" && data !== null && "error" in data && typeof data.error === "string" ? data.error : `authority request failed (${response.status})`;
      throw new AuthorityApiError(response.status, message);
    }
    return data as T;
  }
  return {
    createProfile: (profileId: string) => request<AuthorityProfile>("/profiles", "POST", { profileId }),
    loadProfile: (profileId: string) => request<AuthorityProfile>(`/profiles/${encodeURIComponent(profileId)}`),
    loadSnapshot: (profileId: string) => request<AuthoritySnapshot>(`/profiles/${encodeURIComponent(profileId)}/snapshot`),
    loadSector: (profileId: string) => request<AuthoritySector>(`/profiles/${encodeURIComponent(profileId)}/sector`),
    applyAction: (profileId: string, expectedVersion: number, requestId: string, action: AuthorityAction) => request<AuthorityProfile>(`/profiles/${encodeURIComponent(profileId)}/actions`, "POST", { requestId, expectedVersion, action }),
    settleCampaignAttack: (profileId: string, payload: { requestId: string; expectedVersion: number; targetId: string; army: OrbitscarArmyEntry[]; commands: OrbitscarCommand[] }) => request<AuthorityProfile & { attemptId: string; targetId: string; input: OrbitscarBattleInput; result: OrbitscarBattleResult }>(`/profiles/${encodeURIComponent(profileId)}/campaign-attacks`, "POST", payload),
    submitRivalAttack: (payload: RivalAttackRequest) => request<AuthorityAttack>("/attacks", "POST", payload),
    loadAttack: (attackId: string) => request<AuthorityAttack>(`/attacks/${encodeURIComponent(attackId)}`),
  };
}
