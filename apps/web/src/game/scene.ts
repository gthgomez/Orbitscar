import Phaser from "phaser";
import type { OrbitscarContent } from "@orbitscar/content";
import type { ColonyState, OrbitscarBattleEvent, OrbitscarBattleResult, OrbitscarPosition } from "@orbitscar/simulation";
import { type GameMode, type ReplayState, type Zone, zonePositions } from "../state/game-session.js";

const ARENA = { width: 1200, height: 800 };
const GRID = 40;
const ART_TEXTURES: Record<string, string> = {
  command_relay: "orbitscar-command-relay",
  matter_extractor: "orbitscar-matter-extractor",
  arc_projector: "orbitscar-arc-projector",
  line_rigger: "orbitscar-line-rigger",
  needle_drone: "orbitscar-needle-drone",
  deployment_marker: "orbitscar-deployment-marker",
};
const ART_PATHS: Record<string, string> = {
  "orbitscar-command-relay": "/art/orbitscar/command-relay.svg",
  "orbitscar-matter-extractor": "/art/orbitscar/matter-extractor.svg",
  "orbitscar-arc-projector": "/art/orbitscar/arc-projector.svg",
  "orbitscar-line-rigger": "/art/orbitscar/line-rigger.svg",
  "orbitscar-needle-drone": "/art/orbitscar/needle-drone.svg",
  "orbitscar-deployment-marker": "/art/orbitscar/deployment-marker.svg",
};
export type SceneBridge = { content: OrbitscarContent; getMode: () => GameMode; getColony: () => ColonyState; getBuildMode: () => string | undefined; getSelectedBuildingId: () => string | undefined; getSelectedZone: () => Zone; getTargetStructures: () => Array<{ id: string; buildingId: string; position: OrbitscarPosition; currentHealth?: number; level?: number }>; getReplay: () => ReplayState | undefined; isReducedMotion: () => boolean; setPreview: (position?: OrbitscarPosition) => void; selectBuilding: (id?: string) => void; selectZone: (zone: Zone) => void; placeBuilding: (position: OrbitscarPosition) => void; onFrame: (now: number) => void };

export class OrbitscarScene extends Phaser.Scene {
  private world!: Phaser.GameObjects.Graphics;
  private bridge!: SceneBridge;
  private dragStart?: { x: number; y: number; scrollX: number; scrollY: number };
  private pinchDistance?: number;
  private preview?: OrbitscarPosition;
  private lastBattleDrawAt = 0;
  private units = new Map<string, { position: OrbitscarPosition; health: number; alive: boolean }>();
  private structureHealth = new Map<string, number>();
  private defenseLocks = new Map<string, string>();
  private artSprites = new Map<string, Phaser.GameObjects.Image>();
  constructor(bridge: SceneBridge) { super("OrbitscarScene"); this.bridge = bridge; }
  preload(): void { for (const [key, path] of Object.entries(ART_PATHS)) this.load.svg(key, path); }
  create(): void {
    this.world = this.add.graphics();
    this.cameras.main.setBounds(0, 0, ARENA.width, ARENA.height);
    this.updateCameraZoom();
    this.input.addPointer(2);
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => { if (this.input.pointer1.isDown && this.input.pointer2.isDown) { this.pinchDistance = this.pointerDistance(); this.dragStart = undefined; return; } const point = this.worldPoint(pointer); this.preview = point; this.bridge.setPreview(point); this.dragStart = { x: pointer.x, y: pointer.y, scrollX: this.cameras.main.scrollX, scrollY: this.cameras.main.scrollY }; });
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => { const point = this.worldPoint(pointer); this.preview = point; this.bridge.setPreview(point); if (this.input.pointer1.isDown && this.input.pointer2.isDown) { const distance = this.pointerDistance(); if (this.pinchDistance && distance > 0) this.cameras.main.setZoom(Phaser.Math.Clamp(this.cameras.main.zoom * (distance / this.pinchDistance), .55, 2)); this.pinchDistance = distance; return; } if (!this.dragStart || !pointer.isDown) return; this.cameras.main.scrollX = this.dragStart.scrollX - (pointer.x - this.dragStart.x) / this.cameras.main.zoom; this.cameras.main.scrollY = this.dragStart.scrollY - (pointer.y - this.dragStart.y) / this.cameras.main.zoom; });
    this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => { const wasTap = this.dragStart !== undefined && Math.abs(pointer.x - this.dragStart.x) < 8 && Math.abs(pointer.y - this.dragStart.y) < 8; const point = this.worldPoint(pointer); this.dragStart = undefined; if (!this.input.pointer1.isDown || !this.input.pointer2.isDown) this.pinchDistance = undefined; if (!wasTap) return; if (this.bridge.getMode() === "colony") this.colonyClick(point); else if (this.bridge.getMode() === "deployment") this.battleClick(point); });
    this.input.on("wheel", (_pointer: Phaser.Input.Pointer, _objects: Phaser.GameObjects.GameObject[], _dx: number, dy: number) => this.cameras.main.setZoom(Phaser.Math.Clamp(this.cameras.main.zoom - dy * .001, .55, 2)));
    this.scale.on("resize", () => this.updateCameraZoom());
    this.draw();
  }
  update(): void { this.bridge.onFrame(performance.now()); const now = performance.now(); if (this.bridge.isReducedMotion() && this.bridge.getMode() === "battle" && now - this.lastBattleDrawAt < 400) return; this.lastBattleDrawAt = now; this.draw(); }
  private worldPoint(pointer: Phaser.Input.Pointer): OrbitscarPosition { const point = this.cameras.main.getWorldPoint(pointer.x, pointer.y); return { x: point.x, y: point.y }; }
  private pointerDistance(): number { return Phaser.Math.Distance.Between(this.input.pointer1.x, this.input.pointer1.y, this.input.pointer2.x, this.input.pointer2.y); }
  private updateCameraZoom(): void { if (this.cameras.main) this.cameras.main.setZoom(Phaser.Math.Clamp(Math.min(this.scale.width / ARENA.width, this.scale.height / ARENA.height), .55, 1.5)); }
  private colonyClick(point: OrbitscarPosition): void { const buildMode = this.bridge.getBuildMode(); if (buildMode) { this.bridge.placeBuilding({ x: Math.round((point.x - 20) / GRID) * GRID, y: Math.round((point.y - 20) / GRID) * GRID }); return; } const colony = this.bridge.getColony(); const hit = [...colony.buildings].reverse().find((building) => { const footprint = this.bridge.content.buildings[building.buildingId].footprint; return point.x >= building.position.x && point.x <= building.position.x + footprint[0] * GRID && point.y >= building.position.y && point.y <= building.position.y + footprint[1] * GRID; }); this.bridge.selectBuilding(hit?.id); }
  private battleClick(point: OrbitscarPosition): void { const hit = (Object.entries(zonePositions) as [Zone, OrbitscarPosition][]).find(([, position]) => Math.abs(point.x - position.x) < 80 && Math.abs(point.y - position.y) < 80); if (hit) this.bridge.selectZone(hit[0]); }
  private applyEvents(events: OrbitscarBattleEvent[], replay: ReplayState): void { this.units.clear(); this.structureHealth.clear(); this.defenseLocks.clear(); for (const structure of replay.input.structures) this.structureHealth.set(structure.id, structure.currentHealth ?? this.bridge.content.buildings[structure.buildingId].maxHealth); for (const event of events) { if (event.type === "defense_aimed" && event.entityId && event.targetId) this.defenseLocks.set(event.entityId, event.targetId); if ((event.type === "defense_lock_lost" || event.type === "defense_destroyed") && event.entityId) this.defenseLocks.delete(event.entityId); if (event.type === "unit_destroyed" && event.entityId) for (const [defenseId, targetId] of this.defenseLocks) if (targetId === event.entityId) this.defenseLocks.delete(defenseId); if (event.entityId?.includes("#")) { const unitId = event.entityId.split("#")[0]; const unit = this.units.get(event.entityId) ?? { position: event.position ?? { x: 0, y: 0 }, health: this.bridge.content.units[unitId].health, alive: true }; if (event.position) unit.position = { ...event.position }; if (event.remainingHealth !== undefined) unit.health = event.remainingHealth; if (event.type === "unit_destroyed") unit.alive = false; this.units.set(event.entityId, unit); } else if (event.entityId && event.remainingHealth !== undefined) this.structureHealth.set(event.entityId, event.remainingHealth); } }
  private draw(): void { if (!this.world) return; for (const sprite of this.artSprites.values()) sprite.setVisible(false); this.world.clear(); this.world.fillStyle(0x09151c, 1).fillRect(0, 0, ARENA.width, ARENA.height); this.world.lineStyle(1, 0x17323c, 1); for (let x = 0; x <= ARENA.width; x += GRID) this.world.lineBetween(x, 0, x, ARENA.height); for (let y = 0; y <= ARENA.height; y += GRID) this.world.lineBetween(0, y, ARENA.width, y); if (this.bridge.getMode() === "colony") this.drawColony(); else this.drawBattle(); }
  private drawArtSprite(instanceId: string, textureKey: string, x: number, y: number, width: number, height: number, alpha = 1): void {
    if (!this.textures.exists(textureKey)) return;
    let sprite = this.artSprites.get(instanceId);
    if (!sprite) {
      sprite = this.add.image(x, y, textureKey);
      this.artSprites.set(instanceId, sprite);
    }
    sprite.setTexture(textureKey).setPosition(x, y).setDisplaySize(width, height).setAlpha(alpha).setVisible(true);
  }
  private drawColony(): void {
    this.world.fillStyle(0x18363d, .65).fillRoundedRect(90, 100, 700, 600, 18);
    const colony = this.bridge.getColony();
    for (const building of colony.buildings) {
      const definition = this.bridge.content.buildings[building.buildingId];
      const w = definition.footprint[0] * GRID;
      const h = definition.footprint[1] * GRID;
      const selected = this.bridge.getSelectedBuildingId() === building.id;
      const color = building.buildingId === "command_relay" ? 0xf2c879 : definition.defenseId ? 0xe07878 : 0x7396a3;
      if (ART_TEXTURES[building.buildingId]) this.world.fillStyle(color, .9).fillRect(building.position.x, building.position.y, w, h);
      else this.drawBuildingSilhouette(building.buildingId, building.position.x + w / 2, building.position.y + h / 2, w, h, color);
      this.world.lineStyle(selected ? 4 : 2, selected ? 0xffffff : 0x0b1115, 1).strokeRect(building.position.x, building.position.y, w, h);
      this.world.fillStyle(0x071017, .7).fillRect(building.position.x, building.position.y + h - 9, w, 9);
      this.world.fillStyle(0x8ee6d1, 1).fillRect(building.position.x, building.position.y + h - 9, w * Math.min(1, building.health / (definition.maxHealth * (1 + (building.level - 1) * .25))), 9);
      const textureKey = ART_TEXTURES[building.buildingId];
      if (textureKey) this.drawArtSprite(`building:${building.id}`, textureKey, building.position.x + w / 2, building.position.y + h / 2 - 4, w * .8, h * .8);
    }
    const selected = colony.buildings.find((building) => building.id === this.bridge.getSelectedBuildingId());
    const selectedDefinition = selected && this.bridge.content.buildings[selected.buildingId];
    const selectedDefense = selectedDefinition?.defenseId && this.bridge.content.defenses[selectedDefinition.defenseId];
    if (selected && selectedDefinition && selectedDefense) {
      const centerX = selected.position.x + selectedDefinition.footprint[0] * GRID / 2;
      const centerY = selected.position.y + selectedDefinition.footprint[1] * GRID / 2;
      const level = 1 + (selected.level - 1) * .05;
      this.world.lineStyle(2, 0xffb5a8, .5).strokeCircle(centerX, centerY, selectedDefense.range * level);
    }
    const buildMode = this.bridge.getBuildMode();
    if (buildMode && this.preview) {
      const definition = this.bridge.content.buildings[buildMode];
      this.world.lineStyle(2, 0x8ee6d1, .9).strokeRect(this.preview.x, this.preview.y, definition.footprint[0] * GRID, definition.footprint[1] * GRID);
    }
  }
  private drawBattle(): void {
    for (const [zone, position] of Object.entries(zonePositions) as [Zone, OrbitscarPosition][]) this.drawZone(zone, position);
    const replay = this.bridge.getReplay();
    if (replay) this.applyEvents(replay.result.events.slice(0, replay.eventIndex), replay);
    const structures = replay?.input.structures ?? this.bridge.getTargetStructures();
    for (const structure of structures) this.drawStructure(structure);
    if (replay) {
      for (const [id, unit] of this.units) {
        if (!unit.alive) continue;
        const unitId = id.split("#")[0];
        const textureKey = ART_TEXTURES[unitId];
        if (textureKey) this.drawArtSprite(`unit:${id}`, textureKey, unit.position.x, unit.position.y, 28, 28);
        else this.drawUnitSilhouette(unitId, unit.position);
      }
      for (const [defenseId, targetId] of this.defenseLocks) {
        const structure = structures.find((entry) => entry.id === defenseId);
        const target = this.units.get(targetId);
        if (!structure || !target?.alive) continue;
        const definition = this.bridge.content.buildings[structure.buildingId];
        const x = structure.position.x + definition.footprint[0] * GRID / 2;
        const y = structure.position.y + definition.footprint[1] * GRID / 2;
        this.world.lineStyle(2, 0xffb45f, .9).lineBetween(x, y, target.position.x, target.position.y);
        this.world.fillStyle(0xffb45f, .95).fillCircle(target.position.x, target.position.y, 5);
      }
    }
  }
  private drawBuildingSilhouette(buildingId: string, x: number, y: number, width: number, height: number, color: number): void {
    const halfW = width * .34;
    const halfH = height * .34;
    this.world.fillStyle(color, .95);
    this.world.lineStyle(2, 0x0b1115, .95);
    if (buildingId === "scatter_coil") {
      this.world.fillCircle(x, y, Math.min(width, height) * .22);
      this.world.strokeCircle(x, y, Math.min(width, height) * .38);
      this.world.lineBetween(x - halfW, y, x + halfW, y);
      this.world.lineBetween(x, y - halfH, x, y + halfH);
    } else if (buildingId === "snare_lattice") {
      this.world.fillTriangle(x, y - halfH, x + halfW, y, x, y + halfH);
      this.world.fillTriangle(x, y - halfH, x - halfW, y, x, y + halfH);
      this.world.lineStyle(2, 0x8ee6d1, .9).lineBetween(x - halfW * .6, y, x + halfW * .6, y);
    } else if (buildingId === "drop_cradle") {
      this.world.strokeRect(x - halfW, y - halfH * .65, halfW * 2, halfH * 1.3);
      this.world.fillRect(x - halfW * .62, y - halfH * .35, halfW * 1.24, halfH * .7);
      this.world.lineStyle(3, 0xf2c879, .9).lineBetween(x - halfW * .8, y + halfH, x + halfW * .8, y + halfH);
    } else this.world.fillRoundedRect(x - halfW, y - halfH, halfW * 2, halfH * 2, 5);
  }
  private drawUnitSilhouette(unitId: string, position: OrbitscarPosition): void {
    const { x, y } = position;
    const palette: Record<string, number> = { pulse_marksman: 0x9bb7ff, breach_medic: 0x8ee6d1, signal_saboteur: 0xc491d3, ram_walker: 0xf2c879, skirmish_walker: 0x76c9e9, shield_carrier: 0x89a9ca, salvage_hauler: 0xe4a966, relay_drone: 0x86edbf };
    const color = palette[unitId] ?? 0x9bb7ff;
    this.world.fillStyle(color, 1);
    this.world.lineStyle(2, 0x071017, 1);
    if (unitId === "pulse_marksman") {
      this.world.fillRoundedRect(x - 5, y - 8, 10, 16, 3);
      this.world.lineStyle(3, 0xd7e0ff, 1).lineBetween(x + 3, y - 5, x + 12, y - 8);
    } else if (unitId === "breach_medic") {
      this.world.fillRoundedRect(x - 8, y - 7, 16, 14, 3);
      this.world.fillStyle(0x0b1c24, 1).fillRect(x - 2, y - 5, 4, 10).fillRect(x - 5, y - 2, 10, 4);
    } else if (unitId === "signal_saboteur") {
      this.world.fillTriangle(x, y - 10, x + 9, y + 7, x - 9, y + 7);
      this.world.lineStyle(2, 0xe7ceff, 1).lineBetween(x, y - 9, x + 5, y - 15);
    } else if (unitId === "ram_walker") {
      this.world.fillTriangle(x + 10, y, x - 6, y - 8, x - 6, y + 8);
      this.world.lineStyle(2, 0x3b2b15, 1).lineBetween(x - 5, y - 6, x - 10, y - 11).lineBetween(x - 5, y + 6, x - 10, y + 11);
    } else if (unitId === "skirmish_walker") {
      this.world.fillTriangle(x + 10, y, x - 8, y - 7, x - 5, y + 7);
      this.world.lineStyle(2, 0x071017, 1).lineBetween(x - 5, y - 6, x - 11, y - 10).lineBetween(x - 5, y + 6, x - 11, y + 10);
    } else if (unitId === "shield_carrier") {
      this.world.fillCircle(x, y, 6);
      this.world.lineStyle(3, 0xa9d2ff, .9).strokeCircle(x, y, 11);
    } else if (unitId === "salvage_hauler") {
      this.world.fillRoundedRect(x - 10, y - 6, 20, 12, 3);
      this.world.fillStyle(0xf2c879, 1).fillRect(x - 3, y - 11, 9, 5);
    } else if (unitId === "relay_drone") {
      this.world.strokeCircle(x, y, 9);
      this.world.fillCircle(x, y, 3);
      this.world.lineBetween(x - 12, y, x + 12, y);
    } else this.world.fillCircle(x, y, 8);
  }
  private drawZone(zone: Zone, position: OrbitscarPosition): void {
    const mode = this.bridge.getMode();
    const selected = zone === (mode === "deployment" || mode === "battle" ? this.bridge.getSelectedZone() : this.bridge.getReplay()?.input.commands.find((command) => command.type === "DEPLOY")?.payload.zone);
    this.world.fillStyle(selected ? 0x1d796e : 0x16414a, selected ? .35 : .18).fillRect(position.x - 70, position.y - 70, 140, 140);
    this.world.lineStyle(2, selected ? 0x8ee6d1 : 0x32606b, .8).strokeRect(position.x - 70, position.y - 70, 140, 140);
    if (selected) this.drawArtSprite(`approach:${zone}`, ART_TEXTURES.deployment_marker, position.x, position.y, 100, 100, .8);
  }
  // maxHealth always comes from the content definition; the caller passes the
  // structure record so current damage can never be mistaken for the maximum.
  private drawStructure(structure: { id: string; buildingId: string; position: OrbitscarPosition; currentHealth?: number; level?: number }): void { const building = this.bridge.content.buildings[structure.buildingId]; const maxHealth = building.maxHealth; const health = this.structureHealth.get(structure.id) ?? structure.currentHealth ?? maxHealth; const defenseId = building.defenseId; const defense = defenseId ? this.bridge.content.defenses[defenseId] : undefined; const effectiveRange = defense ? defense.range * (1 + ((structure.level ?? 1) - 1) * .05) : 0; if (health > 0 && defense) this.world.lineStyle(1, 0xe07878, .22).strokeCircle(structure.position.x, structure.position.y, effectiveRange); const color = structure.buildingId === "command_relay" ? 0xf2c879 : defenseId ? 0xe07878 : 0x7396a3; this.world.fillStyle(health > 0 ? color : 0x35454b, 1).fillRect(structure.position.x - 18, structure.position.y - 18, 36, 36); this.world.lineStyle(1, 0x0b1115, 1).strokeRect(structure.position.x - 18, structure.position.y - 18, 36, 36); this.world.fillStyle(0x071017, .75).fillRect(structure.position.x - 22, structure.position.y + 25, 44, 5); this.world.fillStyle(0x8ee6d1, 1).fillRect(structure.position.x - 22, structure.position.y + 25, 44 * Math.max(0, Math.min(1, health / maxHealth)), 5); const textureKey = ART_TEXTURES[structure.buildingId]; if (health > 0 && textureKey) this.drawArtSprite(`structure:${structure.id}`, textureKey, structure.position.x, structure.position.y - 7, 42, 42); }
}

export { ARENA };
