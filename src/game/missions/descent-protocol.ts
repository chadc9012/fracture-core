/** Mission 4 — "Descent Protocol": gives fd-16's dive to Thalassia (currently just an abstract
 * "survive 60s underwater" timer) an actual scripted destination and story beat, continuing
 * straight from Stitched Neon Core's ending ("that signal was coming through Neon City — from
 * somewhere under Thalassia"). Thalassia.tsx's full sunken city is already built and explorable;
 * this is the first authored reason to swim out to it. Deliberately ends on a cliffhanger rather
 * than a boss fight — Thalassia has no catalog boss yet (it isn't a physical REGIONS entry, see
 * quests.ts's header comment), and the real confrontation belongs to fd-18's still-unbuilt final
 * mission, "The System Core." Same ANCHOR/ARRIVED/CLEAR/HACK/ACK shape as Missions 01-03. */
import { airlockSite, reactorSite, ringWaypoint } from "../thalassia-sectors";

/* Thalassia playable descent (owner brief, Phase 1): the old dive → ring fight → trace became a four-stage mission.
 *   DIVE      submersible approach: reach the Sentry Dock (ANCHOR gives the dock; star-map deploys arrive there too)
 *   COMBAT_1  dock security wakes up — clear it
 *   AIRLOCK   restore the dock airlock (HACK 0..100). Restoring it arms the dock air station and the dock checkpoint.
 *   RING      cross the Abyssal Ring to its far waypoint (electrified coolant, thalassia-sectors.ts) — ARRIVED
 *   CORE      descend into the Sunk-Core to the damaged reactor (crush depth, patrols) — ARRIVED
 *   TRACING   trace the reactor's signal (HACK 0..100) — the Deepmind's control core, the hook for fd-18's boss
 * Saved runs from the old three-step version (DIVE / COMBAT_1 / TRACING) keep working: those states still exist. */
export type MissionState = "IDLE" | "TRIGGERED" | "DIVE" | "COMBAT_1" | "AIRLOCK" | "RING" | "CORE" | "TRACING" | "COMPLETE" | "WORLD_UPDATE";
export type MissionEvent =
  | { type: "START" }
  | { type: "ANCHOR"; x: number; z: number }
  /** `from`: the state the world saw when it emitted the event. The frame loop emits every frame until React catches up, so a second
   * ARRIVED queued behind the first would otherwise be applied to the NEXT state (live playtest: RING skipped straight past CORE to TRACING). */
  | { type: "ARRIVED"; from?: MissionState }
  | { type: "CLEAR"; from?: MissionState }
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
  DIVE: "Take the submersible down to Thalassia's Sentry Dock",
  COMBAT_1: "Dock security is awake — clear the Sentry Dock",
  AIRLOCK: "Restore the dock airlock",
  RING: "Cross the Abyssal Ring — stay off the coolant when it charges",
  CORE: "Descend into the Sunk-Core to the damaged reactor",
  TRACING: "Trace the signal through the reactor",
  COMPLETE: "First sight of the control core",
  WORLD_UPDATE: "The Deepmind is still awake",
};

/** stages after the airlock is restored: the dock checkpoint and air station are live */
export const airlockRestored = (m: MissionRun | null | undefined) => !!m && ["RING", "CORE", "TRACING", "COMPLETE", "WORLD_UPDATE"].includes(m.state);

export function advanceMission(m: MissionRun, e: MissionEvent): MissionRun {
  if ((e.type === "ARRIVED" || e.type === "CLEAR") && e.from && e.from !== m.state) return m; // stale world event for an earlier state
  switch (m.state) {
    case "IDLE":
      return e.type === "START"
        ? { ...m, state: "TRIGGERED", nova: "I traced it as far as I can over the grid. Past that it's open ocean, and then it's gone dark — straight down. Whatever's under there has been quiet a very long time." }
        : m;
    case "TRIGGERED":
      return e.type === "ANCHOR"
        ? { ...m, state: "DIVE", target: { x: e.x, z: e.z }, nova: "That's not seabed out there. That's architecture — and a docking ring still blinking. Take us to the Sentry Dock. Hull's going to complain on the way down." }
        : m;
    case "DIVE":
      return e.type === "ARRIVED"
        ? { ...m, state: "COMBAT_1", nova: "We're through the outer seal and the dock's security frames just woke up. Clear them — then we can get that airlock breathing again." }
        : m;
    case "COMBAT_1":
      return e.type === "CLEAR"
        ? { ...m, state: "AIRLOCK", target: airlockSite(), hack: 0, nova: "Dock's quiet. The airlock controller is fried but not dead — reroute it and the dock air station comes back with it." }
        : m;
    case "AIRLOCK":
      if (e.type !== "HACK") return m;
      if (e.progress >= 100) return { ...m, hack: 0, state: "RING", target: ringWaypoint(), nova: "Airlock's holding and the station's pumping air — that's our checkpoint. Next is the Abyssal Ring. The floor's flooded with live coolant: when it charges, get up off the floor." };
      return { ...m, hack: e.progress };
    case "RING":
      return e.type === "ARRIVED"
        ? { ...m, state: "CORE", target: reactorSite(), nova: "You made the far side. Below us is the Sunk-Core — the rupture. Past crush depth your suit starts to give, so go down, get the reactor, come back up." }
        : m;
    case "CORE":
      return e.type === "ARRIVED"
        ? { ...m, state: "TRACING", hack: 0, nova: "That's the reactor — or what's left of it. Something's feeding it from the rift below. Trace the signal before the patrols close in." }
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
