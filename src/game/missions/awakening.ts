/** Neon Core – Awakening: micro-objective chain driven by world events.
 * Patrol → escalation elite → loot → capture/hold → extract. No popups. */
export type AwakeningState = "IDLE" | "DROP" | "PATROL" | "ESCALATION" | "LOOT" | "CAPTURE" | "HOLD" | "EXTRACT" | "COMPLETE";
export type AwakeningEvent =
  | { type: "START" }
  | { type: "ANCHOR"; x: number; z: number }
  /** `from` names the phase the cleared wave belonged to; a CLEAR for any other phase is a stale/duplicate delivery and is ignored. */
  | { type: "CLEAR"; from?: "PATROL" | "ESCALATION" }
  | { type: "ARRIVED" }
  | { type: "HOLD"; progress: number }
  | { type: "ACK" };

export type AwakeningRun = { id: "awakening"; state: AwakeningState; target: { x: number; z: number } | null; hold: number; line: string; alert: string };

export const AWAKENING: AwakeningRun = { id: "awakening", state: "IDLE", target: null, hold: 0, line: "", alert: "" };

export const AWAKENING_OBJECTIVE: Record<AwakeningState, string> = {
  IDLE: "", DROP: "Deploying to Neon Core", PATROL: "Clear the patrol", ESCALATION: "Faction elite inbound — survive",
  LOOT: "Collect recovered gear", CAPTURE: "Reach the capture point", HOLD: "Hold the capture point", EXTRACT: "Reach extraction", COMPLETE: "Sector stabilized",
};

export function advanceAwakening(m: AwakeningRun, e: AwakeningEvent): AwakeningRun {
  switch (m.state) {
    case "IDLE": return e.type === "START" ? { ...m, state: "DROP", line: "Identity stabilized… Deploying subject to live conflict zone. Welcome to Neon Core." } : m;
    case "DROP": return e.type === "ANCHOR" ? { ...m, state: "PATROL", target: { x: e.x, z: e.z }, line: "Hostiles on your position. Move and shoot." } : m;
    case "PATROL": return e.type === "CLEAR" && (!e.from || e.from === "PATROL") ? { ...m, state: "ESCALATION", alert: "NEON CORE DISTRICT ALERT: Faction activity detected", line: "Something bigger is coming. Use cover." } : m;
    case "ESCALATION": return e.type === "CLEAR" && (!e.from || e.from === "ESCALATION") ? { ...m, state: "LOOT", alert: "", line: "Gear recovered. Everything you do improves your build." } : m;
    case "LOOT": return e.type === "ACK" && m.target ? { ...m, state: "CAPTURE", target: { x: m.target.x + 30, z: m.target.z - 18 }, line: "Capture point marked. Secure it." } : m;
    case "CAPTURE": return e.type === "ARRIVED" ? { ...m, state: "HOLD", hold: 0, line: "Hold position. New wave incoming." } : m;
    case "HOLD":
      if (e.type !== "HOLD") return m;
      return e.progress >= 100 && m.target ? { ...m, hold: 100, state: "EXTRACT", target: { x: m.target.x - 26, z: m.target.z + 34 }, line: "Point held. Extraction route unlocked." } : { ...m, hold: e.progress };
    case "EXTRACT": return e.type === "ARRIVED" ? { ...m, state: "COMPLETE", target: null, line: "Sector stabilized. Returning to command interface." } : m;
    default: return m;
  }
}
