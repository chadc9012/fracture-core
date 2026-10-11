/** Presentation timing for the signature ability looks from the combat spec: Phase Dash afterimages, the Gravity Rift
 * vortex, the Resonance Shield shell and the Fracture Surge shockwave. Pure: AbilityFx samples these from a CAST event's
 * real start/end/radius/duration; nothing here applies damage, moves the player or spends energy. */

export type Ghost = { x: number; z: number; opacity: number; scale: number };

export const AFTERIMAGE_COUNT = 5;
export const AFTERIMAGE_SECONDS = 0.45;

/** Violet afterimages left along a dash or strike path (from → to). Older ghosts (near the start) fade first.
 * Returns [] once faded, when the path is too short to read, or under reduced motion (the ring flourish still plays). */
export function afterimages(fromX: number, fromZ: number, toX: number, toZ: number, age: number, reducedMotion = false): Ghost[] {
  const len = Math.hypot(toX - fromX, toZ - fromZ);
  if (reducedMotion || len < 0.75 || !(age >= 0) || age >= AFTERIMAGE_SECONDS) return [];
  const out: Ghost[] = [];
  for (let i = 0; i < AFTERIMAGE_COUNT; i++) {
    const f = i / AFTERIMAGE_COUNT; // 0 = start of the path
    // each ghost lives a little longer the closer it is to where the dash ended
    const life = AFTERIMAGE_SECONDS * (0.55 + 0.45 * f);
    const k = age / life;
    if (k >= 1) continue;
    out.push({ x: fromX + (toX - fromX) * f, z: fromZ + (toZ - fromZ) * f, opacity: (1 - k) * (0.25 + 0.5 * f), scale: 0.92 + 0.08 * f });
  }
  return out;
}

/** The streak between dash start and end: full length at once, then thinning out. */
export function streak(age: number): { width: number; opacity: number } {
  const t = age / AFTERIMAGE_SECONDS;
  if (!(t >= 0) || t >= 1) return { width: 0, opacity: 0 };
  return { width: 0.5 * (1 - t), opacity: 0.85 * (1 - t) * (1 - t) };
}

/** Gravity Rift: rings spiral INTO the real radius over its duration (min 0.8 s), spinning faster as they close. */
export function vortex(age: number, radius: number, duration: number, rings = 3): { r: number; spin: number; opacity: number }[] {
  const len = Math.max(0.8, Math.min(6, duration));
  if (!(age >= 0) || age >= len) return [];
  const fade = age > len - 0.3 ? (len - age) / 0.3 : 1;
  return Array.from({ length: rings }, (_, i) => {
    const phase = ((age * 0.9 + i / rings) % 1);
    return { r: Math.max(0.3, radius * (1 - phase)), spin: age * (2 + 4 * phase) + i, opacity: 0.6 * phase * fade };
  });
}

/** Resonance Shield: a shell that holds for the real barrier duration, shimmering, and pulses when it starts and ends. */
export function shieldShell(age: number, duration: number): { visible: boolean; scale: number; opacity: number } {
  const len = Math.max(0.6, Math.min(20, duration));
  if (!(age >= 0) || age >= len) return { visible: false, scale: 0, opacity: 0 };
  const rise = Math.min(1, age / 0.25);
  const tail = Math.min(1, (len - age) / 0.4);
  const shimmer = 0.06 * Math.sin(age * 9);
  return { visible: true, scale: 0.7 + 0.3 * rise, opacity: Math.max(0, (0.18 + shimmer) * tail + (1 - rise) * 0.4) };
}

/** Fracture Surge: two shockwave rings racing out to the real radius, the second a beat behind. */
export function shockwave(age: number, radius: number): { r: number; opacity: number }[] {
  const out: { r: number; opacity: number }[] = [];
  for (const delay of [0, 0.12]) {
    const t = (age - delay) / 0.5;
    if (t < 0 || t >= 1) continue;
    out.push({ r: Math.max(0.5, radius * (1 - Math.pow(1 - t, 2))), opacity: 0.9 * (1 - t) });
  }
  return out;
}
