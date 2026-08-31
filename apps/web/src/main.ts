import Phaser from "phaser";
import balance from "@orbitscar/content/data/orbitscar-v0/balance.json" with { type: "json" };
import { parseOrbitscarContent, type OrbitscarEncounterDefinition, type OrbitscarResourceBundle } from "@orbitscar/content";
import { applyBattleResult, advanceColony, createColony, parseColonySave, placeColonyBuilding, serializeColony, trainUnits, upgradeColonyBuilding, type ColonyState } from "@orbitscar/simulation";
import { resolveOrbitscarBattle, type OrbitscarArmyEntry, type OrbitscarBattleEvent, type OrbitscarBattleInput, type OrbitscarBattleResult, type OrbitscarPosition } from "@orbitscar/simulation";
import "./style.css";

const content = parseOrbitscarContent(balance);
const ARENA = { width: 1200, height: 800 };
const GRID = 40;
const storageKey = "orbitscar_colony_v2";
const legacyStorageKey = "orbitscar_colony_v1";
type Mode = "colony" | "targets" | "army" | "battle" | "report";
type Zone = "west" | "north" | "south" | "east";
type Wave = { zone: Zone; units: OrbitscarArmyEntry[] };
type ReplayState = { input: OrbitscarBattleInput; result: OrbitscarBattleResult; startedAt: number; eventIndex: number; done: boolean };
const zonePositions: Record<Zone, OrbitscarPosition> = { west: { x: 120, y: 400 }, north: { x: 420, y: 90 }, south: { x: 420, y: 710 }, east: { x: 1080, y: 400 } };

let mode: Mode = "colony";
let colony = loadColony();
let notice = "Local colony authority online.";
let selectedTarget: OrbitscarEncounterDefinition = Object.values(content.encounters)[0];
let selectedArmy: Record<string, number> = {};
let waveDraft: Record<string, number> = {};
let selectedZone: Zone = "west";
let waves: Wave[] = [];
let abilityArmed = false;
let buildMode: string | undefined;
let selectedBuildingId: string | undefined;
let replay: ReplayState | undefined;
let lastUiReplayTick = -1;

function loadColony(): ColonyState {
  try {
    const saved = window.localStorage.getItem(storageKey) ?? window.localStorage.getItem(legacyStorageKey);
    return saved === null ? createColony("local-player", content) : parseColonySave(saved);
  } catch {
    return createColony("local-player", content);
  }
}

function saveColony(message = "Colony saved locally."): void {
  try { window.localStorage.setItem(storageKey, serializeColony(colony)); notice = message; }
  catch { notice = "Local save unavailable; this session is still playable."; }
  renderApp();
}
function setNotice(message: string): void { notice = message; renderApp(); }
function setMode(next: Mode): void { mode = next; buildMode = undefined; selectedBuildingId = undefined; renderApp(); }
function displayName(id: string): string { return id.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function bundleText(bundle: OrbitscarResourceBundle): string { return Object.entries(bundle).map(([id, value]) => `${displayName(id)} ${value}`).join(" · "); }
function button(label: string, action: string, className = ""): string { return `<button type="button" class="${className}" data-action="${action}">${label}</button>`; }
function capacityOf(entries: Record<string, number>): number { return Object.entries(entries).reduce((total, [unitId, count]) => total + count * (content.units[unitId]?.capacity ?? 0), 0); }
function available(unitId: string): number { return colony.reserves[unitId] ?? 0; }
function resourcesHtml(): string { return `<div class="resource-strip">${Object.entries(colony.resources).map(([id, value]) => `<div class="resource"><strong>${Math.floor(value)}</strong><span>${displayName(id)}</span></div>`).join("")}</div>`; }
function stagedCount(unitId: string): number { return waves.reduce((total, wave) => total + (wave.units.find((entry) => entry.unitId === unitId)?.count ?? 0), 0); }
function reportLoot(result: OrbitscarBattleResult): string { return Object.keys(result.loot).length === 0 ? "No salvage recovered." : bundleText(result.loot); }

function renderColony(): string {
  const selected = selectedBuildingId === undefined ? undefined : colony.buildings.find((building) => building.id === selectedBuildingId);
  return `<h1>Home colony</h1><p class="eyebrow">Landing plinth // persistent local authority</p>${resourcesHtml()}<div class="row"><span class="muted">Reserves</span><strong>${Object.values(colony.reserves).reduce((total, count) => total + count, 0)} units</strong></div><div class="actions">${button("Collect cycle", "collect")} ${button("Save colony", "save", "primary")} ${button("Choose target", "targets", "primary")}</div><div class="notice" role="status">${notice}</div><h2>Construction</h2><p>Select a module, then tap the plinth to place it. Existing modules can be selected and upgraded.</p><div class="card-grid">${Object.values(content.buildings).map((building) => `<div class="card ${buildMode === building.id ? "selected" : ""}"><h3>${displayName(building.id)}</h3><div class="meta">${building.footprint.join("×")} grid · ${building.maxHealth} integrity</div><p>${bundleText(building.cost)}</p>${button(buildMode === building.id ? "Placing…" : "Place module", `build:${building.id}`)}</div>`).join("")}</div><h2>Installed modules</h2><div class="stack">${colony.buildings.map((building) => { const definition = content.buildings[building.buildingId]; const maxHealth = definition.maxHealth * (1 + (building.level - 1) * .25); return `<div class="card"><div class="row"><div><h3>${displayName(building.buildingId)}</h3><div class="meta">${building.id} · level ${building.level} · ${Math.round(building.health)} integrity</div></div>${button("Upgrade", `upgrade:${building.id}`)}</div><div class="meter"><i style="width:${Math.min(100, building.health / maxHealth * 100)}%"></i></div></div>`; }).join("")}</div>${selected ? `<div class="notice">Selected ${displayName(selected.buildingId)}. Upgrade from this panel.</div>` : ""}<h2>Training bay</h2><div class="card-grid">${Object.values(content.units).map((unit) => `<div class="card"><h3>${displayName(unit.id)}</h3><div class="meta">${displayName(unit.role)} · capacity ${unit.capacity} · ${available(unit.id)} owned</div><p>${bundleText(unit.cost)}</p>${button("Train 1", `train:${unit.id}`)}</div>`).join("")}</div><p class="footer-help">Drag the colony view to pan · wheel or pinch to zoom · save to persist a local snapshot.</p>`;
}

function renderTargets(): string {
  return `<h1>Sector targets</h1><p>Scout an authored relay snapshot before committing reserves. Layout, fire lanes, and reward are visible here; combat resolves from the signed simulation input.</p><div class="card-grid">${Object.values(content.encounters).map((target) => `<div class="card ${target.id === selectedTarget.id ? "selected" : ""}"><div class="row"><h3>${target.name}</h3><span class="pill">${target.difficulty}</span></div><div class="meta">${target.codename} · ${target.structures.length} structures</div><p>${target.description}</p><p class="meta">Reward preview: ${bundleText(target.rewardPreview)}</p>${button(target.id === selectedTarget.id ? "Scouted" : "Scout target", `scout:${target.id}`, target.id === selectedTarget.id ? "primary" : "")}</div>`).join("")}</div><div class="actions">${button("Compose attacking force", "army", "primary")} ${button("Back to colony", "colony")}</div>`;
}

function renderArmy(): string {
  const capacity = capacityOf(selectedArmy);
  return `<h1>Compose breach force</h1><p>Choose from persistent reserves. Every unit consumes deployment capacity; the resolver rejects over-capacity or duplicated reserve use.</p><div class="row"><span class="muted">Target</span><strong>${selectedTarget.name}</strong></div><div class="row"><span class="muted">Capacity</span><strong>${capacity} / 10</strong></div><div class="meter"><i style="width:${Math.min(100, capacity * 10)}%"></i></div><div class="stack" style="margin-top:12px">${Object.values(content.units).map((unit) => { const count = selectedArmy[unit.id] ?? 0; return `<div class="card"><div class="row"><div><h3>${displayName(unit.id)}</h3><div class="meta">${displayName(unit.role)} · ${available(unit.id)} reserve · ${unit.capacity} capacity each</div></div><div class="quantity">${button("−", `army:-:${unit.id}`)}<output>${count}</output>${button("+", `army:+:${unit.id}`)}</div></div></div>`; }).join("")}</div><div class="actions">${button("Back to targets", "targets")} ${button("Begin deployment", "begin-battle", "primary")}</div><div class="notice">${notice}</div>`;
}

function renderBattle(): string {
  if (replay !== undefined) {
    const progress = Math.min(100, replay.result.durationTicks === 0 ? 100 : Math.max(0, lastUiReplayTick) / replay.result.durationTicks * 100);
    const latest = replay.result.events[Math.max(0, replay.eventIndex - 1)];
    return `<h1>Autonomous breach</h1><p>${selectedTarget.name} · the plan is locked. Watch the signed event stream resolve at simulation speed.</p><div class="meter"><i style="width:${progress}%"></i></div><p class="meta">${latest ? `Tick ${latest.tick}: ${displayName(latest.type)}${latest.entityId ? ` · ${latest.entityId}` : ""}` : "Deployment staged."}</p><div class="event-log">${replay.result.events.slice(Math.max(0, replay.eventIndex - 9), replay.eventIndex).map((event) => `${event.tick.toString().padStart(4, "0")}  ${event.type}${event.entityId ? `  ${event.entityId}` : ""}`).join("<br>") || "Awaiting event stream…"}</div><div class="actions">${button(replay.done ? "Open battle report" : "Replay running…", "report", "primary")} ${button("Restart plan", "army")}</div>`;
  }
  const nextCapacity = capacityOf(waveDraft);
  return `<h1>Choose the breach</h1><p>Tap a marked approach on the tactical view, stage a wave, then decide whether to commit a reroute intervention. Later waves arrive after the first engagement.</p><div class="card"><div class="row"><strong>${selectedTarget.name}</strong><span class="pill">${waves.length} / 3 waves staged</span></div><p class="meta">Next wave: ${Object.values(waveDraft).reduce((total, count) => total + count, 0)} units · ${nextCapacity} / 10 capacity</p></div><h2>Deployment point</h2><div class="zone-grid">${(["west", "north", "south", "east"] as Zone[]).map((zone) => button(zone.toUpperCase(), `zone:${zone}`, selectedZone === zone ? "selected" : "")).join("")}</div><h2>Wave ${waves.length + 1}</h2><div class="stack">${Object.values(content.units).filter((unit) => (waveDraft[unit.id] ?? 0) > 0).map((unit) => `<div class="row"><span>${displayName(unit.id)} <span class="meta">(${unit.capacity} cap · ${stagedCount(unit.id)} staged)</span></span><div class="quantity">${button("−", `wave:-:${unit.id}`)}<output>${waveDraft[unit.id] ?? 0}</output>${button("+", `wave:+:${unit.id}`)}</div></div>`).join("") || `<div class="empty">All selected units are staged. Resolve the plan or restart composition to change it.</div>`}</div>${waves.length > 0 ? `<div class="card" style="margin-top:10px"><strong>Staged waves</strong>${waves.map((wave, index) => `<p class="meta">Wave ${index + 1} · ${wave.zone.toUpperCase()} · ${wave.units.map((entry) => `${displayName(entry.unitId)} ×${entry.count}`).join(", ")}</p>`).join("")}</div>` : ""}<div class="actions">${button("Deploy wave", "deploy-wave", "primary")} ${button(abilityArmed ? "Reroute armed" : "Arm Emergency Reroute", "ability", abilityArmed ? "warn" : "")} ${button("Resolve autonomous battle", "resolve-battle", "primary")} ${button("Cancel", "targets")}</div><p class="footer-help">Deployment geography changes travel and exposure; timing changes the result.</p>`;
}

function renderReport(): string {
  const result = replay?.result;
  if (!result) return `<h1>No report</h1>${button("Return home", "colony", "primary")}`;
  const totalDeployed = result.deploymentUsage.reduce((sum, usage) => sum + usage.units.reduce((inner, unit) => inner + unit.count, 0), 0);
  const casualties = Object.values(result.attackerCasualties).reduce((sum, count) => sum + count, 0);
  const destroyed = result.destroyedStructureIds.length;
  return `<h1>Battle report</h1><p class="eyebrow">${selectedTarget.codename} · ${result.outcomeHash.slice(0, 16)}…</p><div class="card ${result.winner === "attacker" ? "selected" : ""}"><div class="row"><h3>${result.victoryTier === "full" ? "Relay secured" : result.victoryTier === "partial" ? "Partial breach" : "Defense held"}</h3><span class="pill">${result.victoryTier}</span></div><p>${result.winner === "attacker" ? "Your route reached the hostile core." : "The colony held its relay, but the event stream is preserved for the next plan."}</p></div><div class="resource-strip"><div class="resource"><strong>${totalDeployed}</strong><span>deployed</span></div><div class="resource"><strong>${casualties}</strong><span>casualties</span></div><div class="resource"><strong>${destroyed}</strong><span>structures down</span></div></div><h2>Salvage</h2><p>${reportLoot(result)}</p><h2>Tactical readout</h2><p>${result.commanderUse.count > 0 ? "Emergency Reroute accelerated the active force during the selected window. " : "No commander intervention was used. "}${destroyed > 0 ? `${result.destroyedStructureIds.join(", ")} fell under pressure.` : "The defense mesh remained intact."}</p><p class="meta">Duration ${result.durationTicks} ticks · ${result.eventCount} events · replay ${result.canonicalHash.slice(0, 12)}…</p><div class="actions">${button("Return to colony and apply result", "return-home", "primary")} ${button("Attack again", "army")}</div><div class="notice">Rewards and casualties apply exactly once when you return home.</div>`;
}

function renderApp(): void {
  const root = document.querySelector<HTMLDivElement>("#ui-root");
  if (!root) return;
  root.innerHTML = `<div class="shell"><header class="topbar"><div class="brand">ORBITSCAR</div><div class="eyebrow">autonomous edgeworld</div><nav class="nav">${(["colony", "targets", "army"] as Mode[]).map((item) => `<button class="${mode === item ? "active" : ""}" data-action="${item}">${displayName(item)}</button>`).join("")}</nav><div class="metrics">ALLOY ${Math.floor(colony.resources.alloy ?? 0)} · VOL ${Math.floor(colony.resources.volatile ?? 0)} · SIG ${Math.floor(colony.resources.signal ?? 0)}</div></header><section class="content ${mode === "battle" || mode === "report" ? "wide" : ""}">${mode === "colony" ? renderColony() : mode === "targets" ? renderTargets() : mode === "army" ? renderArmy() : mode === "battle" ? renderBattle() : renderReport()}</section></div>`;
  root.querySelectorAll<HTMLElement>("[data-action]").forEach((element) => element.addEventListener("click", () => handleAction(element.dataset.action ?? "")));
}

function adjustCount(source: Record<string, number>, unitId: string, delta: number, limit: number): void {
  const next = Math.max(0, Math.min(limit, (source[unitId] ?? 0) + delta));
  if (source === selectedArmy && capacityOf({ ...source, [unitId]: next }) > 10) { setNotice("That force exceeds the 10-capacity breach budget."); return; }
  if (source === waveDraft && capacityOf({ ...source, [unitId]: next }) > 10) { setNotice("This wave exceeds the 10-capacity tactical budget."); return; }
  source[unitId] = next;
  renderApp();
}

function stageWave(): void {
  const units = Object.entries(waveDraft).filter(([, count]) => count > 0).map(([unitId, count]) => ({ unitId, count }));
  if (units.length === 0) { setNotice("Select at least one remaining unit for this wave."); return; }
  if (capacityOf(Object.fromEntries(units.map((entry) => [entry.unitId, entry.count]))) > 10) { setNotice("This wave exceeds deployment capacity."); return; }
  waves.push({ zone: selectedZone, units });
  const nextDraft: Record<string, number> = {};
  for (const [unitId, count] of Object.entries(selectedArmy)) nextDraft[unitId] = Math.max(0, count - stagedCount(unitId));
  waveDraft = nextDraft;
  setNotice(`${selectedZone.toUpperCase()} wave staged. Adjust the remaining force for a later reinforcement.`);
}

function createBattleInput(): OrbitscarBattleInput {
  const commands: OrbitscarBattleInput["commands"] = waves.map((wave, index) => ({ commandId: `wave-${index + 1}`, sequence: index + 1, tick: index * 600, type: "DEPLOY" as const, payload: { zone: wave.zone, position: { ...zonePositions[wave.zone] }, units: wave.units } }));
  if (abilityArmed) commands.push({ commandId: "commander-reroute", sequence: commands.length + 1, tick: 300, type: "COMMANDER_ABILITY", payload: { abilityId: "emergency_reroute", targetStructureId: "arc" } });
  return { canonicalFormatVersion: 2, rulesetVersion: content.rulesetVersion, seed: 101 + selectedTarget.id.length, maxDurationTicks: 2400, arena: ARENA, deploymentCapacity: 10, maxDeploymentCharges: 3, commanderId: "mara_voss", army: Object.entries(selectedArmy).filter(([, count]) => count > 0).map(([unitId, count]) => ({ unitId, count })), structures: selectedTarget.structures.map((structure) => ({ ...structure, position: { ...structure.position } })), commands, content };
}

function resolveBattle(): void {
  if (waves.length === 0) { setNotice("Deploy at least one wave before resolving."); return; }
  try { const input = createBattleInput(); replay = { input, result: resolveOrbitscarBattle(input), startedAt: performance.now(), eventIndex: 0, done: false }; lastUiReplayTick = -1; mode = "battle"; renderApp(); }
  catch (error) { setNotice(error instanceof Error ? error.message : "Battle input rejected."); }
}

function handleAction(action: string): void {
  const [verb, value, unitId] = action.split(":");
  if (action === "colony") { setMode("colony"); return; }
  if (action === "targets") { setMode("targets"); return; }
  if (action === "army") { selectedArmy = {}; waveDraft = {}; waves = []; abilityArmed = false; setMode("army"); return; }
  if (action === "collect") { colony = advanceColony(colony, 300, content); saveColony("Extractor cycle collected."); return; }
  if (action === "save") { saveColony(); return; }
  if (verb === "scout" && value) { selectedTarget = content.encounters[value]; setNotice(`${selectedTarget.name} snapshot loaded into the tactical view.`); return; }
  if (verb === "train" && value) { try { colony = trainUnits(colony, value, 1, content); saveColony(`${displayName(value)} added to reserves.`); } catch (error) { setNotice(error instanceof Error ? error.message : "Training failed."); } return; }
  if (verb === "build" && value) { buildMode = value; selectedBuildingId = undefined; setNotice(`Placement mode: ${displayName(value)}. Tap an open grid cell.`); return; }
  if (verb === "upgrade" && value) { try { colony = upgradeColonyBuilding(colony, value, content); saveColony("Module upgraded."); } catch (error) { setNotice(error instanceof Error ? error.message : "Upgrade failed."); } return; }
  if (verb === "army" && value && unitId) { adjustCount(selectedArmy, unitId, value === "+" ? 1 : -1, available(unitId)); return; }
  if (action === "begin-battle") { if (capacityOf(selectedArmy) === 0) { setNotice("Choose at least one unit from your persistent reserves."); return; } waveDraft = { ...selectedArmy }; waves = []; abilityArmed = false; selectedZone = "west"; setMode("battle"); return; }
  if (verb === "zone" && value) { selectedZone = value as Zone; renderApp(); return; }
  if (verb === "wave" && value && unitId) { adjustCount(waveDraft, unitId, value === "+" ? 1 : -1, Math.max(0, (selectedArmy[unitId] ?? 0) - stagedCount(unitId))); return; }
  if (action === "deploy-wave") { stageWave(); return; }
  if (action === "ability") { abilityArmed = !abilityArmed; renderApp(); return; }
  if (action === "resolve-battle") { resolveBattle(); return; }
  if (action === "report" && replay?.done) { mode = "report"; renderApp(); return; }
  if (action === "return-home" && replay) { colony = applyBattleResult(colony, replay.input, replay.result); saveColony("Battle report archived. Survivors and salvage reconciled."); replay = undefined; selectedArmy = {}; waves = []; setMode("colony"); }
}

class OrbitscarScene extends Phaser.Scene {
  private world!: Phaser.GameObjects.Graphics;
  private dragStart?: { x: number; y: number; scrollX: number; scrollY: number };
  private units = new Map<string, { position: OrbitscarPosition; health: number; alive: boolean }>();
  private structureHealth = new Map<string, number>();
  constructor() { super("OrbitscarScene"); }
  create(): void {
    this.world = this.add.graphics();
    this.cameras.main.setBounds(0, 0, ARENA.width, ARENA.height);
    this.cameras.main.setZoom(Math.min(this.scale.width / 1200, this.scale.height / 800));
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => { const point = this.cameras.main.getWorldPoint(pointer.x, pointer.y); this.dragStart = { x: pointer.x, y: pointer.y, scrollX: this.cameras.main.scrollX, scrollY: this.cameras.main.scrollY }; if (mode === "colony") this.colonyClick(point); else if (mode === "battle" && replay === undefined) this.battleClick(point); });
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => { if (!this.dragStart || !pointer.isDown) return; this.cameras.main.scrollX = this.dragStart.scrollX - (pointer.x - this.dragStart.x) / this.cameras.main.zoom; this.cameras.main.scrollY = this.dragStart.scrollY - (pointer.y - this.dragStart.y) / this.cameras.main.zoom; });
    this.input.on("pointerup", () => { this.dragStart = undefined; });
    this.input.on("wheel", (_pointer: Phaser.Input.Pointer, _objects: Phaser.GameObjects.GameObject[], _dx: number, dy: number) => this.cameras.main.setZoom(Phaser.Math.Clamp(this.cameras.main.zoom - dy * .001, .55, 1.5)));
    this.draw();
  }
  update(): void { if (replay !== undefined) this.advanceReplay(); this.draw(); }
  private colonyClick(point: OrbitscarPosition): void {
    if (buildMode) {
      const buildingId = buildMode;
      const position = { x: Math.round((point.x - 20) / GRID) * GRID, y: Math.round((point.y - 20) / GRID) * GRID };
      try { colony = placeColonyBuilding(colony, buildingId, position, content); buildMode = undefined; saveColony(`${displayName(buildingId)} placed.`); }
      catch (error) { setNotice(error instanceof Error ? error.message : "Placement rejected."); }
      return;
    }
    const hit = [...colony.buildings].reverse().find((building) => { const footprint = content.buildings[building.buildingId].footprint; return point.x >= building.position.x && point.x <= building.position.x + footprint[0] * GRID && point.y >= building.position.y && point.y <= building.position.y + footprint[1] * GRID; });
    selectedBuildingId = hit?.id;
    if (hit) setNotice(`${displayName(hit.buildingId)} selected. Upgrade from the colony panel.`);
  }
  private battleClick(point: OrbitscarPosition): void { const hit = (Object.entries(zonePositions) as [Zone, OrbitscarPosition][]).find(([, position]) => Math.abs(point.x - position.x) < 80 && Math.abs(point.y - position.y) < 80); if (hit) { selectedZone = hit[0]; renderApp(); } }
  private advanceReplay(): void {
    if (!replay) return;
    const elapsedTicks = Math.floor((performance.now() - replay.startedAt) / 1000 * 30);
    while (replay.eventIndex < replay.result.events.length && replay.result.events[replay.eventIndex].tick <= elapsedTicks) replay.eventIndex += 1;
    if (elapsedTicks >= replay.result.durationTicks) replay.done = true;
    if (elapsedTicks - lastUiReplayTick >= 15 || elapsedTicks >= replay.result.durationTicks) { lastUiReplayTick = Math.min(elapsedTicks, replay.result.durationTicks); renderApp(); }
    this.applyEvents(replay.result.events.slice(0, replay.eventIndex));
  }
  private applyEvents(events: OrbitscarBattleEvent[]): void {
    this.units.clear(); this.structureHealth.clear(); if (!replay) return;
    for (const structure of replay.input.structures) this.structureHealth.set(structure.id, structure.currentHealth ?? content.buildings[structure.buildingId].maxHealth);
    for (const event of events) {
      if (event.entityId?.includes("#")) { const unitId = event.entityId.split("#")[0]; const unit = this.units.get(event.entityId) ?? { position: event.position ?? { x: 0, y: 0 }, health: content.units[unitId].health, alive: true }; if (event.position) unit.position = { ...event.position }; if (event.remainingHealth !== undefined) unit.health = event.remainingHealth; if (event.type === "unit_destroyed") unit.alive = false; this.units.set(event.entityId, unit); }
      else if (event.entityId && event.remainingHealth !== undefined) this.structureHealth.set(event.entityId, event.remainingHealth);
    }
  }
  private draw(): void { if (!this.world) return; this.world.clear(); this.world.fillStyle(0x09151c, 1).fillRect(0, 0, ARENA.width, ARENA.height); this.world.lineStyle(1, 0x17323c, 1); for (let x = 0; x <= ARENA.width; x += GRID) this.world.lineBetween(x, 0, x, ARENA.height); for (let y = 0; y <= ARENA.height; y += GRID) this.world.lineBetween(0, y, ARENA.width, y); if (mode === "colony") this.drawColony(); else this.drawBattle(); }
  private drawColony(): void { this.world.fillStyle(0x18363d, .65).fillRoundedRect(90, 100, 700, 600, 18); for (const building of colony.buildings) { const definition = content.buildings[building.buildingId]; const w = definition.footprint[0] * GRID; const h = definition.footprint[1] * GRID; const selected = selectedBuildingId === building.id; const color = building.buildingId === "command_relay" ? 0xf2c879 : definition.defenseId ? 0xe07878 : 0x7396a3; this.world.fillStyle(color, .9).fillRect(building.position.x, building.position.y, w, h); this.world.lineStyle(selected ? 4 : 2, selected ? 0xffffff : 0x0b1115, 1).strokeRect(building.position.x, building.position.y, w, h); this.world.fillStyle(0x071017, .7).fillRect(building.position.x, building.position.y + h - 9, w, 9); this.world.fillStyle(0x8ee6d1, 1).fillRect(building.position.x, building.position.y + h - 9, w * Math.min(1, building.health / (definition.maxHealth * (1 + (building.level - 1) * .25))), 9); } if (buildMode) { const definition = content.buildings[buildMode]; this.world.lineStyle(2, 0x8ee6d1, .9).strokeRect(120, 120, definition.footprint[0] * GRID, definition.footprint[1] * GRID); } }
  private drawBattle(): void { for (const [zone, position] of Object.entries(zonePositions) as [Zone, OrbitscarPosition][]) this.drawZone(zone, position); const structures = replay?.input.structures ?? selectedTarget.structures; for (const structure of structures) this.drawStructure(structure.id, structure.position, structure.buildingId, this.structureHealth.get(structure.id) ?? content.buildings[structure.buildingId].maxHealth); for (const [id, unit] of this.units) if (unit.alive) { const color = id.startsWith("ram_walker") ? 0xf2c879 : id.startsWith("needle_drone") ? 0x8ee6d1 : 0x9bb7ff; this.world.fillStyle(color, 1).fillCircle(unit.position.x, unit.position.y, 9); this.world.lineStyle(1, 0x071017, 1).strokeCircle(unit.position.x, unit.position.y, 12); } }
  private drawZone(zone: Zone, position: OrbitscarPosition): void { const selected = zone === selectedZone; this.world.fillStyle(selected ? 0x1d796e : 0x16414a, selected ? .35 : .18).fillRect(position.x - 70, position.y - 70, 140, 140); this.world.lineStyle(2, selected ? 0x8ee6d1 : 0x32606b, .8).strokeRect(position.x - 70, position.y - 70, 140, 140); }
  private drawStructure(id: string, position: OrbitscarPosition, buildingId: string, maxHealth: number): void { const health = replay ? this.structureHealth.get(id) ?? maxHealth : maxHealth; const color = buildingId === "command_relay" ? 0xf2c879 : content.buildings[buildingId].defenseId ? 0xe07878 : 0x7396a3; this.world.fillStyle(health > 0 ? color : 0x35454b, 1).fillRect(position.x - 18, position.y - 18, 36, 36); this.world.lineStyle(1, 0x0b1115, 1).strokeRect(position.x - 18, position.y - 18, 36, 36); this.world.fillStyle(0x071017, .75).fillRect(position.x - 22, position.y + 25, 44, 5); this.world.fillStyle(0x8ee6d1, 1).fillRect(position.x - 22, position.y + 25, 44 * Math.max(0, health / maxHealth), 5); }
}

new Phaser.Game({ type: Phaser.AUTO, parent: "game", backgroundColor: "#081018", scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH, width: 1200, height: 800 }, input: { activePointers: 3 }, scene: OrbitscarScene });
renderApp();
