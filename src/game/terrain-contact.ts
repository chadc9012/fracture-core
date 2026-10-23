/** Terrain-aligned decal transforms, shared by procedural ground-contact meshes. */
export type Vec3 = { x: number; y: number; z: number };
export function terrainContactNormal(x: number, z: number, height: (x: number, z: number) => number, step = 0.8): Vec3 {
  const dx = height(x + step, z) - height(x - step, z);
  const dz = height(x, z + step) - height(x, z - step);
  const nx = dx === 0 ? 0 : -dx / (2 * step), ny = 1, nz = dz === 0 ? 0 : -dz / (2 * step);
  const len = Math.hypot(nx, ny, nz) || 1;
  return { x: nx / len, y: ny / len, z: nz / len };
}
/** Offset along the ground normal, rather than vertically, to prevent slope clipping. */
export function terrainContactPosition(x: number, z: number, height: (x: number, z: number) => number, offset: number): Vec3 {
  const n = terrainContactNormal(x, z, height);
  return { x: x + n.x * offset, y: height(x, z) + n.y * offset, z: z + n.z * offset };
}
