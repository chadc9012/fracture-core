/**
 * Stratagems — Helldivers-style call-ins: hold the call-in key, enter a directional code, then
 * throw the beacon you armed. Pure state machine (no DOM, no clock): callers pass `now` in seconds,
 * so the input rules stay deterministic and testable apart from Scene/HUD/physics.
 *
 *   open → type arrows → partial matches keep listening → full match arms a beacon
 *        → wrong arrow or a hesitation timeout resets the code (and flashes the failure)
 *   release the call-in key with a beacon armed → Scene throws it (see sim.ts throwBeacon)
 */
export type Dir = "U" | "D" | "L" | "R";
export type StratagemId = "RESUPPLY" | "ORBITAL_STRIKE" | "RECON_PULSE";

export type StratagemDef = {
  id: StratagemId;
  name: string;
  code: readonly Dir[];
  /** seconds before this stratagem can be called again after it is thrown */
  cooldown: number;
  /** seconds between the beacon landing and its effect */
  delay: number;
  /** world-unit effect radius (also drawn as the telegraph ring) */
  radius: number;
  description: string;
};

export const STRATAGEMS: readonly StratagemDef[] = [
  { id: "RESUPPLY", name: "Supply Drop", code: ["D", "D", "U", "R"], cooldown: 40, delay: 2.5, radius: 7, description: "Refills ammo reserves and repairs hull for anyone standing on the pad." },
  { id: "ORBITAL_STRIKE", name: "Orbital Strike", code: ["R", "R", "U"], cooldown: 25, delay: 3, radius: 9, description: "Heavy blast after a short delay. Friendly fire: clear the zone." },
  { id: "RECON_PULSE", name: "Recon Pulse", code: ["U", "U", "L", "R"], cooldown: 18, delay: 1.5, radius: 30, description: "Marks every machine in range so they take bonus damage." },
] as const;

export const CODE_TIMEOUT_S = 2;
export const FAIL_FLASH_S = 0.25;

export type StratagemState = {
  /** call-in key held: code entry is live */
  open: boolean;
  seq: Dir[];
  lastInput: number;
  /** a matched code waiting to be thrown on key release */
  armed: StratagemId | null;
  failUntil: number;
  /** earliest time (seconds) each stratagem can be armed again */
  readyAt: Record<StratagemId, number>;
};

export const createStratagemState = (): StratagemState => ({
  open: false, seq: [], lastInput: 0, armed: null, failUntil: 0,
  readyAt: { RESUPPLY: 0, ORBITAL_STRIKE: 0, RECON_PULSE: 0 },
});

export function stratagemById(id: StratagemId): StratagemDef {
  return STRATAGEMS.find((item) => item.id === id) ?? STRATAGEMS[0]!;
}

export const isPartialMatch = (input: readonly Dir[], code: readonly Dir[]) => input.length <= code.length && input.every((dir, i) => dir === code[i]);

export function openStratagems(state: StratagemState) { state.open = true; state.seq = []; }
export function closeStratagems(state: StratagemState) { state.open = false; state.seq = []; }

export type InputEvent = "none" | "partial" | "match" | "fail" | "cooldown";

/** Feed one arrow press. A full match on a ready stratagem arms it and closes code entry. */
export function inputDirection(state: StratagemState, dir: Dir, now: number): InputEvent {
  if (!state.open || state.armed) return "none";
  state.seq.push(dir);
  state.lastInput = now;
  const candidates = STRATAGEMS.filter((item) => isPartialMatch(state.seq, item.code));
  if (!candidates.length) { state.seq = []; state.failUntil = now + FAIL_FLASH_S; return "fail"; }
  const full = candidates.find((item) => item.code.length === state.seq.length);
  if (!full) return "partial";
  state.seq = [];
  if (state.readyAt[full.id] > now) { state.failUntil = now + FAIL_FLASH_S; return "cooldown"; }
  state.armed = full.id;
  state.open = false;
  return "match";
}

/** Hesitation timeout: clears a half-typed code. Returns true when it reset. */
export function tickStratagems(state: StratagemState, now: number): boolean {
  if (state.open && state.seq.length && now - state.lastInput > CODE_TIMEOUT_S) {
    state.seq = [];
    state.failUntil = now + FAIL_FLASH_S;
    return true;
  }
  return false;
}

/** Release the call-in key: returns the armed stratagem to throw (and starts its cooldown), or null. */
export function releaseStratagems(state: StratagemState, now: number, cooldownMult = 1): StratagemId | null {
  const armed = state.armed;
  state.open = false;
  state.seq = [];
  state.armed = null;
  if (armed) state.readyAt[armed] = now + stratagemById(armed).cooldown * cooldownMult;
  return armed;
}

export function cooldownRemaining(state: StratagemState, id: StratagemId, now: number): number {
  return Math.max(0, state.readyAt[id] - now);
}

/** Plain-data snapshot for the HUD panel (Scene builds it each frame). */
export type StratagemHud = {
  open: boolean;
  seq: Dir[];
  armedName: string;
  /** name of the equipped class backpack, shown in the panel header */
  pack: string;
  failing: boolean;
  rows: { id: StratagemId; name: string; code: readonly Dir[]; cooldown: number }[];
};
export const EMPTY_STRATAGEM_HUD: StratagemHud = { open: false, seq: [], armedName: "", pack: "", failing: false, rows: [] };

export function stratagemHud(state: StratagemState, now: number, pack = ""): StratagemHud {
  if (!state.open && !state.armed) return EMPTY_STRATAGEM_HUD;
  return {
    open: state.open,
    seq: [...state.seq],
    armedName: state.armed ? stratagemById(state.armed).name : "",
    pack,
    failing: now < state.failUntil,
    rows: STRATAGEMS.map((item) => ({ id: item.id, name: item.name, code: item.code, cooldown: cooldownRemaining(state, item.id, now) })),
  };
}
