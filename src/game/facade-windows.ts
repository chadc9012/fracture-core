/** Lit-window facade for every city tower (material "WindowsLit" in the building GLBs, InstancedGlb.tsx swaps it in at load).
 *
 * Owner's target frames (docs/reference/target-nexus-night.png, target-neon-night.png): night towers read as glass curtain walls
 * covered in small lit rooms, mostly cool white with warm pockets and a few cyan / magenta accents, whole office floors lit in
 * bands and others dark. The old baked map lit a third of the rooms in big warm blocks, so towers read as dark boxes with orange
 * rectangles.
 *
 * Layout matches the GLB UVs (scripts/build-buildings.py): one texture tile spans 16 bays (1.6 m each) by 16 floors (3.6 m each),
 * so each 64 px cell is one window bay of one floor. Pure: returns RGBA pixels, the component uploads them. */
import { mulberry32 } from "./rng";

export const FACADE = { size: 1024, cells: 16 } as const;

type RGB = [number, number, number];
const COOL: RGB = [0.86, 0.93, 1.0], WARM: RGB = [1.0, 0.8, 0.55], CYAN: RGB = [0.35, 0.9, 1.0], MAGENTA: RGB = [1.0, 0.42, 0.86];

/** which light a lit room has: mostly office white, some warm homes, rare neon accents */
export function roomColor(r: number): RGB {
  return r < 0.56 ? COOL : r < 0.88 ? WARM : r < 0.95 ? CYAN : MAGENTA;
}

/** RGBA pixels for the facade, `size` x `size`. Rows are floors: each floor gets an occupancy (dark, part lit, busy) so lit rooms
 * band across the tower like real office floors at night; inside a lit room the ceiling light falls off downward, some rooms have
 * blinds half down, and a mullion splits every bay into two panes. Unlit glass keeps a faint blue so towers never go pure black. */
export function facadePixels(size: number = FACADE.size, cells: number = FACADE.cells, seed = 11): Uint8ClampedArray {
  const rnd = mulberry32(seed), px = new Uint8ClampedArray(size * size * 4), c = Math.floor(size / cells);
  const put = (x: number, y: number, col: RGB, k: number) => {
    const i = (y * size + x) * 4;
    px[i] = Math.min(255, col[0] * k * 255); px[i + 1] = Math.min(255, col[1] * k * 255); px[i + 2] = Math.min(255, col[2] * k * 255); px[i + 3] = 255;
  };
  for (let j = 0; j < cells; j++) {
    const occ = [0.12, 0.45, 0.82][Math.floor(rnd() * 3)]!; // this floor: mostly dark, part lit, or busy
    const floorTint = rnd();                                  // a floor tends to share one kind of light
    for (let i = 0; i < cells; i++) {
      const lit = rnd() < occ;
      const col = roomColor(rnd() < 0.7 ? floorTint : rnd());
      const level = 0.55 + rnd() * 0.45;
      const blind = rnd() < 0.25 ? 0.25 + rnd() * 0.35 : 0;   // share of the window covered from the top
      const x0 = i * c, y0 = j * c;
      for (let y = 0; y < c; y++) for (let x = 0; x < c; x++) {
        const gx = x0 + x, gy = y0 + y;
        const frame = x < 3 || x >= c - 3 || y < 4 || y >= c - 7;          // the bay frame and the spandrel under the window
        const mullion = Math.abs(x - c / 2) < 1;                            // the pane split
        if (frame || mullion) { put(gx, gy, [0.02, 0.03, 0.05], 1); continue; }
        const v = (y - 4) / (c - 11);                                         // 0 at the top of the window, 1 at the sill
        if (!lit || v < blind) { put(gx, gy, [0.05, 0.08, 0.14], blind && lit ? 0.9 : 0.6); continue; }
        const fall = 1 - 0.38 * v;                                            // the ceiling light falls off toward the sill
        const spot = 1 + 0.18 * Math.cos(((x - 3) / (c - 6)) * Math.PI * 2); // a fixture near each pane centre
        put(gx, gy, col, level * fall * spot);
      }
    }
  }
  return px;
}

/** share of window cells that are lit in a generated facade (tests and tuning) */
export function litShare(px: Uint8ClampedArray, size: number = FACADE.size, cells: number = FACADE.cells): number {
  const c = Math.floor(size / cells);
  let lit = 0;
  for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) {
    const x = i * c + Math.floor(c * 0.3), y = j * c + 4 + Math.floor((c - 11) * 0.6), k = (y * size + x) * 4;
    if (px[k]! + px[k + 1]! + px[k + 2]! > 200) lit++;
  }
  return lit / (cells * cells);
}
