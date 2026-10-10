/** The Dragon Who Remembers - Vaelith (Ember Peaks). A story scenario on the shared story layer (story.ts): a non-lethal first
 * trial run by the encounter director (scenario-encounters.ts "vaelith", truce instead of a kill), a branching conversation at each
 * stage, three memories to recover, a lair defence, a destroy-or-preserve choice, and a trust ladder Hostile -> Wary -> Allied ->
 * Bonded that unlocks limited companion strikes and the rewards. Everything here is pure; Scene/GameCanvas only forward events.
 * Dragon riding / free flight is NOT implemented (no mount framework exists); Vaelith is a character, not a vehicle. */
import { applyEffects, registerStages, stageAtLeast, stageOf, trustOf, type DialogueGraph, type StoryEffect, type StoryState } from "./story";
import { grantScenarioReward, type RewardCard, type ScenarioClaim } from "./scenario-loot";
import type { PlayerProgression } from "./progression";
import { applyMachineDamageMods, spawnMissionDrones, type Machine, type WorldSim } from "./sim";
import { REGIONS } from "./world";

export const VAELITH = "vaelith";
export const VAELITH_STAGES = ["unmet", "gate", "trial", "truth", "memories", "defense", "artifact", "alliance"] as const;
export type VaelithStage = (typeof VAELITH_STAGES)[number];
registerStages(VAELITH, VAELITH_STAGES);

export type BondLevel = "HOSTILE" | "WARY" | "ALLIED" | "BONDED";
export const BOND_THRESHOLDS = { WARY: 10, ALLIED: 40, BONDED: 80 } as const;
export function bondLevel(points: number): BondLevel {
  return points >= BOND_THRESHOLDS.BONDED ? "BONDED" : points >= BOND_THRESHOLDS.ALLIED ? "ALLIED" : points >= BOND_THRESHOLDS.WARY ? "WARY" : "HOSTILE";
}
export const vaelithBond = (s: StoryState) => bondLevel(trustOf(s, VAELITH));

const T = (amount: number): StoryEffect => ({ trust: { who: VAELITH, amount } });
const STAGE = (to: VaelithStage): StoryEffect => ({ stage: { scenario: VAELITH, to } });

/* ------------------------------ dialogue ------------------------------ */
export const GATE_DIALOGUE: DialogueGraph = {
  id: "vaelith.gate", start: "nova",
  nodes: {
    nova: { id: "nova", speaker: "NOVA", text: "Massive life-form ahead. Thermal reading is impossible. It appears to be burning without consuming oxygen.", next: "vaelith" },
    vaelith: { id: "vaelith", speaker: "Vaelith", text: "Another little soldier sent to kill the monster. Tell me, little spark - who told you I was the monster?",
      choices: [
        { id: "listen", text: "No one. I came to understand.", effects: [T(5), { flag: "vaelith.gate-listened" }], next: "trial" },
        { id: "hunt", text: "The reports did. Stand and fight.", effects: [{ flag: "vaelith.gate-hostile" }], next: "trial" },
      ] },
    trial: { id: "trial", speaker: "Vaelith", text: "Show me whether your courage is your own.", effects: [STAGE("gate")] },
  },
};

export const TRUTH_DIALOGUE: DialogueGraph = {
  id: "vaelith.truth", start: "nova",
  nodes: {
    nova: { id: "nova", speaker: "NOVA", text: "The energy signature matches the oldest Fracture records. This creature was present at the beginning.", next: "truth" },
    truth: { id: "truth", speaker: "Vaelith", text: "I could have devoured your world. Instead, I chose to protect the choice it had not yet made.",
      choices: [
        { id: "why", text: "Then why guard what broke it?", effects: [T(5)], next: "terms" },
        { id: "doubt", text: "Convenient story for a monster.", effects: [{ flag: "vaelith.truth-doubted" }], next: "terms" },
      ] },
    terms: { id: "terms", speaker: "Vaelith", text: "I will not wear a saddle. I will not be your weapon. Earn my trust, and I will fight beside you. Three memories of mine lie scattered across these peaks. Bring them back to yourself.", next: "nova2" },
    nova2: { id: "nova2", speaker: "NOVA", text: "I believe we've just negotiated with an extinction-level event.", effects: [STAGE("truth")] },
  },
};

export const ARTIFACT_DIALOGUE: DialogueGraph = {
  id: "vaelith.artifact", start: "intro",
  nodes: {
    intro: { id: "intro", speaker: "Vaelith", text: "That fragment is the thing that broke the world. I have guarded it for centuries. Destroy it, and its danger ends - and so does what it remembers. Keep it, and the danger stays with us. Choose.",
      choices: [
        { id: "preserve", text: "Preserve it. It is a record, and a warning.", effects: [{ choice: { key: "vaelith.artifact", value: "preserve" } }, { flag: "vaelith.artifact-preserved" }, T(15), { collect: "relic:ember-heart" }], next: "done" },
        { id: "destroy", text: "Destroy it. Nothing should hold that power.", effects: [{ choice: { key: "vaelith.artifact", value: "destroy" } }, { flag: "vaelith.artifact-destroyed" }, T(10)], next: "done" },
      ] },
    done: { id: "done", speaker: "NOVA", text: "Decision logged. There is no taking it back.", effects: [STAGE("artifact")] },
  },
};

export const ALLIANCE_DIALOGUE: DialogueGraph = {
  id: "vaelith.alliance", start: "open",
  nodes: {
    open: { id: "open", speaker: "Vaelith", text: "You chose, and you stayed. That is rarer than courage.",
      choices: [
        { id: "equal", text: "Then stand with me - not behind me.", requires: { trustAtLeast: { who: VAELITH, points: 60 } }, effects: [T(10), { flag: "vaelith.bonded-oath" }], next: "ally" },
        { id: "kind", text: "I'll keep earning it.", requires: { trustAtLeast: { who: VAELITH, points: BOND_THRESHOLDS.ALLIED } }, effects: [T(5)], next: "ally" },
        { id: "terms", text: "Terms accepted.", requires: { trustAtLeast: { who: VAELITH, points: BOND_THRESHOLDS.ALLIED } }, next: "ally" },
      ] },
    ally: { id: "ally", speaker: "Vaelith", text: "I will answer when the sky is open and the cause is just. Do not call me inside walls, or into another's arena.", effects: [STAGE("alliance"), { flag: "vaelith.allied" }] },
  },
};

export const VAELITH_GRAPHS = { gate: GATE_DIALOGUE, truth: TRUTH_DIALOGUE, artifact: ARTIFACT_DIALOGUE, alliance: ALLIANCE_DIALOGUE } as const;

/** Which conversation is due at this stage (null = none right now). */
export function dialogueDue(s: StoryState): { graph: DialogueGraph } | null {
  const st = (stageOf(s, VAELITH) ?? "unmet") as VaelithStage;
  if (st === "unmet") return { graph: GATE_DIALOGUE };
  if (st === "trial") return { graph: TRUTH_DIALOGUE };
  if (st === "defense") return { graph: ARTIFACT_DIALOGUE };
  if (st === "artifact") return { graph: ALLIANCE_DIALOGUE };
  return null;
}

/* ------------------------------ world: lair, memories, defence ------------------------------ */
const EMBER = REGIONS.find((r) => r.id === "ember")!;
export const VAELITH_LAIR = { x: EMBER.x + EMBER.radius * 0.5, z: EMBER.z + EMBER.radius * 0.45 };
export const MEMORY_RADIUS = 6;
export const MEMORY_SITES = [
  { id: "memory:ash-garden", label: "Ash garden memory", x: EMBER.x - EMBER.radius * 0.35, z: EMBER.z + EMBER.radius * 0.1 },
  { id: "memory:glass-bell", label: "Glass bell memory", x: EMBER.x + EMBER.radius * 0.1, z: EMBER.z - EMBER.radius * 0.55 },
  { id: "memory:first-sky", label: "First sky memory", x: EMBER.x - EMBER.radius * 0.1, z: EMBER.z + EMBER.radius * 0.62 },
] as const;
export const LAIR_DEFENSE_COUNT = 6;

/** Boss lair is fightable only before the trial has been survived (afterwards Vaelith is a character, not an encounter). */
export const vaelithFightable = (s: StoryState) => ["unmet", "gate"].includes(stageOf(s, VAELITH) ?? "unmet");

/** The uncollected memory within reach of (x,z), once the player has heard the truth. */
export function memoryNear(s: StoryState, x: number, z: number): string | null {
  if (!stageAtLeast(s, VAELITH, "truth")) return null;
  for (const m of MEMORY_SITES) if (!s.collectibles.includes(m.id) && Math.hypot(m.x - x, m.z - z) <= MEMORY_RADIUS) return m.id;
  return null;
}

/** everything Scene reports to the story handler */
export type StoryWorldEvent = { type: "LAIR_ENTER" } | VaelithEvent;
export type VaelithEvent =
  | { type: "TRIAL_SURVIVED" }
  | { type: "MEMORY"; id: string }
  | { type: "DEFENSE_CLEARED" };

/** Pure reducer for gameplay events. Out-of-order, repeated or unknown events change nothing; trust per source is paid once. */
export function applyVaelithEvent(s: StoryState, ev: VaelithEvent): StoryState {
  if (ev.type === "TRIAL_SURVIVED") {
    if (!stageAtLeast(s, VAELITH, "gate")) return s;
    return applyEffects(s, [T(10), STAGE("trial")], "vaelith.trial");
  }
  if (ev.type === "MEMORY") {
    if (!stageAtLeast(s, VAELITH, "truth") || !MEMORY_SITES.some((m) => m.id === ev.id)) return s;
    let out = applyEffects(s, [{ collect: ev.id }, T(10)], `vaelith.${ev.id}`);
    if (MEMORY_SITES.every((m) => out.collectibles.includes(m.id))) out = applyEffects(out, [STAGE("memories")]);
    return out;
  }
  if (!stageAtLeast(s, VAELITH, "memories")) return s;
  return applyEffects(s, [T(10), STAGE("defense")], "vaelith.defense");
}

/** Spawns the lair-defence wave (existing mission drones, tagged `mission`). Returns how many spawned (pool may limit). */
export function startLairDefense(sim: WorldSim): number {
  const before = sim.machines.filter((m) => m.alive && m.mission).length;
  spawnMissionDrones(sim, VAELITH_LAIR.x, VAELITH_LAIR.z, LAIR_DEFENSE_COUNT, false);
  return sim.machines.filter((m) => m.alive && m.mission).length - before;
}
export const lairDefenseCleared = (sim: WorldSim) => !sim.machines.some((m) => m.alive && m.mission);

/** Current objective text and (if any) where to go. */
export function objectiveFor(s: StoryState): { text: string; target?: { x: number; z: number } } | null {
  const st = (stageOf(s, VAELITH) ?? "unmet") as VaelithStage;
  switch (st) {
    case "unmet": return { text: "Ember Peaks: find the Ashen Gate (Vaelith's lair)", target: VAELITH_LAIR };
    case "gate": return { text: "Survive Vaelith's trial - you do not have to kill it", target: VAELITH_LAIR };
    case "trial": return { text: "Speak with Vaelith", target: VAELITH_LAIR };
    case "truth": { const left = MEMORY_SITES.filter((m) => !s.collectibles.includes(m.id)); const n = left[0]!; return { text: `Recover Vaelith's memories (${3 - left.length}/3): ${n.label}`, target: n }; }
    case "memories": return { text: "Defend Vaelith's lair", target: VAELITH_LAIR };
    case "defense": return { text: "Decide the fate of the Fracture artifact", target: VAELITH_LAIR };
    case "artifact": return { text: "Speak with Vaelith to seal the alliance", target: VAELITH_LAIR };
    default: return null;
  }
}

/* ------------------------------ rewards ------------------------------ */
/** Reward claims the current story state has earned. Stable run ids: paying twice is impossible through the claim ledger. */
export function vaelithClaims(s: StoryState): ScenarioClaim[] {
  const out: ScenarioClaim[] = [];
  if (stageAtLeast(s, VAELITH, "alliance")) out.push({ scenarioId: "vaelith-alliance", runId: "story:vaelith:alliance", participated: true, rolls: [] });
  if (stageAtLeast(s, VAELITH, "alliance") && vaelithBond(s) === "BONDED") out.push({ scenarioId: "vaelith-bond", runId: "story:vaelith:bond", participated: true, rolls: [] });
  return out;
}
/** Grants every earned, unclaimed Vaelith reward (and the choice/bond-dependent extras) through the existing validated claim path. */
export function grantVaelithRewards(progress: PlayerProgression): { progress: PlayerProgression; cards: RewardCard[] } {
  let next = progress; const cards: RewardCard[] = [];
  for (const claim of vaelithClaims(progress.story)) {
    const r = grantScenarioReward(next, claim);
    if (r.status !== "granted") continue;
    next = r.progress; cards.push(...r.cards);
    if (claim.scenarioId === "vaelith-bond") next = { ...next, story: applyEffects(next.story, [{ collect: "cosmetic:dragon-bond" }]) };
    if (claim.scenarioId === "vaelith-alliance" && next.story.choices["vaelith.artifact"] === "destroy") next = { ...next, fractureShards: next.fractureShards + 150 }; // destroying the artifact pays its residue once, with the alliance claim
  }
  return { progress: next, cards };
}

/* ------------------------------ companion (limited, cooldown) ------------------------------ */
export const COMPANION_COOLDOWN = 90;
export type CompanionState = { readyAt: number };
export type CompanionCall = { kind: "STRIKE" | "BREATH"; px: number; pz: number; yaw: number; now: number; indoors: boolean };
export type CompanionResult = { ok: true; hits: number } | { ok: false; reason: "not-allied" | "cooldown" | "indoors" | "boss-arena" };

/** Vaelith answers only when allied, outdoors, off cooldown, and not inside a Unique Scenario boss arena. Damage uses the shared
 * applyMachineDamageMods path (poise, vulnerability) and never touches the player. Bonded: +50% damage and a shorter cooldown. */
export function callVaelith(sim: WorldSim, story: StoryState, state: CompanionState, call: CompanionCall): CompanionResult {
  const bond = vaelithBond(story);
  if (!stageAtLeast(story, VAELITH, "alliance") || (bond !== "ALLIED" && bond !== "BONDED")) return { ok: false, reason: "not-allied" };
  if (call.indoors) return { ok: false, reason: "indoors" };
  if (sim.machines.some((m) => m.alive && m.boss && m.scenarioId)) return { ok: false, reason: "boss-arena" };
  if (call.now < state.readyAt) return { ok: false, reason: "cooldown" };
  const mult = bond === "BONDED" ? 1.5 : 1;
  const targets: Machine[] = sim.machines.filter((m) => m.alive && !m.decoy && Math.hypot(m.x - call.px, m.z - call.pz) <= 60);
  let hits = 0;
  const strike = (m: Machine, base: number) => { m.hp -= applyMachineDamageMods(sim, m, base * mult, "THERMAL", call.px, call.pz); hits++; };
  if (call.kind === "STRIKE") {
    for (const m of targets.sort((a, b) => Math.hypot(a.x - call.px, a.z - call.pz) - Math.hypot(b.x - call.px, b.z - call.pz)).slice(0, 3)) strike(m, 6);
  } else {
    for (const m of targets) {
      const dx = m.x - call.px, dz = m.z - call.pz, d = Math.hypot(dx, dz) || 1;
      const dot = (dx * Math.sin(call.yaw) + dz * Math.cos(call.yaw)) / d;
      if (d <= 34 && dot >= Math.cos(0.5)) strike(m, 3.5);
    }
  }
  state.readyAt = call.now + COMPANION_COOLDOWN * (bond === "BONDED" ? 0.7 : 1);
  return { ok: true, hits };
}

