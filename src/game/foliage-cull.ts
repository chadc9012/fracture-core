/** Pure distance culling for instanced foliage. Instanced meshes are drawn in full every frame
 * (and again in the shadow pass) unless their instance list is trimmed, so only plants within
 * `radius` of the camera are kept. */
export type XZ = { x: number; z: number };

/** Indices of `items` within `radius` of (cx, cz), in original order. */
export function nearIndices(items: readonly XZ[], cx: number, cz: number, radius: number): number[] {
  const r2 = radius * radius, out: number[] = [];
  for (let i = 0; i < items.length; i++) {
    const dx = items[i]!.x - cx, dz = items[i]!.z - cz;
    if (dx * dx + dz * dz <= r2) out.push(i);
  }
  return out;
}

/** Draw radius per species (metres): big trees read far into the fog, ground cover only up close. */
export const CULL_RADIUS = { fir: 130, broadleaf: 130, rock: 120, log: 90, shrub: 70, fern: 55 } as const;

/** Re-select only after the camera has moved this far (m), so a still or slow camera costs nothing. */
export const RESELECT_DISTANCE = 6;
export const movedEnough = (px: number, pz: number, cx: number, cz: number) => Math.hypot(cx - px, cz - pz) >= RESELECT_DISTANCE;
