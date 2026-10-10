/** Cloud puff layout (pure). Puffs ride a ring around the PLAYER (the layer follows the camera, like the dome) and must stay inside the camera far plane:
 * a billboard past `far` is cut off by the clip plane with straight edges, which read as translucent rectangular "blocky patches" in the sky.
 * Distances here are kept so that even the largest puff's farthest corner is under CLOUD_REACH_LIMIT of the far plane. */
export const CLOUD_COUNT = 18;
/** fraction of the camera far plane the farthest puff corner may reach */
export const CLOUD_REACH_LIMIT = 0.92;
/** cloud cover grows a puff by up to this factor (Scene sets env.cloud 0..1) */
export const COVER_GROWTH = 0.25;

export type Puff = { a: number; r: number; y: number; scale: number; speed: number; baseOpacity: number; drift: number };

function mulberry(seed: number) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/** Same seed and spread as before; radius is compressed from 900..2300 m into 700..1250 m and each puff's scale shrinks by the same ratio, so its apparent angular size is unchanged. */
export function cloudPuffs(count = CLOUD_COUNT, seed = 4471): Puff[] {
  const rnd = mulberry(seed);
  return Array.from({ length: count }, () => {
    const a = rnd() * Math.PI * 2, oldR = 900 + rnd() * 1400, y = 260 + rnd() * 160, oldScale = 220 + rnd() * 340;
    const r = 700 + ((oldR - 900) / 1400) * 550;
    return { a, r, y, scale: oldScale * (r / oldR), speed: 1.4 + rnd() * 2.2, baseOpacity: 0.35 + rnd() * 0.4, drift: rnd() * Math.PI * 2 };
  });
}

/** distance from the camera to the farthest corner of a puff at full cloud cover (sprites are scale x 0.55*scale) */
export function puffFarthestReach(p: Puff, cover = 1): number {
  const sc = p.scale * (1 + Math.min(1, Math.max(0, cover)) * COVER_GROWTH);
  const halfDiag = Math.hypot(sc, sc * 0.55) / 2;
  return Math.hypot(p.r, p.y + 8) + halfDiag;
}
