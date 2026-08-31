export const TARGET_TAGS = [
  "core",
  "defense",
  "utility",
  "economy",
  "deployment",
  "resource",
  "air",
  "ground",
  "anti_armor",
  "anti_swarm",
  "control",
] as const;

export type OrbitscarTargetTag = (typeof TARGET_TAGS)[number];

export type OrbitscarTargetPriority =
  | { selector: "tag"; tag: OrbitscarTargetTag }
  | { selector: "nearest"; tag?: OrbitscarTargetTag }
  | { selector: "lowest_health"; tag?: OrbitscarTargetTag }
  | { selector: "any" };

export type OrbitscarUnitDefinition = {
  id: string;
  role: string;
  capacity: number;
  power: number;
  health: number;
  range: number;
  speed: number;
  cadence: number;
  targetPriority: OrbitscarTargetPriority[];
  targetTags: OrbitscarTargetTag[];
  counters: string[];
  cost: OrbitscarResourceBundle;
};

export type OrbitscarResourceBundle = Record<string, number>;

export type OrbitscarBuildingDefinition = {
  id: string;
  footprint: [number, number];
  maxHealth: number;
  targetTags: OrbitscarTargetTag[];
  defenseId?: string;
  cost: OrbitscarResourceBundle;
};

export type OrbitscarDefenseDefinition = {
  id: string;
  buildingId: string;
  maxHealth: number;
  range: number;
  damage: number;
  cadence: number;
  targetPriority: OrbitscarTargetPriority[];
  targetTags: OrbitscarTargetTag[];
};

export type OrbitscarAbilityDefinition = {
  id: string;
  kind: "reroute";
  durationTicks: number;
  magnitude: number;
};

export type OrbitscarCommanderDefinition = {
  id: string;
  abilityId: string;
  charges: number;
};

export type OrbitscarContent = {
  schemaVersion: number;
  contentSet: string;
  rulesetVersion: string;
  resources: Record<string, { id: string; kind: "normal" }>;
  buildings: Record<string, OrbitscarBuildingDefinition>;
  defenses: Record<string, OrbitscarDefenseDefinition>;
  units: Record<string, OrbitscarUnitDefinition>;
  abilities: Record<string, OrbitscarAbilityDefinition>;
  commanders: Record<string, OrbitscarCommanderDefinition>;
};

type UnknownRecord = Record<string, unknown>;

function record(value: unknown, label: string): UnknownRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as UnknownRecord;
}

function stringValue(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(`${label} must be a non-empty string`);
  return value;
}

function integerValue(value: unknown, label: string, minimum = 0): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum) {
    throw new Error(`${label} must be an integer >= ${minimum}`);
  }
  return value;
}

function finiteNumber(value: unknown, label: string, minimum = 0): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum) {
    throw new Error(`${label} must be a finite number >= ${minimum}`);
  }
  return value;
}

function stringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value.map((entry, index) => stringValue(entry, `${label}[${index}]`));
}

function resourceBundle(value: unknown, label: string): OrbitscarResourceBundle {
  const input = record(value, label);
  const output: OrbitscarResourceBundle = {};
  for (const [resourceId, amount] of Object.entries(input)) output[resourceId] = finiteNumber(amount, `${label}.${resourceId}`);
  return output;
}

function tags(value: unknown, label: string): OrbitscarTargetTag[] {
  const values = stringArray(value, label);
  return values.map((tag) => {
    if (!(TARGET_TAGS as readonly string[]).includes(tag)) throw new Error(`${label} contains unknown target tag '${tag}'`);
    return tag as OrbitscarTargetTag;
  });
}

function priorities(value: unknown, label: string): OrbitscarTargetPriority[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${label} must be a non-empty array`);
  return value.map((entry, index) => {
    const item = record(entry, `${label}[${index}]`);
    const selector = stringValue(item.selector, `${label}[${index}].selector`);
    if (selector === "any") {
      if (item.tag !== undefined) throw new Error(`${label}[${index}] any selector cannot have a tag`);
      return { selector: "any" };
    }
    if (selector === "tag") {
      const tag = tags([item.tag], `${label}[${index}].tag`)[0];
      return { selector: "tag", tag };
    }
    if (selector === "nearest" || selector === "lowest_health") {
      const tag = item.tag === undefined ? undefined : tags([item.tag], `${label}[${index}].tag`)[0];
      return tag === undefined ? { selector } : { selector, tag };
    }
    throw new Error(`${label}[${index}] has unknown selector '${selector}'`);
  });
}

function uniqueIds<T extends { id: string }>(values: T[], label: string): Record<string, T> {
  const output: Record<string, T> = {};
  for (const value of values) {
    if (output[value.id]) throw new Error(`${label} contains duplicate ID '${value.id}'`);
    output[value.id] = value;
  }
  return output;
}

export function parseOrbitscarContent(value: unknown): OrbitscarContent {
  const input = record(value, "content");
  const schemaVersion = integerValue(input.schemaVersion, "schemaVersion", 1);
  const contentSet = stringValue(input.contentSet, "contentSet");
  const rulesetVersion = stringValue(input.rulesetVersion, "rulesetVersion");
  const rawResources = record(input.resources, "resources");
  const resources: OrbitscarContent["resources"] = {};
  for (const [id, raw] of Object.entries(rawResources)) {
    const item = record(raw, `resources.${id}`);
    const kind = stringValue(item.kind, `resources.${id}.kind`);
    if (kind !== "normal") throw new Error(`resources.${id}.kind must be normal`);
    resources[id] = { id, kind: "normal" };
  }

  const rawBuildings = record(input.buildings, "buildings");
  const buildings = uniqueIds(
    Object.entries(rawBuildings).map(([id, raw]) => {
      const item = record(raw, `buildings.${id}`);
      const footprintValue = item.footprint;
      if (!Array.isArray(footprintValue) || footprintValue.length !== 2) throw new Error(`buildings.${id}.footprint must be [width,height]`);
      const footprint = [integerValue(footprintValue[0], `buildings.${id}.footprint[0]`, 1), integerValue(footprintValue[1], `buildings.${id}.footprint[1]`, 1)] as [number, number];
      const defenseId = item.defenseId === undefined ? undefined : stringValue(item.defenseId, `buildings.${id}.defenseId`);
      return { id, footprint, maxHealth: finiteNumber(item.maxHealth, `buildings.${id}.maxHealth`, 1), targetTags: tags(item.targetTags, `buildings.${id}.targetTags`), cost: resourceBundle(item.cost, `buildings.${id}.cost`), ...(defenseId === undefined ? {} : { defenseId }) };
    }),
    "buildings",
  );

  const rawDefenses = record(input.defenses, "defenses");
  const defenses = uniqueIds(
    Object.entries(rawDefenses).map(([id, raw]) => {
      const item = record(raw, `defenses.${id}`);
      return { id, buildingId: stringValue(item.buildingId, `defenses.${id}.buildingId`), maxHealth: finiteNumber(item.maxHealth, `defenses.${id}.maxHealth`, 1), range: finiteNumber(item.range, `defenses.${id}.range`), damage: finiteNumber(item.damage, `defenses.${id}.damage`), cadence: integerValue(item.cadence, `defenses.${id}.cadence`, 1), targetPriority: priorities(item.targetPriority, `defenses.${id}.targetPriority`), targetTags: tags(item.targetTags, `defenses.${id}.targetTags`) };
    }),
    "defenses",
  );

  const rawUnits = record(input.units, "units");
  const units = uniqueIds(
    Object.entries(rawUnits).map(([id, raw]) => {
      const item = record(raw, `units.${id}`);
      return { id, role: stringValue(item.role, `units.${id}.role`), capacity: integerValue(item.capacity, `units.${id}.capacity`, 1), power: finiteNumber(item.power, `units.${id}.power`, 1), health: finiteNumber(item.health, `units.${id}.health`, 1), range: finiteNumber(item.range, `units.${id}.range`), speed: finiteNumber(item.speed, `units.${id}.speed`, 1), cadence: integerValue(item.cadence, `units.${id}.cadence`, 1), targetPriority: priorities(item.targetPriority, `units.${id}.targetPriority`), targetTags: tags(item.targetTags, `units.${id}.targetTags`), counters: stringArray(item.counters, `units.${id}.counters`), cost: resourceBundle(item.cost, `units.${id}.cost`) };
    }),
    "units",
  );

  const rawAbilities = record(input.abilities, "abilities");
  const abilities = uniqueIds(
    Object.entries(rawAbilities).map(([id, raw]) => {
      const item = record(raw, `abilities.${id}`);
      const kind = stringValue(item.kind, `abilities.${id}.kind`);
      if (kind !== "reroute") throw new Error(`abilities.${id}.kind '${kind}' is unknown`);
      return { id, kind: "reroute" as const, durationTicks: integerValue(item.durationTicks, `abilities.${id}.durationTicks`, 1), magnitude: finiteNumber(item.magnitude, `abilities.${id}.magnitude`, 1) };
    }),
    "abilities",
  );

  const rawCommanders = record(input.commanders, "commanders");
  const commanders = uniqueIds(
    Object.entries(rawCommanders).map(([id, raw]) => {
      const item = record(raw, `commanders.${id}`);
      return { id, abilityId: stringValue(item.abilityId, `commanders.${id}.abilityId`), charges: integerValue(item.charges, `commanders.${id}.charges`, 1) };
    }),
    "commanders",
  );

  for (const building of Object.values(buildings)) {
    if (building.defenseId !== undefined && defenses[building.defenseId] === undefined) throw new Error(`building '${building.id}' references unknown defense '${building.defenseId}'`);
  }
  for (const defense of Object.values(defenses)) {
    if (buildings[defense.buildingId] === undefined) throw new Error(`defense '${defense.id}' references unknown building '${defense.buildingId}'`);
  }
  for (const commander of Object.values(commanders)) {
    if (abilities[commander.abilityId] === undefined) throw new Error(`commander '${commander.id}' references unknown ability '${commander.abilityId}'`);
  }

  return { schemaVersion, contentSet, rulesetVersion, resources, buildings, defenses, units, abilities, commanders };
}
