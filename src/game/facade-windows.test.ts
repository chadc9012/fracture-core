import { describe, expect, test } from "bun:test";
import { FACADE, facadePixels, litShare, roomColor } from "./facade-windows";

describe("tower facade windows", () => {
  const px = facadePixels(256, 16);
  test("about half the rooms are lit, enough for a city at night, not every window", () => {
    const s = litShare(px, 256, 16);
    expect(s).toBeGreaterThan(0.3);
    expect(s).toBeLessThan(0.7);
  });
  test("lit rooms are mostly cool office white, with warm rooms and rare neon accents", () => {
    let cool = 0, warm = 0, accent = 0;
    for (let i = 0; i < 1000; i++) { const c = roomColor(i / 1000); if (c[2] >= c[0] && c[1] > 0.85) cool++; else if (c[0] > c[2]) warm++; else accent++; }
    expect(cool).toBeGreaterThan(warm);
    expect(accent).toBeLessThan(150);
  });
  test("frames and mullions stay dark and unlit glass is never pure black", () => {
    const at = (x: number, y: number): [number, number, number] => { const k = (y * 256 + x) * 4; return [px[k]!, px[k + 1]!, px[k + 2]!]; };
    expect(Math.max(...at(0, 0))).toBeLessThan(20);           // bay frame corner
    expect(Math.max(...at(8, 8))).toBeLessThan(20);           // mullion at the centre of the first bay
    let darkGlass = 0;
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) { const [r, g, b] = at(x, y); if (b > 10 && b < 40 && r < 20) darkGlass++; }
    expect(darkGlass).toBeGreaterThan(0);
  });
  test("deterministic and the full-size map is RGBA of the right length", () => {
    expect(facadePixels(64, 4)).toEqual(facadePixels(64, 4));
    expect(facadePixels().length).toBe(FACADE.size * FACADE.size * 4);
  });
});
