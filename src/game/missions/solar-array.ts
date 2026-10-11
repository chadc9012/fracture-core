/** Solara story mission — "Solar Array Alpha": upgrades fd-08 ("The Desert Approach"), which used
 * to be only a 90 s survive timer, into the desert's first authored beat (campaign tracker §8,
 * "Solara story mission (Unbroken Glass available)").
 *
 * Story: after the Neon lockdown, NOVA follows the Syndicate grid's power upstream. It isn't
 * generated in the city at all: it's beamed in from Solar Array Alpha, an old energy-harvesting
 * ring out on the Glass Flats. Ash-born raiders have dug in around it. The array's mirrors have
 * drifted, and the focused heat has been feeding a standing-wave anomaly at the focal point, the
 * Unbroken Glass. Realigning the mirrors starves the anomaly and makes it fight. With it gone the
 * beam runs true again, and the trace shows where it goes: not Neon, but Nexus City's Core Node,
 * the Authority's control layer (fd-09).
 *
 * Same ANCHOR/ARRIVED/CLEAR/HACK/ACK shape as the other machines. Solara has no catalog boss, so
 * summonBoss("solara", ...) falls back to its Unique Scenario, the Unbroken Glass (poise gimmick),
 * tagged `{ mission: true }` for the usual CLEAR detection. Pure: no React, no randomness. */
export type MissionState = "IDLE" | "TRIGGERED" | "CROSSING" | "COMBAT_1" | "REALIGNING" | "BOSS" | "COMPLETE" | "WORLD_UPDATE";
export type MissionEvent =
  | { type: "START" }
  | { type: "ANCHOR"; x: number; z: number }
  | { type: "ARRIVED" }
  | { type: "CLEAR" }
  | { type: "HACK"; progress: number }
  | { type: "ACK" };

export type MissionRun = {
  id: "solar-array";
  state: MissionState;
  target: { x: number; z: number } | null;
  hack: number;
  nova: string;
};

export const SOLAR_ARRAY: MissionRun = { id: "solar-array", state: "IDLE", target: null, hack: 0, nova: "" };

/** Solar Array Alpha, as an offset from Solara's centre in units of the region radius (out on the flats). */
export const ARRAY_OFFSET = { dx: 0.3, dz: 0.15 } as const;

export function arraySite(region: { x: number; z: number; radius: number }): { x: number; z: number } {
  return { x: region.x + region.radius * ARRAY_OFFSET.dx, z: region.z + region.radius * ARRAY_OFFSET.dz };
}

export const OBJECTIVE: Record<MissionState, string> = {
  IDLE: "",
  TRIGGERED: "Follow the grid's power upstream",
  CROSSING: "Cross the Glass Flats to Solar Array Alpha",
  COMBAT_1: "Ash-born raiders hold the array: clear them",
  REALIGNING: "Realign the array's mirrors",
  BOSS: "Break the Unbroken Glass",
  COMPLETE: "Beam realigned",
  WORLD_UPDATE: "The beam leads to Nexus City",
};

export function advanceMission(m: MissionRun, e: MissionEvent): MissionRun {
  switch (m.state) {
    case "IDLE":
      return e.type === "START"
        ? { ...m, state: "TRIGGERED", nova: "Neon's grid doesn't make its own power. It's beamed in from the desert. Let's find out who's holding the other end." }
        : m;
    case "TRIGGERED":
      return e.type === "ANCHOR"
        ? { ...m, state: "CROSSING", target: { x: e.x, z: e.z }, nova: "Solar Array Alpha, out on the Glass Flats. Keep moving out there. The heat will cook you if you stand still." }
        : m;
    case "CROSSING":
      return e.type === "ARRIVED"
        ? { ...m, state: "COMBAT_1", nova: "Raiders dug in around the mirrors. They're stripping it for parts. Clear them out." }
        : m;
    case "COMBAT_1":
      return e.type === "CLEAR"
        ? { ...m, state: "REALIGNING", nova: "The mirrors have drifted, so all that heat is pooling at the focal point. Turn each one back onto the collector." }
        : m;
    case "REALIGNING":
      if (e.type !== "HACK") return m;
      if (e.progress >= 100) return { ...m, hack: 100, state: "BOSS", nova: "Beam's back on the collector, and something at the focal point just lost its meal. The anomaly's hardening. Hit it only when the light cracks across its shell." };
      return { ...m, hack: e.progress };
    case "BOSS":
      return e.type === "CLEAR" ? { ...m, state: "COMPLETE", nova: "It shattered. The array's running clean for the first time in years." } : m;
    case "COMPLETE":
      return e.type === "ACK"
        ? { ...m, state: "WORLD_UPDATE", target: null, nova: "I traced the beam. It doesn't stop at Neon. It runs straight into Nexus City, into the Authority's Core Node. They've been powering the whole war from out here." }
        : m;
    default:
      return m;
  }
}

/** Mirror realignment minigame (overlay): three mirrors, each set to one of eight headings. Each
 * mirror has a target heading derived from the run seed; rotating onto it locks that mirror.
 * Progress is the share of locked mirrors. */
export const MIRRORS = 3;
export const HEADINGS = 8;

export function targetHeading(seed: number, mirror: number): number {
  const h = Math.imul((seed | 0) ^ (mirror + 7) * 0x27d4eb2d, 0x165667b1) >>> 0;
  return h % HEADINGS;
}

/** Start headings are never already on target. */
export function startHeading(seed: number, mirror: number): number {
  return (targetHeading(seed, mirror) + 3 + mirror) % HEADINGS;
}

export type MirrorState = { heading: number[]; locked: boolean[] };

export function mirrorStart(seed: number): MirrorState {
  const idx = Array.from({ length: MIRRORS }, (_, i) => i);
  return { heading: idx.map((i) => startHeading(seed, i)), locked: idx.map(() => false) };
}

/** Rotates one mirror by `step` (+1 / -1); it locks when it lands on its target. Locked mirrors ignore input. */
export function rotateMirror(s: MirrorState, seed: number, mirror: number, step: 1 | -1): MirrorState {
  if (mirror < 0 || mirror >= MIRRORS || s.locked[mirror]) return s;
  const heading = s.heading.map((h, i) => (i === mirror ? (h + step + HEADINGS) % HEADINGS : h));
  const locked = s.locked.map((l, i) => (i === mirror ? heading[i] === targetHeading(seed, i) : l));
  return { heading, locked };
}

export const alignProgress = (s: MirrorState) => Math.round((s.locked.filter(Boolean).length / MIRRORS) * 100);

/** How far (in headings) a mirror is from its target, 0..4: the overlay turns this into a beam-strength readout. */
export function misalignment(s: MirrorState, seed: number, mirror: number): number {
  const d = Math.abs((s.heading[mirror] ?? 0) - targetHeading(seed, mirror));
  return Math.min(d, HEADINGS - d);
}
