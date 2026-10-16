/** Neon City's three playable districts and the Rust-Muck underground race. Pure layout + rules (offsets from the Neon City
 * centre) so the 3D district, map labels and race HUD all agree, and the race is testable without rendering.
 *  - Aegis Spire: corporate heart — plaza deck and the spire tower, north of the market.
 *  - The Grid: transit layer — raised walkways (walkable decks with ramps) east of the market.
 *  - Rust-Muck: the undercity — a covered, dim sunken market west of the market; the race starts here. */
export type DistrictId = "aegis-spire" | "the-grid" | "rust-muck";
export type District = { id: DistrictId; name: string; tagline: string; dx: number; dz: number; radius: number; color: string };

export const NEON_DISTRICTS: readonly District[] = [
  { id: "aegis-spire", name: "Aegis Spire", tagline: "Corporate heart of Neon City", dx: 0, dz: -78, radius: 30, color: "#9fe8ff" },
  { id: "the-grid", name: "The Grid", tagline: "Transit decks, walkways and drones", dx: 82, dz: 0, radius: 34, color: "#38e8ff" },
  { id: "rust-muck", name: "The Undercity · Rust-Muck", tagline: "Underground markets and street racing", dx: -80, dz: 12, radius: 30, color: "#ff7a2e" },
];

export const districtAt = (cx: number, cz: number, x: number, z: number): District | null =>
  NEON_DISTRICTS.find((d) => Math.hypot(x - (cx + d.dx), z - (cz + d.dz)) < d.radius) ?? null;

/** The Grid's walkways, offsets from the Neon City centre; `top` is metres above the district's ground. */
export const GRID_WALKWAYS = [
  { id: "grid-a", dx: 82, dz: -14, dirX: 1, dirZ: 0, length: 56, width: 4.5, top: 6, ramp: 14 },
  { id: "grid-b", dx: 82, dz: 14, dirX: 1, dirZ: 0, length: 56, width: 4.5, top: 6, ramp: 14 },
  { id: "grid-c", dx: 82, dz: 0, dirX: 0, dirZ: 1, length: 24, width: 4, top: 6, ramp: 0 },
] as const;

/* ---------------- Rust-Muck underground race ---------------- */

/** Gates in order; the last gate is the start/finish line. Offsets from the Neon City centre. */
export const RACE_GATES: readonly { dx: number; dz: number }[] = [
  { dx: -80, dz: -8 }, { dx: -58, dz: -44 }, { dx: -20, dz: -66 }, { dx: 22, dz: -64 },
  { dx: 60, dz: -36 }, { dx: 82, dz: 0 }, { dx: 58, dz: 42 }, { dx: 0, dz: 50 }, { dx: -54, dz: 40 }, { dx: -80, dz: 30 },
];
export const RACE_START = { dx: -80, dz: 30 };
export const GATE_RADIUS = 7;
export const COUNTDOWN_S = 3;
export const RACE_TIME_LIMIT_S = 180;
export const RACE_BEST_KEY = "world-fracture-rustmuck-best";

export type RaceState =
  | { phase: "IDLE"; armed: boolean }
  | { phase: "COUNTDOWN"; until: number }
  | { phase: "RUNNING"; startedAt: number; gate: number }
  | { phase: "DONE"; time: number; at: number };
export type RaceEvent = null | { kind: "COUNTDOWN" } | { kind: "GO" } | { kind: "GATE"; gate: number } | { kind: "FINISH"; time: number } | { kind: "TIMEOUT" };

export const RACE_IDLE: RaceState = { phase: "IDLE", armed: true };

/** Advance the race from the racer's position (relative to the Neon City centre). Pure: same inputs, same result. */
export function stepRace(s: RaceState, rx: number, rz: number, now: number): { state: RaceState; event: RaceEvent } {
  const atStart = Math.hypot(rx - RACE_START.dx, rz - RACE_START.dz) < GATE_RADIUS;
  if (s.phase === "IDLE") {
    // must leave the line and come back before a new race can start (no instant re-trigger)
    if (!atStart) return { state: s.armed ? s : { phase: "IDLE", armed: true }, event: null };
    return s.armed ? { state: { phase: "COUNTDOWN", until: now + COUNTDOWN_S }, event: { kind: "COUNTDOWN" } } : { state: s, event: null };
  }
  if (s.phase === "COUNTDOWN") return now >= s.until ? { state: { phase: "RUNNING", startedAt: now, gate: 0 }, event: { kind: "GO" } } : { state: s, event: null };
  if (s.phase === "RUNNING") {
    const t = now - s.startedAt;
    if (t > RACE_TIME_LIMIT_S) return { state: { phase: "IDLE", armed: false }, event: { kind: "TIMEOUT" } };
    const g = RACE_GATES[s.gate]!;
    if (Math.hypot(rx - g.dx, rz - g.dz) >= GATE_RADIUS) return { state: s, event: null };
    if (s.gate === RACE_GATES.length - 1) return { state: { phase: "DONE", time: t, at: now }, event: { kind: "FINISH", time: t } };
    return { state: { ...s, gate: s.gate + 1 }, event: { kind: "GATE", gate: s.gate } };
  }
  return now - s.at > 6 ? { state: { phase: "IDLE", armed: false }, event: null } : { state: s, event: null };
}

/** Credits for a finish: 150 base, +100 for a new personal best, +250 the very first time. */
export function raceReward(time: number, best: number | null): { credits: number; newBest: boolean } {
  const first = best === null;
  const newBest = first || time < best!;
  return { credits: 150 + (newBest ? 100 : 0) + (first ? 250 : 0), newBest };
}
