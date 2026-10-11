/** Frostspire dressing (pure layout): snow-laden pines on the lower slopes, ice crystal formations, wind-carved snow
 * drifts, frozen expedition camps (tents, crates, sleds, a dead beacon) and a frozen waterfall on a steep face.
 * Keeps clear of the avalanche run, the crevasse field, the Summit Array, the Aether-Lift, roads and mission arenas. */
import { arenaCircles, clusters, landmark, regionById, scatter, zoneCircle, type PlaceRules, type Prop } from "./dressing-kit";
import { heightAt, slopeAt } from "./terrain";
import { mulberry32 } from "./rng";

export const FROST: PlaceRules = {
  region: "frostspire",
  keepOut: () => [zoneCircle("avalanche", 10), zoneCircle("crevasse", 6), { ...landmark("summit-array"), r: 30 }, { ...landmark("aether-lift"), r: 26 }, ...arenaCircles("frostspire")],
};
const R = () => regionById("frostspire");

/** pines only below the snowline, on gentle ground */
export const pines = () => scatter(FROST, 220, 0xf1e5, { inner: R().radius * 0.25, outer: R().radius * 0.95, maxSlope: 0.55, gap: 3.2, clear: 2, maxH: 60 });
export const iceCrystals = () => scatter(FROST, 34, 0x1ce, { inner: 10, outer: R().radius * 0.85, maxSlope: 1.2, gap: 8, clear: 3 });
export const drifts = () => scatter(FROST, 60, 0xd1f7, { inner: 0, outer: R().radius * 0.95, maxSlope: 0.45, gap: 7, clear: 1 });
/** three abandoned survey camps, each with tents, crates and a sled around a dead beacon mast */
export function camps(): { at: Prop; items: Prop[] }[] {
  const anchors = scatter(FROST, 3, 0xca3b, { inner: R().radius * 0.2, outer: R().radius * 0.9, maxSlope: 0.45, gap: 40, clear: 6 });
  const items = clusters(FROST, anchors, 9, 9, 0xca3c, 2.2);
  return anchors.map((at, i) => ({ at, items: items[i] ?? [] }));
}
/** the steepest high face near the range's heart gets a frozen waterfall: a column of ice down the slope */
export function frozenFall(): { x: number; z: number; top: number; bottom: number; yaw: number } | null {
  const r = R(), rnd = mulberry32(0xfa11);
  let best: { x: number; z: number; s: number } | null = null;
  for (let i = 0; i < 300; i++) {
    const a = rnd() * Math.PI * 2, d = r.radius * (0.2 + rnd() * 0.5), x = r.x + Math.cos(a) * d, z = r.z + Math.sin(a) * d;
    const s = slopeAt(x, z);
    if (s < 0.9) continue;
    if (FROST.keepOut().some((k) => Math.hypot(x - k.x, z - k.z) < k.r + 10)) continue;
    if (!best || s > best.s) best = { x, z, s };
  }
  if (!best) return null;
  const gx = heightAt(best.x + 1, best.z) - heightAt(best.x - 1, best.z), gz = heightAt(best.x, best.z + 1) - heightAt(best.x, best.z - 1);
  const yaw = Math.atan2(gx, gz); // faces up the slope
  const up = { x: best.x + Math.sin(yaw) * 8, z: best.z + Math.cos(yaw) * 8 }, dn = { x: best.x - Math.sin(yaw) * 8, z: best.z - Math.cos(yaw) * 8 };
  return { x: best.x, z: best.z, top: heightAt(up.x, up.z), bottom: heightAt(dn.x, dn.z), yaw };
}
