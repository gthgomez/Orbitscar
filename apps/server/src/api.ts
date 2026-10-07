import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { deflateSync, inflateSync } from "node:zlib";
import balance from "@orbitscar/content/data/orbitscar-v0/balance.json" with { type: "json" };
import { parseOrbitscarContent, type OrbitscarContent } from "@orbitscar/content";
import {
  applyBattleResult,
  applyColonyDefenseResult,
  claimRivalSectorNode,
  getSectorNodeState,
  SECTOR_NODES,
  authoritativeDigest,
  collectColonyProduction,
  createColony,
  parseColonySave,
  placeColonyBuilding,
  recordColonyScout,
  repairColonyBuilding,
  researchDoctrine,
  resolveOrbitscarBattle,
  selectColonyCommander,
  sectorRewardPreview,
  serializeColony,
  settleColonyProduction,
  trainUnits,
  upgradeColonyBuilding,
  validateOrbitscarInput,
  type ColonyState,
  type OrbitscarBattleInput,
  type OrbitscarCommand,
  type OrbitscarPosition,
} from "@orbitscar/simulation";

const SERVER_SCHEMA_VERSION = 2;
const MAX_BODY_BYTES = 1_000_000;
const MAX_STORED_ATTACK_REPORTS = 250;
const MAX_STORED_REQUESTS = 512;
const MAX_CACHED_RESPONSE_BYTES = 8_000_000;
const MAX_REQUEST_CACHE_BYTES = 32_000_000;
const DEPLOYMENT_CAPACITY = 10;
const ARENA = { width: 1200, height: 800 };
const content = parseOrbitscarContent(balance);

type ProfileRecord = { version: number; save: string };
type RequestRecord = { fingerprint: string; statusCode: number; response: unknown; responseEncoding?: "deflate-json-v1"; attackId?: string };
type AttackRecord = { requestId: string; attackerId: string; defenderId: string; attackerVersion: number; defenderVersion: number; snapshotHash: string; sectorNodeId?: string; input: OrbitscarBattleInput; result: ReturnType<typeof resolveOrbitscarBattle> };
type ServerDatabase = { schemaVersion: number; profiles: Record<string, ProfileRecord>; requests: Record<string, RequestRecord>; attacks: Record<string, AttackRecord> };
type ServerOptions = { databasePath: string; content?: OrbitscarContent };

class ApiError extends Error {
  constructor(readonly statusCode: number, message: string) { super(message); }
}

function record(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new ApiError(400, `${name} must be an object`);
  return value as Record<string, unknown>;
}

function requireKeys(value: Record<string, unknown>, allowed: string[], name: string): void {
  const unexpected = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unexpected.length) throw new ApiError(400, `${name} contains unexpected field '${unexpected[0]}'`);
}

function stringField(value: unknown, name: string, pattern?: RegExp): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > 80 || (pattern && !pattern.test(value))) throw new ApiError(400, `${name} must be a valid non-empty string`);
  return value;
}

function intField(value: unknown, name: string, minimum = 0): number {
  if (!Number.isInteger(value) || typeof value !== "number" || value < minimum) throw new ApiError(400, `${name} must be an integer >= ${minimum}`);
  return value;
}

function parseArmy(value: unknown): Array<{ unitId: string; count: number }> {
  if (!Array.isArray(value) || value.length > 20) throw new ApiError(400, "army must be an array of at most 20 entries");
  return value.map((entry, index) => {
    const item = record(entry, `army[${index}]`);
    requireKeys(item, ["unitId", "count"], `army[${index}]`);
    return { unitId: stringField(item.unitId, `army[${index}].unitId`), count: intField(item.count, `army[${index}].count`, 1) };
  });
}

function parseCommands(value: unknown): OrbitscarCommand[] {
  if (!Array.isArray(value) || value.length > 8) throw new ApiError(400, "commands must be an array of at most 8 entries");
  const commands = value.map((raw, index) => {
    const command = record(raw, `commands[${index}]`);
    const type = stringField(command.type, `commands[${index}].type`);
    requireKeys(command, ["commandId", "sequence", "tick", "type", "payload"], `commands[${index}]`);
    const commandId = stringField(command.commandId, `commands[${index}].commandId`);
    const sequence = intField(command.sequence, `commands[${index}].sequence`);
    const tick = intField(command.tick, `commands[${index}].tick`);
    const payload = record(command.payload, `commands[${index}].payload`);
    if (type === "DEPLOY") {
      requireKeys(payload, ["zone", "position", "units"], `commands[${index}].payload`);
      const zone = stringField(payload.zone, `commands[${index}].payload.zone`);
      if (!(zone === "west" || zone === "north" || zone === "south" || zone === "east")) throw new ApiError(400, "deployment zone is invalid");
      const position = record(payload.position, `commands[${index}].payload.position`);
      requireKeys(position, ["x", "y"], `commands[${index}].payload.position`);
      if (typeof position.x !== "number" || !Number.isFinite(position.x) || typeof position.y !== "number" || !Number.isFinite(position.y)) throw new ApiError(400, "deployment position must contain finite coordinates");
      return { commandId, sequence, tick, type, payload: { zone, position: position as unknown as OrbitscarPosition, units: parseArmy(payload.units) } } as OrbitscarCommand;
    }
    if (type === "COMMANDER_ABILITY") {
      requireKeys(payload, ["abilityId", "targetStructureId"], `commands[${index}].payload`);
      const abilityId = stringField(payload.abilityId, `commands[${index}].payload.abilityId`);
      const targetStructureId = payload.targetStructureId === undefined ? undefined : stringField(payload.targetStructureId, `commands[${index}].payload.targetStructureId`);
      return { commandId, sequence, tick, type, payload: targetStructureId === undefined ? { abilityId } : { abilityId, targetStructureId } } as OrbitscarCommand;
    }
    if (type === "RETREAT") {
      requireKeys(payload, [], `commands[${index}].payload`);
      return { commandId, sequence, tick, type, payload: {} } as OrbitscarCommand;
    }
    throw new ApiError(400, `commands[${index}].type is unsupported`);
  });
  let deployed = false;
  let retreated = false;
  for (let index = 0; index < commands.length; index += 1) {
    const command = commands[index];
    if (command.sequence !== index + 1) throw new ApiError(400, `command sequence must be contiguous starting at 1 (expected ${index + 1})`);
    if (index > 0 && command.tick < commands[index - 1].tick) throw new ApiError(400, "command ticks must be in ascending order");
    if (retreated) throw new ApiError(400, "no commands are accepted after retreat");
    if (command.type === "DEPLOY") deployed = true;
    if (command.type === "COMMANDER_ABILITY" && !deployed) throw new ApiError(400, "commander ability requires a prior deployment");
    if (command.type === "RETREAT") retreated = true;
  }
  return commands;
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const rawChunk of req) {
    const chunk = Buffer.isBuffer(rawChunk) ? rawChunk : Buffer.from(rawChunk);
    size += chunk.byteLength;
    if (size > MAX_BODY_BYTES) throw new ApiError(413, "request body is too large");
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown; }
  catch { throw new ApiError(400, "request body must be valid JSON"); }
}

function send(res: ServerResponse, statusCode: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, { "content-type": "application/json; charset=utf-8", "content-length": Buffer.byteLength(body), "cache-control": "no-store" });
  res.end(body);
}

function initialDatabase(): ServerDatabase {
  return { schemaVersion: SERVER_SCHEMA_VERSION, profiles: {}, requests: {}, attacks: {} };
}

function validateStoredDatabase(database: ServerDatabase): void {
  if (Object.keys(database.requests).length > MAX_STORED_REQUESTS) throw new Error("server request cache exceeds its record limit");
  let cacheBytes = 0;
  for (const [id, request] of Object.entries(database.requests)) {
    const validResponse = request?.responseEncoding === "deflate-json-v1"
      ? typeof request.response === "string" && /^[A-Za-z0-9+/]+=*$/.test(request.response)
      : database.schemaVersion === 1 && request?.responseEncoding === undefined && typeof request?.response === "object" && request.response !== null;
    if (typeof request !== "object" || request === null || !/^[a-f0-9]{64}$/.test(request.fingerprint) || ![200, 201].includes(request.statusCode) || !validResponse || (request.attackId !== undefined && typeof request.attackId !== "string")) {
      throw new Error(`request '${id}' has an invalid record`);
    }
    if (request.responseEncoding === "deflate-json-v1") {
      cacheBytes += Buffer.byteLength(JSON.stringify([id, request]));
      if (cacheBytes > MAX_REQUEST_CACHE_BYTES) throw new Error("server request cache exceeds its storage limit");
      unpackResponse(request);
    } else if (Array.isArray(request.response)) {
      throw new Error(`request '${id}' has an invalid response`);
    }
  }
  for (const [id, attack] of Object.entries(database.attacks)) {
    if (typeof attack !== "object" || attack === null || attack.requestId !== id || typeof attack.attackerId !== "string" || typeof attack.defenderId !== "string" || !Number.isInteger(attack.attackerVersion) || !Number.isInteger(attack.defenderVersion) || !/^[a-f0-9]{64}$/.test(attack.snapshotHash) || typeof attack.input !== "object" || attack.input === null || typeof attack.result !== "object" || attack.result === null || typeof attack.result.outcomeHash !== "string") {
      throw new Error(`attack '${id}' has an invalid record`);
    }
  }
}

function trimRequests(requests: Record<string, RequestRecord>): void {
  const ids = Object.keys(requests);
  const recordBytes = (id: string) => Buffer.byteLength(JSON.stringify([id, requests[id]]));
  let cacheBytes = ids.reduce((total, id) => total + recordBytes(id), 0);
  while (ids.length > 0 && (ids.length > MAX_STORED_REQUESTS || cacheBytes > MAX_REQUEST_CACHE_BYTES)) {
    const oldest = ids.shift()!;
    cacheBytes -= recordBytes(oldest);
    delete requests[oldest];
  }
}

function profileState(database: ServerDatabase, profileId: string): ColonyState {
  const profile = database.profiles[profileId];
  if (!profile) throw new ApiError(404, `profile '${profileId}' was not found`);
  return parseColonySave(profile.save);
}

function hashSnapshot(profileId: string, version: number, structures: Array<{ id: string; buildingId: string; position: OrbitscarPosition; level: number; currentHealth: number }>): string {
  return authoritativeDigest({ identity: profileId, version, structures });
}

function snapshot(database: ServerDatabase, profileId: string, gameContent: OrbitscarContent) {
  const state = profileState(database, profileId);
  const version = database.profiles[profileId].version;
  const structures = state.buildings.map((building) => ({ id: building.id, buildingId: building.buildingId, position: { ...building.position }, level: building.level, currentHealth: building.health }));
  return { profileId, version, snapshotHash: hashSnapshot(profileId, version, structures), structures, commandTier: Math.min(3, state.buildings.filter((building) => building.buildingId === "command_relay").reduce((highest, building) => Math.max(highest, building.level), 1)), doctrineId: state.doctrineId, updatedAt: state.updatedAt, contentRulesetVersion: gameContent.rulesetVersion };
}

function requestFingerprint(value: unknown): string { return authoritativeDigest(value); }
function compressResponse(response: unknown): string {
  const json = JSON.stringify(response);
  if (Buffer.byteLength(json) > MAX_CACHED_RESPONSE_BYTES) throw new Error("response exceeds the idempotency cache limit");
  return deflateSync(Buffer.from(json)).toString("base64");
}
function unpackResponse(request: RequestRecord): unknown {
  if (request.responseEncoding === undefined) return request.response;
  if (request.responseEncoding !== "deflate-json-v1" || typeof request.response !== "string") throw new Error("stored request response encoding is invalid");
  try {
    const bytes = Buffer.from(request.response, "base64");
    if (bytes.toString("base64") !== request.response) throw new Error("invalid base64");
    const value = JSON.parse(inflateSync(bytes, { maxOutputLength: MAX_CACHED_RESPONSE_BYTES }).toString("utf8")) as unknown;
    if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("cached response is not an object");
    return value;
  }
  catch { throw new Error("stored request response is corrupt"); }
}
function requestId(value: unknown): string { return stringField(value, "requestId", /^[A-Za-z0-9][A-Za-z0-9._-]{1,79}$/); }
function profileId(value: unknown): string { return stringField(value, "profileId", /^[a-z0-9][a-z0-9-]{1,31}$/); }

function attackResponse(attackId: string, attack: AttackRecord) {
  return { attackId, attackerId: attack.attackerId, defenderId: attack.defenderId, attackerVersion: attack.attackerVersion, defenderVersion: attack.defenderVersion + 1, snapshotVersion: attack.defenderVersion, snapshotHash: attack.snapshotHash, ...(attack.sectorNodeId === undefined ? {} : { sectorNodeId: attack.sectorNodeId }), input: attack.input, result: attack.result };
}

export function createOrbitscarServer(options: ServerOptions): Server {
  const gameContent = options.content ?? content;
  const databasePath = options.databasePath;
  mkdirSync(dirname(databasePath), { recursive: true });
  let database = initialDatabase();
  if (existsSync(databasePath)) {
    let stored: unknown;
    try { stored = JSON.parse(readFileSync(databasePath, "utf8")) as unknown; }
    catch { throw new Error("server database is not valid JSON"); }
    if (typeof stored !== "object" || stored === null || Array.isArray(stored)) throw new Error("server database must be an object");
    database = stored as ServerDatabase;
    if (![1, SERVER_SCHEMA_VERSION].includes(database.schemaVersion) || typeof database.profiles !== "object" || database.profiles === null || Array.isArray(database.profiles) || typeof database.requests !== "object" || database.requests === null || Array.isArray(database.requests) || typeof database.attacks !== "object" || database.attacks === null || Array.isArray(database.attacks)) throw new Error("unsupported server database schema");
    if (database.schemaVersion === 1) {
      validateStoredDatabase(database);
      for (const request of Object.values(database.requests)) {
        if (typeof request === "object" && request !== null && request.responseEncoding === undefined) {
          request.response = compressResponse(request.response);
          request.responseEncoding = "deflate-json-v1";
        }
      }
      trimRequests(database.requests);
      database.schemaVersion = SERVER_SCHEMA_VERSION;
    }
    for (const [id, profile] of Object.entries(database.profiles)) {
      if (typeof profile !== "object" || profile === null || !Number.isInteger(profile.version) || profile.version < 1 || typeof profile.save !== "string") throw new Error(`profile '${id}' has an invalid record`);
      const state = parseColonySave(profile.save);
      if (state.playerId !== id) throw new Error(`profile '${id}' identity does not match its colony`);
    }
    validateStoredDatabase(database);
  }

  let queue: Promise<void> = Promise.resolve();
  function transaction<T>(work: () => T | Promise<T>): Promise<T> {
    const current = queue.then(work, work);
    queue = current.then(() => undefined, () => undefined);
    return current;
  }
  function persist(next: ServerDatabase): void {
    const temp = `${databasePath}.${randomUUID()}.tmp`;
    writeFileSync(temp, JSON.stringify(next), { encoding: "utf8", mode: 0o600 });
    renameSync(temp, databasePath);
    database = next;
  }

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const path = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    if (req.method === "GET" && path.length === 1 && path[0] === "health") return send(res, 200, { status: "ok", schemaVersion: SERVER_SCHEMA_VERSION, rulesetVersion: gameContent.rulesetVersion });
    if (req.method === "POST" && url.pathname === "/profiles") {
      const body = record(await readJson(req), "body");
      requireKeys(body, ["profileId"], "body");
      const id = profileId(body.profileId);
      return transaction(() => {
        if (database.profiles[id]) throw new ApiError(409, `profile '${id}' already exists`);
        const state = createColony(id, gameContent);
        const next = structuredClone(database);
        next.profiles[id] = { version: 1, save: serializeColony(state) };
        persist(next);
        send(res, 201, { profileId: id, version: 1, colony: state });
      });
    }
    if (req.method === "GET" && path.length === 2 && path[0] === "profiles") {
      const id = stringField(path[1], "profileId", /^[a-z0-9][a-z0-9-]{1,31}$/);
      return send(res, 200, { profileId: id, version: database.profiles[id]?.version, colony: profileState(database, id) });
    }
    if (req.method === "GET" && path.length === 3 && path[0] === "profiles" && path[2] === "snapshot") {
      const id = stringField(path[1], "profileId", /^[a-z0-9][a-z0-9-]{1,31}$/);
      const value = snapshot(database, id, gameContent);
      return send(res, 200, { ...value, snapshotId: `${id}@${value.version}:${value.snapshotHash}` });
    }
    if (req.method === "GET" && path.length === 3 && path[0] === "profiles" && path[2] === "sector") {
      const id = stringField(path[1], "profileId", /^[a-z0-9][a-z0-9-]{1,31}$/);
      const state = profileState(database, id);
      return send(res, 200, { profileId: id, version: database.profiles[id].version, nodes: SECTOR_NODES.map((node) => ({ ...node, status: getSectorNodeState(state, node.id, gameContent) })) });
    }
    if (req.method === "POST" && path.length === 3 && path[0] === "profiles" && path[2] === "actions") {
      const id = stringField(path[1], "profileId", /^[a-z0-9][a-z0-9-]{1,31}$/);
      const body = record(await readJson(req), "body");
      requireKeys(body, ["requestId", "expectedVersion", "action"], "body");
      const idempotencyId = requestId(body.requestId);
      const expectedVersion = intField(body.expectedVersion, "expectedVersion", 1);
      const action = record(body.action, "action");
      const fingerprint = requestFingerprint({ profileId: id, body });
      return transaction(() => {
        const prior = database.requests[idempotencyId];
        if (prior) {
          if (prior.fingerprint !== fingerprint) throw new ApiError(409, "requestId was already used for a different request");
          if (prior.attackId) {
            const attack = database.attacks[prior.attackId];
            return attack ? send(res, 200, attackResponse(prior.attackId, attack)) : send(res, 410, { error: "attack was settled; its archived report has expired" });
          }
          return send(res, 200, unpackResponse(prior));
        }
        const current = database.profiles[id];
        if (!current) throw new ApiError(404, `profile '${id}' was not found`);
        if (current.version !== expectedVersion) throw new ApiError(409, `stale profile version: expected ${expectedVersion}, current ${current.version}`);
        const atMs = Date.now();
        let state: ColonyState;
        try {
          state = settleColonyProduction(profileState(database, id), atMs, gameContent);
          const type = stringField(action.type, "action.type");
          if (type === "TRAIN") {
            requireKeys(action, ["type", "unitId", "count"], "action");
            state = trainUnits(state, stringField(action.unitId, "action.unitId"), intField(action.count, "action.count", 1), gameContent);
          } else if (type === "BUILD") {
            requireKeys(action, ["type", "buildingId", "position"], "action");
            const position = record(action.position, "action.position");
            requireKeys(position, ["x", "y"], "action.position");
            if (typeof position.x !== "number" || !Number.isFinite(position.x) || typeof position.y !== "number" || !Number.isFinite(position.y)) throw new ApiError(400, "action.position must contain finite coordinates");
            state = placeColonyBuilding(state, stringField(action.buildingId, "action.buildingId"), position as unknown as OrbitscarPosition, gameContent, atMs);
          } else if (type === "UPGRADE") {
            requireKeys(action, ["type", "buildingId"], "action");
            state = upgradeColonyBuilding(state, stringField(action.buildingId, "action.buildingId"), gameContent, atMs);
          } else if (type === "RESEARCH") {
            requireKeys(action, ["type", "doctrineId"], "action");
            state = researchDoctrine(state, stringField(action.doctrineId, "action.doctrineId"), gameContent);
          } else if (type === "COMMANDER") {
            requireKeys(action, ["type", "commanderId"], "action");
            state = selectColonyCommander(state, stringField(action.commanderId, "action.commanderId"), gameContent);
          } else if (type === "SCOUT") {
            requireKeys(action, ["type", "targetId"], "action");
            state = recordColonyScout(state, stringField(action.targetId, "action.targetId"), gameContent);
          } else if (type === "COLLECT") {
            requireKeys(action, ["type"], "action");
            state = collectColonyProduction(state, atMs, gameContent);
          } else if (type === "REPAIR") {
            requireKeys(action, ["type", "buildingId"], "action");
            state = repairColonyBuilding(state, stringField(action.buildingId, "action.buildingId"), gameContent, atMs);
          } else throw new ApiError(400, `unsupported colony action '${type}'`);
        } catch (error) {
          if (error instanceof ApiError) throw error;
          throw new ApiError(400, error instanceof Error ? error.message : "colony action was rejected");
        }
        const response = { profileId: id, version: expectedVersion + 1, colony: state };
        const next = structuredClone(database);
        next.profiles[id] = { version: expectedVersion + 1, save: serializeColony(state) };
        next.requests[idempotencyId] = { fingerprint, statusCode: 200, response: compressResponse(response), responseEncoding: "deflate-json-v1" };
        trimRequests(next.requests);
        persist(next);
        send(res, 200, response);
      });
    }
    if (req.method === "POST" && path.length === 3 && path[0] === "profiles" && path[2] === "campaign-attacks") {
      const id = stringField(path[1], "profileId", /^[a-z0-9][a-z0-9-]{1,31}$/);
      const body = record(await readJson(req), "body");
      requireKeys(body, ["requestId", "expectedVersion", "targetId", "army", "commands"], "body");
      const idempotencyId = requestId(body.requestId);
      const expectedVersion = intField(body.expectedVersion, "expectedVersion", 1);
      const targetId = stringField(body.targetId, "targetId");
      const target = gameContent.encounters[targetId];
      if (!target) throw new ApiError(404, `campaign target '${targetId}' was not found`);
      const army = parseArmy(body.army);
      const commands = parseCommands(body.commands);
      if (!commands.some((command) => command.type === "DEPLOY")) throw new ApiError(400, "attack command stream must contain a deployment");
      const fingerprint = requestFingerprint({ profileId: id, body });
      return transaction(() => {
        const prior = database.requests[idempotencyId];
        if (prior) {
          if (prior.fingerprint !== fingerprint) throw new ApiError(409, "requestId was already used for a different request");
          return send(res, 200, unpackResponse(prior));
        }
        const current = database.profiles[id];
        if (!current) throw new ApiError(404, `profile '${id}' was not found`);
        if (current.version !== expectedVersion) throw new ApiError(409, `stale profile version: expected ${expectedVersion}, current ${current.version}`);
        if (!profileState(database, id).scoutedTargets.includes(targetId)) throw new ApiError(400, `campaign target '${targetId}' must be scouted before attack`);
        const sectorNode = SECTOR_NODES.find((node) => node.encounterId === targetId);
        if (sectorNode && !["frontier", "secured"].includes(getSectorNodeState(profileState(database, id), sectorNode.id, gameContent))) throw new ApiError(409, `campaign target '${targetId}' is behind locked relay lanes`);
        const atMs = Date.now();
        const state = settleColonyProduction(profileState(database, id), atMs, gameContent);
        for (const entry of army) {
          if ((state.reserves[entry.unitId] ?? 0) < entry.count) throw new ApiError(400, `army exceeds current '${entry.unitId}' reserves`);
          const unit = gameContent.units[entry.unitId];
          if (!unit) throw new ApiError(400, `army references unknown unit '${entry.unitId}'`);
          if (unit.requiredTier > Math.min(3, state.buildings.filter((building) => building.buildingId === "command_relay").reduce((tier, building) => Math.max(tier, building.level), 1))) throw new ApiError(400, `unit '${entry.unitId}' is locked for this command tier`);
        }
        const seed = createHash("sha256").update(`${idempotencyId}:${targetId}:${expectedVersion}`).digest().readUInt32BE(0);
        const input: OrbitscarBattleInput = {
          canonicalFormatVersion: 2,
          rulesetVersion: gameContent.rulesetVersion,
          seed,
          maxDurationTicks: 2400,
          arena: ARENA,
          deploymentCapacity: DEPLOYMENT_CAPACITY,
          maxDeploymentCharges: 3,
          commanderId: state.commanderId,
          attackerDoctrineId: state.doctrineId,
          army,
          structures: target.structures.map((structure) => ({ ...structure, position: { ...structure.position } })),
          commands,
          rewardPreview: sectorRewardPreview(state, targetId, gameContent),
          content: gameContent,
        };
        const validation = validateOrbitscarInput(input);
        if (!validation.ok) throw new ApiError(400, validation.errors.join("; "));
        const result = resolveOrbitscarBattle(input);
        const settled = applyBattleResult(state, input, result, idempotencyId, targetId);
        const response = { profileId: id, version: expectedVersion + 1, colony: settled, attemptId: idempotencyId, targetId, input, result, sector: settled.sector };
        const next = structuredClone(database);
        next.profiles[id] = { version: expectedVersion + 1, save: serializeColony(settled) };
        next.requests[idempotencyId] = { fingerprint, statusCode: 201, response: compressResponse(response), responseEncoding: "deflate-json-v1" };
        trimRequests(next.requests);
        persist(next);
        send(res, 201, response);
      });
    }
    if (req.method === "POST" && path.length === 1 && path[0] === "attacks") {
      const body = record(await readJson(req), "body");
      requireKeys(body, ["requestId", "attackerId", "defenderId", "attackerVersion", "snapshotVersion", "snapshotHash", "army", "commands", "sectorNodeId"], "body");
      const idempotencyId = requestId(body.requestId);
      const attackerId = stringField(body.attackerId, "attackerId", /^[a-z0-9][a-z0-9-]{1,31}$/);
      const defenderId = stringField(body.defenderId, "defenderId", /^[a-z0-9][a-z0-9-]{1,31}$/);
      if (attackerId === defenderId) throw new ApiError(400, "attacker and defender must be different profiles");
      const attackerVersion = intField(body.attackerVersion, "attackerVersion", 1);
      const snapshotVersion = intField(body.snapshotVersion, "snapshotVersion", 1);
      const submittedSnapshotHash = stringField(body.snapshotHash, "snapshotHash");
      const sectorNodeId = body.sectorNodeId === undefined ? undefined : stringField(body.sectorNodeId, "sectorNodeId");
      const army = parseArmy(body.army);
      const commands = parseCommands(body.commands);
      if (!commands.some((command) => command.type === "DEPLOY")) throw new ApiError(400, "attack command stream must contain a deployment");
      const fingerprint = requestFingerprint(body);
      return transaction(() => {
        const prior = database.requests[idempotencyId];
        if (prior) {
          if (prior.fingerprint !== fingerprint) throw new ApiError(409, "requestId was already used for a different request");
          if (prior.attackId) {
            const attack = database.attacks[prior.attackId];
            return attack ? send(res, 200, attackResponse(prior.attackId, attack)) : send(res, 410, { error: "attack was settled; its archived report has expired" });
          }
          return send(res, 200, prior.response);
        }
        const attackerRecord = database.profiles[attackerId];
        const defenderRecord = database.profiles[defenderId];
        if (!attackerRecord || !defenderRecord) throw new ApiError(404, "attacker or defender profile was not found");
        if (attackerRecord.version !== attackerVersion) throw new ApiError(409, `stale attacker version: expected ${attackerVersion}, current ${attackerRecord.version}`);
        const defenderSnapshot = snapshot(database, defenderId, gameContent);
        if (defenderSnapshot.version !== snapshotVersion || defenderSnapshot.snapshotHash !== submittedSnapshotHash) throw new ApiError(409, `stale defender snapshot: current version is ${defenderSnapshot.version}`);
        if (sectorNodeId !== undefined) {
          const node = SECTOR_NODES.find((entry) => entry.id === sectorNodeId && entry.kind === "rival");
          if (!node || node.rivalProfileId !== defenderId) throw new ApiError(400, `defender '${defenderId}' does not own rival sector node '${sectorNodeId}'`);
          if (getSectorNodeState(profileState(database, attackerId), sectorNodeId, gameContent) !== "rival-frontier") throw new ApiError(409, `rival sector node '${sectorNodeId}' is not on the connected frontier`);
        }

        const atMs = Date.now();
        const attackerState = settleColonyProduction(profileState(database, attackerId), atMs, gameContent);
        const defenderState = settleColonyProduction(profileState(database, defenderId), atMs, gameContent);
        for (const entry of army) {
          if ((attackerState.reserves[entry.unitId] ?? 0) < entry.count) throw new ApiError(400, `army exceeds current '${entry.unitId}' reserves`);
          const unit = gameContent.units[entry.unitId];
          if (!unit) throw new ApiError(400, `army references unknown unit '${entry.unitId}'`);
          if (unit.requiredTier > Math.min(3, attackerState.buildings.filter((building) => building.buildingId === "command_relay").reduce((tier, building) => Math.max(tier, building.level), 1))) throw new ApiError(400, `unit '${entry.unitId}' is locked for this command tier`);
        }
        const attackId = idempotencyId;
        const seed = createHash("sha256").update(`${attackId}:${submittedSnapshotHash}:${attackerVersion}`).digest().readUInt32BE(0);
        const structures = defenderState.buildings.map((building) => ({ id: building.id, buildingId: building.buildingId, position: { ...building.position }, level: building.level, currentHealth: building.health }));
        const rewardPreview = Object.fromEntries(Object.entries(defenderState.resources).map(([id, amount]) => [id, Math.floor(amount)]));
        const input: OrbitscarBattleInput = {
          canonicalFormatVersion: 2,
          rulesetVersion: gameContent.rulesetVersion,
          seed,
          maxDurationTicks: 2400,
          arena: ARENA,
          deploymentCapacity: DEPLOYMENT_CAPACITY,
          maxDeploymentCharges: 3,
          commanderId: attackerState.commanderId,
          attackerDoctrineId: attackerState.doctrineId,
          defenderDoctrineId: defenderState.doctrineId,
          army,
          structures,
          commands,
          rewardPreview,
          content: gameContent,
        };
        const validation = validateOrbitscarInput(input);
        if (!validation.ok) throw new ApiError(400, validation.errors.join("; "));
        const result = resolveOrbitscarBattle(input);
        let settledAttacker = applyBattleResult(attackerState, input, result, attackId);
        if (sectorNodeId !== undefined) settledAttacker = claimRivalSectorNode(settledAttacker, sectorNodeId, defenderId, result.winner, gameContent);
        let settledDefender = applyColonyDefenseResult(defenderState, input, result, attackId, atMs);
        for (const [resourceId, amount] of Object.entries(result.loot)) settledDefender.resources[resourceId] = Math.max(0, (settledDefender.resources[resourceId] ?? 0) - amount);
        const attackRecord: AttackRecord = { requestId: idempotencyId, attackerId, defenderId, attackerVersion: attackerVersion + 1, defenderVersion: snapshotVersion, snapshotHash: submittedSnapshotHash, ...(sectorNodeId === undefined ? {} : { sectorNodeId }), input, result };
        const response = attackResponse(attackId, attackRecord);
        const next = structuredClone(database);
        next.profiles[attackerId] = { version: attackerVersion + 1, save: serializeColony(settledAttacker) };
        next.profiles[defenderId] = { version: snapshotVersion + 1, save: serializeColony(settledDefender) };
        next.requests[idempotencyId] = { fingerprint, statusCode: 201, response: compressResponse({ attackId }), responseEncoding: "deflate-json-v1", attackId };
        trimRequests(next.requests);
        next.attacks[attackId] = attackRecord;
        const attackIds = Object.keys(next.attacks);
        while (attackIds.length > MAX_STORED_ATTACK_REPORTS) delete next.attacks[attackIds.shift()!];
        persist(next);
        send(res, 201, response);
      });
    }
    if (req.method === "GET" && path.length === 2 && path[0] === "attacks") {
      const attack = database.attacks[path[1]];
      if (!attack) throw new ApiError(404, `attack '${path[1]}' was not found`);
      return send(res, 200, attackResponse(path[1], attack));
    }
    throw new ApiError(404, "route was not found");
  }

  return createServer((req, res) => {
    void handle(req, res).catch((error: unknown) => {
      if (res.headersSent) return res.destroy(error instanceof Error ? error : undefined);
      const statusCode = error instanceof ApiError ? error.statusCode : error instanceof Error && (error.message.includes("insufficient") || error.message.includes("requires") || error.message.includes("already committed") || error.message.includes("unknown") || error.message.includes("outside") || error.message.includes("overlaps") || error.message.includes("does not need") || error.message.includes("sector") || error.message.includes("rival node")) ? 400 : 500;
      send(res, statusCode, { error: error instanceof Error ? error.message : "unknown server error" });
    });
  });
}
