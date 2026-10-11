/** Sound design data for the procedural weapon/explosion engine in audio.ts. Pure numbers and rules, so the feel can be tuned and tested
 * without a browser. A gunshot is four layers (the way recorded gunshots are built in film/game sound): a supersonic CRACK (very short,
 * bright), the muzzle BLAST (band-limited noise pushed through saturation), a low THUMP (pitch-dropping sine, the "punch" felt in the chest)
 * and a reverberant TAIL; plus an optional MECH layer (bolt / slide / pump). Explosions arrive late with distance (speed of sound) and lose
 * their top end, which is what makes far blasts read as far. */
export type ShotProfile = {
  crack: { freq: number; dur: number; gain: number };
  blast: { freq: number; q: number; dur: number; gain: number; drive: number };
  thump: { f0: number; f1: number; dur: number; gain: number };
  tail: { dur: number; cutoff: number; gain: number; send: number };
  mech?: { at: number; freq: number; gain: number }[];
  /** energy weapons add a tonal zap */
  zap?: { f0: number; f1: number; dur: number; gain: number; type: OscillatorType };
};

export type ShotKey = "AUTO" | "PULSE" | "HEAVY" | "SIDEARM" | "SHOTGUN" | "VEHICLE" | "LAUNCHER";

export const SHOTS: Record<ShotKey, ShotProfile> = {
  AUTO: { crack: { freq: 5200, dur: 0.012, gain: 0.55 }, blast: { freq: 1700, q: 0.8, dur: 0.075, gain: 0.85, drive: 2.2 }, thump: { f0: 150, f1: 48, dur: 0.09, gain: 0.75 }, tail: { dur: 0.45, cutoff: 1400, gain: 0.16, send: 0.22 } },
  PULSE: { crack: { freq: 6800, dur: 0.01, gain: 0.4 }, blast: { freq: 1300, q: 1.1, dur: 0.08, gain: 0.6, drive: 1.6 }, thump: { f0: 120, f1: 42, dur: 0.1, gain: 0.6 }, tail: { dur: 0.5, cutoff: 2400, gain: 0.12, send: 0.28 }, zap: { f0: 2200, f1: 380, dur: 0.11, gain: 0.12, type: "sawtooth" } },
  HEAVY: { crack: { freq: 4200, dur: 0.02, gain: 0.7 }, blast: { freq: 700, q: 0.6, dur: 0.22, gain: 1, drive: 3.2 }, thump: { f0: 95, f1: 26, dur: 0.45, gain: 1 }, tail: { dur: 1.3, cutoff: 650, gain: 0.3, send: 0.38 }, mech: [{ at: 0.32, freq: 1800, gain: 0.3 }] },
  SIDEARM: { crack: { freq: 6000, dur: 0.014, gain: 0.7 }, blast: { freq: 1400, q: 0.7, dur: 0.1, gain: 0.95, drive: 2.6 }, thump: { f0: 175, f1: 52, dur: 0.13, gain: 0.85 }, tail: { dur: 0.6, cutoff: 1200, gain: 0.18, send: 0.26 }, mech: [{ at: 0.07, freq: 3200, gain: 0.25 }] },
  SHOTGUN: { crack: { freq: 3800, dur: 0.02, gain: 0.6 }, blast: { freq: 800, q: 0.45, dur: 0.24, gain: 1, drive: 3 }, thump: { f0: 115, f1: 30, dur: 0.32, gain: 1 }, tail: { dur: 1, cutoff: 800, gain: 0.26, send: 0.35 }, mech: [{ at: 0.3, freq: 2200, gain: 0.42 }, { at: 0.42, freq: 1500, gain: 0.42 }] },
  VEHICLE: { crack: { freq: 4600, dur: 0.012, gain: 0.45 }, blast: { freq: 1500, q: 0.8, dur: 0.07, gain: 0.75, drive: 2 }, thump: { f0: 130, f1: 46, dur: 0.08, gain: 0.7 }, tail: { dur: 0.4, cutoff: 1300, gain: 0.14, send: 0.2 } },
  LAUNCHER: { crack: { freq: 2600, dur: 0.03, gain: 0.35 }, blast: { freq: 520, q: 0.5, dur: 0.5, gain: 0.7, drive: 1.8 }, thump: { f0: 120, f1: 34, dur: 0.36, gain: 0.9 }, tail: { dur: 0.9, cutoff: 500, gain: 0.2, send: 0.3 } },
};

/** which profile a weapon id uses (launchers share one; their element only shades it) */
export function shotKey(weapon: string): ShotKey | null {
  if (weapon === "SWORD") return null;
  if (weapon === "ROCKET" || weapon === "CINDER" || weapon === "FROSTBITE" || weapon === "VITRIOL") return "LAUNCHER";
  return (weapon in SHOTS ? weapon : "AUTO") as ShotKey;
}

/** per-shot humanisation: small pitch/gain variation so automatic fire never sounds like one sample looped */
export function variation(rand: () => number): { pitch: number; gain: number } {
  return { pitch: 0.94 + rand() * 0.12, gain: 0.9 + rand() * 0.2 };
}

export const SPEED_OF_SOUND = 343;
/** explosion arrival + filtering by distance: late, darker and quieter far away; the sub never fully disappears */
export function blastAtDistance(dist: number): { delay: number; cutoff: number; gain: number; sub: number } {
  const d = Math.max(0, dist);
  return { delay: d / SPEED_OF_SOUND, cutoff: Math.max(380, 9000 / (1 + d / 40)), gain: 1 / (1 + d / 35), sub: 1 / (1 + d / 120) };
}

export type BlastFlavor = "KINETIC" | "THERMAL" | "CRYO" | "TOXIC" | "ARC";
/** extra layer an elemental blast adds on top of the boom */
export const BLAST_FLAVOR: Record<BlastFlavor, { kind: "roar" | "shatter" | "hiss" | "crackle" | "none"; gain: number }> = {
  KINETIC: { kind: "none", gain: 0 },
  THERMAL: { kind: "roar", gain: 0.35 },
  CRYO: { kind: "shatter", gain: 0.3 },
  TOXIC: { kind: "hiss", gain: 0.3 },
  ARC: { kind: "crackle", gain: 0.35 },
};
export function flavorFor(element: string | undefined): BlastFlavor {
  return element === "THERMAL" ? "THERMAL" : element === "CRYO" ? "CRYO" : element === "TOXIC" || element === "BIO" ? "TOXIC" : element === "ARC" ? "ARC" : "KINETIC";
}
