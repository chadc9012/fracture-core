/* ------------------------------------------------------------------
 * ADAPTIVE BUILD SYSTEM
 *
 * The player never picks a build. Every meaningful action feeds a
 * behaviour vector; the vector is normalised into a playstyle profile;
 * the profile grows, specialises and mutates skill nodes; mutated nodes
 * feed modifiers back into combat, logistics, movement and the world
 * simulation itself. Behaviour → identity → skills → behaviour.
 * ------------------------------------------------------------------ */

export type BehaviorKey = "combat" | "logistics" | "vehicles" | "stealth" | "support";

export const BEHAVIOR_KEYS: BehaviorKey[] = ["combat", "logistics", "vehicles", "stealth", "support"];

export type SkillForm = "BASE" | "SPECIALIZED" | "ELITE_MUTATION";

export type BranchId =
  | "COMBAT_BRANCH"
  | "LOGISTICS_BRANCH"
  | "VEHICLE_MASTERY"
  | "STEALTH_BRANCH"
  | "SUPPORT_BRANCH";

type BranchDef = {
  id: BranchId;
  driver: BehaviorKey;
  /** share of the behaviour window needed before the branch grows */
  threshold: number;
  /** [base, specialized, elite_mutation] */
  forms: [string, string, string];
  blurb: string;
};

export const BRANCHES: BranchDef[] = [
  {
    id: "COMBAT_BRANCH",
    driver: "combat",
    threshold: 0.34,
    forms: ["Rifle Mastery", "Precision Executioner", "Time-Locked Duelist"],
    blurb: "You solve problems with the trigger.",
  },
  {
    id: "LOGISTICS_BRANCH",
    driver: "logistics",
    threshold: 0.28,
    forms: ["Supply Runner", "Convoy Commander", "War Economy Architect"],
    blurb: "You win by moving crates, not bodies.",
  },
  {
    id: "VEHICLE_MASTERY",
    driver: "vehicles",
    threshold: 0.24,
    forms: ["Driver", "Armored Specialist", "Battlefield Ram Unit"],
    blurb: "The buggy is the weapon.",
  },
  {
    id: "STEALTH_BRANCH",
    driver: "stealth",
    threshold: 0.26,
    forms: ["Shadow Runner", "Ghost Operative", "Phase Infiltrator"],
    blurb: "You move through the war, not into it.",
  },
  {
    id: "SUPPORT_BRANCH",
    driver: "support",
    threshold: 0.24,
    forms: ["Medic", "Combat Field Surgeon", "Team Resonance Anchor"],
    blurb: "You keep the convoy and the core alive.",
  },
];

export type SkillNode = {
  id: BranchId;
  driver: BehaviorKey;
  name: string;
  level: number;
  /** progress toward the next level, 0..1 */
  xp: number;
  form: SkillForm;
  /** balance: growth rate shrinks past level 10 */
  growth: number;
  /** balance: elite mutations always carry a drawback */
  counterplay: string | null;
  /** seconds since the mutation, used for the UI flash */
  mutatedAt: number;
};

export type Adaptation = {
  /** rolling behaviour window — reset every adaptation cycle */
  window: Record<BehaviorKey, number>;
  /** lifetime totals, used for the identity title */
  lifetime: Record<BehaviorKey, number>;
  /** last normalised playstyle profile */
  playstyle: Record<BehaviorKey, number>;
  skills: Record<BranchId, SkillNode>;
  /** seconds until the next adaptation pass */
  timer: number;
  cycle: number;
  identity: string;
  log: { text: string; life: number }[];
  /** feedback into the world simulation */
  influence: { logisticsEfficiency: number; aiAggression: number; convoyDiscipline: number };
};

const zeroVector = (): Record<BehaviorKey, number> => ({
  combat: 0,
  logistics: 0,
  vehicles: 0,
  stealth: 0,
  support: 0,
});

export function createAdaptation(): Adaptation {
  const skills = {} as Record<BranchId, SkillNode>;
  for (const b of BRANCHES) {
    skills[b.id] = {
      id: b.id,
      driver: b.driver,
      name: b.forms[0],
      level: 0,
      xp: 0,
      form: "BASE",
      growth: 1,
      counterplay: null,
      mutatedAt: 999,
    };
  }
  return {
    window: zeroVector(),
    lifetime: zeroVector(),
    playstyle: { combat: 0.2, logistics: 0.2, vehicles: 0.2, stealth: 0.2, support: 0.2 },
    skills,
    timer: ADAPTATION_INTERVAL,
    cycle: 0,
    identity: "Unproven Survivor",
    log: [],
    influence: { logisticsEfficiency: 1, aiAggression: 1, convoyDiscipline: 1 },
  };
}

/** how often the adaptive loop re-reads behaviour, in seconds */
export const ADAPTATION_INTERVAL = 24;

/* ---------------- 1. behaviour tracking ---------------- */

export function logBehavior(adaptation: Adaptation, key: BehaviorKey, value = 1) {
  adaptation.window[key] += value;
  adaptation.lifetime[key] += value;
}

/* ---------------- 2. profile generation ---------------- */

export function getPlaystyle(vector: Record<BehaviorKey, number>): Record<BehaviorKey, number> {
  const total = BEHAVIOR_KEYS.reduce((a, k) => a + vector[k], 0);
  if (total <= 0) return { combat: 0.2, logistics: 0.2, vehicles: 0.2, stealth: 0.2, support: 0.2 };
  const out = zeroVector();
  for (const k of BEHAVIOR_KEYS) out[k] = vector[k] / total;
  return out;
}

export function dominantBehavior(playstyle: Record<BehaviorKey, number>): BehaviorKey {
  return BEHAVIOR_KEYS.reduce((best, k) => (playstyle[k] > playstyle[best] ? k : best), "combat");
}

/* ---------------- 3 + 4. adaptation & mutation ---------------- */

function pushLog(adaptation: Adaptation, text: string) {
  adaptation.log.unshift({ text, life: 8 });
  if (adaptation.log.length > 4) adaptation.log.pop();
}

function adaptNode(adaptation: Adaptation, node: SkillNode, amount: number) {
  const def = BRANCHES.find((b) => b.id === node.id)!;
  node.xp += amount * node.growth;
  while (node.xp >= 1) {
    node.xp -= 1;
    node.level++;
    balanceAdaptation(node);

    const nextForm: SkillForm = node.level >= 5 ? "ELITE_MUTATION" : node.level >= 3 ? "SPECIALIZED" : "BASE";
    if (nextForm !== node.form) {
      node.form = nextForm;
      node.name = def.forms[nextForm === "ELITE_MUTATION" ? 2 : nextForm === "SPECIALIZED" ? 1 : 0];
      node.mutatedAt = 0;
      if (nextForm === "ELITE_MUTATION") {
        node.counterplay = COUNTERPLAY[node.id];
        pushLog(adaptation, `MUTATION — ${def.forms[2]} (${node.counterplay})`);
      } else {
        pushLog(adaptation, `${def.forms[1]} emerged from how you fight`);
      }
    } else {
      pushLog(adaptation, `${node.name} deepened to L${node.level}`);
    }
  }
}

const COUNTERPLAY: Record<BranchId, string> = {
  COMBAT_BRANCH: "louder: war machines aggro from further out",
  LOGISTICS_BRANCH: "richer cargo draws heavier convoy escorts",
  VEHICLE_MASTERY: "heavier chassis, slower on foot",
  STEALTH_BRANCH: "lighter armour, you take more hull damage",
  SUPPORT_BRANCH: "field kit weight lowers your damage output",
};

/* ---------------- 9. balance control ---------------- */

export function balanceAdaptation(node: SkillNode) {
  if (node.level > 10) node.growth = Math.max(0.15, node.growth * 0.82);
}

/* ---------------- 6. adaptive feedback loop ---------------- */

export function stepAdaptation(adaptation: Adaptation, dt: number) {
  for (const l of adaptation.log) l.life -= dt;
  while (adaptation.log.length && adaptation.log[adaptation.log.length - 1]!.life <= 0) adaptation.log.pop();
  for (const id of Object.keys(adaptation.skills) as BranchId[]) adaptation.skills[id].mutatedAt += dt;

  adaptation.timer -= dt;
  if (adaptation.timer > 0) return;
  adaptation.timer = ADAPTATION_INTERVAL;

  const activity = BEHAVIOR_KEYS.reduce((a, k) => a + adaptation.window[k], 0);
  if (activity < 3) return; // idle session: nothing to learn from

  adaptation.cycle++;
  const playstyle = getPlaystyle(adaptation.window);
  adaptation.playstyle = playstyle;

  for (const def of BRANCHES) {
    const share = playstyle[def.driver];
    if (share < def.threshold) continue;
    // stronger dominance adapts faster, capped so nothing runs away
    const amount = Math.min(1.4, 0.45 + (share - def.threshold) * 2.2);
    adaptNode(adaptation, adaptation.skills[def.id], amount);
  }

  adaptation.identity = identityOf(adaptation);
  applyWorldInfluence(adaptation);
  adaptation.window = zeroVector(); // reset the behaviour window
}

/* ---------------- 8. emergent build identity ---------------- */

export function identityOf(adaptation: Adaptation): string {
  const lifetime = getPlaystyle(adaptation.lifetime);
  const ranked = [...BRANCHES].sort((a, b) => lifetime[b.driver] - lifetime[a.driver]);
  const top = adaptation.skills[ranked[0]!.id];
  const second = adaptation.skills[ranked[1]!.id];
  if (top.level === 0) return "Unproven Survivor";
  if (second.level >= 3) return `${top.name} / ${second.name}`;
  return top.name;
}

/* ---------------- 7. world impact of adaptation ---------------- */

export function applyWorldInfluence(adaptation: Adaptation) {
  const s = adaptation.skills;
  const inf = adaptation.influence;
  inf.logisticsEfficiency = 1 + (s.LOGISTICS_BRANCH.form === "ELITE_MUTATION" ? 0.2 : 0) + s.LOGISTICS_BRANCH.level * 0.02;
  inf.aiAggression =
    1 + (s.COMBAT_BRANCH.form === "ELITE_MUTATION" ? 0.3 : 0) + s.COMBAT_BRANCH.level * 0.025 -
    (s.STEALTH_BRANCH.level * 0.02);
  inf.aiAggression = Math.max(0.6, inf.aiAggression);
  inf.convoyDiscipline = 1 + s.SUPPORT_BRANCH.level * 0.05;
}

export function hasSkill(adaptation: Adaptation, id: BranchId, minLevel = 1) {
  return adaptation.skills[id].level >= minLevel;
}

/* ---------------- derived gameplay modifiers ---------------- */

export type SquadArchetype = "BALANCED" | "DEFENSIVE" | "STRIKER" | "STRATEGIST";

export type AdaptationMods = {
  bulletDamage: number;
  fireRate: number;
  cargoValue: number;
  ramDamage: number;
  hullDurability: number;
  regen: number;
  aggroRadius: number;
  footSpeed: number;
  vehicleSpeed: number;
  /** Set each frame from the equipped ability build's synergy archetype (see buildSynergy() in
   * ability-network.ts) so squad AI actually reacts to loadout, not just adaptation branches. */
  squadArchetype: SquadArchetype;
  /** True while a reflective/bulwark ability is active — ranged squad roles hold fire instead of
   * suppressing, matching the "Ranged units holding fire" threat text live-build.ts already shows. */
  rangedHoldFire: boolean;
  /** Global Balance Controller (see balance.ts) — set each frame from the player's own power score,
   * not from any skill branch. incomingDamageScale multiplies all damage dealt to the player
   * (hurtPlayer in sim.ts); outgoingDamageScale folds into the player's own bulletDamage in
   * Scene.tsx. Both default to 1 so nothing changes until Scene.tsx starts setting them. */
  incomingDamageScale: number;
  outgoingDamageScale: number;
};

export function adaptationMods(adaptation: Adaptation): AdaptationMods {
  const s = adaptation.skills;
  const elite = (id: BranchId) => (s[id].form === "ELITE_MUTATION" ? 1 : 0);
  return {
    bulletDamage: 1 + s.COMBAT_BRANCH.level * 0.12 + elite("COMBAT_BRANCH") * 0.4 - elite("SUPPORT_BRANCH") * 0.15,
    fireRate: 1 + s.COMBAT_BRANCH.level * 0.05,
    cargoValue: 1 + s.LOGISTICS_BRANCH.level * 0.09 + elite("LOGISTICS_BRANCH") * 0.25,
    ramDamage: 1 + s.VEHICLE_MASTERY.level * 0.15 + elite("VEHICLE_MASTERY") * 0.5,
    hullDurability: 1 + s.VEHICLE_MASTERY.level * 0.06 - elite("STEALTH_BRANCH") * 0.2,
    regen: s.SUPPORT_BRANCH.level * 0.35 + elite("SUPPORT_BRANCH") * 1.5,
    aggroRadius: 1 + elite("COMBAT_BRANCH") * 0.25 - s.STEALTH_BRANCH.level * 0.05,
    footSpeed: 1 + s.STEALTH_BRANCH.level * 0.04 - elite("VEHICLE_MASTERY") * 0.08,
    vehicleSpeed: 1 + s.VEHICLE_MASTERY.level * 0.03,
    squadArchetype: "BALANCED",
    rangedHoldFire: false,
    incomingDamageScale: 1,
    outgoingDamageScale: 1,
  };
}
