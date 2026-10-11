/** Wastelands dressing (pure layout) — the trailer's ruined city outskirts: gutted concrete building shells, leaning
 * power pylons with sagging cables, junk heaps and tyre piles, billboards, and smoke from burning debris.
 * Keeps clear of the Convoy Sprint wreck field (its own set piece), Scrap-Outpost Alpha, roads and the Dark Knight lair. */
import { arenaCircles, clusters, landmark, regionById, scatter, type PlaceRules, type Prop } from "./dressing-kit";
import { mulberry32 } from "./rng";
import { WRECK_SPREAD } from "./set-pieces";

export const WASTE: PlaceRules = {
  region: "wastelands",
  keepOut: () => [{ ...landmark("convoy-sprint"), r: WRECK_SPREAD + 10 }, { ...landmark("scrap-outpost"), r: 30 }, ...arenaCircles("wastelands")],
};
const R = () => regionById("wastelands");

/** the old outskirts: a district of building shells in one quarter of the region, streets left open between them */
export function ruins(): (Prop & { w: number; d: number; floors: number; broken: number })[] {
  const rnd = mulberry32(0x5e11);
  return scatter(WASTE, 26, 0x5e1, { inner: R().radius * 0.25, outer: R().radius * 0.9, maxSlope: 0.3, gap: 22, clear: 13 }).map((p) => ({
    ...p, w: 8 + rnd() * 10, d: 8 + rnd() * 8, floors: 2 + Math.floor(rnd() * 5), broken: rnd(),
  }));
}
/** pylons march in a line across the region; the renderer strings cables between neighbours */
export function pylons(): Prop[] {
  const r = R(), rnd = mulberry32(0x9710), out: Prop[] = [];
  const a = rnd() * Math.PI, dx = Math.cos(a), dz = Math.sin(a);
  for (let i = -6; i <= 6; i++) {
    const x = r.x + dx * i * 26 + (rnd() - 0.5) * 4, z = r.z + dz * i * 26 + (rnd() - 0.5) * 4;
    if (Math.hypot(x - r.x, z - r.z) > r.radius * 0.95) continue;
    if (WASTE.keepOut().some((k) => Math.hypot(x - k.x, z - k.z) < k.r)) continue;
    // r is the cross-arm yaw: perpendicular to the line the pylons march along
    out.push({ x, z, s: 1, r: -a - Math.PI / 2, tilt: (rnd() - 0.5) * (i % 4 === 0 ? 0.2 : 0.06) });
  }
  return out;
}
export const junkHeaps = () => clusters(WASTE, scatter(WASTE, 14, 0x7a2, { inner: 0, outer: R().radius * 0.9, maxSlope: 0.4, gap: 30, clear: 4 }), 10, 5, 0x7a3, 1.1);
export const billboards = () => scatter(WASTE, 6, 0xb1b, { inner: R().radius * 0.2, outer: R().radius * 0.9, maxSlope: 0.3, gap: 60, clear: 6 });
/** burning debris piles that smoke (a few of the junk heaps) */
export const fires = () => junkHeaps().flatMap((h, i) => (i % 3 === 0 && h[0] ? [h[0]] : []));
