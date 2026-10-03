/** Mission 5 — "The System Core": fd-18's still-unbuilt final mission, the one Descent Protocol's
 * header comment pointed to ("the real confrontation belongs to fd-18's still-unbuilt final
 * mission, 'The System Core'") and the one EndingOverlay.tsx has been waiting on since fd-18 first
 * existed. Picks up straight from Descent Protocol's cliffhanger ("next time we go down there,
 * we're not finding it by accident") — same dive-back-into-Thalassia shape as Mission 04, but this
 * time it doesn't stop at a sighting: it ends in the game's final scripted boss fight.
 *
 * The System Core has no entry in encounters.ts (Thalassia isn't a physical REGIONS entry, see
 * quests.ts's header comment), so it's wired through unique-scenarios.ts instead — the mechanism
 * purpose-built for exactly this ("a region with no catalog boss"), already proven on Solara's
 * Unbroken Glass. summonBoss(sim, "thalassia", ..., { mission: true }) resolves through that
 * fallback, and the boss fight uses the same mission-tagged CLEAR-detection idiom as Mission 03's
 * Aegis-Prime fight: the generic "no more alive mission-tagged machines" check fires CLEAR.
 *
 * Same ANCHOR/ARRIVED/CLEAR/HACK/ACK shape as Missions 01-04 on purpose — Scene.tsx/GameCanvas.tsx
 * wire it up identically. WORLD_UPDATE is where GameCanvas.tsx dispatches the BOSS_DEFEATED event
 * fd-18 is actually listening for (key "system-core"), which completes fd-18 and — via
 * GameCanvas.tsx's existing completedMissions.includes("fd-18") check — triggers EndingOverlay. */
export type MissionState = "IDLE" | "TRIGGERED" | "DIVE" | "COMBAT_1" | "STABILIZING" | "BOSS" | "COMPLETE" | "WORLD_UPDATE";
export type MissionEvent =
  | { type: "START" }
  | { type: "ANCHOR"; x: number; z: number }
  | { type: "ARRIVED" }
  | { type: "CLEAR" }
  | { type: "HACK"; progress: number }
  | { type: "ACK" };

export type MissionRun = {
  id: "system-core";
  state: MissionState;
  target: { x: number; z: number } | null;
  hack: number;
  nova: string;
};

export const SYSTEM_CORE: MissionRun = { id: "system-core", state: "IDLE", target: null, hack: 0, nova: "" };

/** In-world objective line (not a menu) for each state. */
export const OBJECTIVE: Record<MissionState, string> = {
  IDLE: "",
  TRIGGERED: "The Deepmind has noticed you — it isn't hiding anymore",
  DIVE: "Dive back to the control core",
  COMBAT_1: "Break through its last line of defense",
  STABILIZING: "Collapse the three containment locks",
  BOSS: "Confront the System Core",
  COMPLETE: "The System Core is down",
  WORLD_UPDATE: "The Fracture, answered",
};

export function advanceMission(m: MissionRun, e: MissionEvent): MissionRun {
  switch (m.state) {
    case "IDLE":
      return e.type === "START"
        ? { ...m, state: "TRIGGERED", nova: "Every world you've touched — Veridan, Neon City, the Wastelands, all of it — routes back to the same place. Thalassia's core isn't a ruin anymore. It's awake, and it's been waiting for you." }
        : m;
    case "TRIGGERED":
      return e.type === "ANCHOR"
        ? { ...m, state: "DIVE", target: { x: e.x, z: e.z }, nova: "That's not architecture down there anymore — it's a nervous system, and it's lit up end to end. Go straight to the center." }
        : m;
    case "DIVE":
      return e.type === "ARRIVED"
        ? { ...m, state: "COMBAT_1", nova: "You're at the heart of the Deepmind. It already knows you're inside its perimeter — everything down here is about to answer to it." }
        : m;
    case "COMBAT_1":
      return e.type === "CLEAR"
        ? { ...m, state: "STABILIZING", nova: "Perimeter's down. It's not hiding anymore — three containment locks are all that's keeping its real core sealed off. Break them and it has nowhere left to retreat." }
        : m;
    case "STABILIZING":
      if (e.type !== "HACK") return m;
      if (e.progress >= 100) return { ...m, hack: 100, state: "BOSS", nova: "Locks are down. The System Core — the thing every Fracture Architect, every world, every one of them, has been answering to — just opened its eyes." };
      return { ...m, hack: e.progress };
    case "BOSS":
      return e.type === "CLEAR" ? { ...m, state: "COMPLETE", nova: "The System Core is down. Whatever the Fracture actually was, it just lost whatever was holding it together." } : m;
    case "COMPLETE":
      return e.type === "ACK"
        ? { ...m, state: "WORLD_UPDATE", target: null, nova: "It's quiet down here now. Really quiet, for the first time since any of this started. I think that's it. I think it's over." }
        : m;
    default:
      return m;
  }
}
