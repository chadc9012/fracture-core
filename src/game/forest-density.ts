/** Grove planting: the forest used to be one uniform scatter (about one tree per 30 m2), which reads as a spread-out park. This adds
 * clustered groves: a few grove centres, each ringed by a denser blob of trees with varied scale and a minimum spacing, so there are thick
 * stands, canopy-to-canopy walls and open gaps between them. Pure and seeded: the caller's `accept` enforces terrain, trail and road rules,
 * so the mission trail, clearings and crash pad stay clear. */
export type Tree = { x: number; z: number; s: number; r: number };
export const GROVE = { centres: 14, perGrove: 9, minRadius: 2.2, maxRadius: 8.5, minScale: 0.85, maxScale: 1.35, minSpacing: 2.6 } as const;

export function growGroves(
  centres: readonly { x: number; z: number }[],
  existing: readonly { x: number; z: number }[],
  rnd: () => number,
  accept: (x: number, z: number) => boolean,
  perGrove: number = GROVE.perGrove,
): Tree[] {
  const out: Tree[] = [];
  const s2 = GROVE.minSpacing * GROVE.minSpacing;
  const free = (x: number, z: number) => {
    for (const p of existing) { const dx = p.x - x, dz = p.z - z; if (dx * dx + dz * dz < s2) return false; }
    for (const p of out) { const dx = p.x - x, dz = p.z - z; if (dx * dx + dz * dz < s2) return false; }
    return true;
  };
  for (const c of centres) {
    const n = Math.max(1, Math.round(perGrove * (0.6 + rnd() * 0.8)));
    let guard = n * 8, made = 0;
    while (made < n && guard-- > 0) {
      const a = rnd() * Math.PI * 2;
      const d = GROVE.minRadius + (GROVE.maxRadius - GROVE.minRadius) * Math.pow(rnd(), 1.4); // thicker toward the centre
      const x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d;
      if (!accept(x, z) || !free(x, z)) continue;
      out.push({ x, z, s: GROVE.minScale + (GROVE.maxScale - GROVE.minScale) * rnd(), r: rnd() * Math.PI * 2 });
      made++;
    }
  }
  return out;
}
