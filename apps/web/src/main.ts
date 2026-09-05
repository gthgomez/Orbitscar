import Phaser from "phaser";
import balance from "@orbitscar/content/data/orbitscar-v0/balance.json" with { type: "json" };
import { parseOrbitscarContent, type OrbitscarEncounterDefinition } from "@orbitscar/content";
import { applyBattleResult, advanceColony, placeColonyBuilding, resolveOrbitscarBattle, trainUnits, upgradeColonyBuilding, type ColonyState, type OrbitscarBattleInput } from "@orbitscar/simulation";
import { OrbitscarScene, ARENA } from "./game/scene.js";
import { loadColony, persistColony } from "./persistence/colony-save.js";
import { attackAgain, beginDeployment, beginArmyComposition, canStageWave, clearAttackPlan, countStaged, createGameSession, MAX_DEPLOYMENT_CHARGES, restartPlan, showReport, startBattle, zonePositions, type GameSession, type Zone } from "./state/game-session.js";
import { renderApp } from "./ui/render.js";
import "./style.css";

const content = parseOrbitscarContent(balance);
const root: HTMLElement = (() => {
  const candidate = document.querySelector<HTMLElement>("#ui-root");
  if (candidate === null) throw new Error("missing #ui-root");
  return candidate;
})();

let colony: ColonyState = loadColony(content);
let session: GameSession = createGameSession();
let notice = "Local colony authority online.";
let selectedTarget: OrbitscarEncounterDefinition = Object.values(content.encounters)[0];
let selectedBuildingId: string | undefined;
let buildMode: string | undefined;
let previewPosition: { x: number; y: number } | undefined;
let lastUiReplayTick = -1;
let localAttemptSequence = 0;

function refresh(): void { renderApp({ root, content, colony, selectedTarget, selectedBuildingId, buildMode, notice, session }); }
function setNotice(message: string): void { notice = message; refresh(); }
function setMode(mode: GameSession["mode"]): void { session = { ...session, mode }; buildMode = undefined; selectedBuildingId = undefined; refresh(); }
function saveColony(message: string): void { notice = persistColony(colony, message).message; refresh(); }
function displayName(id: string): string { return id.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function capacityOf(entries: Record<string, number>): number { return Object.entries(entries).reduce((total, [unitId, count]) => total + count * (content.units[unitId]?.capacity ?? 0), 0); }
function available(unitId: string): number { return colony.reserves[unitId] ?? 0; }
function newAttemptId(): string { localAttemptSequence += 1; const random = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${localAttemptSequence}`; return `attempt-${random}`; }
function updatePlan(plan: GameSession["plan"]): void { session = { ...session, plan }; refresh(); }

function adjustArmy(unitId: string, delta: number): void {
  const current = session.plan.selectedArmy[unitId] ?? 0;
  const next = Math.max(0, Math.min(available(unitId), current + delta));
  if (capacityOf({ ...session.plan.selectedArmy, [unitId]: next }) > 10) { setNotice("That force exceeds the 10-capacity breach budget."); return; }
  updatePlan({ ...session.plan, selectedArmy: { ...session.plan.selectedArmy, [unitId]: next } });
}

function adjustWave(unitId: string, delta: number): void {
  const current = session.plan.waveDraft[unitId] ?? 0;
  const limit = Math.max(0, (session.plan.selectedArmy[unitId] ?? 0) - countStaged(session.plan.waves, unitId));
  const next = Math.max(0, Math.min(limit, current + delta));
  if (capacityOf({ ...session.plan.waveDraft, [unitId]: next }) > 10) { setNotice("This wave exceeds the 10-capacity tactical budget."); return; }
  updatePlan({ ...session.plan, waveDraft: { ...session.plan.waveDraft, [unitId]: next } });
}

function stageWave(): void {
  if (!canStageWave(session)) { setNotice(`Deployment limit reached: ${MAX_DEPLOYMENT_CHARGES} waves maximum.`); return; }
  const units = Object.entries(session.plan.waveDraft).filter(([, count]) => count > 0).map(([unitId, count]) => ({ unitId, count }));
  if (units.length === 0) { setNotice("Select at least one remaining unit for this wave."); return; }
  if (capacityOf(Object.fromEntries(units.map((entry) => [entry.unitId, entry.count]))) > 10) { setNotice("This wave exceeds deployment capacity."); return; }
  const waves = [...session.plan.waves, { zone: session.plan.selectedZone, units }];
  const waveDraft = Object.fromEntries(Object.entries(session.plan.selectedArmy).map(([unitId, count]) => [unitId, Math.max(0, count - countStaged(waves, unitId))]));
  const zone = session.plan.selectedZone;
  session = { ...session, plan: { ...session.plan, waves, waveDraft } };
  notice = `${zone.toUpperCase()} wave staged. A later window can reinforce this breach.`;
  refresh();
}

// Emergency Reroute pins the force to a defense structure of the scouted
// encounter; hardcoding an ID would reject the plan on any layout without it.
function commanderRerouteTarget(): string | undefined { return selectedTarget.structures.find((structure) => content.buildings[structure.buildingId]?.defenseId !== undefined)?.id; }

function createBattleInput(): OrbitscarBattleInput {
  const commands: OrbitscarBattleInput["commands"] = session.plan.waves.map((wave, index) => ({ commandId: `wave-${index + 1}`, sequence: index + 1, tick: index * 600, type: "DEPLOY" as const, payload: { zone: wave.zone, position: { ...zonePositions[wave.zone] }, units: wave.units } }));
  if (session.plan.abilityArmed) commands.push({ commandId: "commander-reroute", sequence: commands.length + 1, tick: 300, type: "COMMANDER_ABILITY", payload: { abilityId: "emergency_reroute", targetStructureId: commanderRerouteTarget() } });
  return { canonicalFormatVersion: 2, rulesetVersion: content.rulesetVersion, seed: 101 + selectedTarget.id.length, maxDurationTicks: 2400, arena: ARENA, deploymentCapacity: 10, maxDeploymentCharges: MAX_DEPLOYMENT_CHARGES, commanderId: "mara_voss", rewardPreview: { ...selectedTarget.rewardPreview }, army: Object.entries(session.plan.selectedArmy).filter(([, count]) => count > 0).map(([unitId, count]) => ({ unitId, count })), structures: selectedTarget.structures.map((structure) => ({ ...structure, position: { ...structure.position } })), commands, content };
}

function resolveBattle(): void {
  if (session.plan.waves.length === 0) { setNotice("Deploy at least one wave before resolving."); return; }
  try { const input = createBattleInput(); const result = resolveOrbitscarBattle(input); session = startBattle(session, { input, result, attemptId: newAttemptId(), startedAt: performance.now(), eventIndex: 0, done: false }); lastUiReplayTick = -1; refresh(); }
  catch (error) { setNotice(error instanceof Error ? error.message : "Battle input rejected."); }
}

function retreat(): void {
  const replay = session.replay;
  if (!replay || replay.done) return;
  const currentTick = Math.max(1, Math.min(replay.input.maxDurationTicks, lastUiReplayTick < 0 ? 1 : lastUiReplayTick));
  const input: OrbitscarBattleInput = { ...replay.input, commands: [...replay.input.commands, { commandId: `retreat-${replay.attemptId}`, sequence: replay.input.commands.length + 1, tick: currentTick, type: "RETREAT" as const, payload: {} }] };
  try { const result = resolveOrbitscarBattle(input); session = startBattle(session, { ...replay, input, result, startedAt: performance.now(), eventIndex: 0, done: false }); lastUiReplayTick = -1; refresh(); }
  catch (error) { setNotice(error instanceof Error ? error.message : "Retreat rejected."); }
}

function onFrame(now: number): void {
  const replay = session.replay;
  if (!replay || replay.done) return;
  const elapsedTicks = Math.floor((now - replay.startedAt) / 1000 * 30);
  let eventIndex = replay.eventIndex;
  while (eventIndex < replay.result.events.length && replay.result.events[eventIndex].tick <= elapsedTicks) eventIndex += 1;
  const done = elapsedTicks >= replay.result.durationTicks;
  if (eventIndex !== replay.eventIndex || done !== replay.done) { session = { ...session, replay: { ...replay, eventIndex, done } }; if (elapsedTicks - lastUiReplayTick >= 15 || done) { lastUiReplayTick = Math.min(elapsedTicks, replay.result.durationTicks); refresh(); } }
}

function handleAction(action: string): void {
  const [verb, value, unitId] = action.split(":");
  if (action === "colony") { session = clearAttackPlan(session); setMode("colony"); return; }
  if (action === "targets") { session = clearAttackPlan(session); setMode("targets"); return; }
  if (action === "army") { session = beginArmyComposition(session); setMode("army"); return; }
  if (action === "collect") { colony = advanceColony(colony, 300, content); saveColony("Extractor cycle collected."); return; }
  if (action === "save") { saveColony("Colony saved locally."); return; }
  if (verb === "scout" && value && content.encounters[value]) { selectedTarget = content.encounters[value]; notice = `${selectedTarget.name} snapshot loaded into the tactical view.`; refresh(); return; }
  if (verb === "train" && value) { try { colony = trainUnits(colony, value, 1, content); saveColony(`${displayName(value)} added to reserves.`); } catch (error) { setNotice(error instanceof Error ? error.message : "Training failed."); } return; }
  if (verb === "build" && value && content.buildings[value]) { buildMode = value; selectedBuildingId = undefined; setNotice(`Placement mode: ${displayName(value)}. Tap an open grid cell.`); return; }
  if (verb === "select-building" && value) { selectedBuildingId = value; notice = `${displayName(colony.buildings.find((building) => building.id === value)?.buildingId ?? value)} selected.`; refresh(); return; }
  if (verb === "upgrade" && value) { try { colony = upgradeColonyBuilding(colony, value, content); saveColony("Module upgraded."); } catch (error) { setNotice(error instanceof Error ? error.message : "Upgrade failed."); } return; }
  if (verb === "army" && value && unitId) { adjustArmy(unitId, value === "+" ? 1 : -1); return; }
  if (action === "begin-deployment") { if (capacityOf(session.plan.selectedArmy) === 0) { setNotice("Choose at least one unit from your persistent reserves."); return; } session = beginDeployment(session); setMode("deployment"); return; }
  if (verb === "zone" && value && ["west", "north", "south", "east"].includes(value)) { updatePlan({ ...session.plan, selectedZone: value as Zone }); return; }
  if (verb === "wave" && value && unitId) { adjustWave(unitId, value === "+" ? 1 : -1); return; }
  if (action === "deploy-wave") { stageWave(); return; }
  if (action === "ability") { updatePlan({ ...session.plan, abilityArmed: !session.plan.abilityArmed }); return; }
  if (action === "resolve-battle") { resolveBattle(); return; }
  if (action === "report") { session = showReport(session); refresh(); return; }
  if (action === "retreat") { retreat(); return; }
  if (action === "restart-plan") { session = restartPlan(session); setMode("deployment"); return; }
  if (action === "cancel-deployment") { session = clearAttackPlan(session); setMode("targets"); return; }
  if (action === "attack-again") { session = attackAgain(session); setMode("army"); return; }
  if (action === "return-home" && session.replay) { try { colony = applyBattleResult(colony, session.replay.input, session.replay.result, session.replay.attemptId); saveColony("Battle report archived. Survivors and salvage reconciled."); session = clearAttackPlan(session); setMode("colony"); } catch (error) { setNotice(error instanceof Error ? error.message : "Settlement rejected."); } }
}

function placeBuilding(position: { x: number; y: number }): void {
  if (!buildMode) return;
  try { colony = placeColonyBuilding(colony, buildMode, position, content); const placed = buildMode; buildMode = undefined; previewPosition = undefined; saveColony(`${displayName(placed)} placed.`); }
  catch (error) { setNotice(error instanceof Error ? error.message : "Placement rejected."); }
}

root.addEventListener("click", (event) => { const target = event.target as HTMLElement; const actionElement = target.closest<HTMLElement>("[data-action]"); if (actionElement?.dataset.action) handleAction(actionElement.dataset.action); });

new Phaser.Game({ type: Phaser.AUTO, parent: "game", backgroundColor: "#081018", scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH, width: ARENA.width, height: ARENA.height }, input: { activePointers: 3 }, scene: new OrbitscarScene({ content, getMode: () => session.mode, getColony: () => colony, getBuildMode: () => buildMode, getSelectedBuildingId: () => selectedBuildingId, getSelectedZone: () => session.plan.selectedZone, getTargetStructures: () => selectedTarget.structures, getReplay: () => session.replay, setPreview: (position) => { previewPosition = position; }, selectBuilding: (id) => { selectedBuildingId = id; refresh(); }, selectZone: (zone) => { updatePlan({ ...session.plan, selectedZone: zone }); }, placeBuilding, onFrame }) });
refresh();
