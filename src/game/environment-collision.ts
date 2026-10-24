import type { StructuralNode } from "./destruction";
import type { InteriorDef } from "./interiors";

export type SolidBox = { x: number; y: number; z: number; w: number; h: number; d: number };
const modelSolids = new Map<string, SolidBox>();
export function setModelSolid(id: string, box: SolidBox) { modelSolids.set(id, box); }
export function removeModelSolid(id: string) { modelSolids.delete(id); }
export function registeredModelSolids(): SolidBox[] { return Array.from(modelSolids.values()); }

/** Same footprints as the existing ruin geometry; destroyed walls stop colliding. */
export function structureSolids(nodes: Iterable<StructuralNode>): SolidBox[] {
  return Array.from(nodes).filter(n => !n.isDestroyed && n.type !== "FLOOR" && n.type !== "CEILING");
}

/** Walls of a pocket room. A HOME is `rooms` 10 m rooms side by side along +X (HOME_ROOM_SIZE): one outer shell around all of
 * them and an internal wall between each pair with a doorway (|z| < 1.6) — a single shop-sized box would wall off every room
 * past the first. */
export function roomSolids(room: InteriorDef, altitude: number, rooms = 1): SolidBox[] {
  const { x, z } = room.origin;
  const y = altitude + 1.9;
  const n = Math.max(1, Math.floor(rooms)), span = n * 10, mid = x + (n - 1) * 5;
  const boxes: SolidBox[] = [
    { x: mid, y, z: z - 5, w: span, h: 3.8, d: 0.3 },
    { x: x - 5, y, z, w: 0.3, h: 3.8, d: 10 },
    { x: x + (n - 1) * 10 + 5, y, z, w: 0.3, h: 3.8, d: 10 },
    { x: x - 3, y, z: z + 5, w: 3.4, h: 3.8, d: 0.3 },
    { x: x + 1.3 + (span - 6.6) / 2, y, z: z + 5, w: span - 6.6, h: 3.8, d: 0.3 },
  ];
  for (let k = 0; k < n - 1; k++) {
    const wx = x + k * 10 + 5;
    boxes.push({ x: wx, y, z: z - 3.3, w: 0.3, h: 3.8, d: 3.4 }, { x: wx, y, z: z + 3.3, w: 0.3, h: 3.8, d: 3.4 });
  }
  if (room.kind === "SHOP") boxes.push({ x, y: altitude + 0.55, z: z - 1.5, w: 3.4, h: 1.1, d: 0.8 });
  return boxes;
}

/** Swept circle vs expanded boxes. Resolve axes separately to retain wall sliding. */
export function sweepSolids(body: { x: number; z: number }, from: { x: number; z: number }, feet: number, height: number, radius: number, boxes: readonly SolidBox[]): boolean {
  const dx = body.x - from.x, dz = body.z - from.z;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.25));
  let x = from.x, z = from.z, hit = false;
  const blocked = (px: number, pz: number) => boxes.some(b => feet < b.y + b.h / 2 && feet + height > b.y - b.h / 2 && Math.abs(px - b.x) < b.w / 2 + radius && Math.abs(pz - b.z) < b.d / 2 + radius);
  for (let i = 0; i < steps; i++) {
    if (!blocked(x + dx / steps, z)) x += dx / steps; else hit = true;
    if (!blocked(x, z + dz / steps)) z += dz / steps; else hit = true;
  }
  body.x = x; body.z = z;
  return hit;
}

/** Camera/body origin must remain above the sampled support surface, even uphill. */
export function clampToFloor(body: { y: number; vy: number }, floor: number, offset: number): boolean {
  if (body.y >= floor + offset) return false;
  body.y = floor + offset;
  if (body.vy < 0) body.vy = 0;
  return true;
}