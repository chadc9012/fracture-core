/** Ember Peaks' lightning storm (reference "storm - Ember Peaks"): after dusk the volcano draws dry lightning, a forked bolt
 * striking the peaks every few seconds and lighting the slopes violet-white. Pure schedule + bolt shape so the look is testable;
 * EmberLightning.tsx draws it. Presentation only: these bolts never hurt (the weather STORM hazard in Scene is separate). */
import { ember, CRATER_R } from "./ember-dressing";

export const EMBER_STORM = { period: 5.2, flash: 0.32, cloudY: 260 } as const;
const h = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

/** how strongly the storm runs: nothing by day, building through dusk to full at night */
export const stormLevel = (night: number) => Math.max(0, Math.min(1, (night - 0.25) / 0.45));

export type Strike = { on: boolean; k: number; seed: number; x: number; z: number };
/** the strike at time t (s): one bolt per period slot (some slots skipped), at a seeded spot on the peaks around the crater */
export function emberStrike(t: number, level: number): Strike {
  const slot = Math.floor(t / EMBER_STORM.period), into = t - slot * EMBER_STORM.period, at = h(slot) * (EMBER_STORM.period - EMBER_STORM.flash);
  const e = ember(), a = h(slot + 0.37) * Math.PI * 2, d = CRATER_R * (1.5 + h(slot + 0.71) * 6);
  const live = level > 0 && h(slot + 0.13) < 0.35 + 0.55 * level && into >= at && into < at + EMBER_STORM.flash;
  // a flash flickers: two quick pulses inside the window
  const f = live ? (into - at) / EMBER_STORM.flash : 0;
  const k = live ? Math.max(0, Math.sin(f * Math.PI)) * (0.55 + 0.45 * Math.abs(Math.sin(f * Math.PI * 3))) * level : 0;
  return { on: live, k, seed: slot, x: e.x + Math.cos(a) * d, z: e.z + Math.sin(a) * d };
}

/** a jagged bolt from the cloud base down to the ground point, plus a couple of forks; deterministic from the seed */
export function boltPath(seed: number, x: number, groundY: number, z: number, segments = 16): { main: [number, number, number][]; forks: [number, number, number][][] } {
  const top = EMBER_STORM.cloudY, main: [number, number, number][] = [];
  const sx = x + (h(seed + 1.1) - 0.5) * 120, sz = z + (h(seed + 2.3) - 0.5) * 120;
  for (let i = 0; i <= segments; i++) {
    const f = i / segments, j = Math.sin(f * Math.PI) * 26;
    main.push([sx + (x - sx) * f + (h(seed * 3.1 + i) - 0.5) * j, top + (groundY - top) * f, sz + (z - sz) * f + (h(seed * 5.7 + i) - 0.5) * j]);
  }
  const forks: [number, number, number][][] = [];
  for (let k = 0; k < 2; k++) {
    const from = main[4 + k * 4]!, len = 5, fork: [number, number, number][] = [from];
    const dx = (h(seed + k * 9.3) - 0.5) * 60, dz = (h(seed + k * 4.1) - 0.5) * 60;
    for (let i = 1; i <= len; i++) { const p = fork[i - 1]!; fork.push([p[0] + dx / len + (h(seed + k + i * 1.7) - 0.5) * 10, p[1] - 14, p[2] + dz / len + (h(seed + k + i * 2.9) - 0.5) * 10]); }
    forks.push(fork);
  }
  return { main, forks };
}
