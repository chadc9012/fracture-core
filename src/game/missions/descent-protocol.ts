/** Mission 4 — "Descent Protocol": gives fd-16's dive to Thalassia (currently just an abstract
 * "survive 60s underwater" timer) an actual scripted destination and story beat, continuing
 * straight from Stitched Neon Core's ending ("that signal was coming through Neon City — from
 * somewhere under Thalassia"). Thalassia.tsx's full sunken city is already built and explorable;
 * this is the first authored reason to swim out to it. Deliberately ends on a cliffhanger rather
 * than a boss fight — Thalassia has no catalog boss yet (it isn't a physical REGIONS entry, see
 * quests.ts's header comment), and the real confrontation belongs to fd-18's still-unbuilt final
 * mission, "The System Core." Same ANCHOR/ARRIVED/CLEAR/HACK/ACK shape as Missions 01-03. */
export type MissionState = "IDLE" | "TRIGGERED" | "DIVE" | "COMBAT_1" | "TRACING" | "COMPLETE" | "WORLD_UPDATE";
export type MissionEvent =
  | { type: "START" }
  | { type: "ANCHOR"; x: number; z: number }
  | { type: "ARRIVED" }
  | { type: "CLEAR" }
  | { type: "HACK"; progress: number }
  | { type: "ACK" };

export type MissionRun = {
  id: "descent-protocol";
  state: MissionState;
  target: { x: number; z: number } | null;
  hack: number;
  nova: string;
};

export const DESCENT_PROTOCOL: MissionRun = { id: "descent-protocol", state: "IDLE", target: null, hack: 0, nova: "" };

/** In-world objective line (not a menu) for each state. */
export const OBJECTIVE: Record<MissionState, string> = {
  IDLE: "",
  TRIGGERED: "Source triangulated — it's below the waterline",
  DIVE: "Dive to the sunken city",
  COMBAT_1: "Defense ring's active — break through",
  TRACING: "Trace the signal through the city",
  COMPLETE: "First sight of the control core",
  WORLD_UPDATE: "The Deepmind is still awake",
};

export function advanceMission(m: MissionRun, e: MissionEvent): MissionRun {
  switch (m.state) {
    case "IDLE":
      return e.type === "START"
        ? { ...m, state: "TRIGGERED", nova: "I traced it as far as I can over the grid. Past that it's open ocean, and then it's gone dark — straight down. Whatever's under there has been quiet a very long time." }
        : m;
    case "TRIGGERED":
      return e.type === "ANCHOR"
        ? { ...m, state: "DIVE", target: { x: e.x, z: e.z }, nova: "That's not seabed out there. That's architecture. Something built that, and something's still keeping the lights on." }
        : m;
    case "DIVE":
      return e.type === "ARRIVED"
        ? { ...m, state: "COMBAT_1", nova: "A defense ring just came online around you. It's old, but it's not broken — clear it before it calls down something worse." }
        : m;
    case "COMBAT_1":
      return e.type === "CLEAR"
        ? { ...m, state: "TRACING", nova: "Ring's down. The signal's strongest toward the city center — a control core, still drawing full power after all this time." }
        : m;
    case "TRACING":
      if (e.type !== "HACK") return m;
      if (e.progress >= 100) return { ...m, hack: 100, state: "COMPLETE", nova: "There. That's it — the Deepmind's control core. Whatever the Fracture actually is, it started right there. And it just noticed you." };
      return { ...m, hack: e.progress };
    case "COMPLETE":
      return e.type === "ACK"
        ? { ...m, state: "WORLD_UPDATE", target: null, nova: "It's not responding to the trace anymore. It's responding to you. Next time we go down there, we're not finding it by accident." }
        : m;
    default:
      return m;
  }
}
