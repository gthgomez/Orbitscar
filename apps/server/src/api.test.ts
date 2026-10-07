import { mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateSync, inflateSync } from "node:zlib";
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

  it("rejects corrupt compressed idempotency responses at startup", async () => {
    await stop(running);
    const malformed = {
      schemaVersion: 2,
      profiles: {},
      requests: { broken: { fingerprint: "a".repeat(64), statusCode: 200, response: Buffer.from("not a deflate stream").toString("base64"), responseEncoding: "deflate-json-v1" } },
      attacks: {},
    };
    await writeFile(join(directory, "server-state.json"), JSON.stringify(malformed));
    expect(() => createOrbitscarServer({ databasePath: join(directory, "server-state.json") })).toThrow("stored request response is corrupt");
    await unlink(join(directory, "server-state.json"));
    running = await start();
  });

  it("rejects schema 2 request caches beyond the record bound", async () => {
    await stop(running);
    const response = deflateSync(Buffer.from(JSON.stringify({ ok: true }))).toString("base64");
    const requests = Object.fromEntries(Array.from({ length: 513 }, (_, index) => [`request-${index}`, {
      fingerprint: "b".repeat(64), statusCode: 200, response, responseEncoding: "deflate-json-v1",
    }]));
    await writeFile(join(directory, "server-state.json"), JSON.stringify({ schemaVersion: 2, profiles: {}, requests, attacks: {} }));
    expect(() => createOrbitscarServer({ databasePath: join(directory, "server-state.json") })).toThrow("server request cache exceeds its record limit");
    await unlink(join(directory, "server-state.json"));
    running = await start();
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

  it("resolves PvE campaign attacks on the server and persists relay ownership", async () => {
    await createProfile(running, "campaign-player");
    await createProfile(running, "local-rival-drift");
    const trained = await call<{ version: number }>(running, "/profiles/campaign-player/actions", "POST", { requestId: "campaign-train", expectedVersion: 1, action: { type: "TRAIN", unitId: "line_rigger", count: 10 } });
    expect(trained.status).toBe(200);
    const scouted = await call<{ version: number }>(running, "/profiles/campaign-player/actions", "POST", { requestId: "campaign-scout", expectedVersion: 2, action: { type: "SCOUT", targetId: "drift-lode" } });
    expect(scouted.status).toBe(200);
    const attack = { requestId: "campaign-drift-1", expectedVersion: 3, targetId: "drift-lode", army: [{ unitId: "line_rigger", count: 10 }], commands: [{ commandId: "opening", sequence: 1, tick: 0, type: "DEPLOY", payload: { zone: "west", position: { x: 120, y: 400 }, units: [{ unitId: "line_rigger", count: 10 }] } }] };
    const first = await call<{ profileId: string; version: number; colony: { reports: Array<{ attemptId: string }> }; result: { outcomeHash: string; victoryTier: string; winner: string }; input: Parameters<typeof resolveOrbitscarBattle>[0]; sector: { securedNodeIds: string[] } }>(running, "/profiles/campaign-player/campaign-attacks", "POST", attack);
    expect(first.status).toBe(201);
    expect(first.data.result.winner).toBe("attacker");
    expect(resolveOrbitscarBattle(first.data.input).outcomeHash).toBe(first.data.result.outcomeHash);
    expect(first.data.sector.securedNodeIds).toContain("drift-lode");
    expect(first.data.profileId).toBe("campaign-player");
    expect(first.data.version).toBe(4);
    expect(first.data.colony.reports.some((report) => report.attemptId === "campaign-drift-1")).toBe(true);
    type StoredRequest = { response: unknown; responseEncoding?: string };
    const stored = JSON.parse(await readFile(join(directory, "server-state.json"), "utf8")) as { schemaVersion: number; requests: Record<string, StoredRequest> };
    expect(stored.schemaVersion).toBe(2);
    expect(stored.requests["campaign-drift-1"].responseEncoding).toBe("deflate-json-v1");
    const encodedResponse = stored.requests["campaign-drift-1"].response as string;
    const cachedResponse = JSON.parse(inflateSync(Buffer.from(encodedResponse, "base64")).toString("utf8"));
    expect(cachedResponse.result.outcomeHash).toBe(first.data.result.outcomeHash);
    expect(Buffer.byteLength(encodedResponse, "base64")).toBeLessThan(Buffer.byteLength(JSON.stringify(first.data)));
    for (const request of Object.values(stored.requests)) {
      if (request.responseEncoding === "deflate-json-v1") {
        request.response = JSON.parse(inflateSync(Buffer.from(request.response as string, "base64")).toString("utf8"));
        delete request.responseEncoding;
      }
    }
    stored.schemaVersion = 1;
    await writeFile(join(directory, "server-state.json"), JSON.stringify(stored));
    await stop(running);
    running = await start();
    const health = await call<{ schemaVersion: number }>(running, "/health");
    expect(health.data.schemaVersion).toBe(2);
    const duplicate = await call<typeof first.data>(running, "/profiles/campaign-player/campaign-attacks", "POST", attack);
    expect(duplicate.status).toBe(200);
    expect(duplicate.data.result.outcomeHash).toBe(first.data.result.outcomeHash);
    expect(duplicate.data.colony).toEqual(first.data.colony);
    const sector = await call<{ nodes: Array<{ id: string; status: string }> }>(running, "/profiles/campaign-player/sector");
    expect(sector.status).toBe(200);
    expect(sector.data.nodes.find((node) => node.id === "drift-lode")?.status).toBe("secured");

    const upgraded = await call<{ version: number }>(running, "/profiles/campaign-player/actions", "POST", { requestId: "campaign-relay-tier", expectedVersion: 4, action: { type: "UPGRADE", buildingId: "command-relay-1" } });
    expect(upgraded.status).toBe(200);
    const reinforced = await call<{ version: number }>(running, "/profiles/campaign-player/actions", "POST", { requestId: "campaign-retrain", expectedVersion: 5, action: { type: "TRAIN", unitId: "line_rigger", count: 10 } });
    expect(reinforced.status).toBe(200);
    const migratedStored = JSON.parse(await readFile(join(directory, "server-state.json"), "utf8")) as { schemaVersion: number; requests: Record<string, StoredRequest> };
    expect(migratedStored.schemaVersion).toBe(2);
    expect(migratedStored.requests["campaign-drift-1"].responseEncoding).toBe("deflate-json-v1");
    const rivalSnapshot = await call<{ version: number; snapshotHash: string }>(running, "/profiles/local-rival-drift/snapshot");
    const rivalRequest = { ...attackRequest(rivalSnapshot.data, "campaign-player", "rival-drift-1", 10, reinforced.data.version), defenderId: "local-rival-drift", sectorNodeId: "rival-drift" };
    const rivalBattle = await call<{ result: { winner: string }; sectorNodeId?: string }>(running, "/attacks", "POST", rivalRequest);
    expect(rivalBattle.status).toBe(201);
    expect(rivalBattle.data.result.winner).toBe("attacker");
    expect(rivalBattle.data.sectorNodeId).toBe("rival-drift");
    const rivalSector = await call<{ nodes: Array<{ id: string; status: string }> }>(running, "/profiles/campaign-player/sector");
    expect(rivalSector.data.nodes.find((node) => node.id === "rival-drift")?.status).toBe("secured");
  });

  it("rejects rival relay attacks outside a profile's connected frontier", async () => {
    await createProfile(running, "attacker");
    await createProfile(running, "local-rival-drift");
    const attacker = await trainStarterForce(running, "attacker");
    const snapshot = await call<{ version: number; snapshotHash: string }>(running, "/profiles/local-rival-drift/snapshot");
    const request = { ...attackRequest(snapshot.data, "attacker", "unconnected-rival", 3, attacker.version), defenderId: "local-rival-drift", sectorNodeId: "rival-drift" };
    const denied = await call<{ error: string }>(running, "/attacks", "POST", request);
    expect(denied.status).toBe(409);
    expect(denied.data.error).toContain("connected frontier");
    const attackerState = await call<{ version: number; colony: { reports: unknown[] } }>(running, "/profiles/attacker");
    expect(attackerState.data.version).toBe(attacker.version);
    expect(attackerState.data.colony.reports).toHaveLength(0);
  });
});
