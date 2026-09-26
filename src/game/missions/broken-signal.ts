/** Mission 1 — "Broken Signal": deterministic state machine driven by world events. */
export type MissionState = "IDLE" | "TRIGGERED" | "DISCOVERY" | "TRAVERSAL" | "COMBAT_1" | "HACKING" | "COMBAT_2" | "COMPLETE" | "WORLD_UPDATE";
export type MissionEvent =
  | { type: "START" }
  | { type: "ANCHOR"; x: number; z: number }
  | { type: "ARRIVED" }
  | { type: "CLEAR" }
  | { type: "HACK"; progress: number }
  | { type: "ACK" };

export type MissionRun = {
  id: "broken-signal";
  state: MissionState;
  target: { x: number; z: number } | null;
  hack: number;
  wave2Done: boolean;
  nova: string;
};

export const BROKEN_SIGNAL: MissionRun = { id: "broken-signal", state: "IDLE", target: null, hack: 0, wave2Done: false, nova: "" };

/** In-world objective line (not a menu) for each state. */
export const OBJECTIVE: Record<MissionState, string> = {
  IDLE: "",
  TRIGGERED: "Unauthorized signal detected",
  DISCOVERY: "Follow the drone beacon",
  TRAVERSAL: "Enter the corrupted industrial sector",
  COMBAT_1: "Eliminate the data drone scouts",
  HACKING: "Restore data node connection",
  COMBAT_2: "Survive the escalation wave",
  COMPLETE: "Signal traced",
  WORLD_UPDATE: "Subway entrance unlocked",
};

export function advanceMission(m: MissionRun, e: MissionEvent): MissionRun {
  switch (m.state) {
    case "IDLE":
      return e.type === "START" ? { ...m, state: "TRIGGERED", nova: "That wasn't supposed to happen… something is interfering with the ad network." } : m;
    case "TRIGGERED":
      return e.type === "ANCHOR" ? { ...m, state: "DISCOVERY", target: { x: e.x, z: e.z }, nova: "Follow that signal. It's moving toward the industrial zone." } : m;
    case "DISCOVERY":
      return e.type === "ARRIVED" && m.target ? { ...m, state: "TRAVERSAL", target: { x: m.target.x + 22, z: m.target.z + 22 }, nova: "We're entering a corrupted sector. Stay alert." } : m;
    case "TRAVERSAL":
      return e.type === "ARRIVED" ? { ...m, state: "COMBAT_1", nova: "These drones are scanning for corrupted data… take them out." } : m;
    case "COMBAT_1":
      return e.type === "CLEAR" ? { ...m, state: "HACKING", nova: "Stabilize the data stream. Think of it like routing clean data through broken systems." } : m;
    case "HACKING":
      if (e.type !== "HACK") return m;
      if (e.progress >= 50 && !m.wave2Done) return { ...m, hack: e.progress, state: "COMBAT_2", nova: "They've noticed you. Incoming wave." };
      if (e.progress >= 100) return { ...m, hack: 100, state: "COMPLETE", nova: "Signal traced… it's coming from deeper in the system. We're not alone in here." };
      return { ...m, hack: e.progress };
    case "COMBAT_2":
      return e.type === "CLEAR" ? { ...m, state: "HACKING", wave2Done: true, nova: "Wave down. Finish the route." } : m;
    case "COMPLETE":
      return e.type === "ACK" ? { ...m, state: "WORLD_UPDATE", target: null, nova: "The wall's open. Undercore subway is live — and the city's signage is still glitching." } : m;
    default:
      return m;
  }
}
