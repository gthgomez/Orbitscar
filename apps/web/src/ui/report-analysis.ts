import type { OrbitscarContent, OrbitscarEncounterDefinition } from "@orbitscar/content";
import type { OrbitscarBattleResult } from "@orbitscar/simulation";

export type BattleReportAnalysis = {
  recordedFacts: string[];
  tacticalSuggestion?: string;
};

type ReportKind = "attack" | "defense";

function friendlyName(id: string): string {
  return id.replace(/#\d+$/, "").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function entityName(id: string, target: OrbitscarEncounterDefinition, content: OrbitscarContent): string {
  const structure = target.structures.find((entry) => entry.id === id);
  return friendlyName(structure?.buildingId ?? id);
}

function topByAmount(entries: Map<string, number> | undefined): [string, number] | undefined {
  return entries ? [...entries].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] : undefined;
}

export function analyzeBattleReport(
  result: OrbitscarBattleResult,
  kind: ReportKind,
  target: OrbitscarEncounterDefinition,
  content: OrbitscarContent,
): BattleReportAnalysis {
  const facts: string[] = [];
  const structureIds = new Set(target.structures.map((structure) => structure.id));
  const defenseIds = new Set(target.structures.filter((structure) => content.buildings[structure.buildingId].defenseId !== undefined).map((structure) => structure.id));
  const attackerDamageByStructure = new Map<string, Map<string, number>>();
  const defenseDamage = new Map<string, number>();
  const defenseKills = new Map<string, number>();
  const structureDamageByUnit = new Map<string, number>();
  const deployedEvents = result.events.filter((event) => event.type === "deployed" && event.entityId);

  for (const event of result.events) {
    if ((event.type === "unit_damaged" || event.type === "unit_destroyed") && event.targetId && defenseIds.has(event.targetId)) {
      defenseDamage.set(event.targetId, (defenseDamage.get(event.targetId) ?? 0) + (event.value ?? 0));
    }
    if (event.type === "unit_attacked" && event.entityId && event.targetId && structureIds.has(event.targetId)) {
      const unitId = event.entityId.replace(/#\d+$/, "");
      structureDamageByUnit.set(unitId, (structureDamageByUnit.get(unitId) ?? 0) + (event.value ?? 0));
      const byUnit = attackerDamageByStructure.get(event.targetId) ?? new Map<string, number>();
      byUnit.set(unitId, (byUnit.get(unitId) ?? 0) + (event.value ?? 0));
      attackerDamageByStructure.set(event.targetId, byUnit);
    }
    if (event.type === "unit_destroyed" && event.targetId && structureIds.has(event.targetId)) {
      defenseKills.set(event.targetId, (defenseKills.get(event.targetId) ?? 0) + 1);
    }
  }

  if (kind === "attack") {
    const topDefense = topByAmount(defenseDamage);
    if (topDefense) {
      const kills = defenseKills.get(topDefense[0]) ?? 0;
      facts.push(`${entityName(topDefense[0], target, content)} dealt ${topDefense[1]} recorded damage and destroyed ${kills} unit${kills === 1 ? "" : "s"}.`);
    } else facts.push("No defense fire was recorded.");

    const topUnit = topByAmount(structureDamageByUnit);
    if (topUnit) facts.push(`${friendlyName(topUnit[0])} dealt ${topUnit[1]} recorded structure damage.`);
    else facts.push("No attacker damage to structures was recorded.");

    const waves = result.deploymentUsage;
    let deployedIndex = 0;
    for (let index = 0; index < waves.length; index += 1) {
      const wave = waves[index];
      const deployedCount = wave.units.reduce((sum, entry) => sum + entry.count, 0);
      const waveEntities = deployedEvents.slice(deployedIndex, deployedIndex + deployedCount);
      deployedIndex += deployedCount;
      let damage = 0;
      for (const deployed of waveEntities) {
        if (!deployed.entityId) continue;
        damage += result.events.filter((event) => event.type === "unit_attacked" && event.entityId === deployed.entityId && event.targetId && structureIds.has(event.targetId)).reduce((sum, event) => sum + (event.value ?? 0), 0);
      }
      const waveLabel = index === 0 ? "Opening wave" : `Reinforcement ${index}`;
      facts.push(`${waveLabel} dealt ${damage} recorded damage and used ${wave.capacityUsed} capacity.`);
    }

    const ability = result.events.find((event) => event.type === "ability");
    if (ability) facts.push(`${friendlyName(ability.entityId ?? result.commanderUse.abilityId)} was activated at tick ${ability.tick}${ability.targetId ? `, focused on ${entityName(ability.targetId, target, content)}` : ""}.`);
    else facts.push("No commander ability activation was recorded.");

    const firstContact = result.events.find((event) => event.type === "defense_fired");
    if (firstContact?.entityId) facts.push(`${entityName(firstContact.entityId, target, content)} opened fire at tick ${firstContact.tick}.`);
    if (result.retreated) facts.push("The force retreated; surviving units remain available for another sortie.");
    else {
      const casualties = Object.values(result.attackerCasualties).reduce((sum, count) => sum + count, 0);
      const deployed = result.deploymentUsage.reduce((sum, usage) => sum + usage.units.reduce((unitTotal, entry) => unitTotal + entry.count, 0), 0);
      const returned = Math.max(0, deployed - casualties);
      const reserves = Math.max(0, Object.values(result.survivingUnits).reduce((sum, count) => sum + count, 0) - returned);
      facts.push(`${casualties} attacker casualties were recorded; ${returned} deployed units returned and ${reserves} remained in reserve.`);
    }

    const suggestions = target.suggestedCounters.map((id) => friendlyName(id));
    return { recordedFacts: facts, tacticalSuggestion: suggestions.length ? `Intel suggests considering ${suggestions.join(", ")} for this defense profile.` : undefined };
  }

  const topDefense = topByAmount(defenseDamage);
  const kills = topDefense ? defenseKills.get(topDefense[0]) ?? 0 : 0;
  if (topDefense) facts.push(`${entityName(topDefense[0], target, content)} dealt ${topDefense[1]} recorded damage and destroyed ${kills} raider${kills === 1 ? "" : "s"}.`);
  else facts.push("No colony defense fire was recorded.");

  const mostDamagedStructure = topByAmount(new Map(Object.entries(result.damageByEntity).filter(([id]) => structureIds.has(id))));
  const topAttacker = mostDamagedStructure ? topByAmount(attackerDamageByStructure.get(mostDamagedStructure[0])) : undefined;
  if (mostDamagedStructure) facts.push(`${entityName(mostDamagedStructure[0], target, content)} took ${mostDamagedStructure[1]} recorded damage${topAttacker ? ` from ${friendlyName(topAttacker[0])}` : ""}.`);
  else facts.push("No colony structure took recorded damage.");
  facts.push(`${Object.values(result.attackerCasualties).reduce((sum, count) => sum + count, 0)} raider casualties were recorded.`);
  return { recordedFacts: facts };
}
