/**
 * Interior NPC dialogue — the "voice" the pasted cinematics/story specs kept reaching for,
 * built as real data + a small typewriter overlay (see DialogueOverlay.tsx) instead of raw
 * document.createElement DOM injection or a duplicate mission-narration engine. There is no
 * text-to-speech or voice-file playback available in this sandbox (no network, no assets), so
 * "dialogue audio" here is the same procedural-Web-Audio philosophy as the rest of the game's
 * sound (see @/game/audio's playDialogueBlip): a per-speaker pitched blip per revealed
 * character, not recorded speech.
 *
 * Revisits: GameCanvas used to greet each interior's NPC exactly once and never again. That made
 * the interiors (a real, walk-in, always-mounted system) feel like a one-time flavor screen. This
 * adds real revisit content, keyed off state the game already tracks live rather than a canned
 * script: the zone's territory-control owner and instability tier (sim.ts's zones/instabilityTier
 * — the same data RegionLabels/Minimap already surface) and the active Fracture Descent quest
 * (progression.activeQuestId). revisitDialogueFor() picks the most relevant thing to say and
 * falls back to a rotating idle bank so a tenth visit doesn't just repeat the ninth.
 */
import type { Faction, InstabilityTier } from "./sim";

export type DialogueLine = { speaker: string; text: string };

/** Keyed by interior id (@/game/interiors) — shown once, the first time the player walks in. */
export const INTERIOR_DIALOGUE: Record<string, DialogueLine[]> = {
  "nexus-apartment": [
    { speaker: "Mara", text: "Off shift and still crawling with Vanguard tech. Shut the door, would you?" },
    { speaker: "Mara", text: "Whatever you're carrying out there, leave it by the mat. I just got this place clean." },
  ],
  "nexus-scrap-market": [
    { speaker: "Broker", text: "Scrap-Market's open. Standard components, material conversion, no questions past sundown." },
    { speaker: "Broker", text: "Everything on the counter's real. Everything under it costs extra to not ask about." },
  ],
  "veridan-outpost": [
    { speaker: "Field Medic", text: "Vanguard Outpost Alpha. Sit if you need to — the forest doesn't get quieter than this." },
    { speaker: "Field Medic", text: "The wildlife out there's been fractured for a while now. It's not you it's angry at. Probably." },
  ],
  "frostspire-shelter": [
    { speaker: "Relay Technician", text: "Summit array's still broadcasting, somehow. Half my fingers gave out years ago." },
    { speaker: "Relay Technician", text: "You get used to the cold. You never get used to the silence between transmissions." },
  ],
  "ember-bunker": [
    { speaker: "Survey Engineer", text: "Caldera's active again. Third time this month the containment field's flickered." },
    { speaker: "Survey Engineer", text: "Whatever's under that reactor, it isn't stable. Hasn't been since before I got here." },
  ],
  "wastelands-tradepost": [
    { speaker: "Runner", text: "Scrap-Outpost Alpha — Black-Market prices, no faction markup, cash or components." },
    { speaker: "Runner", text: "Highway's Raider territory past the ridge. Buy what you need before you push out there." },
  ],
  "solara-waystation": [
    { speaker: "Faction Liaison", text: "Solar Array's still feeding the grid, barely. Heat'll kill you faster than the sand will." },
    { speaker: "Faction Liaison", text: "Faction Quarter backs this post. Anything you need, it's on their tab — for now." },
  ],
  "swamps-scavenger-hub": [
    { speaker: "Trader", text: "Airboat Transit's the only dry ground for a mile. Fog's thick tonight — thicker than usual." },
    { speaker: "Trader", text: "Something's been moving in the reeds that isn't wildlife. Keep the engine running." },
  ],
};

export function dialogueFor(interiorId: string): DialogueLine[] | null {
  return INTERIOR_DIALOGUE[interiorId] ?? null;
}

/** Who createSim() (sim.ts) hands each region to at the start of a run — a revisit line names the
 *  faction only when the live owner has actually drifted from this, i.e. something really happened. */
const STARTING_OWNER: Record<string, Faction> = {
  nexus: "vanguard",
  veridan: "syndicate",
  frostspire: "overseer",
  ember: "overseer",
  wastelands: "syndicate",
  solara: "syndicate",
  swamps: "overseer",
};

const SPEAKER: Record<string, string> = {
  "nexus-apartment": "Mara",
  "nexus-scrap-market": "Broker",
  "veridan-outpost": "Field Medic",
  "frostspire-shelter": "Relay Technician",
  "ember-bunker": "Survey Engineer",
  "wastelands-tradepost": "Runner",
  "solara-waystation": "Faction Liaison",
  "swamps-scavenger-hub": "Trader",
};

/** One line for when the zone's instability has climbed into FRACTURED/COLLAPSING/VOID territory. */
const SEVERE_LINE: Record<string, string> = {
  "nexus-apartment": "The stability field hiccuped again last night. First time I've felt it in here.",
  "nexus-scrap-market": "Half my regulars stopped coming in. Whatever's happening out there, it's close now.",
  "veridan-outpost": "The forest's stopped making forest sounds. That's worse than the machines, somehow.",
  "frostspire-shelter": "Relay's dropping packets it shouldn't drop. The mountain doesn't glitch. Until now.",
  "ember-bunker": "Containment's not flickering anymore — it's just off, more than it's on.",
  "wastelands-tradepost": "Convoys stopped running the northern route entirely. Nobody's saying why out loud.",
  "solara-waystation": "The grid's browning out at noon now. Never used to happen, even in the worst heat.",
  "swamps-scavenger-hub": "The fog's not lifting at dawn anymore. It's just staying. Watch your footing out there.",
};

/** Milder version for STRAINED — noticed, not yet alarmed. */
const STRAINED_LINE: Record<string, string> = {
  "nexus-apartment": "Lights flicker if you stand too close to the window. Started a few days back.",
  "nexus-scrap-market": "Prices are creeping up. Suppliers say the routes are getting less predictable.",
  "veridan-outpost": "Wildlife's been jumpier than usual. Something's got them on edge out there.",
  "frostspire-shelter": "Static on the relay's worse than usual today. Probably nothing.",
  "ember-bunker": "Containment field's stuttering more than it used to. Keeping an eye on it.",
  "wastelands-tradepost": "Raider chatter's picked up on the scanners. Nothing close yet.",
  "solara-waystation": "Dust storms are running longer than the forecasts say they should.",
  "swamps-scavenger-hub": "Water's rising a little more than it should this time of year.",
};

/** Noticed when the live territory-control owner has drifted from where the run started. */
function factionShiftLine(speaker: string, owner: Faction): DialogueLine {
  const names: Record<Faction, string> = { vanguard: "the Resonants", syndicate: "the Breakers", overseer: "the Controllers" };
  return { speaker, text: `Word is ${names[owner]} run this ground now. Things change fast out here.` };
}

const IDLE_LINES: Record<string, string[]> = {
  "nexus-apartment": [
    "Door's always open. Mine, not the city's — the city's never open.",
    "You track less mud in than most. I appreciate that, actually.",
  ],
  "nexus-scrap-market": [
    "Still standing, still trading. That's the whole business model these days.",
    "You want the good stuff, ask. Don't just stare at the counter, it makes people nervous.",
  ],
  "veridan-outpost": [
    "Forest's quiet today. Enjoy it while it lasts.",
    "Medkit's stocked if you need it. Try not to need it.",
  ],
  "frostspire-shelter": [
    "Signal's holding. Barely, but holding.",
    "Cold gets into everything up here. Even the coffee.",
  ],
  "ember-bunker": [
    "Reactor's behaving. For now.",
    "You get used to the rumble. Eventually.",
  ],
  "wastelands-tradepost": [
    "Prices are the prices. Don't ask twice.",
    "Ridge road's clear as of an hour ago. That could change.",
  ],
  "solara-waystation": [
    "Grid's stable. Heat's not, but the grid is.",
    "Faction pays my wages, but I don't ask too many questions about why.",
  ],
  "swamps-scavenger-hub": [
    "Engine's warm if you need to move fast.",
    "Fog'll lift by midday. Usually.",
  ],
};

/**
 * Picks what an interior's NPC has to say on a revisit, in priority order: a severe zone-instability
 * warning, a faction-control shift, a light nod to whatever Fracture Descent quest is active, a milder
 * instability comment, then a rotating idle line so repeat visits don't feel canned.
 */
export function revisitDialogueFor(
  interiorId: string,
  ctx: { questTitle: string | null; zoneTier: InstabilityTier; owner: Faction; regionId: string; visitCount: number },
): DialogueLine[] | null {
  const speaker = SPEAKER[interiorId];
  if (!speaker) return null;

  if (ctx.zoneTier === "FRACTURED" || ctx.zoneTier === "COLLAPSING" || ctx.zoneTier === "VOID") {
    const line = SEVERE_LINE[interiorId];
    if (line) return [{ speaker, text: line }];
  }
  const startingOwner = STARTING_OWNER[ctx.regionId];
  if (startingOwner && ctx.owner !== startingOwner) {
    return [factionShiftLine(speaker, ctx.owner)];
  }
  if (ctx.questTitle) {
    return [{ speaker, text: `Still chasing "${ctx.questTitle}"? Careful out there — whatever it is, it hasn't gotten easier.` }];
  }
  if (ctx.zoneTier === "STRAINED") {
    const line = STRAINED_LINE[interiorId];
    if (line) return [{ speaker, text: line }];
  }
  const idle = IDLE_LINES[interiorId];
  if (!idle || idle.length === 0) return null;
  return [{ speaker, text: idle[ctx.visitCount % idle.length]! }];
}
