/** The Core Node set piece (trailer: the giant core/pod reveal). Pure: how far the armoured pod is open, how bright the
 * core burns and whether the beam is up, from the real mission state. CoreNodePod.tsx only draws it. */
import type { MissionState } from "./missions/core-node";

export type CoreLook = { open: number; glow: number; beam: boolean; alarm: boolean; spin: number };

export function coreLook(state: MissionState, hack: number): CoreLook {
  switch (state) {
    case "IDLE": case "TRIGGERED": case "INFILTRATE": return { open: 0, glow: 0.35, beam: false, alarm: false, spin: 0.2 };
    case "COMBAT_1": return { open: 0, glow: 0.5, beam: false, alarm: true, spin: 0.6 };
    case "HACKING": { const h = Math.min(1, Math.max(0, hack)); return { open: 0.35 * h, glow: 0.5 + 0.4 * h, beam: false, alarm: false, spin: 0.6 + 1.4 * h }; }
    case "REVEAL": return { open: 1, glow: 1.6, beam: true, alarm: false, spin: 2.4 };
    case "COMPLETE": case "WORLD_UPDATE": return { open: 1, glow: 1, beam: true, alarm: false, spin: 0.8 };
  }
}

/** Ease the shown openness toward the target so the petals part over ~1.5 s instead of popping. */
export function easeOpen(current: number, target: number, dt: number): number {
  const k = 1 - Math.exp(-dt * 2);
  return current + (target - current) * k;
}

export const POD_PETALS = 6;
/** Petal tilt (radians, outward from the core axis) at openness 0..1. */
export const petalTilt = (open: number) => open * 1.05;
