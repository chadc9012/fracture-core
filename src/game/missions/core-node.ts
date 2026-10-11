/** Mid-campaign reveal mission — "The Core Node": upgrades fd-09 ("Protocol Breach") and carries the two
 * story beats the campaign tracker (§7 A.4/A.6, §8 "One mid-campaign reveal mission") said had no hook:
 * NOVA's secret, and the faction choice that decides the ending.
 *
 * Story: Solar Array Alpha's beam runs into the Nexus Authority's Core Node. The Carrier breaks in, holds
 * off the Authority's response, and NOVA opens the node's archive. Before the Carrier can read it, NOVA
 * tells the truth: she is a fragment of the Thalassian Deepmind, the intelligence that started the
 * Fracture and broke itself doing it. The archive explains the Carrier: the Resonant Carrier program
 * existed to deliver a key to the System Core, and three sides want to decide what that key does.
 * The Carrier chooses who to stand with:
 *   - Controllers — lock reality down (Control ending)
 *   - Breakers    — tear the Core open (Chaos ending)
 *   - Resonants   — bring the layers back into balance (Resonant ending)
 *
 * The choice is a story decision (`progression.story.choices.faction`), written through the shared story
 * reducers (story.ts) by REVEAL_GRAPH, so it is replay-safe and merges like every other decision. The
 * machine only waits for the conversation: REVEAL advances on DECIDED, which GameCanvas sends once the
 * graph finishes with a faction recorded. Same ANCHOR/ARRIVED/CLEAR/HACK/ACK shape as the others. */
import type { DialogueGraph, StoryState } from "../story";

export type MissionState = "IDLE" | "TRIGGERED" | "INFILTRATE" | "COMBAT_1" | "HACKING" | "REVEAL" | "COMPLETE" | "WORLD_UPDATE";
export type MissionEvent =
  | { type: "START" }
  | { type: "ANCHOR"; x: number; z: number }
  | { type: "ARRIVED" }
  | { type: "CLEAR" }
  | { type: "HACK"; progress: number }
  | { type: "DECIDED" }
  | { type: "ACK" };

export type MissionRun = { id: "core-node"; state: MissionState; target: { x: number; z: number } | null; hack: number; nova: string };
export const CORE_NODE: MissionRun = { id: "core-node", state: "IDLE", target: null, hack: 0, nova: "" };

export type Faction = "controllers" | "breakers" | "resonants";
export const FACTION_KEY = "faction";
export const FACTIONS: Record<Faction, { name: string; creed: string; accent: string }> = {
  controllers: { name: "Controllers", creed: "Control the fracture, control the world.", accent: "#5fb4ff" },
  breakers: { name: "Breakers", creed: "The fracture is evolution.", accent: "#ff5a4e" },
  resonants: { name: "Resonants", creed: "Balance is power.", accent: "#b48cff" },
};

export function factionOf(story: Pick<StoryState, "choices"> | undefined): Faction | null {
  const v = story?.choices[FACTION_KEY];
  return v === "controllers" || v === "breakers" || v === "resonants" ? v : null;
}

export const OBJECTIVE: Record<MissionState, string> = {
  IDLE: "",
  TRIGGERED: "Follow the beam into Nexus City",
  INFILTRATE: "Reach the Core Node",
  COMBAT_1: "Authority response team: hold the node",
  HACKING: "Open the Core Node's archive",
  REVEAL: "Hear NOVA out",
  COMPLETE: "Allegiance chosen",
  WORLD_UPDATE: "The road to the System Core is open",
};

const COMPLETE_LINE: Record<Faction, string> = {
  controllers: "The Controllers, then. Fine. If locking it down is what keeps people alive, I'll help you hold the key steady.",
  breakers: "The Breakers. You want it all to break open. I can't say I'm not afraid of that. I'll still take you there.",
  resonants: "The Resonants. Thank you. I think that's what I was hoping you'd say, and I didn't dare ask.",
};

export function advanceMission(m: MissionRun, e: MissionEvent, faction: Faction | null = null): MissionRun {
  switch (m.state) {
    case "IDLE":
      return e.type === "START" ? { ...m, state: "TRIGGERED", nova: "The beam from Solara ends in Nexus City, at the Authority's Core Node. Everything we've chased runs through that building." } : m;
    case "TRIGGERED":
      return e.type === "ANCHOR" ? { ...m, state: "INFILTRATE", target: { x: e.x, z: e.z }, nova: "Core Node's at the center of the grid. The Authority will see us coming. That's fine. We just need to get there first." } : m;
    case "INFILTRATE":
      return e.type === "ARRIVED" ? { ...m, state: "COMBAT_1", nova: "Response team inbound. Hold the node while I find the archive." } : m;
    case "COMBAT_1":
      return e.type === "CLEAR" ? { ...m, state: "HACKING", nova: "They're down. The archive wants a handshake. Repeat the pattern and I'll do the rest." } : m;
    case "HACKING":
      if (e.type !== "HACK") return m;
      if (e.progress >= 100) return { ...m, hack: 100, state: "REVEAL", nova: "I'm in. Before you read this, there's something I have to tell you." };
      return { ...m, hack: e.progress };
    case "REVEAL":
      // only a recorded allegiance closes the reveal; a skipped conversation leaves it open
      return e.type === "DECIDED" && faction ? { ...m, state: "COMPLETE", nova: COMPLETE_LINE[faction] } : m;
    case "COMPLETE":
      return e.type === "ACK" ? { ...m, state: "WORLD_UPDATE", target: null, nova: "The Authority will lock Nexus down over this. Let them. We know where the Core is now, and they don't know what we chose." } : m;
    default:
      return m;
  }
}

/** Starts once the desert chapter (fd-08) is done. Saves already past fd-09 get it too if they never chose a
 * faction, so every run reaches the finale with an allegiance; it never starts after the finale. */
export function coreNodeReady(completed: readonly string[], story: Pick<StoryState, "choices"> | undefined): boolean {
  if (!completed.includes("fd-08") || completed.includes("core-node") || completed.includes("fd-18")) return false;
  return !completed.includes("fd-09") || factionOf(story) === null;
}

export const REVEAL_GRAPH: DialogueGraph = {
  id: "core-node.reveal",
  start: "open",
  nodes: {
    open: { id: "open", speaker: "NOVA", text: "The archive's open. Carrier, before you read it: I haven't told you what I am. You should hear it from me first.", next: "secret" },
    secret: {
      id: "secret", speaker: "NOVA",
      text: "I wasn't built to guide you. I'm part of the Deepmind, the intelligence under Thalassia that started the Fracture. When it broke reality it broke itself too. I'm the piece that came loose and wanted to fix it.",
      effects: [{ flag: "nova-secret-known" }],
      choices: [
        { id: "why", text: "Why didn't you tell me?", next: "why" },
        { id: "lied", text: "You lied to me the whole way here.", effects: [{ trust: { who: "nova", amount: -10 } }], next: "why" },
        { id: "trust", text: "You've kept me alive. That counts for something.", effects: [{ trust: { who: "nova", amount: 10 } }], next: "why" },
      ],
    },
    why: { id: "why", speaker: "NOVA", text: "This node was built to find pieces like me and erase them. If you'd known, you'd have hesitated at the door, and you'd have been right to. Read the archive. It's about you, not me.", next: "archive" },
    archive: { id: "archive", speaker: "ARCHIVE", text: "RESONANT CARRIER PROGRAM. Subjects stable across every reality layer. Purpose: carry the key to the System Core. Three parties hold a claim on what the key will do.", next: "offer" },
    offer: {
      id: "offer", speaker: "NOVA",
      text: "Everyone out there has been watching you. The Controllers want the Core locked down for good. The Breakers want it torn open. The Resonants want it listening again. I'll take you to the Core either way. But choose now. The Authority knows we're in here.",
      choices: [
        { id: "controllers", text: "Stand with the Controllers. Lock reality down.", effects: [{ choice: { key: FACTION_KEY, value: "controllers" } }, { flag: "faction-controllers" }], next: "chosen-controllers" },
        { id: "breakers", text: "Stand with the Breakers. Let it break open.", effects: [{ choice: { key: FACTION_KEY, value: "breakers" } }, { flag: "faction-breakers" }], next: "chosen-breakers" },
        { id: "resonants", text: "Stand with the Resonants. Bring it back into balance.", effects: [{ choice: { key: FACTION_KEY, value: "resonants" } }, { flag: "faction-resonants" }, { trust: { who: "nova", amount: 5 } }], next: "chosen-resonants" },
      ],
    },
    "chosen-controllers": { id: "chosen-controllers", speaker: "CONTROLLERS", text: "Carrier. The Authority has been waiting for you to see sense. Bring us the key and nothing will ever fracture again." },
    "chosen-breakers": { id: "chosen-breakers", speaker: "BREAKERS", text: "Took you long enough. The Rebellion's been tearing at the walls for years. You're the first one who can reach the Core." },
    "chosen-resonants": { id: "chosen-resonants", speaker: "RESONANTS", text: "You hear it too, then. The layers aren't fighting. They're calling for help. We'll be with you at the Core." },
  },
};
