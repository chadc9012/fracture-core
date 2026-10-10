import { describe, expect, test } from "bun:test";
import { waterMix, voiceAction, STREAM_REACH, FALL_REACH, LINGER_MS, AUDIBLE } from "./water-audio";
import { waterNetwork } from "./terrain";
import type { WaterNetwork } from "./rivers";

const pt = (x: number, z: number, s = 0) => ({ x, z, s, w: 3, d: 1 });
const net: WaterNetwork = {
  lakes: [],
  rivers: [
    { id: "a", regionId: "veridan", dry: false, mouth: "ocean", points: [pt(0, 0), pt(0, 10), pt(0, 20)], falls: [{ x: 0, z: 10, top: 10, bottom: 0, dirX: 0, dirZ: 1, w: 3 }], speed: [1, 3, 1] },
    { id: "dry", regionId: "wastelands", dry: true, mouth: "lake", points: [pt(200, 0), pt(200, 10)], falls: [], speed: [1, 1] },
  ],
};

describe("water audio mix", () => {
  test("nothing is audible far from all water; dry washes are silent", () => {
    const m = waterMix(500, 500, net);
    expect(m.stream).toBeNull(); expect(m.fall).toBeNull();
    expect(waterMix(200, 3, net).stream).toBeNull();
  });
  test("one stream voice and one fall voice however many segments are near, taking the loudest", () => {
    const m = waterMix(4, 10, net);
    expect(m.stream).not.toBeNull(); expect(m.fall).not.toBeNull();
    expect(m.stream!.dist).toBeLessThan(5);
  });
  test("gain falls with distance and reaches zero at the reach", () => {
    const g = (d: number) => waterMix(d, 10, net).stream?.gain ?? 0;
    expect(g(2)).toBeGreaterThan(g(20));
    expect(g(20)).toBeGreaterThan(g(40));
    expect(g(STREAM_REACH + 1)).toBe(0);
    const f = (d: number) => waterMix(d, 10, net).fall?.gain ?? 0;
    expect(f(10)).toBeGreaterThan(f(80));
    expect(f(FALL_REACH + 1)).toBe(0);
  });
  test("falls carry further than streams", () => {
    const m = waterMix(80, 10, net);
    expect(m.stream).toBeNull(); expect(m.fall).not.toBeNull();
  });
  test("muffle (indoors / underwater) scales the mix", () => {
    expect(waterMix(3, 10, net, 0.25).stream!.gain).toBeCloseTo(waterMix(3, 10, net).stream!.gain * 0.25, 5);
  });
  test("gain stays within 0..1 on the real network", () => {
    const real = waterNetwork();
    for (const r of real.rivers) for (const p of r.points) { const m = waterMix(p.x, p.z, real); for (const s of [m.stream, m.fall]) if (s) { expect(s.gain).toBeGreaterThanOrEqual(0); expect(s.gain).toBeLessThanOrEqual(1); } }
  });
});

describe("voice lifecycle", () => {
  test("starts when audible, lingers through short gaps, stops after the linger time, idles otherwise", () => {
    expect(voiceAction(0.2, false, 0)).toBe("start");
    expect(voiceAction(0.2, true, 0)).toBe("keep");
    expect(voiceAction(0, true, 500)).toBe("keep");
    expect(voiceAction(0, true, LINGER_MS)).toBe("stop");
    expect(voiceAction(AUDIBLE / 2, false, 99999)).toBe("idle");
  });
});
