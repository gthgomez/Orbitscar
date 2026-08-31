import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseOrbitscarContent } from "@orbitscar/content";
import { parseOrbitscarBattleScenario, resolveOrbitscarBattle, type OrbitscarBattleResult } from "./orbitscar.js";

const contentPath = resolve("packages/content/data/orbitscar-v0/balance.json");
const content = parseOrbitscarContent(JSON.parse(await readFile(contentPath, "utf8")));
const scenarioPaths = process.argv.slice(2).filter((argument) => argument !== "--");
if (scenarioPaths.length === 0) throw new Error("usage: pnpm simulate -- <scenario.json> [other-scenario.json]");

function summary(path: string, result: OrbitscarBattleResult): Record<string, unknown> {
  return { scenario: path, winner: result.winner, victoryTier: result.victoryTier, durationTicks: result.durationTicks, attackerCasualties: result.attackerCasualties, survivingUnits: result.survivingUnits, destroyedStructures: result.destroyedStructureIds, damageByEntity: result.damageByEntity, deploymentUsage: result.deploymentUsage, commanderUse: result.commanderUse, eventCount: result.eventCount, outcomeHash: result.outcomeHash, canonicalHash: result.canonicalHash };
}

const results: { path: string; result: OrbitscarBattleResult }[] = [];
for (const scenarioPath of scenarioPaths) {
  const raw = JSON.parse(await readFile(resolve(scenarioPath), "utf8"));
  results.push({ path: scenarioPath, result: resolveOrbitscarBattle(parseOrbitscarBattleScenario(raw, content)) });
}
if (results.length === 1) console.log(JSON.stringify(summary(results[0].path, results[0].result), null, 2));
else console.log(JSON.stringify({ scenarios: results.map(({ path, result }) => summary(path, result)), comparison: { sameOutcome: new Set(results.map(({ result }) => result.outcomeHash)).size === 1, differentDurations: new Set(results.map(({ result }) => result.durationTicks)).size > 1, differentCasualties: new Set(results.map(({ result }) => JSON.stringify(result.attackerCasualties))).size > 1, differentStructures: new Set(results.map(({ result }) => JSON.stringify(result.destroyedStructureIds))).size > 1 } }, null, 2));
