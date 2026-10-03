/** Mission 2 — "Blackout Protocol": deterministic state machine driven by world events.
 * Picks up exactly where Broken Signal left off — the traced signal didn't dead-end, it led
 * straight into Neon City's own surveillance grid. This is the scripted reason the player has
 * a concrete first reason to fight through the real Neon City street (NeonCity.tsx) rather than
 * it just sitting unexplained on the map, and it seeds the "Stitched Neon Core" hook for the
 * next session. Same shape as broken-signal.ts on purpose, so Scene.tsx/GameCanvas.tsx wire it
 * up the identical way (ANCHOR/ARRIVED/CLEAR from world events, HACK/ACK from UI). */
export type MissionState = "IDLE" | "TRIGGERED" | "INFILTRATION" | "COMBAT_1" | "HACKING" | "COMBAT_2" | "COMPLETE" | "WORLD_UPDATE";
export type MissionEvent =
  | { type: "START" }
  | { type: "ANCHOR"; x: number; z: number }
  | { type: "ARRIVED" }
  | { type: "CLEAR" }
  | { type: "HACK"; progress: number }
  | { type: "ACK" };

export type MissionRun = {
  id: "blackout-protocol";
  state: MissionState;
  target: { x: number; z: number } | null;
  hack: number;
  wave2Done: boolean;
  nova: string;
};

export const BLACKOUT_PROTOCOL: MissionRun = { id: "blackout-protocol", state: "IDLE", target: null, hack: 0, wave2Done: false, nova: "" };

/** In-world objective line (not a menu) for each state. */
export const OBJECTIVE: Record<MissionState, string> = {
  IDLE: "",
  TRIGGERED: "Neon City grid signature matches the trace",
  INFILTRATION: "Reach the Neon City substation",
  COMBAT_1: "Clear the substation guard",
  HACKING: "Cut the surveillance relays",
  COMBAT_2: "Hold the relay against the enforcer wave",
  COMPLETE: "Grid down — district blacked out",
  WORLD_UPDATE: "Stitched Neon Core signal detected",
};

export function advanceMission(m: MissionRun, e: MissionEvent): MissionRun {
  switch (m.state) {
    case "IDLE":
      return e.type === "START" ? { ...m, state: "TRIGGERED", nova: "That trace didn't dead-end — it led straight into Neon City's own grid. Somebody's hiding behind the Syndicate's noise." } : m;
    case "TRIGGERED":
      return e.type === "ANCHOR" ? { ...m, state: "INFILTRATION", target: { x: e.x, z: e.z }, nova: "Get into the district. Keep your profile low until we're past their first scanners." } : m;
    case "INFILTRATION":
      return e.type === "ARRIVED" ? { ...m, state: "COMBAT_1", nova: "Substation's guarded. Clear them before anyone calls it in." } : m;
    case "COMBAT_1":
      return e.type === "CLEAR" ? { ...m, state: "HACKING", nova: "Three relays feed the surveillance net. Cut them in sequence, or it just reroutes around you." } : m;
    case "HACKING":
      if (e.type !== "HACK") return m;
      if (e.progress >= 50 && !m.wave2Done) return { ...m, hack: e.progress, state: "COMBAT_2", nova: "Grid noticed the cut. Enforcer wave inbound — hold the relay." };
      if (e.progress >= 100) return { ...m, hack: 100, state: "COMPLETE", nova: "Grid's down. Whole district just went dark — and under all that dead signal, something else just lit up." };
      return { ...m, hack: e.progress };
    case "COMBAT_2":
      return e.type === "CLEAR" ? { ...m, state: "HACKING", wave2Done: true, nova: "Wave down. Finish the cut." } : m;
    case "COMPLETE":
      return e.type === "ACK" ? { ...m, state: "WORLD_UPDATE", target: null, nova: "They're calling whatever's underneath the Stitched Neon Core. That's not on any map NOVA has." } : m;
    default:
      return m;
  }
}
