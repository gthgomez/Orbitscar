import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import balance from "@orbitscar/content/data/orbitscar-v0/balance.json" with { type: "json" };
import { parseOrbitscarContent } from "@orbitscar/content";
import type { Zone } from "./corpus.js";
import { planDescriptors, runBattle, summarize, type RunRecord } from "./evaluate.js";

const args = process.argv.slice(2);
function option(name: string, fallback: string): string {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] !== undefined ? args[index + 1] : fallback;
}

const targetRuns = Number(option("runs", "1152"));
const seedBase = Number(option("seed-base", "10000"));
const outDir = option("out", join("runs", `eval-${new Date().toISOString().slice(0, 10)}`));

const content = parseOrbitscarContent(balance);
const encounters = Object.values(content.encounters);
const zones: Zone[] = ["west", "north", "south", "east"];
const plans = [...planDescriptors(encounters, content, zones, [false, true])];
const replicas = Math.max(1, Math.ceil(targetRuns / plans.length));

mkdirSync(outDir, { recursive: true });
const jsonlPath = join(outDir, "runs.jsonl");
const records: RunRecord[] = [];
let runIndex = 0;

const started = Date.now();
for (let replica = 0; replica < replicas; replica++) {
  for (const plan of plans) {
    // deterministic per-plan seeds: same replica index always yields the same seed
    const seed = seedBase + replica * 7919 + [...plan.descriptor.encounterId].reduce((total, ch) => total + ch.charCodeAt(0), 0);
    const built = plan.build(seed);
    const { record } = runBattle(content, content.encounters[built.descriptor.encounterId], built, runIndex, runIndex % 25 === 0);
    records.push(record);
    runIndex += 1;
  }
}
writeFileSync(jsonlPath, records.map((record) => JSON.stringify(record)).join("\n") + "\n");

const summary = summarize(records);
const summaryPath = join(outDir, "summary.json");
writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

console.log(`runs: ${records.length} (${plans.length} plans × ${replicas} seed replicas) in ${((Date.now() - started) / 1000).toFixed(1)}s`);
console.log(`invariant violations: ${summary.invariantViolations}`);
console.log(`unique outcome hashes: ${summary.uniqueOutcomeHashes}/${records.length}`);
console.log(`jsonl: ${jsonlPath}`);
console.log(`summary: ${summaryPath}`);

const worst = [...summary.groups].sort((a, b) => a.winRate - b.winRate)[0];
const best = [...summary.groups].sort((a, b) => b.winRate - a.winRate)[0];
if (worst) console.log(`lowest win rate: ${worst.encounter}/${worst.composition}/${worst.timing}/${worst.zone}${worst.ability ? "/ability" : ""} → ${(worst.winRate * 100).toFixed(0)}%`);
if (best) console.log(`highest win rate: ${best.encounter}/${best.composition}/${best.timing}/${best.zone}${best.ability ? "/ability" : ""} → ${(best.winRate * 100).toFixed(0)}%`);
if (summary.invariantViolations > 0) process.exitCode = 1;
