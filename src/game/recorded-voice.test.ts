import { describe, expect, test } from "bun:test";
import { decodeWav, recordedUrl } from "./recorded-voice";
import { readFileSync, readdirSync } from "node:fs";

function wav(samples: number[], rate = 22050, channels = 1): ArrayBuffer {
  const b = new DataView(new ArrayBuffer(44 + samples.length * 2));
  const s = (o: number, t: string) => [...t].forEach((c, i) => b.setUint8(o + i, c.charCodeAt(0)));
  s(0, "RIFF"); b.setUint32(4, 36 + samples.length * 2, true); s(8, "WAVE"); s(12, "fmt "); b.setUint32(16, 16, true);
  b.setUint16(20, 1, true); b.setUint16(22, channels, true); b.setUint32(24, rate, true); b.setUint32(28, rate * 2 * channels, true);
  b.setUint16(32, 2 * channels, true); b.setUint16(34, 16, true); s(36, "data"); b.setUint32(40, samples.length * 2, true);
  samples.forEach((x, i) => b.setInt16(44 + i * 2, x, true));
  return b.buffer;
}

describe("recorded voice", () => {
  test("decodes 16-bit mono PCM", () => {
    const d = decodeWav(wav([0, 16384, -16384, 32767]));
    expect(d.sampleRate).toBe(22050);
    expect(d.samples[1]).toBeCloseTo(0.5);
    expect(d.samples[2]).toBeCloseTo(-0.5);
  });
  test("averages stereo", () => expect(decodeWav(wav([16384, -16384, 8192, 8192], 24000, 2)).samples.length).toBe(2));
  test("rejects non-WAV so the caller falls back to streaming", () => {
    expect(() => decodeWav(new ArrayBuffer(8))).toThrow();
    expect(() => decodeWav(new TextEncoder().encode("RIFFxxxxWAVEjunkjunkjunk").buffer as ArrayBuffer)).toThrow();
  });
  test("unknown lines have no recording", () => expect(recordedUrl("nope")).toBeNull());
  test("every bundled voice clip decodes and is not silent", () => {
    const dir = new URL("../../public/audio/voices/", import.meta.url);
    const files = readdirSync(dir).filter((f) => f.endsWith(".wav"));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const raw = readFileSync(new URL(f, dir));
      const d = decodeWav(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer);
      expect(d.samples.length / d.sampleRate).toBeGreaterThan(2);
      expect(d.samples.some((x) => Math.abs(x) > 0.1)).toBe(true);
    }
  });
});
