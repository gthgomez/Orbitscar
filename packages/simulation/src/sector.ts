import type { OrbitscarContent } from "@orbitscar/content";
import type { ColonyState } from "./colony.js";

export type SectorNodeKind = "home" | "pve" | "rival";
export type SectorNode = { id: string; name: string; kind: SectorNodeKind; requiredTier: number; neighbors: string[]; encounterId?: string; rivalProfileId?: string };
export type SectorNodeStatus = "home" | "secured" | "frontier" | "rival-frontier" | "locked" | "rival";

// Relay lanes are fixed campaign geography. A defeated command core secures a
// node; holding it only opens connected fronts, so territory cannot compound
// into an unbounded passive power bonus.
export const SECTOR_NODES: readonly SectorNode[] = [
  { id: "home-relay", name: "Home Relay", kind: "home", requiredTier: 1, neighbors: ["cinder-yard", "drift-lode"] },
  { id: "cinder-yard", name: "Cinder Yard", kind: "pve", encounterId: "cinder-yard", requiredTier: 1, neighbors: ["home-relay", "quiet-orbit", "glasswake-gate"] },
  { id: "glass-spine", name: "Glass Spine", kind: "pve", encounterId: "glass-spine", requiredTier: 2, neighbors: ["drift-lode", "quiet-orbit", "salt-spool"] },
  { id: "quiet-orbit", name: "Quiet Orbit", kind: "pve", encounterId: "quiet-orbit", requiredTier: 3, neighbors: ["cinder-yard", "glass-spine", "glasswake-gate"] },
  { id: "drift-lode", name: "Drift Lode", kind: "pve", encounterId: "drift-lode", requiredTier: 1, neighbors: ["home-relay", "glass-spine", "ember-switch"] },
  { id: "glasswake-gate", name: "Glasswake Gate", kind: "pve", encounterId: "glasswake-gate", requiredTier: 1, neighbors: ["cinder-yard", "quiet-orbit", "salt-spool", "shard-cairn"] },
  { id: "ember-switch", name: "Ember Switch", kind: "pve", encounterId: "ember-switch", requiredTier: 2, neighbors: ["drift-lode", "shard-cairn"] },
  { id: "salt-spool", name: "Salt Spool", kind: "pve", encounterId: "salt-spool", requiredTier: 2, neighbors: ["glasswake-gate", "glass-spine", "morrow-gate"] },
  { id: "shard-cairn", name: "Shard Cairn", kind: "pve", encounterId: "shard-cairn", requiredTier: 2, neighbors: ["glasswake-gate", "ember-switch", "morrow-gate", "vesper-vault"] },
  { id: "morrow-gate", name: "Morrow Gate", kind: "pve", encounterId: "morrow-gate", requiredTier: 2, neighbors: ["salt-spool", "shard-cairn", "hollow-meridian"] },
  { id: "vesper-vault", name: "Vesper Vault", kind: "pve", encounterId: "vesper-vault", requiredTier: 3, neighbors: ["shard-cairn", "hollow-meridian"] },
  { id: "hollow-meridian", name: "Hollow Meridian", kind: "pve", encounterId: "hollow-meridian", requiredTier: 3, neighbors: ["morrow-gate", "vesper-vault"] },
  { id: "rival-drift", name: "Rival: Drift Exchange", kind: "rival", rivalProfileId: "local-rival-drift", requiredTier: 2, neighbors: ["drift-lode", "glasswake-gate"] },
  { id: "rival-ember", name: "Rival: Ember Anchorage", kind: "rival", rivalProfileId: "local-rival-ember", requiredTier: 3, neighbors: ["ember-switch", "morrow-gate"] },
  { id: "rival-meridian", name: "Rival: Meridian Hold", kind: "rival", rivalProfileId: "local-rival-meridian", requiredTier: 3, neighbors: ["vesper-vault", "hollow-meridian"] },
];

export function getSectorNodeState(colony: ColonyState, nodeId: string, content: OrbitscarContent): SectorNodeStatus {
  const node = SECTOR_NODES.find((entry) => entry.id === nodeId);
  if (!node) throw new Error(`unknown sector node '${nodeId}'`);
  if (node.kind === "home") return "home";
  if (colony.sector.securedNodeIds.includes(node.id)) return "secured";
  if (node.kind === "rival" && colony.sector.securedRivalNodeIds.includes(node.id)) return "secured";
  const encounter = node.encounterId ? content.encounters[node.encounterId] : undefined;
  const commandTier = Math.min(3, colony.buildings.filter((building) => building.buildingId === "command_relay").reduce((tier, building) => Math.max(tier, building.level), 1));
  if (node.kind === "pve" && (!encounter || Math.max(node.requiredTier, encounter.requiredTier) > commandTier)) return "locked";
  if (node.kind === "rival" && node.requiredTier > commandTier) return "locked";
  const held = new Set(["home-relay", ...colony.sector.securedNodeIds, ...colony.sector.securedRivalNodeIds]);
  if (node.neighbors.some((neighbor) => held.has(neighbor))) return node.kind === "rival" ? "rival-frontier" : "frontier";
  if (node.kind === "rival") return "rival";
  return "locked";
}

export function claimSectorNode(colony: ColonyState, nodeId: string, winner: string, content: OrbitscarContent): ColonyState {
  const node = SECTOR_NODES.find((entry) => entry.id === nodeId);
  if (!node || node.kind !== "pve" || !node.encounterId || !content.encounters[node.encounterId]) throw new Error(`unknown sector node '${nodeId}'`);
  if (winner !== "attacker" || colony.sector.securedNodeIds.includes(node.id)) return colony;
  const commandTier = Math.min(3, colony.buildings.filter((building) => building.buildingId === "command_relay").reduce((tier, building) => Math.max(tier, building.level), 1));
  const requiredTier = Math.max(node.requiredTier, content.encounters[node.encounterId].requiredTier);
  if (requiredTier > commandTier) throw new Error(`sector node '${nodeId}' requires Command Tier ${requiredTier}`);
  const status = getSectorNodeState(colony, nodeId, content);
  if (status !== "frontier") throw new Error(`sector node '${nodeId}' is locked behind a relay lane`);
  return { ...colony, sector: { ...colony.sector, securedNodeIds: [...colony.sector.securedNodeIds, node.id] }, updatedAt: new Date().toISOString() };
}

export function claimRivalSectorNode(colony: ColonyState, nodeId: string, defenderProfileId: string, winner: string, content: OrbitscarContent): ColonyState {
  const node = SECTOR_NODES.find((entry) => entry.id === nodeId && entry.kind === "rival");
  if (!node || !node.rivalProfileId) throw new Error(`unknown rival sector node '${nodeId}'`);
  if (defenderProfileId !== node.rivalProfileId) throw new Error(`rival node '${nodeId}' belongs to a different defender`);
  if (winner !== "attacker" || colony.sector.securedRivalNodeIds.includes(nodeId)) return colony;
  if (node.requiredTier > Math.min(3, colony.buildings.filter((building) => building.buildingId === "command_relay").reduce((tier, building) => Math.max(tier, building.level), 1))) throw new Error(`rival node '${nodeId}' requires Command Tier ${node.requiredTier}`);
  if (colony.sector.securedRivalNodeIds.length >= 2) throw new Error("sector holds a maximum of two rival relays at once");
  if (getSectorNodeState(colony, nodeId, content) !== "rival-frontier") throw new Error(`rival node '${nodeId}' is locked behind a relay lane`);
  return { ...colony, sector: { ...colony.sector, securedRivalNodeIds: [...colony.sector.securedRivalNodeIds, nodeId] }, updatedAt: new Date().toISOString() };
}

export function sectorRewardPreview(colony: ColonyState, encounterId: string, content: OrbitscarContent): Record<string, number> {
  const encounter = content.encounters[encounterId];
  if (!encounter) throw new Error(`unknown campaign target '${encounterId}'`);
  return colony.sector.securedNodeIds.includes(encounterId) ? {} : { ...encounter.rewardPreview };
}
