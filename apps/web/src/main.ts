import Phaser from "phaser";
import balance from "@orbitscar/content/data/orbitscar-v0/balance.json" with { type: "json" };
import { parseOrbitscarContent, type OrbitscarEncounterDefinition } from "@orbitscar/content";
import { appendOrbitscarCommand, applyBattleResult, authoritativeDigest, applyColonyDefenseResult, beginColonySortie, buildColonyRaidInput, collectColonyProduction, commandTierOf, placeColonyBuilding, recordColonyScout, repairColonyBuilding, researchDoctrine, resolveOrbitscarBattle, sectorRewardPreview, selectColonyCommander, trainUnits, upgradeColonyBuilding, type ColonyState, type OrbitscarBattleInput } from "@orbitscar/simulation";
import { OrbitscarScene, ARENA } from "./game/scene.js";
import { loadColony, persistColony } from "./persistence/colony-save.js";
import { attackAgain, beginDeployment, beginArmyComposition, canStageWave, clearAttackPlan, countStaged, createGameSession, MAX_DEPLOYMENT_CHARGES, restartPlan, showReport, startBattle, zonePositions, type GameSession, type Zone } from "./state/game-session.js";
import { renderApp } from "./ui/render.js";
import { createSoundPlayer } from "./audio.js";
import "./style.css";

const content = parseOrbitscarContent(balance);
const playSound = createSoundPlayer();
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
let selectedCommanderTargetId: string | undefined;
const activeBattleKey = "orbitscar_active_battle_v1";
type ActiveBattleSave = { schemaVersion: 1; kind: "attack" | "defense"; attemptId: string; targetId: string; input: OrbitscarBattleInput; currentTick: number; selectedZone: Zone };

function refresh(): void { renderApp({ root, content, colony, selectedTarget, selectedBuildingId, buildMode, notice, session, selectedCommanderTargetId }); }
function persistActiveBattle(): void {
  const replay = session.replay;
  if (!replay) return;
  const body: ActiveBattleSave = { schemaVersion: 1, kind: replay.kind ?? "attack", attemptId: replay.attemptId, targetId: selectedTarget.id, input: replay.input, currentTick: replay.currentTick ?? 0, selectedZone: session.plan.selectedZone };
  try { localStorage.setItem(activeBattleKey, JSON.stringify({ ...body, checksum: authoritativeDigest(body) })); } catch { notice = "Active battle could not be saved in this browser."; }
}
function clearActiveBattle(): void { try { localStorage.removeItem(activeBattleKey); } catch { /* local persistence may be unavailable */ } }
function restoreActiveBattle(): void {
  try {
    const serialized = localStorage.getItem(activeBattleKey);
    if (!serialized) return;
    const parsed = JSON.parse(serialized) as Partial<ActiveBattleSave> & { checksum?: string };
    const { checksum, ...body } = parsed;
    if (parsed.schemaVersion !== 1 || typeof checksum !== "string" || authoritativeDigest(body) !== checksum || !parsed.input || !parsed.attemptId || !parsed.targetId || !Number.isInteger(parsed.currentTick) || parsed.currentTick! < 0) throw new Error("invalid active battle save");
    // Never trust embedded save content as the rules source. Rebind the replay
    // to the shipped, schema-validated content before reproducing it.
    const input = { ...parsed.input, content };
    if (input.rulesetVersion !== content.rulesetVersion) throw new Error("active battle ruleset is no longer available");
    const result = resolveOrbitscarBattle(input);
    const currentTick = Math.min(input.maxDurationTicks, parsed.currentTick!);
    selectedTarget = content.encounters[parsed.targetId] ?? { id: parsed.targetId, requiredTier: 1, opponentTier: 1, name: parsed.kind === "defense" ? "Home Colony" : "Archived Target", codename: parsed.targetId.toUpperCase(), difficulty: "contested", description: "Recovered deterministic battle snapshot.", rewardPreview: input.rewardPreview, structures: input.structures, suggestedCounters: [] };
    const army = Object.fromEntries(input.army.map((entry) => [entry.unitId, entry.count]));
    const waves = input.commands.filter((command) => command.type === "DEPLOY").map((command) => ({ zone: command.payload.zone, units: command.payload.units }));
    const staged = Object.fromEntries(Object.keys(army).map((unitId) => [unitId, waves.reduce((sum, wave) => sum + (wave.units.find((entry) => entry.unitId === unitId)?.count ?? 0), 0)]));
    const waveDraft = Object.fromEntries(Object.entries(army).map(([unitId, count]) => [unitId, Math.max(0, count - (staged[unitId] ?? 0))]));
    const plan = { selectedArmy: army, waveDraft, selectedZone: parsed.selectedZone ?? waves.at(-1)?.zone ?? "west", waves, abilityArmed: false };
    let eventIndex = 0;
    while (eventIndex < result.events.length && result.events[eventIndex].tick <= currentTick) eventIndex += 1;
    const replay = { kind: parsed.kind, input, result, attemptId: parsed.attemptId!, startedAt: performance.now() - currentTick / 30 * 1000, eventIndex, done: currentTick >= result.durationTicks, currentTick };
    session = startBattle({ ...createGameSession(), plan }, replay);
  } catch { clearActiveBattle(); }
}
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
  if (session.plan.waves.length > 0) { setNotice("The first wave is locked. Choose later reinforcements during the battle."); return; }
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

function createBattleInput(seed: number): OrbitscarBattleInput {
  const firstWave = session.plan.waves[0];
  const commands: OrbitscarBattleInput["commands"] = firstWave ? [{ commandId: "wave-1", sequence: 1, tick: 0, type: "DEPLOY", payload: { zone: firstWave.zone, position: { ...zonePositions[firstWave.zone] }, units: firstWave.units } }] : [];
  return { canonicalFormatVersion: 2, rulesetVersion: content.rulesetVersion, seed, maxDurationTicks: 2400, arena: ARENA, deploymentCapacity: 10, maxDeploymentCharges: MAX_DEPLOYMENT_CHARGES, commanderId: colony.commanderId, attackerDoctrineId: colony.doctrineId, rewardPreview: sectorRewardPreview(colony, selectedTarget.id, content), army: Object.entries(session.plan.selectedArmy).filter(([, count]) => count > 0).map(([unitId, count]) => ({ unitId, count })), structures: selectedTarget.structures.map((structure) => ({ ...structure, position: { ...structure.position } })), commands, content };
}

function activeBattleTick(replay: NonNullable<GameSession["replay"]>): number {
  return Math.min(replay.input.maxDurationTicks, Math.max(0, Math.floor((performance.now() - replay.startedAt) / 1000 * 30)));
}

function replayToTick(replay: NonNullable<GameSession["replay"]>, tick: number, input = replay.input, result = replay.result): NonNullable<GameSession["replay"]> {
  let eventIndex = 0;
  while (eventIndex < result.events.length && result.events[eventIndex].tick <= tick) eventIndex += 1;
  return { ...replay, input, result, eventIndex, done: tick >= result.durationTicks, currentTick: tick };
}

function appendLiveCommand(command: OrbitscarBattleInput["commands"][number]): void {
  const replay = session.replay;
  if (!replay || replay.done || replay.kind === "defense" || replay.archived || colony.reports.some((report) => report.attemptId === replay.attemptId)) return;
  const tick = activeBattleTick(replay);
  try {
    const input = appendOrbitscarCommand(replay.input, command, tick);
    const result = resolveOrbitscarBattle(input);
    session = { ...session, replay: replayToTick(replay, tick, input, result) };
    if (!colony.reports.some((report) => report.attemptId === replay.attemptId)) persistActiveBattle();
    lastUiReplayTick = tick;
    refresh();
  } catch (error) { setNotice(error instanceof Error ? error.message : "Battle command rejected."); }
}

function deployReinforcements(): void {
  const replay = session.replay;
  if (!replay) return;
  if (!canStageWave(session)) { setNotice("All deployment charges have been committed."); return; }
  const units = Object.entries(session.plan.waveDraft).filter(([, count]) => count > 0).map(([unitId, count]) => ({ unitId, count }));
  if (units.length === 0) { setNotice("Choose reserve units before committing a reinforcement."); return; }
  const nextTick = Math.max(activeBattleTick(replay) + 1, (replay.input.commands.at(-1)?.tick ?? -1) + 1);
  const sequence = Math.max(0, ...replay.input.commands.map((command) => command.sequence)) + 1;
  const command = { commandId: `reinforcement-${sequence}`, sequence, tick: nextTick, type: "DEPLOY" as const, payload: { zone: session.plan.selectedZone, position: { ...zonePositions[session.plan.selectedZone] }, units } };
  appendLiveCommand(command);
  if (session.replay?.input.commands.some((entry) => entry.commandId === command.commandId)) {
    const waves = [...session.plan.waves, { zone: session.plan.selectedZone, units }];
    const waveDraft = Object.fromEntries(Object.entries(session.plan.selectedArmy).map(([unitId, count]) => [unitId, Math.max(0, count - countStaged(waves, unitId))]));
    session = { ...session, plan: { ...session.plan, waves, waveDraft } };
    notice = `Reinforcement committed from ${session.plan.selectedZone.toUpperCase()} at tick ${nextTick}.`;
    refresh();
  }
}

function activateCommander(): void {
  const replay = session.replay;
  if (!replay) return;
  const nextTick = Math.max(activeBattleTick(replay) + 1, (replay.input.commands.at(-1)?.tick ?? -1) + 1);
  const sequence = Math.max(0, ...replay.input.commands.map((command) => command.sequence)) + 1;
  appendLiveCommand({ commandId: `commander-${sequence}`, sequence, tick: nextTick, type: "COMMANDER_ABILITY", payload: { abilityId: content.commanders[replay.input.commanderId].abilityId, ...(selectedCommanderTargetId === undefined ? {} : { targetStructureId: selectedCommanderTargetId }) } });
}

function startColonyRaid(): void {
  const archetypes = ["scavenger_swarm", "breach_column", "signal_harvest"] as const;
  const raidCount = colony.reports.filter((report) => report.kind === "defense").length;
  const archetype = archetypes[raidCount % archetypes.length];
  const seed = raidCount + 401;
  try {
    const input = buildColonyRaidInput(colony, archetype, seed, content);
    const result = resolveOrbitscarBattle(input);
    colony = applyColonyDefenseResult(colony, input, result, `raid-${seed}`);
    persistColony(colony, "Raid result recorded.");
    selectedTarget = { id: "home-colony", requiredTier: 1, opponentTier: 1, name: "Home Colony", codename: `RAID-${String(raidCount + 1).padStart(2, "0")}`, difficulty: raidCount < 2 ? "cautious" : "contested", description: `Hostile ${displayName(archetype)} pressure on your installed layout.`, rewardPreview: {}, structures: input.structures, suggestedCounters: [] };
    session = startBattle(session, { kind: "defense", input, result, attemptId: `raid-${seed}`, startedAt: performance.now(), eventIndex: 0, done: false, currentTick: 0 });
    persistActiveBattle();
    lastUiReplayTick = -1;
    refresh();
  } catch (error) { setNotice(error instanceof Error ? error.message : "Raid simulation failed."); }
}

function resolveBattle(): void {
  if (session.plan.waves.length === 0) { setNotice("Deploy at least one wave before resolving."); return; }
  try {
    const firstWave = session.plan.waves[0];
    const sortie = beginColonySortie(colony, selectedTarget.id);
    colony = sortie.colony;
    const input = createBattleInput(sortie.seed);
    const result = resolveOrbitscarBattle(input);
    const waves = firstWave ? [firstWave] : [];
    const waveDraft = Object.fromEntries(Object.entries(session.plan.selectedArmy).map(([unitId, count]) => [unitId, Math.max(0, count - countStaged(waves, unitId))]));
    session = { ...session, plan: { ...session.plan, waves, waveDraft } };
    session = startBattle(session, { input, result, attemptId: newAttemptId(), startedAt: performance.now(), eventIndex: 0, done: false, currentTick: 0 });
    persistColony(colony, `Sortie ${colony.sortieCount} launched with a fresh deterministic seed.`);
    persistActiveBattle();
    selectedCommanderTargetId = undefined;
    lastUiReplayTick = -1;
    refresh();
  }
  catch (error) { setNotice(error instanceof Error ? error.message : "Battle input rejected."); }
}

function retreat(): void {
  const replay = session.replay;
  if (!replay || replay.done || replay.kind === "defense" || replay.archived || colony.reports.some((report) => report.attemptId === replay.attemptId)) return;
  const tick = Math.max(activeBattleTick(replay) + 1, (replay.input.commands.at(-1)?.tick ?? -1) + 1);
  const sequence = Math.max(0, ...replay.input.commands.map((command) => command.sequence)) + 1;
  appendLiveCommand({ commandId: `retreat-${replay.attemptId}`, sequence, tick, type: "RETREAT", payload: {} });
}

function onFrame(now: number): void {
  const replay = session.replay;
  if (!replay || replay.done) return;
  const elapsedTicks = Math.floor((now - replay.startedAt) / 1000 * 30);
  let eventIndex = replay.eventIndex;
  while (eventIndex < replay.result.events.length && replay.result.events[eventIndex].tick <= elapsedTicks) eventIndex += 1;
  if (eventIndex > replay.eventIndex) {
    for (const event of replay.result.events.slice(replay.eventIndex, eventIndex)) {
      if (event.type === "deployed") playSound("deploy", colony.settings.muted);
      else if (event.type === "ability") playSound("ability", colony.settings.muted);
      else if (event.type === "unit_destroyed" || event.type === "defense_destroyed") playSound("impact", colony.settings.muted);
      else if (event.type === "battle_ended") playSound(replay.result.winner === (replay.kind === "defense" ? "defender" : "attacker") ? "victory" : "defeat", colony.settings.muted);
    }
  }
  const currentTick = Math.min(replay.input.maxDurationTicks, elapsedTicks);
  const done = currentTick >= replay.result.durationTicks;
  if (eventIndex !== replay.eventIndex || done !== replay.done || currentTick !== replay.currentTick) { session = { ...session, replay: { ...replay, eventIndex, done, currentTick } }; if (eventIndex !== replay.eventIndex && !colony.reports.some((report) => report.attemptId === replay.attemptId)) persistActiveBattle(); if (eventIndex !== replay.eventIndex || done) { if (currentTick - lastUiReplayTick >= 15 || done) { lastUiReplayTick = Math.min(currentTick, replay.result.durationTicks); refresh(); } } }
}

function handleAction(action: string): void {
  const [verb, value, unitId] = action.split(":");
  if (action === "colony") { session = clearAttackPlan(session); setMode("colony"); return; }
  if (action === "targets") { session = clearAttackPlan(session); setMode("targets"); return; }
  if (action === "army") { if (!colony.scoutedTargets.includes(selectedTarget.id)) { session = clearAttackPlan(session); setMode("targets"); setNotice("Scout the selected target before composing a force."); return; } session = beginArmyComposition(session); setMode("army"); return; }
  if (action === "collect") { colony = collectColonyProduction(colony, Date.now(), content); saveColony("Stored production collected."); return; }
  if (action === "save") { saveColony("Colony saved locally."); return; }
  if (verb === "commander" && value) { try { colony = selectColonyCommander(colony, value, content); saveColony(`${displayName(value)} assigned to the command seat.`); } catch (error) { setNotice(error instanceof Error ? error.message : "Commander selection failed."); } return; }
  if (verb === "research" && value) { try { colony = researchDoctrine(colony, value, content); saveColony(`${displayName(value)} doctrine researched. Its benefits are active.`); } catch (error) { setNotice(error instanceof Error ? error.message : "Doctrine research failed."); } return; }
  if (verb === "replay-report" && value) {
    const report = colony.reports.find((entry) => entry.attemptId === value);
    if (!report?.input) { setNotice("This legacy report has no saved replay snapshot."); return; }
    const reportedEncounter = report.sectorNodeId ? content.encounters[report.sectorNodeId] : undefined;
    selectedTarget = report.kind === "defense" ? { id: "home-colony", requiredTier: 1, opponentTier: 1, name: "Home Colony", codename: "DEFENSE-LOG", difficulty: "contested", description: "Archived deterministic battle snapshot.", rewardPreview: report.input.rewardPreview, structures: report.input.structures, suggestedCounters: [] } : reportedEncounter ?? { id: selectedTarget.id, requiredTier: 1, opponentTier: 1, name: selectedTarget.name, codename: selectedTarget.codename, difficulty: "contested", description: "Archived deterministic battle snapshot.", rewardPreview: report.input.rewardPreview, structures: report.input.structures, suggestedCounters: [] };
    clearActiveBattle();
    session = startBattle(session, { kind: report.kind, input: report.input, result: report.result, attemptId: report.attemptId, startedAt: performance.now(), eventIndex: 0, done: false, currentTick: 0, archived: true });
    lastUiReplayTick = -1;
    refresh();
    return;
  }
  if (action === "simulate-raid") { startColonyRaid(); return; }
  if (action === "toggle-readability") { colony = { ...colony, settings: { ...colony.settings, reducedMotion: !colony.settings.reducedMotion } }; saveColony(colony.settings.reducedMotion ? "Low-effects readability mode on: calmer tactical updates, all gameplay information preserved." : "Standard effects restored."); return; }
  if (action === "toggle-audio") { colony = { ...colony, settings: { ...colony.settings, muted: !colony.settings.muted } }; saveColony(colony.settings.muted ? "Sound muted." : "Sound enabled."); return; }
  if (verb === "scout" && value && content.encounters[value] && content.encounters[value].requiredTier <= commandTierOf(colony)) { try { selectedTarget = content.encounters[value]; colony = recordColonyScout(colony, value, content); saveColony(`${selectedTarget.name} intel recorded.`); } catch (error) { setNotice(error instanceof Error ? error.message : "Scouting failed."); } return; }
  if (verb === "train" && value) { try { colony = trainUnits(colony, value, 1, content); saveColony(`${displayName(value)} added to reserves.`); } catch (error) { setNotice(error instanceof Error ? error.message : "Training failed."); } return; }
  if (verb === "build" && value && content.buildings[value]) { buildMode = value; selectedBuildingId = undefined; setNotice(`Placement mode: ${displayName(value)}. Tap an open grid cell.`); return; }
  if (verb === "select-building" && value) { selectedBuildingId = value; notice = `${displayName(colony.buildings.find((building) => building.id === value)?.buildingId ?? value)} selected.`; refresh(); return; }
  if (verb === "upgrade" && value) { try { colony = upgradeColonyBuilding(colony, value, content); saveColony("Module upgraded."); } catch (error) { setNotice(error instanceof Error ? error.message : "Upgrade failed."); } return; }
  if (verb === "repair" && value) { try { colony = repairColonyBuilding(colony, value, content); saveColony("Module integrity restored."); } catch (error) { setNotice(error instanceof Error ? error.message : "Repair failed."); } return; }
  if (verb === "army" && value && unitId) { adjustArmy(unitId, value === "+" ? 1 : -1); return; }
  if (action === "begin-deployment") { if (capacityOf(session.plan.selectedArmy) === 0) { setNotice("Choose at least one unit from your persistent reserves."); return; } session = beginDeployment(session); setMode("deployment"); return; }
  if (verb === "zone" && value && ["west", "north", "south", "east"].includes(value)) { updatePlan({ ...session.plan, selectedZone: value as Zone }); return; }
  if (verb === "commander-target" && value) { selectedCommanderTargetId = value; refresh(); return; }
  if (verb === "wave" && value && unitId) { adjustWave(unitId, value === "+" ? 1 : -1); return; }
  if (action === "deploy-wave") { stageWave(); return; }
  if (action === "live-reinforce") { deployReinforcements(); return; }
  if (action === "commander-ability") { activateCommander(); return; }
  if (action === "resolve-battle") { resolveBattle(); return; }
  if (action === "report") { session = showReport(session); refresh(); return; }
  if (action === "retreat") { retreat(); return; }
  if (action === "restart-plan") { session = restartPlan(session); setMode("deployment"); return; }
  if (action === "cancel-deployment") { session = clearAttackPlan(session); setMode("targets"); return; }
  if (action === "attack-again") { session = attackAgain(session); setMode("army"); return; }
  if (action === "return-home" && session.replay) { try { const priorClaims = colony.sector.securedNodeIds.length; colony = session.replay.kind === "defense" ? applyColonyDefenseResult(colony, session.replay.input, session.replay.result, session.replay.attemptId) : applyBattleResult(colony, session.replay.input, session.replay.result, session.replay.attemptId, selectedTarget.id); const claimed = colony.sector.securedNodeIds.length > priorClaims; saveColony(session.replay.kind === "defense" ? "Raid report archived. Colony damage recorded." : claimed ? `${selectedTarget.name} relay secured. Connected frontier expanded.` : "Battle report archived. Survivors and salvage reconciled."); clearActiveBattle(); session = clearAttackPlan(session); setMode("colony"); } catch (error) { setNotice(error instanceof Error ? error.message : "Settlement rejected."); } }
}

function placeBuilding(position: { x: number; y: number }): void {
  if (!buildMode) return;
  try { colony = placeColonyBuilding(colony, buildMode, position, content); const placed = buildMode; buildMode = undefined; previewPosition = undefined; saveColony(`${displayName(placed)} placed.`); }
  catch (error) { setNotice(error instanceof Error ? error.message : "Placement rejected."); }
}

root.addEventListener("click", (event) => { const target = event.target as HTMLElement; const actionElement = target.closest<HTMLElement>("[data-action]"); if (actionElement?.dataset.action) { handleAction(actionElement.dataset.action); playSound("ui", colony.settings.muted); } });

restoreActiveBattle();
new Phaser.Game({ type: Phaser.AUTO, parent: "game", backgroundColor: "#081018", scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH, width: ARENA.width, height: ARENA.height }, input: { activePointers: 3 }, scene: new OrbitscarScene({ content, getMode: () => session.mode, getColony: () => colony, getBuildMode: () => buildMode, getSelectedBuildingId: () => selectedBuildingId, getSelectedZone: () => session.plan.selectedZone, getTargetStructures: () => selectedTarget.structures, getReplay: () => session.replay, isReducedMotion: () => colony.settings.reducedMotion, setPreview: (position) => { previewPosition = position; }, selectBuilding: (id) => { selectedBuildingId = id; refresh(); }, selectZone: (zone) => { updatePlan({ ...session.plan, selectedZone: zone }); }, placeBuilding, onFrame }) });
refresh();
