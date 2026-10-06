/**
 * Foliage clustering — child plants scatter in a ring-weighted blob around each parent tree so
 * forests read as uneven ecology (saplings and brush near trunks, bare clearings between) instead of
 * uniform random dots. Pure and seeded: the same parents always yield the same undergrowth, and the
 * caller's `accept` hook enforces terrain/road/exclusion rules.
 */
export type ClusterPoint = { x: number; z: number; s: number; r: number; parent: number };

export function clusterAround(
  parents: readonly { x: number; z: number; s: number }[],
  perParent: number,
  rnd: () => number,
  accept: (x: number, z: number) => boolean,
  opts: { minRadius?: number; maxRadius?: number; minScale?: number; maxScale?: number } = {},
): ClusterPoint[] {
  const { minRadius = 1.6, maxRadius = 5.5, minScale = 0.5, maxScale = 1 } = opts;
  const out: ClusterPoint[] = [];
  parents.forEach((p, parent) => {
    // bigger parents seed more children; every parent rolls its own count so groves vary
    const n = Math.round(perParent * (0.4 + rnd() * 1.2) * Math.min(1.4, p.s));
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2;
      const d = minRadius + (maxRadius - minRadius) * Math.pow(rnd(), 1.6); // denser near the trunk
      const x = p.x + Math.cos(a) * d;
      const z = p.z + Math.sin(a) * d;
      if (!accept(x, z)) continue;
      out.push({ x, z, s: minScale + (maxScale - minScale) * rnd(), r: rnd() * Math.PI * 2, parent });
    }
  });
  return out;
}
