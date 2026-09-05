import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseOrbitscarContent } from "./schema.js";

const filePath = resolve("packages/content/data/orbitscar-v0/balance.json");
const content = parseOrbitscarContent(JSON.parse(await readFile(filePath, "utf8")));
if (Object.keys(content.resources).length !== 3) throw new Error("Prototype content must define exactly 3 resources");
if (Object.keys(content.buildings).length !== 6) throw new Error("Prototype content must define exactly 6 buildings");
if (Object.keys(content.units).length !== 10) throw new Error("Prototype content must define exactly 10 units");
if (Object.keys(content.commanders).length !== 2) throw new Error("Prototype content must define exactly 2 commanders");
if (Object.keys(content.encounters).length < 1) throw new Error("Content must define at least one authored encounter");
console.log(`Orbitscar content valid: ${Object.keys(content.resources).length} resources, ${Object.keys(content.buildings).length} buildings, ${Object.keys(content.defenses).length} defenses, ${Object.keys(content.units).length} units, ${Object.keys(content.commanders).length} commanders, ${Object.keys(content.encounters).length} encounters`);
