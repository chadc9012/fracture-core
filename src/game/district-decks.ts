/** Walkable raised surfaces in authored districts (Neon City's Grid walkways, Aegis Spire plaza). Each deck is an oriented
 * rectangle with a flat top and optional ramps at both ends that blend down to `base`, so walkers climb on naturally instead
 * of snapping up. Pure data + lookup; terrain.walkHeight folds it in so player, enemies and vehicles all agree.
 * Registered by district components (idempotent by id) and deliberately free of terrain imports to avoid a cycle. */
export type Deck = {
  id: string; x: number; z: number; dirX: number; dirZ: number;
  length: number; width: number; top: number; base: number; ramp: number;
  /** a deck that climbs or falls along its length (a bridge between shores of different height): the top at the far (+dir)
   * end; the top runs straight from `top` at the near end to it, with no ramps */
  topB?: number;
};

const decks = new Map<string, Deck>();
let bounds = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };

export function registerDeck(d: Deck) {
  const n = Math.hypot(d.dirX, d.dirZ) || 1;
  decks.set(d.id, { ...d, dirX: d.dirX / n, dirZ: d.dirZ / n });
  const r = Math.hypot(d.length, d.width) / 2;
  bounds = { minX: Math.min(bounds.minX, d.x - r), maxX: Math.max(bounds.maxX, d.x + r), minZ: Math.min(bounds.minZ, d.z - r), maxZ: Math.max(bounds.maxZ, d.z + r) };
}

export function clearDecks() { decks.clear(); bounds = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity }; }

/** surface height of a single deck at (x,z), or -Infinity when off it */
export function deckHeight(d: Deck, x: number, z: number): number {
  const dx = x - d.x, dz = z - d.z;
  const along = dx * d.dirX + dz * d.dirZ, across = -dx * d.dirZ + dz * d.dirX;
  const half = d.length / 2;
  if (Math.abs(along) > half || Math.abs(across) > d.width / 2) return -Infinity;
  const fromEnd = half - Math.abs(along);
  if (d.topB !== undefined) return d.top + (d.topB - d.top) * ((along + half) / d.length);
  if (d.ramp > 0 && fromEnd < d.ramp) return d.base + (d.top - d.base) * (fromEnd / d.ramp);
  return d.top;
}

/** highest registered deck under (x,z), or -Infinity */
export function districtDeckAt(x: number, z: number): number {
  if (x < bounds.minX || x > bounds.maxX || z < bounds.minZ || z > bounds.maxZ) return -Infinity;
  let best = -Infinity;
  for (const d of decks.values()) { const h = deckHeight(d, x, z); if (h > best) best = h; }
  return best;
}
