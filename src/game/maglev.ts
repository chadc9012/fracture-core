/** Neon City maglev network (pure): several floating train lines on glowing rails high above the streets, between the Grid
 * deck (y 15) and the Spire terraces. Positions are a pure function of time, so every client agrees and nothing needs state.
 * Loops run one way; shuttles ping-pong. Each train eases out of and into its stations and dwells there. Local metres around
 * the district centre (north = −z); worldRails()/railAt() from maggrind.ts do the geometry. */
import { railAt, worldRails, type Rail, type WorldRail } from "./maggrind";

export type MaglevLine = {
  id: string; name: string; color: string; rail: Rail;
  /** loop = runs one way round; shuttle = ping-pong between the ends */
  mode: "loop" | "shuttle";
  /** fraction (0..1) along the rail where the line stops (shuttles always stop at both ends) */
  stations: readonly number[];
  speed: number; trains: number; cars: number; dwell: number;
};
export const CAR_LENGTH = 6.4, CAR_GAP = 0.8, CAR_STEP = CAR_LENGTH + CAR_GAP, RAIL_GAUGE = 1.1;

const ring = (hx: number, hz: number, y: number, c = 8): Rail["pts"] => [
  [-hx + c, -hz, y], [hx - c, -hz, y], [hx, -hz + c, y], [hx, hz - c, y], [hx - c, hz, y], [-hx + c, hz, y], [-hx, hz - c, y], [-hx, -hz + c, y],
];
const spireRing = (r: number, y: number, cz: number): Rail["pts"] => Array.from({ length: 12 }, (_, i) => [Math.round(Math.sin((i / 12) * Math.PI * 2) * r), Math.round(cz - Math.cos((i / 12) * Math.PI * 2) * r), y] as const);

export const MAGLEV_LINES: readonly MaglevLine[] = [
  { id: "cyan-loop", name: "Cyan Loop", color: "#38e8ff", mode: "loop", rail: { id: "maglev-cyan", name: "Cyan Loop", closed: true, pts: ring(54, 42, 21) }, stations: [0.06, 0.31, 0.56, 0.81], speed: 15, trains: 3, cars: 3, dwell: 4 },
  { id: "magenta-cross", name: "Magenta Cross", color: "#ff2ea6", mode: "shuttle", rail: { id: "maglev-magenta", name: "Magenta Cross", closed: false, pts: [[-66, -22, 40], [-30, -22, 40], [30, -22, 40], [66, -22, 40]] }, stations: [0, 0.5, 1], speed: 18, trains: 2, cars: 4, dwell: 4 },
  { id: "gold-spire", name: "Gold Spire Line", color: "#ffc857", mode: "loop", rail: { id: "maglev-gold", name: "Gold Spire Line", closed: true, pts: spireRing(34, 48, -50) }, stations: [0, 0.5], speed: 12, trains: 2, cars: 3, dwell: 5 },
  { id: "violet-diagonal", name: "Violet Diagonal", color: "#b07bff", mode: "shuttle", rail: { id: "maglev-violet", name: "Violet Diagonal", closed: false, pts: [[-60, 44, 34], [-20, 14, 34], [20, -14, 34], [60, -44, 34]] }, stations: [0, 1], speed: 16, trains: 2, cars: 3, dwell: 4 },
];

export const railLength = (line: MaglevLine, center = { x: 0, z: 0 }): number => worldRails(center, () => 0, [line.rail])[0]!.total;

/** smoothstep ease so trains accelerate out of a station and brake into the next */
const ease = (k: number) => k * k * (3 - 2 * k);

type Leg = { from: number; to: number; dir: 1 | -1 };
/** the stop-to-stop legs of one full cycle, in metres along the rail */
export function cycleLegs(line: MaglevLine, total: number): Leg[] {
  const stops = [...line.stations].map((f) => f * total).sort((a, b) => a - b);
  if (line.mode === "loop") return stops.map((s, i) => ({ from: s, to: i + 1 < stops.length ? stops[i + 1]! : stops[0]! + total, dir: 1 as const }));
  const rev = [...stops].reverse();
  return [...stops.slice(0, -1).map((s, i) => ({ from: s, to: stops[i + 1]!, dir: 1 as const })), ...rev.slice(0, -1).map((s, i) => ({ from: s, to: rev[i + 1]!, dir: -1 as const }))];
}
export const cycleSeconds = (line: MaglevLine, total: number): number => cycleLegs(line, total).reduce((t, l) => t + Math.abs(l.to - l.from) / line.speed * 1.25 + line.dwell, 0);

export type TrainState = { s: number; dir: 1 | -1; stopped: boolean; /** 0..1 how fast relative to cruise speed */ pace: number; station: boolean };
/** where the train's head is `t` seconds into the world clock; trains on a line are spread evenly through the cycle */
export function trainState(line: MaglevLine, total: number, trainIndex: number, t: number): TrainState {
  const legs = cycleLegs(line, total), cycle = cycleSeconds(line, total);
  let clock = (((t + (trainIndex / line.trains) * cycle) % cycle) + cycle) % cycle;
  for (const leg of legs) {
    const dist = Math.abs(leg.to - leg.from), travel = (dist / line.speed) * 1.25;
    if (clock < travel) {
      const k = clock / travel, e = ease(k), slope = 6 * k * (1 - k);
      return { s: leg.from + (leg.to - leg.from) * e, dir: leg.dir, stopped: false, pace: Math.min(1, slope * 0.8), station: false };
    }
    clock -= travel;
    if (clock < line.dwell) return { s: leg.to, dir: leg.dir, stopped: true, pace: 0, station: true };
    clock -= line.dwell;
  }
  const last = legs[legs.length - 1]!;
  return { s: last.to, dir: last.dir, stopped: true, pace: 0, station: true };
}

export type CarPose = { x: number; y: number; z: number; yaw: number; index: number };
/** poses of every car of a train: the head leads, the rest trail along the rail (they bunch at shuttle ends, never leave the rail) */
export function carPoses(line: MaglevLine, wr: WorldRail, st: TrainState): CarPose[] {
  const out: CarPose[] = [];
  for (let i = 0; i < line.cars; i++) {
    let s = st.s - st.dir * (i * CAR_STEP + CAR_LENGTH / 2);
    if (!wr.closed) s = Math.max(0, Math.min(wr.total, s));
    const p = railAt(wr, s);
    out.push({ x: p.x, y: p.y, z: p.z, yaw: Math.atan2(p.tx * st.dir, p.tz * st.dir), index: i });
  }
  return out;
}

export function worldMaglev(center: { x: number; z: number }): { line: MaglevLine; rail: WorldRail }[] {
  return MAGLEV_LINES.map((line) => ({ line, rail: worldRails(center, () => 0, [line.rail])[0]! }));
}
