/** Mission 3 — "Stitched Neon Core": the dungeon Blackout Protocol's ending hooked but never
 * built a physical layer for. The district blackout exposed a signal "stitched" directly into
 * the Syndicate's own grid infrastructure — this mission is the descent to it, ending in the
 * game's first scripted boss fight (Aegis-Prime, nexus's existing catalog boss from
 * encounters.ts — its "High-Tech Interior" lair and shield-pulse tell already fit a fused,
 * defended core perfectly, so this reuses it rather than inventing a parallel boss).
 * Same shape as broken-signal.ts/blackout-protocol.ts on purpose — Scene.tsx/GameCanvas.tsx wire
 * it up identically (ANCHOR/ARRIVED/CLEAR from world events, HACK/ACK from UI). The boss fight
 * reuses the exact same CLEAR-detection idiom as a drone wave: summonBoss(..., { mission: true })
 * tags it, and the generic "no more alive mission-tagged machines" check fires CLEAR same as always. */
export type MissionState = "IDLE" | "TRIGGERED" | "DESCENT" | "COMBAT_1" | "STABILIZING" | "BOSS" | "COMPLETE" | "WORLD_UPDATE";
export type MissionEvent =
  | { type: "START" }
  | { type: "ANCHOR"; x: number; z: number }
  | { type: "ARRIVED" }
  | { type: "CLEAR" }
  | { type: "HACK"; progress: number }
  | { type: "ACK" };

export type MissionRun = {
  id: "stitched-neon-core";
  state: MissionState;
  target: { x: number; z: number } | null;
  hack: number;
  nova: string;
};

export const STITCHED_NEON_CORE: MissionRun = { id: "stitched-neon-core", state: "IDLE", target: null, hack: 0, nova: "" };

/** In-world objective line (not a menu) for each state. */
export const OBJECTIVE: Record<MissionState, string> = {
  IDLE: "",
  TRIGGERED: "Stitched Neon Core signal pinpointed",
  DESCENT: "Descend to the fused relay chamber",
  COMBAT_1: "Clear the chamber's defense grid",
  STABILIZING: "Stabilize the three resonance nodes",
  BOSS: "Bring down Aegis-Prime",
  COMPLETE: "Core breached",
  WORLD_UPDATE: "The signal beneath the signal",
};

export function advanceMission(m: MissionRun, e: MissionEvent): MissionRun {
  switch (m.state) {
    case "IDLE":
      return e.type === "START"
        ? { ...m, state: "TRIGGERED", nova: "That dead grid under the blackout isn't dead — it's stitched into something older. NOVA's got a fix on it. Go." }
        : m;
    case "TRIGGERED":
      return e.type === "ANCHOR"
        ? { ...m, state: "DESCENT", target: { x: e.x, z: e.z }, nova: "Access point's below the substation. Whatever's down there has been running quiet for a long time — don't wake it early." }
        : m;
    case "DESCENT":
      return e.type === "ARRIVED"
        ? { ...m, state: "COMBAT_1", nova: "You're in the chamber. Defense grid's active — clear it before it locks the room down." }
        : m;
    case "COMBAT_1":
      return e.type === "CLEAR"
        ? { ...m, state: "STABILIZING", nova: "Three resonance nodes are keeping this thing fused in place. Stabilize all three or it destabilizes the whole chamber." }
        : m;
    case "STABILIZING":
      if (e.type !== "HACK") return m;
      if (e.progress >= 100) return { ...m, hack: 100, state: "BOSS", nova: "Nodes are stable — and that just woke it up. Aegis-Prime, fully online. Fight." };
      return { ...m, hack: e.progress };
    case "BOSS":
      return e.type === "CLEAR" ? { ...m, state: "COMPLETE", nova: "Aegis-Prime's down. The core's exposed — and it's still transmitting." } : m;
    case "COMPLETE":
      return e.type === "ACK"
        ? { ...m, state: "WORLD_UPDATE", target: null, nova: "That signal wasn't coming from Neon City. It was coming through it — from somewhere under Thalassia." }
        : m;
    default:
      return m;
  }
}
