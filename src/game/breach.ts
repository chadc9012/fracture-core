/** The Breach (owner, Nov 1): combat is taught during the escape, cinematically, instead of in a separate forest calibration.
 * Out of the Residences' doors the opening cinematic plays ("The night the world changed"), then the street fight begins with
 * the player still an ordinary civilian. The Operator's powers wake under pressure, one layer at a time, and NOVA talks them
 * through what is happening. No checklist, no trial gates: a short spoken line and, at most, one quiet input hint.
 *
 *   CINE    the opening cinematic is playing                                   powers 0 (civilian)
 *   DAZED   on the street, unarmed; a Fracture echo closes in                   powers 0
 *   SURGE   it gets close or hits you: armor and weapon flash into existence    powers 1 (fire, melee)
 *   ANCHOR  echoes down; something big anchors to the tear and charges         powers 2 (+ primary ability, dash)
 *   CLEAR   the anchor falls; NOVA and Mara catch their breath                  powers 3 (everything)
 *   DONE    the prologue is over: free roam in Nexus City, Mission 01 recorded
 *
 * Pure; Scene spawns the enemies and reports what happens, GameCanvas holds the run. Deeper training is left to later
 * missions, mentors and exploration (the Verdant Forest calibration and its encounters stay in the game as they were). */

export type BreachState = "CINE" | "DAZED" | "SURGE" | "ANCHOR" | "CLEAR" | "DONE";
export type BreachEvent =
  | { type: "CINE_DONE"; now: number }
  /** DAZED: an echo got close, hit you, or you stood there long enough */
  | { type: "THREAT"; now: number }
  /** SURGE: every echo of the first wave is down */
  | { type: "WAVE_CLEAR"; now: number }
  /** ANCHOR: the anchor is down */
  | { type: "ANCHOR_DOWN"; now: number }
  /** time passing: CLEAR finishes, and a stalled step gets one nudge from NOVA */
  | { type: "TICK"; now: number }
  /** you used what NOVA just pointed you at (fire in SURGE, the ability in ANCHOR): the input hint fades */
  | { type: "USED"; now: number };

export type BreachLine = { speaker: string; text: string };
export type BreachRun = {
  id: "breach"; state: BreachState;
  /** ms timestamp the state began (Date.now()) */
  since: number;
  /** what is said on entering the state (GameCanvas voices it once) */
  lines: readonly BreachLine[];
  /** a quiet input hint under the objective; cleared once used */
  hint: string;
  /** the one nudge for this state has been given */
  nudged: boolean;
};

export const BREACH_DONE = "opening:breach";
/** how long CLEAR lingers before the prologue ends (ms) */
export const CLEAR_MS = 9000;
/** DAZED: if nothing has reached you after this long, the echo's first strike lands anyway (ms) */
export const DAZED_MS = 9000;
/** a step with no progress for this long gets NOVA's one nudge (ms) */
export const NUDGE_MS = 14000;
/** never lower than this while the prologue fight runs: a first encounter teaches, it doesn't kill */
export const BREACH_HP_FLOOR = 40;

const N = "NOVA";
export const BREACH_OBJECTIVE: Record<BreachState, string> = {
  CINE: "", DAZED: "Get clear of the building", SURGE: "Survive the breach", ANCHOR: "Stop the anchor", CLEAR: "", DONE: "",
};
const ENTER: Record<BreachState, readonly BreachLine[]> = {
  CINE: [],
  DAZED: [{ speaker: "Mara", text: "Something's coming out of the smoke. Move!" }],
  SURGE: [{ speaker: N, text: "Your body just answered the Fracture. Armor forming. Weapon system online." }, { speaker: N, text: "Point it at them and squeeze. Your hands know how." }],
  ANCHOR: [{ speaker: N, text: "Something big is anchoring itself to the tear. Your resonance is spiking." }, { speaker: N, text: "Don't hold it back. Let it out." }],
  CLEAR: [{ speaker: N, text: "Readings settling. You did that." }, { speaker: "Mara", text: "What did they do to you? What are you?" }, { speaker: N, text: "I don't know yet either. Stay with me. We'll learn the rest as we go." }],
  DONE: [],
};
const NUDGE: Partial<Record<BreachState, BreachLine>> = {
  SURGE: { speaker: N, text: "Breathe. Find one in your sights. Squeeze." },
  ANCHOR: { speaker: N, text: "Reach for it. The surge in your chest: release it at the anchor." },
};

/** the input hint for a state: plain and short, keyboard and touch both named */
export function breachHint(state: BreachState, keys: { fire: string; primary: string; dash: string }): string {
  if (state === "SURGE") return `${keys.fire} · fire`;
  if (state === "ANCHOR") return `${keys.primary} · release the surge   ${keys.dash} · slip its charge`;
  return "";
}

export const startBreach = (now: number, cinematic: boolean): BreachRun => enter(cinematic ? "CINE" : "DAZED", now);
function enter(state: BreachState, now: number, hint = ""): BreachRun {
  return { id: "breach", state, since: now, lines: ENTER[state], hint, nudged: false };
}

export function advanceBreach(r: BreachRun, e: BreachEvent, hints: (s: BreachState) => string = () => ""): BreachRun {
  const next = (s: BreachState) => enter(s, e.now, hints(s));
  switch (r.state) {
    case "CINE": return e.type === "CINE_DONE" ? next("DAZED") : r;
    case "DAZED": return e.type === "THREAT" || (e.type === "TICK" && e.now - r.since >= DAZED_MS) ? next("SURGE") : r;
    case "SURGE": if (e.type === "WAVE_CLEAR") return next("ANCHOR"); break;
    case "ANCHOR": if (e.type === "ANCHOR_DOWN") return next("CLEAR"); break;
    case "CLEAR": return e.type === "TICK" && e.now - r.since >= CLEAR_MS ? { ...r, state: "DONE", since: e.now, lines: [], hint: "" } : r;
    default: return r;
  }
  if (e.type === "USED" && r.hint) return { ...r, hint: "" };
  if (e.type === "TICK" && !r.nudged && e.now - r.since >= NUDGE_MS && NUDGE[r.state]) return { ...r, nudged: true, lines: [NUDGE[r.state]!] };
  return r;
}

/** which Operator powers are awake: 0 civilian (no body, weapon or HUD), 1 fire and melee, 2 + primary ability and dash, 3 all */
export type Powers = 0 | 1 | 2 | 3;
export function breachPowers(state: BreachState): Powers {
  return state === "CINE" || state === "DAZED" ? 0 : state === "SURGE" ? 1 : state === "ANCHOR" ? 2 : 3;
}
/** may this ability slot be cast at this power level (2 wakes the primary, 3 everything) */
export const slotAwake = (powers: Powers, slot: "PRIMARY" | "TACTICAL" | "ULTIMATE") => powers >= 3 || (powers >= 2 && slot === "PRIMARY");

/** the enemies Scene puts on the street for a state: count, and how many of them are the elite anchor */
export function breachWave(state: BreachState): { count: number; elite: number } | null {
  if (state === "DAZED") return { count: 1, elite: 0 };
  if (state === "SURGE") return { count: 2, elite: 0 };
  if (state === "ANCHOR") return { count: 2, elite: 1 };
  return null;
}

type Box = { x: number; y: number; z: number; w: number; h: number; d: number };
/** where a Breach wave comes out of the smoke: in front of the player (`yaw`), on open ground with a clear line between you,
 * so the echoes can reach you and you can see them (play-test: a fixed point up the street put them behind a planter and a
 * tower wall). Tries the facing first, then swings left and right, then nearer and farther; falls back to straight ahead. */
type Seg = { ax: number; az: number; bx: number; bz: number; half: number; base: number; top: number };
export function openSpawnPoint(px: number, pz: number, feet: number, yaw: number, boxes: readonly Box[], clearance = 1.2, walls: readonly Seg[] = []): { x: number; z: number } {
  const relevant = boxes.filter((b) => feet + 0.3 < b.y + b.h / 2 && feet + 1.8 > b.y - b.h / 2 && Math.abs(b.x - px) < 40 + b.w / 2 && Math.abs(b.z - pz) < 40 + b.d / 2);
  const segs = walls.filter((w) => feet + 0.3 < w.top && feet + 1.8 > w.base);
  const segDist = (w: Seg, x: number, z: number) => { const dx = w.bx - w.ax, dz = w.bz - w.az, l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - w.ax) * dx + (z - w.az) * dz) / l2)); return Math.hypot(x - (w.ax + dx * t), z - (w.az + dz * t)) - w.half; };
  const blocked = (x: number, z: number) => relevant.some((b) => Math.abs(x - b.x) < b.w / 2 + clearance && Math.abs(z - b.z) < b.d / 2 + clearance) || segs.some((w) => segDist(w, x, z) < clearance);
  const clear = (x: number, z: number) => { const n = Math.ceil(Math.hypot(x - px, z - pz) / 0.5); for (let i = 2; i <= n; i++) { const t = i / n; if (blocked(px + (x - px) * t, pz + (z - pz) * t)) return false; } return true; };
  for (const dist of [12, 9, 15, 6]) for (const turn of [0, 0.5, -0.5, 1, -1, 1.6, -1.6, Math.PI]) {
    const a = yaw + turn, x = px + Math.sin(a) * dist, z = pz + Math.cos(a) * dist;
    if (clear(x, z)) return { x, z };
  }
  return { x: px + Math.sin(yaw) * 10, z: pz + Math.cos(yaw) * 10 };
}
