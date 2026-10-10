import { describe, expect, it } from "vitest";
import { createColony, parseColonySave, serializeColony, trainUnits, upgradeColonyBuilding } from "./colony.js";
import { parseOrbitscarContent } from "@orbitscar/content";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { claimRivalSectorNode, claimSectorNode, getSectorNodeState, SECTOR_NODES, sectorRewardPreview } from "./sector.js";
import { authoritativeDigest } from "./hash.js";

const content = parseOrbitscarContent(JSON.parse(readFileSync(resolve("packages/content/data/orbitscar-v0/balance.json"), "utf8")));

describe("relay sector progression", () => {
  it("opens only frontier nodes and advances through connected campaign paths", () => {
    let colony = createColony("sector-test", content);
    expect(getSectorNodeState(colony, "cinder-yard", content)).toBe("frontier");
    expect(getSectorNodeState(colony, "quiet-orbit", content)).toBe("locked");
    colony = claimSectorNode(colony, "cinder-yard", "attacker", content);
    expect(colony.sector.securedNodeIds).toContain("cinder-yard");
    expect(getSectorNodeState(colony, "glasswake-gate", content)).toBe("frontier");
    expect(getSectorNodeState(colony, "drift-lode", content)).toBe("frontier");
    expect(getSectorNodeState(colony, "shard-cairn", content)).toBe("locked");
  });

  it("requires the hostile core to fall, rejects locked/unknown nodes, and never duplicates claims", () => {
    const colony = createColony("sector-test", content);
    const failed = claimSectorNode(colony, "cinder-yard", "defender", content);
    expect(failed.sector.securedNodeIds).toEqual([]);
    expect(() => claimSectorNode(colony, "quiet-orbit", "attacker", content)).toThrow("Command Tier 3");
    expect(() => claimSectorNode(colony, "missing", "attacker", content)).toThrow("unknown sector node");
    const held = claimSectorNode(colony, "cinder-yard", "attacker", content);
    expect(claimSectorNode(held, "cinder-yard", "attacker", content)).toEqual(held);
  });

  it("keeps campaign access bounded by tier and adjacent secured relays", () => {
    const colony = createColony("sector-test", content);
    expect(SECTOR_NODES.filter((node) => node.kind === "pve")).toHaveLength(11);
    for (const [encounterId, encounter] of Object.entries(content.encounters)) {
      const node = SECTOR_NODES.find((entry) => entry.encounterId === encounterId);
      expect(node).toBeDefined();
      expect(node?.requiredTier).toBe(encounter.requiredTier);
    }
    expect(getSectorNodeState(colony, "hollow-meridian", content)).toBe("locked");
    expect(() => claimSectorNode({ ...colony, sector: { securedNodeIds: ["vesper-vault"], securedRivalNodeIds: [] } }, "hollow-meridian", "attacker", content)).toThrow("Command Tier 3");
  });

  it("migrates v7 saves and rejects disconnected or fabricated sector ownership", () => {
    const colony = createColony("sector-test", content);
    const { sector: _removed, ...legacyState } = colony;
    const payload = { ...legacyState, schemaVersion: 7 };
    const oldSave = JSON.stringify({ schemaVersion: 7, payload, checksum: authoritativeDigest(payload) });
    expect(parseColonySave(oldSave).sector.securedNodeIds).toEqual([]);
    const forged = { ...colony, sector: { securedNodeIds: ["hollow-meridian"], securedRivalNodeIds: [] } };
    expect(() => parseColonySave(serializeColony(forged))).toThrow("invalid sector ownership");
    const disconnected = { ...colony, sector: { securedNodeIds: ["cinder-yard", "shard-cairn"], securedRivalNodeIds: [] } };
    expect(() => parseColonySave(serializeColony(disconnected))).toThrow("invalid sector ownership");
    const overTier = { ...colony, sector: { securedNodeIds: ["cinder-yard", "quiet-orbit"], securedRivalNodeIds: [] } };
    expect(() => parseColonySave(serializeColony(overTier))).toThrow("invalid sector ownership");
  });

  it("opens rival frontiers only through connected relays and limits rival holdings", () => {
    let colony = createColony("sector-test", content);
    expect(getSectorNodeState(colony, "rival-drift", content)).toBe("locked");
    colony = upgradeColonyBuilding(trainUnits(colony, "line_rigger", 3, content), "command-relay-1", content);
    expect(getSectorNodeState(colony, "rival-drift", content)).toBe("rival");
    colony = claimSectorNode(colony, "drift-lode", "attacker", content);
    expect(getSectorNodeState(colony, "rival-drift", content)).toBe("rival-frontier");
    expect(claimRivalSectorNode(colony, "rival-drift", "local-rival-drift", "defender", content)).toEqual(colony);
    expect(() => claimRivalSectorNode(colony, "rival-drift", "other-profile", "attacker", content)).toThrow("different defender");
    const held = claimRivalSectorNode(colony, "rival-drift", "local-rival-drift", "attacker", content);
    expect(held.sector.securedRivalNodeIds).toEqual(["rival-drift"]);
    const overextended = { ...colony, buildings: colony.buildings.map((building) => building.buildingId === "command_relay" ? { ...building, level: 3 } : building), sector: { ...colony.sector, securedRivalNodeIds: ["rival-drift", "rival-ember"] } };
    expect(() => claimRivalSectorNode(overextended, "rival-meridian", "local-rival-meridian", "attacker", content)).toThrow("maximum of two");
  });

  it("grants target salvage once, then removes repeatable rewards after relay capture", () => {
    const colony = createColony("sector-test", content);
    expect(sectorRewardPreview(colony, "cinder-yard", content)).toEqual(content.encounters["cinder-yard"].rewardPreview);
    const held = claimSectorNode(colony, "cinder-yard", "attacker", content);
    expect(sectorRewardPreview(held, "cinder-yard", content)).toEqual({});
    expect(sectorRewardPreview(held, "drift-lode", content)).toEqual(content.encounters["drift-lode"].rewardPreview);
  });
});
