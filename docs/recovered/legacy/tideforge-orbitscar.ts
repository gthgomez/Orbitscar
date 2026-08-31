/**
 * Clean-room Orbitscar combat foundation.
 *
 * This module is intentionally isolated from the existing Tideforge resolver
 * and content IDs. It provides canonical input validation, deterministic
 * event ordering, and a tiny ruleset suitable for the first sandbox.
 * It is not production balance or a replacement for the current resolver.
 */

export type OrbitscarUnit = {
  id: string;
  role: string;
  count: number;
  capacity: number;
  power: number;
  targetTags: string[];
};

export type OrbitscarDefense = {
  id: string;
  role: string;
  health: number;
  targetTags: string[];
};

export type OrbitscarDeploymentEvent = {
  sequence: number;
  tick: number;
  dropId: string;
  unitIds: string[];
  zone: string;
};

export type OrbitscarAbilityEvent = {
  sequence: number;
  tick: number;
  abilityId: "emergency_reroute" | "overwatch_ping";
};

export type OrbitscarBattleInput = {
  rulesetVersion: string;
  seed: number;
  deploymentCapacity: number;
  maxDeploymentCharges: number;
  units: OrbitscarUnit[];
  defenses: OrbitscarDefense[];
  deployments: OrbitscarDeploymentEvent[];
  abilities: OrbitscarAbilityEvent[];
};

export type OrbitscarBattleEvent = {
  sequence: number;
  tick: number;
  type: "battle_started" | "deployed" | "ability" | "defense_damaged" | "battle_ended";
  entityId?: string;
  value?: number;
};

export type OrbitscarBattleResult = {
  rulesetVersion: string;
  seed: number;
  winner: "attacker" | "defender" | "draw";
  events: OrbitscarBattleEvent[];
  canonicalHash: string;
};

export type OrbitscarValidation = {
  ok: boolean;
  errors: string[];
};

function stableStringify(value: unknown): string {
  return JSON.stringify(value) ?? "";
}

function stableCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function sortedUnits(units: OrbitscarUnit[]): OrbitscarUnit[] {
  return [...units]
    .map((unit) => ({ ...unit, targetTags: [...unit.targetTags].sort() }))
    .sort((a, b) => stableCompare(a.id, b.id));
}

function sortedDefenses(defenses: OrbitscarDefense[]): OrbitscarDefense[] {
  return [...defenses]
    .map((defense) => ({ ...defense, targetTags: [...defense.targetTags].sort() }))
    .sort((a, b) => stableCompare(a.id, b.id));
}

export function canonicalizeOrbitscarInput(input: OrbitscarBattleInput): OrbitscarBattleInput {
  return {
    rulesetVersion: input.rulesetVersion,
    seed: input.seed >>> 0,
    deploymentCapacity: input.deploymentCapacity,
    maxDeploymentCharges: input.maxDeploymentCharges,
    units: sortedUnits(input.units),
    defenses: sortedDefenses(input.defenses),
    deployments: [...input.deployments]
      .map((event) => ({ ...event, unitIds: [...event.unitIds].sort() }))
      .sort((a, b) => a.sequence - b.sequence),
    abilities: [...input.abilities].sort((a, b) => a.sequence - b.sequence),
  };
}

/** Non-cryptographic stable hash for replay identity; server signatures belong at the API boundary. */
export function hashOrbitscarCanonicalInput(input: OrbitscarBattleInput): string {
  const text = stableStringify(canonicalizeOrbitscarInput(input));
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function duplicateSequences(values: { sequence: number }[]): boolean {
  return new Set(values.map((value) => value.sequence)).size !== values.length;
}

export function validateOrbitscarInput(input: OrbitscarBattleInput): OrbitscarValidation {
  const errors: string[] = [];
  const unitIds = new Set(input.units.map((unit) => unit.id));
  const totalCapacity = input.units.reduce(
    (sum, unit) => sum + Math.max(0, Math.floor(unit.count)) * Math.max(0, unit.capacity),
    0,
  );
  const deploymentUnitIds = input.deployments.flatMap((event) => event.unitIds);

  if (!input.rulesetVersion) errors.push("rulesetVersion is required");
  if (!Number.isInteger(input.seed) || input.seed < 0) errors.push("seed must be an unsigned integer");
  if (!Number.isInteger(input.deploymentCapacity) || input.deploymentCapacity < 0) {
    errors.push("deploymentCapacity must be a non-negative integer");
  }
  if (input.maxDeploymentCharges < 0 || input.deployments.length > input.maxDeploymentCharges) {
    errors.push("deployment charge limit exceeded");
  }
  if (duplicateSequences(input.deployments)) errors.push("deployment sequence numbers must be unique");
  if (duplicateSequences(input.abilities)) errors.push("ability sequence numbers must be unique");
  if (totalCapacity > input.deploymentCapacity) errors.push("army exceeds deployment capacity");
  if (deploymentUnitIds.some((id) => !unitIds.has(id))) errors.push("deployment references unknown unit");
  if (input.units.some((unit) => unit.count < 0 || unit.capacity < 0 || unit.power < 0)) {
    errors.push("unit counts, capacity, and power must be non-negative");
  }
  if (input.defenses.some((defense) => defense.health < 0)) errors.push("defense health must be non-negative");
  return { ok: errors.length === 0, errors };
}

function nextRandom(seed: number): { seed: number; value: number } {
  let next = (seed + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { seed: next, value: ((t ^ (t >>> 14)) >>> 0) / 4294967296 };
}

/**
 * Resolve only the first sandbox rules: deployments damage a deterministic
 * defense target selected by explicit role tags. It is deliberately small so
 * later agents can replace the rules without changing the replay contract.
 */
export function resolveOrbitscarBattle(input: OrbitscarBattleInput): OrbitscarBattleResult {
  const validation = validateOrbitscarInput(input);
  if (!validation.ok) throw new Error(`INVALID_BATTLE_INPUT: ${validation.errors.join(", ")}`);

  const canonical = canonicalizeOrbitscarInput(input);
  const defenses = canonical.defenses.map((defense) => ({ ...defense }));
  const units = new Map(canonical.units.map((unit) => [unit.id, unit]));
  const events: OrbitscarBattleEvent[] = [
    { sequence: 0, tick: 0, type: "battle_started" },
  ];
  let eventSequence = 1;
  let randomSeed = canonical.seed;

  for (const deployment of canonical.deployments) {
    events.push({ sequence: eventSequence++, tick: deployment.tick, type: "deployed", entityId: deployment.dropId });
    for (const unitId of deployment.unitIds) {
      const unit = units.get(unitId);
      if (!unit) continue;
      const target = defenses.find((defense) =>
        unit.targetTags.some((tag) => defense.targetTags.includes(tag)),
      ) ?? defenses[0];
      if (!target || target.health <= 0) continue;
      const roll = nextRandom(randomSeed);
      randomSeed = roll.seed;
      const damage = Math.max(1, Math.floor(unit.count * unit.power * (0.85 + roll.value * 0.15)));
      target.health = Math.max(0, target.health - damage);
      events.push({
        sequence: eventSequence++,
        tick: deployment.tick,
        type: "defense_damaged",
        entityId: target.id,
        value: damage,
      });
    }
  }

  for (const ability of canonical.abilities) {
    events.push({ sequence: eventSequence++, tick: ability.tick, type: "ability", entityId: ability.abilityId });
  }

  const coreAlive = defenses.some((defense) => defense.targetTags.includes("core") && defense.health > 0);
  const winner = coreAlive ? "defender" : "attacker";
  events.push({ sequence: eventSequence, tick: Math.max(0, ...events.map((event) => event.tick)), type: "battle_ended" });

  return {
    rulesetVersion: canonical.rulesetVersion,
    seed: canonical.seed,
    winner,
    events,
    canonicalHash: hashOrbitscarCanonicalInput(canonical),
  };
}
