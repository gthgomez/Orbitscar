import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { authoritativeDigest, resolveOrbitscarBattle } from "@orbitscar/simulation";
import { createOrbitscarServer } from "./api.js";

type RunningApi = { server: ReturnType<typeof createOrbitscarServer>; baseUrl: string };
let directory = "";
let running: RunningApi;

async function start(): Promise<RunningApi> {
  const server = createOrbitscarServer({ databasePath: join(directory, "server-state.json") });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("test server did not bind a TCP port");
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function stop(api: RunningApi): Promise<void> {
  await new Promise<void>((resolve, reject) => api.server.close((error) => error ? reject(error) : resolve()));
}

async function call<T>(api: RunningApi, path: string, method = "GET", body?: unknown): Promise<{ status: number; data: T }> {
  const response = await fetch(`${api.baseUrl}${path}`, { method, headers: body === undefined ? {} : { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, data: await response.json() as T };
}

async function createProfile(api: RunningApi, profileId: string): Promise<{ profileId: string; version: number }> {
  const response = await call<{ profileId: string; version: number }>(api, "/profiles", "POST", { profileId });
  expect(response.status).toBe(201);
  return response.data;
}

async function trainStarterForce(api: RunningApi, profileId: string, count = 3): Promise<{ version: number }> {
  const response = await call<{ version: number }>(api, `/profiles/${profileId}/actions`, "POST", {
    requestId: `${profileId}-train`,
    expectedVersion: 1,
    action: { type: "TRAIN", unitId: "line_rigger", count },
  });
  expect(response.status).toBe(200);
  return response.data;
}

function attackRequest(snapshot: { version: number; snapshotHash: string }, attackerId: string, requestId: string, count = 3, attackerVersion = 2): Record<string, unknown> {
    return {
    requestId,
    attackerId,
    defenderId: "defender",
    attackerVersion,
    snapshotVersion: snapshot.version,
    snapshotHash: snapshot.snapshotHash,
    army: [{ unitId: "line_rigger", count }],
    commands: [
      { commandId: "opening-drop", sequence: 1, tick: 0, type: "DEPLOY", payload: { zone: "west", position: { x: 120, y: 400 }, units: [{ unitId: "line_rigger", count }] } },
      { commandId: "reroute", sequence: 2, tick: 30, type: "COMMANDER_ABILITY", payload: { abilityId: "emergency_reroute" } },
    ],
  };
}

describe("authoritative asynchronous rival API", () => {
  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "orbitscar-server-"));
    running = await start();
  });

  afterEach(async () => {
    await stop(running);
    await rm(directory, { recursive: true, force: true });
  });

  it("settles one command stream against a versioned snapshot and survives restart", async () => {
    await createProfile(running, "attacker");
    await createProfile(running, "defender");
    const attacker = await trainStarterForce(running, "attacker");
    const retrain = await call<{ version: number; colony: { reserves: Record<string, number> } }>(running, "/profiles/attacker/actions", "POST", {
      requestId: "attacker-train",
      expectedVersion: 1,
      action: { type: "TRAIN", unitId: "line_rigger", count: 3 },
    });
    expect(retrain.status).toBe(200);
    expect(retrain.data.version).toBe(attacker.version);
    expect(retrain.data.colony.reserves.line_rigger).toBe(3);
    const snapshot = await call<{ version: number; snapshotHash: string; structures: unknown[] }>(running, "/profiles/defender/snapshot");
    expect(snapshot.status).toBe(200);
    expect(snapshot.data.structures).toHaveLength(2);
    expect(snapshot.data.snapshotHash).toBe(authoritativeDigest({ identity: "defender", version: snapshot.data.version, structures: snapshot.data.structures }));

    const request = attackRequest(snapshot.data, "attacker", "attack-1", 3, attacker.version);
    const first = await call<{ attackId: string; input: Parameters<typeof resolveOrbitscarBattle>[0]; result: { outcomeHash: string; canonicalHash: string; commanderUse: { count: number } }; attackerVersion: number; defenderVersion: number }>(running, "/attacks", "POST", request);
    expect(first.status).toBe(201);
    expect(first.data.attackId).toBe("attack-1");
    expect(first.data.result.outcomeHash).toMatch(/^[a-f0-9]{64}$/);
    expect(first.data.result.commanderUse.count).toBe(1);
    expect(resolveOrbitscarBattle(first.data.input).outcomeHash).toBe(first.data.result.outcomeHash);
    expect(first.data.attackerVersion).toBe(attacker.version + 1);
    expect(first.data.defenderVersion).toBe(snapshot.data.version + 1);

    const duplicate = await call<typeof first.data>(running, "/attacks", "POST", request);
    expect(duplicate.status).toBe(200);
    expect(duplicate.data.result.outcomeHash).toBe(first.data.result.outcomeHash);

    const profile = await call<{ version: number; colony: { reports: Array<{ attemptId: string }>; reserves: Record<string, number> } }>(running, "/profiles/attacker");
    expect(profile.data.colony.reports.filter((report) => report.attemptId === "attack-1")).toHaveLength(1);
    const defender = await call<{ version: number; colony: { reports: Array<{ attemptId: string; kind: string }> } }>(running, "/profiles/defender");
    expect(defender.data.colony.reports.filter((report) => report.attemptId === "attack-1" && report.kind === "defense")).toHaveLength(1);
    const settledAttacker = await call<{ version: number; colony: unknown }>(running, "/profiles/attacker");
    const settledDefender = await call<{ version: number; colony: unknown }>(running, "/profiles/defender");

    await stop(running);
    running = await start();
    const archived = await call<typeof first.data>(running, "/attacks/attack-1");
    expect(archived.status).toBe(200);
    expect(archived.data.result.canonicalHash).toBe(first.data.result.canonicalHash);
    const restartedAttacker = await call<{ version: number; colony: unknown }>(running, "/profiles/attacker");
    const restartedDefender = await call<{ version: number; colony: unknown }>(running, "/profiles/defender");
    expect(restartedAttacker.data).toEqual(settledAttacker.data);
    expect(restartedDefender.data).toEqual(settledDefender.data);
  });

  it("rejects stale snapshots and impossible deployment capacity without mutating either profile", async () => {
    await createProfile(running, "attacker");
    await createProfile(running, "defender");
    await trainStarterForce(running, "attacker", 11);
    const snapshot = await call<{ version: number; snapshotHash: string }>(running, "/profiles/defender/snapshot");

    const impossible = await call<{ error: string }>(running, "/attacks", "POST", attackRequest(snapshot.data, "attacker", "too-large", 11));
    expect(impossible.status).toBe(400);
    expect(impossible.data.error).toContain("capacity");

    const invalidOrder = attackRequest(snapshot.data, "attacker", "ability-before-deploy", 3);
    invalidOrder.commands = [
      { commandId: "reroute-first", sequence: 1, tick: 0, type: "COMMANDER_ABILITY", payload: { abilityId: "emergency_reroute" } },
      { commandId: "drop-second", sequence: 2, tick: 1, type: "DEPLOY", payload: { zone: "west", position: { x: 120, y: 400 }, units: [{ unitId: "line_rigger", count: 3 }] } },
    ];
    const noDeployment = await call<{ error: string }>(running, "/attacks", "POST", invalidOrder);
    expect(noDeployment.status).toBe(400);
    expect(noDeployment.data.error).toContain("prior deployment");

    const advance = await call<{ version: number }>(running, "/profiles/defender/actions", "POST", {
      requestId: "defender-commander",
      expectedVersion: snapshot.data.version,
      action: { type: "COMMANDER", commanderId: "ion_kade" },
    });
    expect(advance.status).toBe(200);
    const stale = await call<{ error: string }>(running, "/attacks", "POST", attackRequest(snapshot.data, "attacker", "stale-attack", 3));
    expect(stale.status).toBe(409);
    expect(stale.data.error).toContain("stale");

    const profile = await call<{ version: number; colony: { reserves: Record<string, number>; reports: unknown[] } }>(running, "/profiles/attacker");
    expect(profile.data.colony.reserves.line_rigger).toBe(11);
    expect(profile.data.colony.reports).toHaveLength(0);
  });

  it("serializes concurrent attacks against one snapshot and rejects forged result fields", async () => {
    await createProfile(running, "attacker");
    await createProfile(running, "defender");
    await trainStarterForce(running, "attacker");
    const snapshot = await call<{ version: number; snapshotHash: string }>(running, "/profiles/defender/snapshot");
    const firstRequest = attackRequest(snapshot.data, "attacker", "race-a");
    const secondRequest = attackRequest(snapshot.data, "attacker", "race-b");
    const [first, second] = await Promise.all([
      call<{ error?: string }>(running, "/attacks", "POST", firstRequest),
      call<{ error?: string }>(running, "/attacks", "POST", secondRequest),
    ]);
    expect([first.status, second.status].sort()).toEqual([201, 409]);

    const forged = await call<{ error: string }>(running, "/attacks", "POST", { ...attackRequest(snapshot.data, "attacker", "forged"), result: { winner: "attacker", loot: { alloy: 999999 } } });
    expect(forged.status).toBe(400);
    expect(forged.data.error).toContain("unexpected");
  });

  it("settles concurrent retries with the same idempotency key exactly once", async () => {
    await createProfile(running, "attacker");
    await createProfile(running, "defender");
    await trainStarterForce(running, "attacker");
    const snapshot = await call<{ version: number; snapshotHash: string }>(running, "/profiles/defender/snapshot");
    const request = attackRequest(snapshot.data, "attacker", "same-concurrent-request");
    const [first, retry] = await Promise.all([
      call<{ result: { outcomeHash: string } }>(running, "/attacks", "POST", request),
      call<{ result: { outcomeHash: string } }>(running, "/attacks", "POST", request),
    ]);
    expect([first.status, retry.status].sort()).toEqual([200, 201]);
    expect(first.data.result.outcomeHash).toBe(retry.data.result.outcomeHash);
    const attacker = await call<{ colony: { reports: Array<{ attemptId: string }> } }>(running, "/profiles/attacker");
    const defender = await call<{ colony: { reports: Array<{ attemptId: string }> } }>(running, "/profiles/defender");
    expect(attacker.data.colony.reports.filter((report) => report.attemptId === "same-concurrent-request")).toHaveLength(1);
    expect(defender.data.colony.reports.filter((report) => report.attemptId === "same-concurrent-request")).toHaveLength(1);
  });
});
