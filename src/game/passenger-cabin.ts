/** The passenger cabin you ride in on a scheduled flight or ferry (ported from the owner's stages 105-119 prototype patches:
 * walkable cabin, seat styles, luxury seating, comfort, ambience). Pure layout and rules; FlightCabin.tsx draws it.
 *
 * Cabin metres, aisle along x = 0, nose (or bow) at -z, seats face -z. A seat style sets the whole cabin's layout: how many
 * seats sit each side of the aisle, the seat size and the row pitch. Fellow passengers are a deterministic manifest per trip
 * (no NPC system behind them: they are seated figures that board as the gate fills). Nothing here is saved: the ticket class
 * is picked on the departures board and the seat in the cabin, for one trip. */

export type CabinMode = "air" | "sea";
export type SeatStyle = "economy" | "premium" | "business" | "sleeper" | "lounge" | "first-class-suite" | "royal-cabin" | "zero-g-pod";
/** shell: a seat on its own (none), a walled suite with a door, or an enclosed pod with a canopy */
export type SeatTheme = {
  label: string; fabric: string; frame: string; trim: string; leather: boolean;
  width: number; depth: number; backHeight: number; pitch: number; perSide: number; shell: "none" | "suite" | "pod"; reclineMax: number;
};
/** muted, real cabin materials (charcoal fabric, tan and oxblood leather, walnut, brushed brass), not toy colours */
export const SEAT_THEMES: Readonly<Record<SeatStyle, SeatTheme>> = {
  economy: { label: "Economy", fabric: "#2f3640", frame: "#4a4f55", trim: "#8b9096", leather: false, width: 0.44, depth: 0.5, backHeight: 0.78, pitch: 0.8, perSide: 3, shell: "none", reclineMax: 12 },
  premium: { label: "Premium economy", fabric: "#3a4350", frame: "#55595f", trim: "#a5a9ae", leather: false, width: 0.52, depth: 0.55, backHeight: 0.84, pitch: 0.97, perSide: 2, shell: "none", reclineMax: 22 },
  business: { label: "Business", fabric: "#6b5440", frame: "#3a3d42", trim: "#b29a74", leather: true, width: 0.62, depth: 0.7, backHeight: 0.9, pitch: 1.55, perSide: 2, shell: "none", reclineMax: 35 },
  sleeper: { label: "Sleeper", fabric: "#2d3a3c", frame: "#30363a", trim: "#8fa3a0", leather: false, width: 0.66, depth: 0.78, backHeight: 0.86, pitch: 2.0, perSide: 1, shell: "none", reclineMax: 65 },
  lounge: { label: "Lounge", fabric: "#5a2a26", frame: "#3b2c28", trim: "#a88a64", leather: true, width: 0.74, depth: 0.74, backHeight: 0.72, pitch: 1.7, perSide: 2, shell: "none", reclineMax: 25 },
  "first-class-suite": { label: "First-class suite", fabric: "#cbbfa8", frame: "#4b3626", trim: "#a8925e", leather: true, width: 0.74, depth: 0.8, backHeight: 1.0, pitch: 2.25, perSide: 1, shell: "suite", reclineMax: 70 },
  "royal-cabin": { label: "Royal cabin", fabric: "#4a2c44", frame: "#2a2224", trim: "#b8975a", leather: false, width: 0.82, depth: 0.86, backHeight: 1.06, pitch: 2.7, perSide: 1, shell: "suite", reclineMax: 75 },
  "zero-g-pod": { label: "Zero-G pod", fabric: "#5b6670", frame: "#c9ced3", trim: "#7fb8cf", leather: true, width: 0.7, depth: 0.86, backHeight: 0.96, pitch: 2.1, perSide: 1, shell: "pod", reclineMax: 80 },
};
export const AVAILABLE_STYLES: Readonly<Record<CabinMode, readonly SeatStyle[]>> = {
  air: ["economy", "premium", "business", "sleeper", "first-class-suite", "royal-cabin", "zero-g-pod"],
  sea: ["economy", "premium", "business", "sleeper", "lounge", "first-class-suite", "royal-cabin"],
};
export const availableStyles = (mode: CabinMode): SeatStyle[] => [...AVAILABLE_STYLES[mode]];
export const styleFor = (mode: CabinMode, style: SeatStyle): SeatStyle => (AVAILABLE_STYLES[mode].includes(style) ? style : "economy");

export type CabinSpec = { width: number; length: number; height: number; aisleWidth: number; extraPerSide: number };
/** a narrowbody airliner section; a ferry passenger deck is wider and taller, with a broad walkway and one more seat a side */
export function cabinSpec(mode: CabinMode): CabinSpec {
  return mode === "air" ? { width: 3.7, length: 20, height: 2.2, aisleWidth: 0.6, extraPerSide: 0 } : { width: 7.4, length: 22, height: 2.6, aisleWidth: 1.4, extraPerSide: 1 };
}

export type Seat = { id: string; row: number; side: "L" | "R"; /** 0 = beside the aisle */ k: number; x: number; z: number; style: SeatStyle };
const LETTERS = "ABCDEFGHJK";
/** the cabin's seats, front row first; letters run window to window (12A is the left window) */
export function makeSeats(mode: CabinMode, style: SeatStyle): Seat[] {
  if (!AVAILABLE_STYLES[mode].includes(style)) throw new Error(`Seat style ${style} is not offered on a ${mode === "air" ? "flight" : "ferry"}`);
  const c = cabinSpec(mode), t = SEAT_THEMES[style];
  const per = t.perSide + (t.shell === "none" ? c.extraPerSide : 0);
  const gap = 0.06, rows = Math.max(1, Math.min(30, Math.floor((c.length - 3.6) / t.pitch)));
  const out: Seat[] = [];
  for (let r = 0; r < rows; r++) {
    for (const side of ["L", "R"] as const) {
      for (let k = 0; k < per; k++) {
        const s = side === "L" ? -1 : 1;
        const x = s * (c.aisleWidth / 2 + 0.08 + t.width / 2 + k * (t.width + gap));
        // letters: left side from the window inwards, right side from the aisle outwards
        const li = side === "L" ? per - 1 - k : per + k;
        out.push({ id: `${r + 1}${LETTERS[li]}`, row: r + 1, side, k, x, z: -c.length / 2 + 2.4 + r * t.pitch, style });
      }
    }
  }
  return out;
}
export const seatById = (seats: readonly Seat[], id: string | null | undefined) => (id ? seats.find((s) => s.id === id) : undefined);
/** the eye of someone sitting in a seat (they look forward, -z) */
export const seatEye = (s: Seat, recline = 0) => ({ x: s.x, y: 1.12 - recline * 0.004, z: s.z + 0.12 + recline * 0.004 });

/** a stable 0..1 number per (trip, seat) */
function hash01(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 10_000) / 10_000;
}
/** who else is on this trip: about three in five seats, the same every time for the same trip and class */
export function cabinManifest(seats: readonly Seat[], tripSeed: string, load = 0.62): string[] {
  return seats.filter((s) => hash01(`${tripSeed}:${s.style}:${s.id}`) < load).map((s) => s.id);
}
/** how many of them are aboard at boarding progress 0..1 (the rest are still at the gate) */
export function boardedCount(total: number, boarding: number): number {
  const b = Number.isFinite(boarding) ? Math.max(0, Math.min(1, boarding)) : 0;
  return Math.floor(total * b);
}
export const BOARDING_LABELS = ["Gate open", "Boarding group one", "Final boarding", "Boarding complete"] as const;
export const boardingLabel = (boarding: number) => BOARDING_LABELS[Math.max(0, Math.min(3, Math.floor((Number.isFinite(boarding) ? boarding : 0) * 3)))]!;

export type SeatPick = { ok: true; seatId: string } | { ok: false; reason: string };
/** take a seat: it must exist and nobody else may be booked into it */
export function pickSeat(seats: readonly Seat[], taken: readonly string[], seatId: string): SeatPick {
  if (!seats.some((s) => s.id === seatId)) return { ok: false, reason: "No such seat in this cabin" };
  if (taken.includes(seatId)) return { ok: false, reason: "That seat is taken" };
  return { ok: true, seatId };
}
/** the seat on your ticket: the free aisle seat nearest the middle of the cabin */
export function assignedSeat(seats: readonly Seat[], taken: readonly string[]): Seat | undefined {
  const free = seats.filter((s) => !taken.includes(s.id));
  const midRow = (Math.max(...seats.map((s) => s.row)) + 1) / 2;
  return [...free].sort((a, b) => a.k - b.k || Math.abs(a.row - midRow) - Math.abs(b.row - midRow) || a.x - b.x)[0];
}

/** walking stays on the aisle (out of the seat rows) and inside the bulkheads */
export function clampCabinPoint(p: { x: number; z: number }, mode: CabinMode): { x: number; z: number } {
  const c = cabinSpec(mode), sx = Number.isFinite(p.x) ? p.x : 0, sz = Number.isFinite(p.z) ? p.z : 0;
  const hx = Math.max(0.05, c.aisleWidth / 2 - 0.12);
  return { x: Math.max(-hx, Math.min(hx, sx)), z: Math.max(-c.length / 2 + 1.1, Math.min(c.length / 2 - 1.1, sz)) };
}

/** recline limits by seat (degrees) */
export const clampRecline = (style: SeatStyle, degrees: number) => (Number.isFinite(degrees) ? Math.min(SEAT_THEMES[style].reclineMax, Math.max(0, degrees)) : 0);

export type EntertainmentChannel = "route" | "cinema" | "music" | "games";
export const ENTERTAINMENT_CHANNELS: readonly EntertainmentChannel[] = ["route", "cinema", "music", "games"];
export const entertainmentLabel = (c: EntertainmentChannel) => ({ route: "Route map", cinema: "Cinema", music: "Music", games: "Games" })[c];
/** the seat-back screen's glow per channel */
export const seatScreenColor = (c: EntertainmentChannel) => ({ route: "#3d8fb0", cinema: "#6a5a9a", music: "#9a4f76", games: "#4f8a5a" })[c];

export type CabinLighting = "daylight" | "evening" | "night" | "boarding";
export const CABIN_LIGHTING: Readonly<Record<CabinLighting, { label: string; color: string; intensity: number }>> = {
  daylight: { label: "Daylight", color: "#f3f1ea", intensity: 1.15 },
  evening: { label: "Evening amber", color: "#ffc58f", intensity: 0.85 },
  night: { label: "Night blue", color: "#7f97d8", intensity: 0.45 },
  boarding: { label: "Boarding", color: "#e8f3f2", intensity: 1.35 },
};
/** the crew's lighting: bright while boarding and landing, then by the time of day outside */
export function lightingFor(phase: string, dayPhase: "day" | "dusk" | "night"): CabinLighting {
  if (phase === "boarding" || phase === "arriving") return "boarding";
  return dayPhase === "night" ? "night" : dayPhase === "dusk" ? "evening" : "daylight";
}
