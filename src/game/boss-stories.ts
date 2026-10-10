/** Story packages for the four existing Unique Scenario bosses: The Last Oath (Dark Knight), The First Hunt (Rime Alpha), The Drowned
 * Crown (Drowned Monarch) and The Last Benediction (Hollow Saint). Everything here is DATA + pure reducers on the shared story layer
 * (story.ts). The encounters themselves (scenario-encounters.ts / encounter-sim.ts), their rewards (scenario-loot.ts) and Null
 * Disruption are untouched: these stories never pay anything, never change phases, and never decide a hit.
 *
 * How it connects to the real fight:
 *  - phase captions are keyed to the encounter's own PHASE events (Scene forwards them; they are presentation only);
 *  - BOSS_DEFEATED is forwarded only from the encounter's VICTORY event, i.e. a real kill through defeatMachine. Truces, resets and
 *    deaths never emit it;
 *  - the post-boss conversation and the vault archive are due only once the boss is defeated, and are once-keyed (replay-safe);
 *  - the archive is a trigger site near the lair (no new geometry, model, cutscene renderer or voice system is assumed).
 * Adaptation note: the drafts stage the Dark Knight's final exchange at the finishing stagger. A modal choice in the middle of a live
 * duel would fight the combat input, so it plays as his last words immediately after the killing blow. */
import { LAIR_SCENARIOS } from "./unique-scenarios";
import { REGIONS } from "./world";
import { applyEffects, registerStages, stageAtLeast, stageOf, type DialogueGraph, type DialogueNode, type StoryEffect, type StoryState } from "./story";

export type BossStoryId = "dark-knight" | "rime-alpha" | "drowned-monarch" | "hollow-saint";
export type StoryLine = { speaker: string; text: string };
/** where a conversation may be opened: at the lair before the fight, right after the kill, or at the vault terminal */
export type DuePlace = "lair" | "defeat" | "vault";
export type BossStory = {
  id: BossStoryId; title: string; stages: readonly string[];
  intro: DialogueGraph;
  /** captions per encounter phase index (0 = opening phase); never interactive */
  phaseLines: readonly (readonly StoryLine[])[];
  /** conversation due at a given stage, and where it can be opened */
  due: Record<string, { graph: DialogueGraph; place: DuePlace }>;
  vault: { label: string; dx: number; dz: number };
  defeatedFlag: string;
  objectives: { defeated: string };
};

const OP = "Operator", NOVA = "NOVA", LOG = "NARRATOR";
const stage = (scenario: string, to: string): StoryEffect => ({ stage: { scenario, to } });
const flag = (f: string): StoryEffect => ({ flag: f });

/** Build a linear graph from lines; extra node overrides (choices, effects) are merged by id. `ids` are generated n0..nN. */
function linear(id: string, lines: readonly StoryLine[], extra: Record<string, Partial<DialogueNode>> = {}): DialogueGraph {
  const nodes: Record<string, DialogueNode> = {};
  lines.forEach((l, i) => {
    const nid = `n${i}`;
    nodes[nid] = { id: nid, speaker: l.speaker, text: l.text, ...(i < lines.length - 1 ? { next: `n${i + 1}` } : {}), ...(extra[nid] ?? {}) };
  });
  return { id, start: "n0", nodes };
}
const L = (speaker: string, text: string): StoryLine => ({ speaker, text });

/* ============================== 1. THE LAST OATH - Dark Knight ============================== */
export const DK = "dark-knight";
export const DK_STAGES = ["unmet", "intro", "defeated", "released", "archive"] as const;
registerStages(DK, DK_STAGES);
const DK_RESPONSE = "dark-knight.response";

const DK_INTRO = linear("dark-knight.intro", [
  L(LOG, "Wind cuts through the ruined entrance. A broken warning beacon flashes in the dark."),
  L(NOVA, "I've found the source of the signal. Military encryption. Pre-Fracture architecture."),
  L(OP, "Anyone still alive in there?"),
  L(NOVA, "I'm detecting movement."),
  L(OP, "Human?"),
  L(NOVA, "I can't confirm that."),
  L("Fortress Recording", "Aegis Division, maintain the perimeter. The vault must remain sealed."),
  L("Unknown Soldier", "Commander, there are children on the other side of the door."),
  L("Fortress Recording", "Maintain the perimeter."),
  L(OP, "Someone chose to leave them there."),
  L(NOVA, "Or someone wanted the record to look that way."),
  L("Dark Knight", "Identify yourself."),
  L(OP, "I'm not with whoever did this to you."),
  L("Dark Knight", "That is what they all say. The oath remains."),
], { n13: { effects: [stage(DK, "intro")] } });

const DK_LAST_WORDS: DialogueGraph = {
  id: "dark-knight.last-words", start: "n0",
  nodes: {
    n0: { id: "n0", speaker: LOG, text: "The finishing blow lands. The Dark Knight does not fall. He kneels, and for the first time the violet drains from his voice.", next: "n1", effects: [flag("dark_knight_defeated")] },
    n1: { id: "n1", speaker: "Serik Vale", text: "Do it.", next: "n2" },
    n2: { id: "n2", speaker: OP, text: "Tell me what I'm ending.", next: "n3" },
    n3: { id: "n3", speaker: "Serik Vale", text: "The oath.", next: "n4" },
    n4: { id: "n4", speaker: OP, text: "Or the man who was forced to keep it?", next: "n5" },
    n5: { id: "n5", speaker: "Serik Vale", text: "I heard them calling for help. I told myself the order mattered more. I was wrong.",
      choices: [
        { id: "compassion", text: "\"You can stop guarding the door.\"", effects: [{ choice: { key: DK_RESPONSE, value: "compassion" } }, flag("vale_response_compassion")], next: "n6" },
        { id: "confront", text: "\"You still made the choice.\"", effects: [{ choice: { key: DK_RESPONSE, value: "confront" } }, flag("vale_response_confrontation")], next: "n6" },
        { id: "investigate", text: "\"Tell me who gave the order.\"", effects: [{ choice: { key: DK_RESPONSE, value: "investigate" } }, flag("vale_response_investigation")], next: "n6" },
      ] },
    n6: { id: "n6", speaker: "Serik Vale", text: "Then let the door open. Let the truth survive me.", effects: [flag("vale_released")], next: "n7" },
    n7: { id: "n7", speaker: "Serik Vale", text: "If there is anyone left to remember us... remember the people behind the door.", next: "n8" },
    n8: { id: "n8", speaker: LOG, text: "His helmet goes dark. The armor collapses into inert fragments, and the corruption drains from the room. The inner door is open.", effects: [stage(DK, "released")] },
  },
};

const DK_ARCHIVE = linear("dark-knight.archive", [
  L(LOG, "The sealed door opens. Inside there are no prisoners, only evacuation records, corrupted mission logs and a damaged World Anchor schematic."),
  L(NOVA, "I've recovered an archive. The fortress wasn't merely containing a Fracture. It was monitoring one."),
  L(OP, "Monitoring what?"),
  L(NOVA, "A stable point between overlapping realities. The designation is partially corrupted: WORLD ANCHOR."),
  L(NOVA, "The map marks several locations. One lies far beneath the waters around Thalassia."),
  L(OP, "Why hide this?"),
  L(NOVA, "The records don't say. But someone removed the original command authorization."),
  L("Serik Vale (recording)", "If this reaches anyone, understand this: the order came from a system we trusted. We verified it. We followed it. And we were wrong."),
  L("Serik Vale (recording)", "If the Anchor wakes again, don't let the system make the choice for you."),
  L(OP, "NOVA, save everything."),
  L(NOVA, "Already done. I also copied the missing authorization signature."),
  L(OP, "And?"),
  L(NOVA, "It's unlike any military command structure in my database. I can't identify it yet."),
], {
  n1: { effects: [flag("world_anchor_evidence"), { collect: "evidence:world-anchor-schematic" }] },
  n12: { effects: [flag("command_signature_recovered"), { collect: "evidence:command-signature" }, stage(DK, "archive")] },
});

const DK_PHASES: StoryLine[][] = [
  [L("Dark Knight", "You will not pass. Hold the line! The gates must hold!"), L(NOVA, "His armor is reacting to your Resonance. Watch for an attack tell before committing.")],
  [L("Dark Knight", "You carry the same signal... the one that opened the sky. No. You were not there."), L(NOVA, "The arena is showing his memories. He may be reliving them."), L("Dark Knight", "I gave the order. I heard them on the other side."), L(NOVA, "Commander Serik Vale. I've recovered his designation from the armor.")],
  [L(NOVA, "The signal is interfering with his motor control. I can't promise what will remain of him if we separate it."), L("Dark Knight", "If I stop... the door opens. Then why can I still hear them?"), L("Unknown Command", "Guardian integrity compromised. Resume containment."), L(NOVA, "That voice isn't coming from Vale. Something is using the fortress network to keep him locked in this state.")],
  [L(NOVA, "His energy output is dropping. He's no longer sustaining the transformation."), L("Dark Knight", "One oath remains.")],
];

/* ============================== 2. THE FIRST HUNT - Rime Alpha ============================== */
export const RA = "rime-alpha";
export const RA_STAGES = ["unmet", "intro", "defeated", "archive"] as const;
registerStages(RA, RA_STAGES);

const RA_INTRO = linear("rime-alpha.intro", [
  L(LOG, "Snow sweeps across the path. A transport lies overturned near a broken antenna."),
  L(NOVA, "The beacon is broadcasting on a military emergency channel. The transmission has repeated for eleven years."),
  L(OP, "Eleven? The Fracture hasn't been around that long."),
  L(NOVA, "Correct. Which means either the timestamp is wrong, or this signal has survived something our records say hasn't happened yet."),
  L(OP, "Something tore this apart."),
  L(NOVA, "The damage is consistent with a large quadruped. And there are no human footprints leading away."),
  L("Researcher (recording)", "Observation log, day forty-two. The Alpha is reacting to the pulses before we initiate them. It isn't predicting the experiment. It's remembering it."),
  L(NOVA, "Resonance spike detected. The source is moving toward us."),
  L(OP, "Then let's find out why."),
], { n8: { effects: [stage(RA, "intro")] } });

const RA_ARCHIVE = linear("rime-alpha.archive", [
  L(LOG, "Inside the tower, the containment glass is shattered from the inside. A single terminal still has power."),
  L(NOVA, "The experiment was called Chrono-Resonance Mapping. They were trying to identify spatial fractures before they became visible."),
  L(OP, "And the Alpha?"),
  L(NOVA, "Its sensory response exceeded every instrument they had."),
  L("Research Director (recording)", "We have confirmed the anomaly. The Alpha responds to the event before the event occurs. This is no longer a predictive model. We are observing an echo from a reality in which the event has already happened."),
  L("Research Director (recording)", "If the same event can leave an echo before it begins, then the Fracture isn't simply destroying worlds. It may be repeating them."),
  L(OP, "How many times has this happened?"),
  L(NOVA, "The archive doesn't establish a number. The map shows distorted signals, one beneath Thalassia and another near a damaged World Anchor site. And the oldest signal is timestamped before this station was built."),
  L(OP, "NOVA, do you think it remembers what happened?"),
  L(NOVA, "I think it remembers more than the people who caused it. I think we have been treating the Fracture as a disaster when it may be a process."),
  L(OP, "Then we find out what it's doing."),
  L(NOVA, "I have marked the next signal: Thalassia. One more observation. When the Alpha looked at you after the fight, its Resonance briefly synchronized with yours. I don't know what that means."),
], {
  n1: { effects: [flag("rime_research_archive_found"), { collect: "evidence:chrono-resonance-mapping" }] },
  n5: { effects: [flag("chrono_resonance_revealed")] },
  n7: { effects: [flag("preconstruction_signal_found")] },
  n11: { effects: [flag("thalassia_signal_marked"), stage(RA, "archive")] },
});

const RA_PHASES: StoryLine[][] = [
  [L(NOVA, "It's tracking your energy signature. I can't mask it without suppressing your abilities.")],
  [L(NOVA, "The arena is displaying environmental states that shouldn't coexist. Memories, possibly, but they aren't yours."), L(OP, "You were kept here.")],
  [L("Child (memory)", "Is it going to hurt us?"), L("Researcher (memory)", "No. It's frightened."), L(NOVA, "Its Resonance is fluctuating. Your signal may be interacting with its memory response.")],
  [L(NOVA, "The energy spike is centered on the research tower. The tower is the target, or the source of what it's afraid of.")],
];

/* ============================== 3. THE DROWNED CROWN - Drowned Monarch ============================== */
export const DM = "drowned-monarch";
export const DM_STAGES = ["unmet", "intro", "defeated", "archive"] as const;
registerStages(DM, DM_STAGES);
export const DM_CHOICE = "drowned.archive";

const DM_INTRO = linear("drowned-monarch.intro", [
  L(NOVA, "We've reached the source of the oldest signal. It predates the research station by several thousand years."),
  L(OP, "That's somehow worse."),
  L("Thalassian Archive", "Royal access required. Identify the reigning sovereign."),
  L(OP, "Try telling it the king is dead."),
  L(NOVA, "I don't recommend sarcasm when addressing ancient security systems."),
  L("Thalassian Archive", "Foreign resonance recognized. Royal succession unresolved."),
  L(NOVA, "It recognizes something in your Resonance that it associates with the royal system."),
  L("Drowned Monarch", "The seal remains. All who approach the Crown come to claim it."),
  L(OP, "We're trying to find out what happened to your world."),
  L("Drowned Monarch", "Then you have come to awaken what should have remained forgotten."),
], { n9: { effects: [stage(DM, "intro")] } });

const DM_ARCHIVE: DialogueGraph = {
  id: "drowned-monarch.archive", start: "n0",
  nodes: {
    n0: { id: "n0", speaker: LOG, text: "The sealed archive opens: thousands of preserved records, personal messages, evacuation orders, and the names of the people who died in the collapse.", next: "n1", effects: [flag("aurelian_archive_found"), { collect: "evidence:aurelian-archive" }] },
    n1: { id: "n1", speaker: NOVA, text: "The archive is intact. It holds the complete account of the Aurelian collapse, and exactly what Avaron chose to conceal.", next: "n2" },
    n2: { id: "n2", speaker: NOVA, text: "The Anchor seal is tied to the archive's preservation system. We can preserve the seal and restrict access, or release the full record to the surviving network and lose the protective seal.",
      choices: [
        { id: "preserve", text: "Preserve the Seal. Keep the archive protected until a safer method is found.", effects: [{ choice: { key: DM_CHOICE, value: "preserve" } }, flag("drowned_archive_preserved")], next: "n3a" },
        { id: "expose", text: "Expose the Truth. Release the complete record so other settlements can prepare.", effects: [{ choice: { key: DM_CHOICE, value: "expose" } }, flag("drowned_truth_released")], next: "n3b" },
      ] },
    n3a: { id: "n3a", speaker: NOVA, text: "The seal holds. Access is restricted to this terminal. Caution has a cost: whoever comes next will have to find this place themselves.", next: "n4" },
    n3b: { id: "n3b", speaker: NOVA, text: "The record is transmitting to the whole surviving network. Knowledge carries risk, but ignorance has already cost this world once.", next: "n4" },
    n4: { id: "n4", speaker: NOVA, text: "I've found another record, embedded in the Anchor's original diagnostic system. It was written before the Concord discovered the Anchor.", next: "n5", effects: [flag("anchor_continuity_record_found")] },
    n5: { id: "n5", speaker: "Anchor Continuity Record", text: "Previous convergence detected. World-state restoration unsuccessful. Preserve surviving resonance signatures. Await the next cycle.", next: "n6", effects: [flag("previous_convergence_revealed")] },
    n6: { id: "n6", speaker: OP, text: "Previous convergence. How many came before it?", next: "n7" },
    n7: { id: "n7", speaker: NOVA, text: "Unknown. I don't know whether we're living through the first recurrence or the last.", next: "n8" },
    n8: { id: "n8", speaker: NOVA, text: "I've connected the evidence from all the sites. The signals point to an unexplored location carrying the same designation as the fortress: WORLD ANCHOR, origin unknown.", next: "n9" },
    n9: { id: "n9", speaker: OP, text: "Then that's where we're going.", effects: [flag("origin_signal_marked"), stage(DM, "archive")] },
  },
};

const DM_PHASES: StoryLine[][] = [
  [L("Drowned Monarch", "Kneel before the Crown."), L(OP, "I don't kneel to ghosts."), L(NOVA, "The figures are residual memory constructs, not living targets. The archive is preserving their final recorded states.")],
  [L("Queen Selene (recording)", "The council has voted to shut the Anchor down."), L("King Avaron (recording)", "And if shutting it down destroys the connections holding our cities together?"), L(NOVA, "Two architectural states are occupying the same coordinates: the city before and after the collapse.")],
  [L("Drowned Monarch", "I watched the sky open. I watched the ocean climb the towers. I sealed the Anchor. I chose the lives beyond these walls over the kingdom before me."), L(NOVA, "These symptoms match documented Fracture events. The archive suggests it happened before the records we consider history.")],
  [L(NOVA, "The containment mechanism is drawing energy from the Monarch. We can't shut it down while he's defending it."), L("Drowned Monarch", "Then let its warning survive!")],
];

/* ============================== 4. THE LAST BENEDICTION - Hollow Saint ============================== */
export const HS = "hollow-saint";
export const HS_STAGES = ["unmet", "intro", "defeated", "archive"] as const;
registerStages(HS, HS_STAGES);

const HS_INTRO = linear("hollow-saint.intro", [
  L("Unknown Woman (transmission)", "If anyone can hear me... please. I remember my name. I remember my son. I just can't remember where I left him."),
  L(NOVA, "The signal is coming from a structure two kilometers ahead. I detect several human-shaped energy signatures, but their readings overlap."),
  L(LOG, "A child's wooden toy lies beside a broken medical station. A wall is covered in names; some are crossed out, others written until the stone is nearly worn away."),
  L(OP, "Why would someone carve their name that many times?"),
  L(NOVA, "Possibly to preserve a memory."),
  L(OP, "Or to make sure they didn't forget it."),
  L("Unknown Man (transmission)", "Elian is dead."),
  L("Unknown Woman (transmission)", "Then why is she calling us home?"),
  L("Hollow Saint", "You have traveled far. Come. The lost are waiting."),
  L(NOVA, "I'm detecting a significant Fracture signature. The figure's identity cannot be verified."),
], { n9: { effects: [stage(HS, "intro")] } });

const HS_ARCHIVE = linear("hollow-saint.archive", [
  L(LOG, "Behind the altar is a hidden room holding the sanctuary's original memory archive, organised around the real testimony of survivors."),
  L(NOVA, "Thousands of personal accounts: names, relationships, medical histories, recollections from the final days of Haven's Rest."),
  L(OP, "Can we restore the people?"),
  L(NOVA, "Not from these records alone. An account of a person is not proof that the person still exists. We can preserve their histories, and stop the anomaly using them to build more false identities."),
  L("Elian (recording)", "The copies will know things no stranger could know. They'll speak in the voices of people you love. That does not make them those people."),
  L("Elian (recording)", "I wanted to believe memory alone could hold a person together. I was wrong. People are more than what can be recorded about them."),
  L(OP, "She figured it out."),
  L(NOVA, "Too late to save Haven's Rest. Not too late for us to learn from it. Four thousand, six hundred and twelve identifiable records are recoverable. I cannot promise every identity can be reconstructed accurately."),
  L(OP, "Then we preserve the truth. Not the copies."),
  L(NOVA, "The archive also holds a map of the anomaly's source. It is not in the swamp. It is a network connecting Fracture sites: the facility beneath Neon City, the old fortress and Thalassia."),
  L(OP, "Someone built a network out of these anomalies."),
  L(NOVA, "Or it is a natural consequence of the Fracture. Either way, I need more evidence from the main Anchor network to trace the transmission crossing it."),
  L(NOVA, "One more thing. The Saint thought preserving memories was preserving people. The Monarch thought preserving the seal was preserving the world. The Knight thought following an order was protecting those he served. Every one of them lost sight of what the preservation was for."),
  L(OP, "Then we find out what the Anchor is supposed to protect."),
], {
  n1: { effects: [flag("elian_archive_found"), { collect: "evidence:haven-archive" }] },
  n3: { effects: [flag("identity_truth_revealed")] },
  n7: { effects: [flag("haven_records_preserved")] },
  n9: { effects: [flag("fracture_network_evidence_found"), { collect: "evidence:fracture-network-map" }] },
  n13: { effects: [flag("anchor_network_lead_found"), stage(HS, "archive")] },
});

const HS_PHASES: StoryLine[][] = [
  [L("Hollow Saint", "Tell me your name."), L(OP, "You first."), L("Hollow Saint", "Elian."), L(NOVA, "I found a Sister Elian in the settlement's medical records. Whether this figure is the same person is unknown.")],
  [L("False Saint", "You promised you would come back."), L(NOVA, "The copies aren't independent combatants. They are decoys generated by the sanctuary's memory system."), L("Elian (memory)", "Tell me one thing you remember. You don't have to remember everything to still be yourself.")],
  [L("Unknown Woman", "You remember me, don't you?"), L(NOVA, "The emotional response was real. The identity may not have been."), L("Elian (memory)", "That's what I tried to teach them.")],
  [L(NOVA, "The core is no longer maintaining a stable identity."), L("Hollow Saint", "If I let them go, there will be nothing left!"), L(OP, "Then let what's left be real!")],
];

/* ============================== registry ============================== */
const mk = (s: Omit<BossStory, "stages">, stages: readonly string[]): BossStory => ({ ...s, stages });
export const BOSS_STORIES: Record<BossStoryId, BossStory> = {
  "dark-knight": mk({
    id: DK, title: "The Last Oath", intro: DK_INTRO, phaseLines: DK_PHASES,
    due: { defeated: { graph: DK_LAST_WORDS, place: "defeat" }, released: { graph: DK_ARCHIVE, place: "vault" } },
    vault: { label: "Aegis vault terminal", dx: 0, dz: -16 }, defeatedFlag: "dark_knight_defeated",
    objectives: { defeated: "Open the sealed vault behind the Dark Knight's arena" },
  }, DK_STAGES),
  "rime-alpha": mk({
    id: RA, title: "The First Hunt", intro: RA_INTRO, phaseLines: RA_PHASES,
    due: { defeated: { graph: RA_ARCHIVE, place: "vault" } },
    vault: { label: "Research tower laboratory", dx: 0, dz: -16 }, defeatedFlag: "rime_alpha_defeated",
    objectives: { defeated: "Follow the Alpha's trail into the ruined research tower" },
  }, RA_STAGES),
  "drowned-monarch": mk({
    id: DM, title: "The Drowned Crown", intro: DM_INTRO, phaseLines: DM_PHASES,
    due: { defeated: { graph: DM_ARCHIVE, place: "vault" } },
    vault: { label: "Royal archive console", dx: 0, dz: -16 }, defeatedFlag: "drowned_monarch_defeated",
    objectives: { defeated: "Decide the fate of the Royal Archive" },
  }, DM_STAGES),
  "hollow-saint": mk({
    id: HS, title: "The Last Benediction", intro: HS_INTRO, phaseLines: HS_PHASES,
    due: { defeated: { graph: HS_ARCHIVE, place: "vault" } },
    vault: { label: "Benediction Archive", dx: 0, dz: -16 }, defeatedFlag: "hollow_saint_defeated",
    objectives: { defeated: "Search behind the altar for Haven's Rest's archive" },
  }, HS_STAGES),
};
export const BOSS_STORY_IDS = Object.keys(BOSS_STORIES) as BossStoryId[];
export const bossStoryFor = (scenarioId: string | undefined): BossStory | null => (scenarioId && scenarioId in BOSS_STORIES ? BOSS_STORIES[scenarioId as BossStoryId] : null);
const stageNow = (s: StoryState, b: BossStory) => stageOf(s, b.id) ?? "unmet";

/** Every graph a boss story owns (used by tests and for sanity checks). */
export const bossGraphs = (b: BossStory): DialogueGraph[] => [b.intro, ...Object.values(b.due).map((d) => d.graph)];

/* ------------------------------ world: vault site ------------------------------ */
export const VAULT_RADIUS = 6;
export function lairOf(id: BossStoryId): { x: number; z: number } | null {
  const sc = LAIR_SCENARIOS.find((s) => s.id === id);
  if (!sc) return null;
  if (sc.lairAt) return sc.lairAt;
  const region = REGIONS.find((r) => r.id === sc.regionId);
  return region && sc.lair ? { x: region.x + region.radius * sc.lair.dx, z: region.z + region.radius * sc.lair.dz } : null;
}
export function vaultSite(id: BossStoryId): { x: number; z: number; label: string } | null {
  const lair = lairOf(id);
  if (!lair) return null;
  const v = BOSS_STORIES[id].vault;
  return { x: lair.x + v.dx, z: lair.z + v.dz, label: v.label };
}

/* ------------------------------ what is due, when ------------------------------ */
/** The conversation due for a boss story at `place`. Pre-fight intro only at the lair; post-fight conversations only once the boss is
 * really defeated (stage >= defeated). A skipped post-fight conversation can be reopened at the vault. */
export function bossDialogueDue(s: StoryState, id: BossStoryId, place: DuePlace): DialogueGraph | null {
  const b = BOSS_STORIES[id], st = stageNow(s, b);
  if (place === "lair") return st === "unmet" ? b.intro : null;
  const d = b.due[st];
  if (!d || !stageAtLeast(s, id, "defeated")) return null;
  return place === "vault" || d.place === place ? d.graph : null;
}
/** First boss story whose intro is still unheard (lair gate). */
export const introDue = (s: StoryState, id: BossStoryId) => bossDialogueDue(s, id, "lair") !== null;

/* ------------------------------ events ------------------------------ */
export type BossStoryEvent =
  | { type: "BOSS_INTRO_SEEN"; scenarioId: string }
  | { type: "BOSS_DEFEATED"; scenarioId: string };

/** Pure reducer. Unknown scenarios and repeats change nothing; the defeat flag and stage are paid once per save. */
export function applyBossStoryEvent(s: StoryState, ev: BossStoryEvent): StoryState {
  const b = bossStoryFor(ev.scenarioId);
  if (!b) return s;
  if (ev.type === "BOSS_INTRO_SEEN") return applyEffects(s, [stage(b.id, "intro")], `boss:${b.id}:intro-skipped`);
  return applyEffects(s, [flag(b.defeatedFlag), stage(b.id, "defeated")], `boss:${b.id}:defeated`);
}

/** The vault trigger the player is standing in (only once its conversation is due), else null. */
export function vaultNear(s: StoryState, x: number, z: number): BossStoryId | null {
  for (const id of BOSS_STORY_IDS) {
    if (!bossDialogueDue(s, id, "vault")) continue;
    const v = vaultSite(id);
    if (v && Math.hypot(v.x - x, v.z - z) <= VAULT_RADIUS) return id;
  }
  return null;
}

/** Objective line + target for the earliest defeated-but-unfinished story. */
export function bossObjective(s: StoryState): { text: string; target: { x: number; z: number } } | null {
  for (const id of BOSS_STORY_IDS) {
    const b = BOSS_STORIES[id];
    if (!stageAtLeast(s, id, "defeated") || stageNow(s, b) === "archive") continue;
    const v = vaultSite(id);
    if (v) return { text: `${b.title} · ${b.objectives.defeated}`, target: { x: v.x, z: v.z } };
  }
  return null;
}

/** Caption lines for an encounter phase (empty for unknown scenario/phase). */
export const phaseCaption = (scenarioId: string, phase: number): readonly StoryLine[] => bossStoryFor(scenarioId)?.phaseLines[phase] ?? [];
