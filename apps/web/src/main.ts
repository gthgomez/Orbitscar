import Phaser from "phaser";
import balance from "@orbitscar/content/data/orbitscar-v0/balance.json" with { type: "json" };
import { parseOrbitscarContent } from "@orbitscar/content";
import { resolveOrbitscarBattle, type OrbitscarBattleEvent, type OrbitscarBattleInput, type OrbitscarBattleResult, type OrbitscarCommand, type OrbitscarPosition } from "@orbitscar/simulation";
import { createColony, parseColonySave, serializeColony, trainUnits, type ColonyState } from "@orbitscar/simulation";
import "./style.css";

const content = parseOrbitscarContent(balance);
const ARENA = { width: 1200, height: 800 };
type ScenarioName = "frontal" | "flank" | "delayed";
type Zone = "west" | "north" | "south" | "east";

const zonePosition: Record<Zone, OrbitscarPosition> = { west: { x: 120, y: 400 }, north: { x: 420, y: 90 }, south: { x: 420, y: 710 }, east: { x: 1080, y: 400 } };
const structures = [
  { id: "relay", buildingId: "command_relay", position: { x: 930, y: 400 } },
  { id: "extractor", buildingId: "matter_extractor", position: { x: 760, y: 240 } },
  { id: "cradle", buildingId: "drop_cradle", position: { x: 760, y: 560 } },
  { id: "arc", buildingId: "arc_projector", position: { x: 640, y: 300 } },
  { id: "scatter", buildingId: "scatter_coil", position: { x: 690, y: 520 } },
  { id: "snare", buildingId: "snare_lattice", position: { x: 830, y: 400 } },
];
const army = [{ unitId: "line_rigger", count: 3 }, { unitId: "pulse_marksman", count: 2 }, { unitId: "ram_walker", count: 2 }, { unitId: "needle_drone", count: 1 }];

const colonyStorageKey = "orbitscar_colony_v1";
let colony: ColonyState;
try { const saved = window.localStorage.getItem(colonyStorageKey); colony = saved === null ? createColony("local-player", content) : parseColonySave(saved); } catch { colony = createColony("local-player", content); }
function renderColony(message = ""): void { const resources = document.querySelector<HTMLDivElement>("#colony-resources"); const reserves = document.querySelector<HTMLDivElement>("#colony-reserves"); const status = document.querySelector<HTMLDivElement>("#colony-message"); if (resources) resources.textContent = `RESOURCES  alloy ${Math.floor(colony.resources.alloy ?? 0)}  volatile ${Math.floor(colony.resources.volatile ?? 0)}  signal ${Math.floor(colony.resources.signal ?? 0)}`; if (reserves) reserves.textContent = `RESERVES  ${Object.entries(colony.reserves).filter(([, count]) => count > 0).map(([id, count]) => `${id}:${count}`).join("  ") || "empty"}  • reports ${colony.reports.length}`; if (status) status.textContent = message; }
function saveColony(): void { try { window.localStorage.setItem(colonyStorageKey, serializeColony(colony)); renderColony("saved locally"); } catch { renderColony("local save unavailable"); } }

function deployment(commandId: string, sequence: number, tick: number, zone: Zone, units: { unitId: string; count: number }[]): OrbitscarCommand {
  return { commandId, sequence, tick, type: "DEPLOY", payload: { zone, position: { ...zonePosition[zone] }, units } };
}

function makeInput(name: ScenarioName, selectedZone: Zone, abilityNow = false): OrbitscarBattleInput {
  const fallback = zonePosition[selectedZone];
  let commands: OrbitscarCommand[];
  if (name === "frontal") commands = [deployment("frontal", 10, 0, selectedZone, [{ unitId: "line_rigger", count: 2 }, { unitId: "ram_walker", count: 1 }]), { commandId: "frontal-ability", sequence: 20, tick: 210, type: "COMMANDER_ABILITY", payload: { abilityId: "emergency_reroute", targetStructureId: "arc" } }, deployment("frontal-reinforce", 30, 420, selectedZone, [{ unitId: "pulse_marksman", count: 2 }, { unitId: "needle_drone", count: 1 }]), deployment("frontal-last", 40, 720, selectedZone, [{ unitId: "line_rigger", count: 1 }, { unitId: "ram_walker", count: 1 }])];
  else if (name === "flank") commands = [deployment("flank", 10, 0, selectedZone === "west" ? "north" : selectedZone, [{ unitId: "line_rigger", count: 2 }, { unitId: "ram_walker", count: 1 }]), deployment("flank-reinforce", 20, 360, "south", [{ unitId: "pulse_marksman", count: 2 }, { unitId: "needle_drone", count: 1 }]), { commandId: "flank-ability", sequence: 30, tick: 720, type: "COMMANDER_ABILITY", payload: { abilityId: "emergency_reroute", targetStructureId: "relay" } }, deployment("flank-last", 40, 840, "south", [{ unitId: "line_rigger", count: 1 }, { unitId: "ram_walker", count: 1 }])];
  else commands = [deployment("delayed-first", 10, 0, selectedZone, [{ unitId: "line_rigger", count: 3 }]), deployment("delayed-second", 20, 900, "south", [{ unitId: "pulse_marksman", count: 2 }, { unitId: "ram_walker", count: 2 }, { unitId: "needle_drone", count: 1 }]), { commandId: "delayed-ability", sequence: 30, tick: 960, type: "COMMANDER_ABILITY", payload: { abilityId: "emergency_reroute", targetStructureId: "snare" } }];
  const first = commands[0];
  if (first.type === "DEPLOY" && selectedZone !== first.payload.zone) first.payload.position = { ...fallback };
  if (abilityNow) { const ability = commands.find((command) => command.type === "COMMANDER_ABILITY"); if (ability && ability.type === "COMMANDER_ABILITY") ability.tick = 0; }
  return { canonicalFormatVersion: 2, rulesetVersion: content.rulesetVersion, seed: name === "flank" ? 29 : 17, maxDurationTicks: 2400, arena: ARENA, deploymentCapacity: 10, maxDeploymentCharges: 3, commanderId: "mara_voss", army, structures, commands, content };
}

type UnitView = { position: OrbitscarPosition; health: number; alive: boolean; target?: string };

class BreachScene extends Phaser.Scene {
  private scenario: ScenarioName = "frontal";
  private zone: Zone = "west";
  private result?: OrbitscarBattleResult;
  private elapsed = 0;
  private eventIndex = 0;
  private simTicks = 0;
  private frameDelta = 0;
  private showDebug = true;
  private abilityNow = false;
  private selectedEntity?: string;
  private units = new Map<string, UnitView>();
  private structureHealth = new Map<string, number>();
  private structureLabels = new Map<string, Phaser.GameObjects.Text>();
  private world!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Text;
  private eventText!: Phaser.GameObjects.Text;
  private scenarioText!: Phaser.GameObjects.Text;
  private zoneTexts = new Map<Zone, Phaser.GameObjects.Text>();
  private dragStart?: { x: number; y: number; cameraX: number; cameraY: number };
  private pinchDistance?: number;

  constructor() { super("BreachScene"); }

  create(): void {
    renderColony("new colony ready");
    document.querySelector<HTMLButtonElement>("#train-line")?.addEventListener("click", () => { try { colony = trainUnits(colony, "line_rigger", 1, content); renderColony("line rigger added to reserves"); } catch (error) { renderColony(error instanceof Error ? error.message : "training failed"); } });
    document.querySelector<HTMLButtonElement>("#save-colony")?.addEventListener("click", saveColony);
    this.cameras.main.setBounds(0, 0, ARENA.width, ARENA.height);
    this.cameras.main.setZoom(Math.min(this.scale.width / 1280, this.scale.height / 860));
    this.world = this.add.graphics();
    this.hud = this.add.text(18, 16, "", { color: "#dce8ee", fontFamily: "monospace", fontSize: "14px", backgroundColor: "#081018cc", padding: { x: 10, y: 8 } }).setScrollFactor(0).setDepth(20);
    this.scenarioText = this.add.text(18, 88, "", { color: "#8ee6d1", fontFamily: "monospace", fontSize: "13px", backgroundColor: "#081018cc", padding: { x: 8, y: 6 } }).setScrollFactor(0).setDepth(20);
    this.eventText = this.add.text(18, 122, "", { color: "#b8c8cf", fontFamily: "monospace", fontSize: "11px", backgroundColor: "#081018aa", padding: { x: 8, y: 6 } }).setScrollFactor(0).setDepth(20);
    this.createButton("FRONTAL", 18, 172, () => { this.scenario = "frontal"; this.restart(); });
    this.createButton("FLANK", 112, 172, () => { this.scenario = "flank"; this.restart(); });
    this.createButton("DELAYED", 188, 172, () => { this.scenario = "delayed"; this.restart(); });
    this.createButton("RESTART", 286, 172, () => this.restart());
    this.createButton("DEBUG [D]", 386, 172, () => { this.showDebug = !this.showDebug; });
    this.createButton("ABILITY NOW", 490, 172, () => { this.abilityNow = true; this.restart(); });
    for (const [index, zone] of (["west", "north", "south", "east"] as Zone[]).entries()) this.createZoneButton(zone, 18 + index * 88, 212);
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => { const pointers = [this.input.pointer1, this.input.pointer2].filter((candidate): candidate is Phaser.Input.Pointer => candidate !== undefined && candidate.isDown); if (pointers.length === 2) this.pinchDistance = Phaser.Math.Distance.Between(pointers[0].x, pointers[0].y, pointers[1].x, pointers[1].y); this.dragStart = { x: pointer.x, y: pointer.y, cameraX: this.cameras.main.scrollX, cameraY: this.cameras.main.scrollY }; const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y); const candidates = [...structures.map((structure) => ({ id: structure.id, position: structure.position })), ...Array.from(this.units.entries()).map(([id, unit]) => ({ id, position: unit.position }))]; this.selectedEntity = candidates.sort((a, b) => Phaser.Math.Distance.Between(worldPoint.x, worldPoint.y, a.position.x, a.position.y) - Phaser.Math.Distance.Between(worldPoint.x, worldPoint.y, b.position.x, b.position.y))[0]?.id; });
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => { const pointers = [this.input.pointer1, this.input.pointer2].filter((candidate): candidate is Phaser.Input.Pointer => candidate !== undefined && candidate.isDown); if (pointers.length === 2 && this.pinchDistance !== undefined) { const distance = Phaser.Math.Distance.Between(pointers[0].x, pointers[0].y, pointers[1].x, pointers[1].y); this.cameras.main.setZoom(Phaser.Math.Clamp(this.cameras.main.zoom * (distance / this.pinchDistance), 0.55, 1.5)); this.pinchDistance = distance; return; } if (this.dragStart && pointer.isDown && Math.abs(pointer.x - this.dragStart.x) + Math.abs(pointer.y - this.dragStart.y) > 8) { this.cameras.main.scrollX = this.dragStart.cameraX - (pointer.x - this.dragStart.x) / this.cameras.main.zoom; this.cameras.main.scrollY = this.dragStart.cameraY - (pointer.y - this.dragStart.y) / this.cameras.main.zoom; } });
    this.input.on("pointerup", () => { this.dragStart = undefined; this.pinchDistance = undefined; });
    this.input.on("wheel", (_pointer: Phaser.Input.Pointer, _gameObjects: Phaser.GameObjects.GameObject[], _dx: number, dy: number) => { this.cameras.main.setZoom(Phaser.Math.Clamp(this.cameras.main.zoom - dy * 0.001, 0.55, 1.5)); });
    this.input.keyboard?.on("keydown-D", () => { this.showDebug = !this.showDebug; });
    this.input.keyboard?.on("keydown-R", () => this.restart());
    this.restart();
  }

  private createButton(label: string, x: number, y: number, action: () => void): void { this.add.text(x, y, label, { color: "#e7f5f2", backgroundColor: "#16303b", fontFamily: "monospace", fontSize: "12px", padding: { x: 8, y: 6 } }).setScrollFactor(0).setDepth(21).setInteractive({ useHandCursor: true }).on("pointerdown", action); }
  private createZoneButton(zone: Zone, x: number, y: number): void { const text = this.add.text(x, y, zone.toUpperCase(), { color: "#b8c8cf", backgroundColor: "#10242d", fontFamily: "monospace", fontSize: "11px", padding: { x: 7, y: 5 } }).setScrollFactor(0).setDepth(21).setInteractive({ useHandCursor: true }).on("pointerdown", () => { this.zone = zone; this.restart(); }); this.zoneTexts.set(zone, text); }

  private restart(): void {
    this.result = resolveOrbitscarBattle(makeInput(this.scenario, this.zone, this.abilityNow)); this.elapsed = 0; this.eventIndex = 0; this.simTicks = 0; this.units.clear(); this.structureHealth.clear(); for (const structure of structures) this.structureHealth.set(structure.id, content.buildings[structure.buildingId].maxHealth); this.eventText.setText(`AUTHORITY: local simulation • outcome ${this.result.outcomeHash.slice(0, 12)}…`); this.scenarioText.setText(`SCENARIO ${this.scenario.toUpperCase()}  •  deploy ${this.zone.toUpperCase()}  •  click a unit/structure`); this.draw(); }

  update(_time: number, delta: number): void { if (!this.result) return; this.frameDelta = delta; this.elapsed = Math.min(this.result.durationTicks / 30 * 1000, this.elapsed + delta); this.simTicks = Math.floor(this.elapsed / 1000 * 30); while (this.eventIndex < this.result.events.length && this.result.events[this.eventIndex].tick <= this.simTicks) this.applyEvent(this.result.events[this.eventIndex++]); this.draw(); }
  private applyEvent(event: OrbitscarBattleEvent): void { if (event.entityId?.includes("#")) { const current = this.units.get(event.entityId) ?? { position: event.position ?? { x: 0, y: 0 }, health: content.units[event.entityId.split("#")[0]].health, alive: true }; if (event.position) current.position = { ...event.position }; if (event.remainingHealth !== undefined) current.health = event.remainingHealth; if (event.type === "unit_destroyed") current.alive = false; if (event.targetId && event.type === "unit_moved") current.target = event.targetId; this.units.set(event.entityId, current); } else if (event.entityId && event.remainingHealth !== undefined) this.structureHealth.set(event.entityId, event.remainingHealth); }

  private draw(): void {
    this.world.clear(); this.world.fillStyle(0x09151c, 1).fillRect(0, 0, ARENA.width, ARENA.height); this.world.lineStyle(1, 0x17323c, 1); for (let x = 0; x <= ARENA.width; x += 40) this.world.lineBetween(x, 0, x, ARENA.height); for (let y = 0; y <= ARENA.height; y += 40) this.world.lineBetween(0, y, ARENA.width, y);
    for (const [zone, position] of Object.entries(zonePosition) as [Zone, OrbitscarPosition][]) { const selected = zone === this.zone; this.world.fillStyle(selected ? 0x1d796e : 0x16414a, selected ? 0.28 : 0.16).fillRect(position.x - 70, position.y - 70, 140, 140); this.world.lineStyle(2, selected ? 0x8ee6d1 : 0x32606b, 0.7).strokeRect(position.x - 70, position.y - 70, 140, 140); }
    for (const structure of structures) { const health = this.structureHealth.get(structure.id) ?? 0; const building = content.buildings[structure.buildingId]; const color = structure.buildingId === "command_relay" ? 0xf2c879 : building.defenseId ? 0xe07878 : 0x7396a3; this.world.fillStyle(health > 0 ? color : 0x35454b, 1).fillRect(structure.position.x - 18, structure.position.y - 18, 36, 36); this.world.lineStyle(this.selectedEntity === structure.id ? 3 : 1, this.selectedEntity === structure.id ? 0xffffff : 0x0b1115, 1).strokeRect(structure.position.x - 18, structure.position.y - 18, 36, 36); this.addWorldLabel(structure.id, structure.position.x - 22, structure.position.y + 24, health, building.maxHealth); if (this.showDebug && building.defenseId) { const weapon = content.defenses[building.defenseId]; this.world.lineStyle(1, 0xe07878, 0.18).strokeCircle(structure.position.x, structure.position.y, weapon.range); } }
    for (const [id, unit] of this.units) { if (!unit.alive) continue; const color = id.startsWith("ram_walker") ? 0xf2c879 : id.startsWith("needle_drone") ? 0x8ee6d1 : 0x9bb7ff; this.world.fillStyle(color, 1).fillCircle(unit.position.x, unit.position.y, 9); this.world.lineStyle(this.selectedEntity === id ? 3 : 1, this.selectedEntity === id ? 0xffffff : 0x071017, 1).strokeCircle(unit.position.x, unit.position.y, 12); if (this.showDebug && unit.target) this.world.lineBetween(unit.position.x, unit.position.y, structures.find((structure) => structure.id === unit.target)?.position.x ?? unit.position.x, structures.find((structure) => structure.id === unit.target)?.position.y ?? unit.position.y); }
    const fps = this.game.loop.actualFps || 0; const entityCount = this.units.size + structures.length; const status = this.result ? `${this.result.winner.toUpperCase()} / ${this.result.victoryTier.toUpperCase()}` : "READY"; const selectedUnitId = this.selectedEntity?.includes("#") ? this.selectedEntity.split("#")[0] : undefined; const selectedText = selectedUnitId && content.units[selectedUnitId] ? `${selectedUnitId} priority ${content.units[selectedUnitId].targetPriority.map((rule) => rule.selector === "tag" ? rule.tag : rule.selector).join(">")}` : this.selectedEntity ? `${this.selectedEntity} structure` : "none"; this.hud.setText(`ORBITSCAR // BREACH LAB\n${status}   t=${this.simTicks}/${this.result?.durationTicks ?? 0}   reserves ${this.result?.survivingUnits ? Object.values(this.result.survivingUnits).reduce((a, b) => a + b, 0) : 0}\nFPS ${fps.toFixed(0)}  sim 30t/s  frame ${this.frameDelta.toFixed(1)}ms\nentities ${entityCount}  events ${this.result?.eventCount ?? 0}  zoom ${this.cameras.main.zoom.toFixed(2)}\nselected ${selectedText}`); for (const [zone, text] of this.zoneTexts) text.setStyle({ color: zone === this.zone ? "#8ee6d1" : "#b8c8cf" });
  }

  private addWorldLabel(id: string, x: number, y: number, health: number, maxHealth: number): void { const label = this.structureLabels.get(id) ?? this.add.text(0, 0, "", { color: "#b8c8cf", fontFamily: "monospace", fontSize: "10px", align: "center" }).setOrigin(0, 0).setDepth(2); label.setPosition(x, y).setText(`${id}\n${Math.max(0, Math.round(health))}/${maxHealth}`); this.structureLabels.set(id, label); }
}

new Phaser.Game({ type: Phaser.AUTO, parent: "game", backgroundColor: "#081018", scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH, width: 1280, height: 860 }, input: { activePointers: 3 }, scene: BreachScene });
