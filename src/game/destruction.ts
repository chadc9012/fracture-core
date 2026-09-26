/**
 * Destructible interiors: a structural graph (walls, pillars, ceilings, floors, cover) with material health,
 * damage propagation and collapse. Every change is recorded as a DestructionEvent so a future multiplayer
 * layer can replicate events (not physics) and rebuild identical state on each client.
 */
export type NodeType = "WALL" | "FLOOR" | "CEILING" | "PILLAR" | "OBJECT";
export type Material = "CONCRETE" | "GLASS" | "METAL";
export type StructuralNode = {
  id: string; type: NodeType; material: Material;
  health: number; maxHealth: number; isDestroyed: boolean;
  /** ids that rest on this node — they fail when every one of their supporters is gone */
  supports: string[];
  x: number; y: number; z: number; w: number; h: number; d: number;
};
export type DestructionEvent = { id: number; chunkId: string; nodeId: string; type: "DAMAGE" | "DESTROY" | "COLLAPSE"; damage?: number | undefined; timestamp: number };
export type Debris = { alive: boolean; x: number; y: number; z: number; vx: number; vy: number; vz: number; spin: number; life: number; size: number; color: string };
export type Structure = { chunkId: string; nodes: Map<string, StructuralNode>; events: DestructionEvent[]; nextEvent: number; debris: Debris[]; cover: { x: number; z: number }[]; version: number; lastCollapse: { x: number; z: number; t: number } | null };

/** Weapons interact differently: bullets chip, heavy shells break structure, energy weakens. */
export const STRUCTURE_MULT: Record<string, number> = { AUTO: 0.6, PULSE: 0.9, HEAVY: 4, SWORD: 1.2, VEHICLE: 1.5 };
const MATERIAL_HP: Record<Material, number> = { CONCRETE: 1, GLASS: 0.25, METAL: 1.6 };

/** Deterministic, seeded (identical on every client). */
function seeded(seed: string) { let h = 2166136261; for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619); return ((h >>> 0) % 10000) / 10000; }

/** Builds a two-room ruined interior: 4 pillars carrying 2 ceiling slabs, outer walls, a glass front, cover crates. */
export function buildInterior(chunkId: string, ox: number, oy: number, oz: number): Structure {
  const nodes = new Map<string, StructuralNode>();
  const add = (id: string, type: NodeType, material: Material, x: number, y: number, z: number, w: number, h: number, d: number, hp: number, supports: string[] = []) => {
    const maxHealth = hp * MATERIAL_HP[material];
    nodes.set(id, { id, type, material, health: maxHealth, maxHealth, isDestroyed: false, supports, x: ox + x, y: oy + y, z: oz + z, w, h, d });
  };
  add("pillar-a", "PILLAR", "CONCRETE", -5, 2.5, -4, 1, 5, 1, 30, ["ceiling-west"]);
  add("pillar-b", "PILLAR", "CONCRETE", -5, 2.5, 4, 1, 5, 1, 30, ["ceiling-west"]);
  add("pillar-c", "PILLAR", "METAL", 5, 2.5, -4, 1, 5, 1, 30, ["ceiling-east"]);
  add("pillar-d", "PILLAR", "METAL", 5, 2.5, 4, 1, 5, 1, 30, ["ceiling-east"]);
  add("ceiling-west", "CEILING", "CONCRETE", -5, 5.25, 0, 10, 0.5, 11, 40);
  add("ceiling-east", "CEILING", "CONCRETE", 5, 5.25, 0, 10, 0.5, 11, 40);
  add("wall-north", "WALL", "CONCRETE", 0, 2.5, -6, 20, 5, 0.6, 26);
  add("wall-west", "WALL", "CONCRETE", -10, 2.5, 0, 0.6, 5, 12, 26);
  add("wall-east", "WALL", "METAL", 10, 2.5, 0, 0.6, 5, 12, 22);
  add("glass-front-a", "WALL", "GLASS", -5, 2.5, 6, 8, 4, 0.2, 24);
  add("glass-front-b", "WALL", "GLASS", 5, 2.5, 6, 8, 4, 0.2, 24);
  add("divider", "WALL", "CONCRETE", 0, 2, 0, 0.5, 4, 7, 20);
  add("crate-a", "OBJECT", "METAL", -3, 0.6, 1.5, 1.4, 1.2, 1.4, 8);
  add("crate-b", "OBJECT", "METAL", 3, 0.6, -2, 1.4, 1.2, 1.4, 8);
  // supporter reverse index is derived: a node collapses when all nodes listing it in `supports` are destroyed
  return { chunkId, nodes, events: [], nextEvent: 1, debris: Array.from({ length: 48 }, () => ({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, spin: 0, life: 0, size: 0.4, color: "#777" })), cover: [], version: 0, lastCollapse: null };
}

function record(s: Structure, nodeId: string, type: DestructionEvent["type"], damage?: number) {
  s.events.push({ id: s.nextEvent++, chunkId: s.chunkId, nodeId, type, damage, timestamp: Date.now() });
  if (s.events.length > 200) s.events.splice(0, s.events.length - 200);
}

function spawnDebris(s: Structure, n: StructuralNode, count: number) {
  const color = n.material === "GLASS" ? "#9fdcff" : n.material === "METAL" ? "#6b7179" : "#8c8579";
  for (let i = 0; i < count; i++) {
    const d = s.debris.find((p) => !p.alive) ?? s.debris[i % s.debris.length]!;
    const r = seeded(`${n.id}${i}`);
    Object.assign(d, { alive: true, x: n.x + (r - 0.5) * n.w, y: n.y + (seeded(`${i}${n.id}`) - 0.3) * n.h, z: n.z + (r - 0.5) * n.d, vx: (r - 0.5) * 8, vy: 2 + r * 5, vz: (seeded(n.id + i * 3) - 0.5) * 8, spin: r * 9, life: 3 + r * 2, size: n.material === "GLASS" ? 0.15 : 0.3 + r * 0.4, color });
  }
}

function destroy(s: Structure, n: StructuralNode, cause: "DESTROY" | "COLLAPSE") {
  if (n.isDestroyed) return;
  n.isDestroyed = true; n.health = 0; s.version++;
  record(s, n.id, cause);
  spawnDebris(s, n, n.type === "CEILING" ? 14 : n.type === "OBJECT" ? 4 : 8);
  // broken walls and fallen slabs become emergent cover
  if (n.type !== "OBJECT" && n.material !== "GLASS") s.cover.push({ x: n.x, z: n.z });
  if (n.type === "CEILING" || n.type === "PILLAR") s.lastCollapse = { x: n.x, z: n.z, t: performance.now() };
  // propagate: anything this node supported collapses once all of its supporters are down
  for (const id of n.supports) {
    const child = s.nodes.get(id);
    if (!child || child.isDestroyed) continue;
    const supporters = [...s.nodes.values()].filter((p) => p.supports.includes(id));
    const standing = supporters.filter((p) => !p.isDestroyed).length;
    // deterministic partial-collapse: with one support left, the slab fails if the seeded roll says so
    if (standing === 0 || (standing === 1 && seeded(s.chunkId + id) > 0.5)) destroy(s, child, "COLLAPSE");
    else { child.health = Math.min(child.health, child.maxHealth * 0.45); record(s, id, "DAMAGE", 0); }
  }
}

export function applyDamage(s: Structure, nodeId: string, damage: number) {
  const n = s.nodes.get(nodeId);
  if (!n || n.isDestroyed) return;
  n.health -= damage; s.version++;
  record(s, nodeId, "DAMAGE", damage);
  if (n.health <= 0) destroy(s, n, "DESTROY");
}

/** Returns the first standing node a point is inside (bullet hit test). */
export function hitTest(s: Structure, x: number, y: number, z: number) {
  for (const n of s.nodes.values()) {
    if (n.isDestroyed) continue;
    if (Math.abs(x - n.x) <= n.w / 2 + 0.2 && Math.abs(y - n.y) <= n.h / 2 + 0.2 && Math.abs(z - n.z) <= n.d / 2 + 0.2) return n;
  }
  return null;
}

/** Applies a replicated event log (for late joiners / reconciliation): replays DAMAGE, forces DESTROY/COLLAPSE. */
export function applyWorldEvent(s: Structure, e: DestructionEvent) {
  const n = s.nodes.get(e.nodeId); if (!n) return;
  if (e.type === "DAMAGE" && e.damage) applyDamage(s, e.nodeId, e.damage);
  else if (e.type !== "DAMAGE") destroy(s, n, e.type);
}

export function stepDebris(s: Structure, dt: number, floorY: number) {
  for (const d of s.debris) {
    if (!d.alive) continue;
    d.vy -= 20 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt; d.life -= dt;
    if (d.y < floorY + d.size / 2) { d.y = floorY + d.size / 2; d.vy *= -0.3; d.vx *= 0.6; d.vz *= 0.6; }
    if (d.life <= 0) d.alive = false; // auto-clean, returns to pool
  }
}

export type StructureState = "INTACT" | "CRACKED" | "UNSTABLE" | "CRITICAL";
export function nodeState(n: StructuralNode): StructureState {
  const r = n.health / n.maxHealth;
  return r > 0.8 ? "INTACT" : r > 0.55 ? "CRACKED" : r > 0.3 ? "UNSTABLE" : "CRITICAL";
}
