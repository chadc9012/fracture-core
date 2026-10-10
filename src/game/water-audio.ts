/** Which running water the player should hear (pure). At most ONE stream voice and ONE waterfall voice exist at any time, however many river segments or falls
 * are nearby: the nearest of each decides the gain, so overlapping segments can never stack duplicate loops. The audio engine (audio.ts updateWaterAudio) fades the
 * two voices toward these gains and tears them down after a quiet spell. Sound is procedural (filtered noise); no sample files exist in the project. */
import type { WaterNetwork } from "./rivers";

export type WaterSource = { gain: number; x: number; z: number; dist: number };
export type WaterMix = { stream: WaterSource | null; fall: WaterSource | null };

/** audible reach in metres (world metres, so they do not change with WORLD_SCALE) */
export const STREAM_REACH = 45;
export const FALL_REACH = 130;
const smooth = (a: number, b: number, v: number) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

/** `muffle` 0..1 scales everything (e.g. 0.25 indoors, 0.35 underwater). Dry washes and rivers' dry segments make no sound. */
export function waterMix(px: number, pz: number, net: WaterNetwork, muffle = 1): WaterMix {
  let stream: WaterSource | null = null;
  for (const r of net.rivers) {
    if (r.dry) continue;
    for (let i = 0; i < r.points.length - 1; i++) {
      const a = r.points[i]!, b = r.points[i + 1]!;
      const ex = b.x - a.x, ez = b.z - a.z, len2 = ex * ex + ez * ez || 1;
      const t = Math.min(1, Math.max(0, ((px - a.x) * ex + (pz - a.z) * ez) / len2));
      const sx = a.x + ex * t, sz = a.z + ez * t, d = Math.hypot(px - sx, pz - sz);
      if (d >= STREAM_REACH) continue;
      // faster water is louder: a lazy bog channel murmurs, a steep run chatters
      const speed = (r.speed[i] ?? 0.6) * (1 - t) + (r.speed[i + 1] ?? 0.6) * t;
      const g = (1 - smooth(a.w * 0.5, STREAM_REACH, d)) * Math.min(1, 0.45 + speed / 5) * muffle;
      if (!stream || g > stream.gain) stream = { gain: g, x: sx, z: sz, dist: d };
    }
  }
  let fall: WaterSource | null = null;
  for (const r of net.rivers) for (const f of r.falls) {
    const d = Math.hypot(px - f.x, pz - f.z);
    if (d >= FALL_REACH) continue;
    const g = (1 - smooth(8, FALL_REACH, d)) ** 1.5 * Math.min(1, 0.55 + (f.top - f.bottom) / 14) * muffle;
    if (!fall || g > fall.gain) fall = { gain: g, x: f.x, z: f.z, dist: d };
  }
  return { stream, fall };
}

/** voice lifecycle: start when audible, keep while audible or recently audible (so a short gap does not thrash node creation), stop after `lingerMs` of silence */
export const AUDIBLE = 0.01;
export const LINGER_MS = 4000;
export type VoiceAction = "start" | "keep" | "stop" | "idle";
export function voiceAction(gain: number, running: boolean, silentForMs: number): VoiceAction {
  if (gain > AUDIBLE) return running ? "keep" : "start";
  if (!running) return "idle";
  return silentForMs >= LINGER_MS ? "stop" : "keep";
}
