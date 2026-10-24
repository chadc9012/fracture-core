import { expect, test } from "bun:test";
import { existsSync, statSync } from "node:fs";
import { AMBIENT_MIX, WEATHER_BEDS, crossfadeLoop } from "./ambient-mix";
import { AMBIENCE_BED_URLS, AUDIO_FILES } from "./audio-files";

/** Regression: idle audio measured ~-16 dBFS RMS in a real browser — a full-level held sine pad (an "engine" drone)
 * over flat noise beds and recordings that clicked at the loop seam ("a plane taking off, with static"). */

test("background beds sit well below the action and the old drone/hiss levels", () => {
  expect(AMBIENT_MIX.pad).toBeLessThanOrEqual(0.15); // was 0.5 held
  expect(AMBIENT_MIX.padCombat).toBeLessThan(AMBIENT_MIX.pad);
  expect(AMBIENT_MIX.padCutoff).toBeLessThanOrEqual(1200);
  expect(AMBIENT_MIX.sampleGain).toBeLessThanOrEqual(0.6); // beds are mastered to -21 dBFS RMS (the old noise WAVs were -16.6 at 0.22)
  expect(AMBIENT_MIX.noiseSeconds).toBeGreaterThanOrEqual(3); // a 1 s loop repeats audibly
  expect(AMBIENT_MIX.waterPeak.fall).toBeLessThan(0.22);
});

test("rain is never a high-pass hiss, and no weather bed is louder than a whisper", () => {
  for (const bed of Object.values(WEATHER_BEDS)) {
    expect(bed.type).not.toBe("highpass");
    expect(bed.gain).toBeLessThanOrEqual(0.05);
  }
  expect(WEATHER_BEDS["Rain mist"]!.cutoff).toBeLessThan(4000);
});

test("crossfadeLoop removes the click at a recording's loop seam", () => {
  let seed = 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 * 2 - 1; };
  // a noisy bed whose end and start do not match (the bundled ambience files jump by up to 0.45 at the seam)
  const n = 24000, data = new Float32Array(n);
  let s = 0; for (let i = 0; i < n; i++) { s = s * 0.97 + rnd() * 0.05; data[i] = s + (i < n / 2 ? 0.4 : -0.4) * (i / n); }
  const raw = Math.abs(data[n - 1]! - data[0]!);
  const fade = 2000, looped = crossfadeLoop(data, fade);
  expect(looped.length).toBe(n - fade);
  const seam = Math.abs(looped[looped.length - 1]! - looped[0]!);
  // the step across the seam is no bigger than an ordinary sample-to-sample step in the same material
  let typical = 0; for (let i = 1; i < looped.length; i++) typical = Math.max(typical, Math.abs(looped[i]! - looped[i - 1]!));
  expect(seam).toBeLessThanOrEqual(typical * 1.05);
  expect(seam).toBeLessThan(raw);
  // the middle of the recording is untouched
  expect(looped[n / 2]).toBe(data[n / 2]!);
});

test("crossfadeLoop handles degenerate inputs", () => {
  const d = new Float32Array([1, 2, 3, 4]);
  expect(Array.from(crossfadeLoop(d, 0))).toEqual([1, 2, 3, 4]);
  expect(crossfadeLoop(d, 99).length).toBe(2); // fade capped at half
});

test("every region's ambience is a designed bed from scripts/build-ambience.py, shipped with the game", () => {
  for (const name of ["forest-wilds", "swamp-marsh", "nexus-hum", "underwater-city", "frost-spire", "solara-dunes", "wasteland-wind", "ember-peaks"]) {
    const url = AMBIENCE_BED_URLS[name]!;
    expect(AUDIO_FILES[name]).toBe(url); // not the old flat-noise WAV on the asset CDN
    const file = `public${url}`;
    expect(existsSync(file)).toBe(true);
    expect(statSync(file).size).toBeGreaterThan(100_000);
  }
});
