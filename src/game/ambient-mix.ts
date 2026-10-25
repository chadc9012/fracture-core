/**
 * Background-bed levels and loop preparation for audio.ts (music pad, biome/weather beds, ambience recordings).
 * Pure so the levels and the seamless-loop rule stay testable.
 *
 * Why: the idle mix measured about -16 dBFS RMS in a real browser — a constant full-level sine pad (an
 * "engine idling" drone) over flat noise recordings that clicked at every 12 s loop seam. Beds now sit
 * well under the action, breathe instead of droning, and loop without a seam.
 */
export const AMBIENT_MIX = {
  /** music ambient pad (on the 0.35 music bus): was 0.5 sustained; now a quiet swell under the region ambience */
  pad: 0.06,
  /** pad level while in combat (the tension/drums layers take over) */
  padCombat: 0.03,
  /** the pad sits behind a lowpass so it is a warm chord, not a hum */
  padCutoff: 900,
  /** seconds per pad swell (fades in and out instead of holding one tone forever) */
  padSwellSeconds: 18,
  /** regional ambience beds (scripts/build-ambience.py, mastered to -21 dBFS RMS) on the ambience bus. 0.78 put idle ambience at
   *  -26 dBFS, within 2 dB of gunfire; 0.5 sits it ~4 dB lower so the action reads over the world */
  sampleGain: 0.5,
  /** depth (0..1) of the slow gust swell on noise beds and recordings, so wind moves instead of hissing */
  gustDepth: 0.45,
  /** gust rate range in Hz */
  gustHz: [0.06, 0.14] as const,
  /** length of the shared procedural noise buffer: a 1 s loop repeats audibly as a 1 Hz "whoosh" */
  noiseSeconds: 4,
  /** crossfade at a recording's loop seam */
  loopCrossfadeSeconds: 0.75,
  /** running-water peaks (was stream 0.13 / fall 0.22) */
  waterPeak: { stream: 0.08, fall: 0.14 },
} as const;

/** Weather beds: rain is a soft mid band, never a high-pass hiss (which reads as radio static). */
export const WEATHER_BEDS: Record<string, { cutoff: number; gain: number; type: BiquadFilterType; q: number }> = {
  // a wide band at 2.4 kHz still reached 16 kHz and read as static; a lowpassed wash reads as rain on leaves
  "Rain mist": { cutoff: 1300, gain: 0.03, type: "lowpass", q: 0.5 },
  Ashfall: { cutoff: 300, gain: 0.04, type: "lowpass", q: 0.5 },
  "Snow haze": { cutoff: 600, gain: 0.025, type: "lowpass", q: 0.5 },
  "Dust front": { cutoff: 700, gain: 0.032, type: "lowpass", q: 0.5 },
};

/**
 * Returns a copy of `data` that loops seamlessly: the last `fade` samples are blended (equal power) into the
 * first `fade`, and the tail is dropped. The sample after the new last one is the old data[n - fade], which is
 * exactly where the blended head begins, so there is no jump at the seam.
 */
export function crossfadeLoop(data: Float32Array, fade: number): Float32Array {
  const n = data.length;
  const x = Math.max(0, Math.min(Math.floor(fade), Math.floor(n / 2)));
  if (x === 0) return data.slice();
  const out = data.slice(0, n - x);
  for (let i = 0; i < x; i++) {
    const t = (i + 0.5) / x;
    out[i] = (data[i] ?? 0) * Math.sin((t * Math.PI) / 2) + (data[n - x + i] ?? 0) * Math.cos((t * Math.PI) / 2);
  }
  return out;
}
