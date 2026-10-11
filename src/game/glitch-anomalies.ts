/** Time-glitch anomalies along the Verdant Forest trail (trailer reference: a leaf frozen mid-fall with ripples spreading through the air,
 * shafts of light through the giant trunks — docs/trailer-references.md). The simulation stutters here: pure layout + timing so the look is
 * testable; GlitchAnomalies.tsx only draws it. Not solid, never on the trail or in a clearing, no gameplay effect. */
import { TRAIL, isReserved } from "./verdant";
import { heightAt } from "./terrain";

export type Anomaly = { x: number; z: number; y: number; yaw: number; phase: number; side: number };

export const ANOMALY_OFFSET = 6.5;
export const ANOMALY_TS = [0.28, 0.52, 0.78] as const;

export function glitchAnomalies(): Anomaly[] {
  const out: Anomaly[] = [];
  ANOMALY_TS.forEach((t, i) => {
    const k = Math.min(TRAIL.length - 2, Math.floor(t * (TRAIL.length - 1)));
    const a = TRAIL[k]!, b = TRAIL[k + 1]!;
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const nx = -(b.z - a.z) / len, nz = (b.x - a.x) / len;
    for (const side of i % 2 ? [1, -1] : [-1, 1]) {
      for (const off of [ANOMALY_OFFSET, ANOMALY_OFFSET + 3, ANOMALY_OFFSET + 6]) {
        const x = a.x + nx * off * side, z = a.z + nz * off * side;
        if (isReserved(x, z, 1)) continue;
        out.push({ x, z, y: heightAt(x, z) + 1.6, yaw: Math.atan2(nx * side, nz * side), phase: i * 2.1, side });
        return;
      }
    }
  });
  return out;
}

/** the leaf's hover: almost frozen, with a tiny stutter "skip" every few seconds as the simulation catches up */
export function leafHover(t: number, phase: number): { dy: number; spin: number; skip: boolean } {
  const cyc = (t + phase) % 4.2;
  const skip = cyc > 3.95;
  return { dy: Math.sin((t + phase) * 0.35) * 0.04 + (skip ? -0.06 : 0), spin: Math.sin((t + phase) * 0.2) * 0.08 + (skip ? 0.25 : 0), skip };
}

/** ripple rings: `n` concentric rings expanding outward on a loop; returns radius (m) and opacity per ring */
export function ripples(t: number, n = 3, period = 2.4, maxR = 1.6): { r: number; o: number }[] {
  return Array.from({ length: n }, (_, i) => { const k = ((t / period) + i / n) % 1; return { r: 0.15 + k * maxR, o: (1 - k) * (1 - k) * 0.8 }; });
}

