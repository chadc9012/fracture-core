/** Armor/weapon shaders: appearance only. Owning a shader (`shader:<id>` in earnedRewards, union-merged) is separate from
 * applying it (GearItem.shader). Applying never touches power, level, element, perks or set bonuses, and an owned shader can be
 * reused on any compatible owned item without buying it again.
 * Emissive rule: a shader recolours paint and trim; it tints emissive parts only when `tintsEmissive`, and never overrides the
 * emissive or special material of EXOTIC gear (exotics keep their signature glow). */
import type { GearItem, GearSlot, MaterialId } from "./inventory";
import type { PlayerProgression } from "./progression";

export type ArmorShader = { id: string; name: string; rarity: "common" | "rare" | "legendary" | "exotic"; base: string; accent: string; emissive: string; metalness: number; roughness: number; tintsEmissive: boolean; slots: GearSlot[]; price?: { material: MaterialId; amount: number }; source: string };
const ALL: GearSlot[] = ["primary", "secondary", "heavy", "helmet", "chest", "gauntlets", "legs", "classItem"];

export const ARMOR_SHADERS: readonly ArmorShader[] = [
  { id: "neon-rain", name: "Neon Rain", rarity: "rare", base: "#18232e", accent: "#00dfff", emissive: "#00aaff", metalness: 0.7, roughness: 0.35, tintsEmissive: true, slots: ALL, price: { material: "microCircuits", amount: 40 }, source: "Neon City black market" },
  { id: "rust-muck", name: "Rust-Muck", rarity: "common", base: "#4b332a", accent: "#b96d42", emissive: "#ff5a28", metalness: 0.4, roughness: 0.8, tintsEmissive: false, slots: ALL, price: { material: "scrapMetal", amount: 60 }, source: "Undercity markets" },
  { id: "void-prism", name: "Void Prism", rarity: "exotic", base: "#15121f", accent: "#8f50ff", emissive: "#bd65ff", metalness: 0.85, roughness: 0.25, tintsEmissive: true, slots: ALL, source: "Hidden Fracture encounter" },
  { id: "vanguard-drab", name: "Vanguard Drab", rarity: "common", base: "#4a5040", accent: "#a8a080", emissive: "#ffd27a", metalness: 0.55, roughness: 0.65, tintsEmissive: false, slots: ALL, price: { material: "reinforcedAlloy", amount: 20 }, source: "City armor shops" },
  { id: "ashen-covenant", name: "Ashen Covenant", rarity: "legendary", base: "#2a1a14", accent: "#ffb040", emissive: "#ff6a1a", metalness: 0.75, roughness: 0.4, tintsEmissive: true, slots: ALL, source: "Vyrak's Covenant" },
];
export const shaderById = (id: string) => ARMOR_SHADERS.find((s) => s.id === id);
export const ownsShader = (p: Pick<PlayerProgression, "earnedRewards">, id: string) => p.earnedRewards.includes(`shader:${id}`);

export function grantShader(p: PlayerProgression, id: string): PlayerProgression {
  return !shaderById(id) || ownsShader(p, id) ? p : { ...p, earnedRewards: [...p.earnedRewards, `shader:${id}`] };
}

export function buyShader(p: PlayerProgression, id: string): { progression: PlayerProgression } | { error: string } {
  const s = shaderById(id);
  if (!s) return { error: "Unknown shader" };
  if (ownsShader(p, id)) return { error: "Already owned — apply it for free" };
  if (!s.price) return { error: `Earned only: ${s.source}` };
  const have = p.materials[s.price.material] ?? 0;
  if (have < s.price.amount) return { error: `Not enough ${s.price.material}` };
  return { progression: grantShader({ ...p, materials: { ...p.materials, [s.price.material]: have - s.price.amount } }, id) };
}

export function applyShader(p: PlayerProgression, itemId: string, shaderId: string | null): { progression: PlayerProgression } | { error: string } {
  const item = p.inventory.find((g) => g.id === itemId);
  if (!item) return { error: "Item not owned" };
  if (shaderId === null) return { progression: { ...p, inventory: p.inventory.map((g) => (g.id === itemId ? { ...g, shader: undefined } : g)) } };
  const s = shaderById(shaderId);
  if (!s || !ownsShader(p, shaderId)) return { error: "Shader not owned" };
  if (!s.slots.includes(item.slot)) return { error: "Not compatible with this item" };
  return { progression: { ...p, inventory: p.inventory.map((g) => (g.id === itemId ? { ...g, shader: shaderId } : g)) } };
}

/** What the renderer should use. Exotic gear keeps its own emissive; non-tinting shaders leave emissive alone. */
export function shaderLook(item: Pick<GearItem, "rarity" | "shader">, nativeEmissive: string) {
  const s = item.shader ? shaderById(item.shader) : undefined;
  if (!s) return null;
  const keepGlow = item.rarity === "EXOTIC" || !s.tintsEmissive;
  return { base: s.base, accent: s.accent, emissive: keepGlow ? nativeEmissive : s.emissive, metalness: s.metalness, roughness: s.roughness };
}
