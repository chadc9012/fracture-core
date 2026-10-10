/**
 * Audited inventory of the 3D assets the game actually ships (Stage 1 realism audit, inspected GLB headers).
 * Status: A = real and in gameplay, B = placeholder (procedural primitives), C = exists but not integrated,
 * D = missing, E = plan/data only. Keep honest — the asset inspector reads this list.
 */
export type AssetStatus = "A" | "B" | "C" | "D" | "E";
export type AssetEntry = { id: string; category: "operator" | "boss" | "enemy" | "civilian" | "merchant" | "weapon" | "vehicle" | "building" | "nature"; status: AssetStatus; url?: string; note: string };

export const ASSET_INVENTORY: AssetEntry[] = [
  { id: "goliath", category: "operator", status: "A", url: "/models/operators/goliath.glb", note: "Rigged single mesh, no materials; clips walk/run/showcase/stagger/squat. Armor slots are painted vertex-colour regions, not separate meshes." },
  { id: "nyx", category: "operator", status: "A", url: "/models/operators/nyx.glb", note: "Rigged single mesh, no materials; clips walk/run/idle/slide/charge/combo/punch/sideshot." },
  { id: "cipher", category: "operator", status: "A", url: "/models/operators/cipher.glb", note: "Rigged single mesh, no materials; clips walk/run only (no idle)." },
  { id: "modular-armor", category: "operator", status: "B", note: "Starter procedural helmet/chest+pauldron/gauntlet/thigh+shin pieces parented to rig bones (armor-pieces.ts); replaceable by authored GLBs per piece." },
  { id: "frost-wolf", category: "boss", status: "A", url: "/models/bosses/frost-wolf.glb", note: "Baked texture, skinned but zero animation clips." },
  { id: "dark-knight", category: "boss", status: "A", url: "/models/bosses/dark-knight.glb", note: "Baked texture, static (no skin, no clips)." },
  { id: "regional-troops", category: "enemy", status: "B", note: "EnemyModel.tsx: articulated layered procedural troopers per faction/region with walk cycle; no enemy GLBs yet." },
  { id: "npc-a/b/c", category: "civilian", status: "A", note: "Repaired CC0 GLBs walk the Nexus plaza (NexusCity.tsx); regional Civilians.tsx still uses primitives." },
  { id: "shopkeepers", category: "merchant", status: "B", note: "ShopStalls.tsx stalls and keepers are primitives." },
  { id: "weapons", category: "weapon", status: "D", note: "No weapon models; weapons are data in weapons.ts with procedural viewmodels." },
  { id: "suv/police/truck", category: "vehicle", status: "A", note: "CC0 GLBs used by Vehicle.tsx and NexusCity.tsx." },
  { id: "van/race-future/wheel", category: "vehicle", status: "C", note: "Registered and preloaded; wheel used by Vehicle.tsx, van/race-future not placed." },
  { id: "tower-a/b, block-a/b", category: "building", status: "A", note: "CC0 city blocks used in Nexus/Neon City." },
  { id: "poly-haven-nature", category: "nature", status: "A", note: "Trees, shrubs, fern, boulder, moss rocks, trunk + 6 ground textures, with primitive fallback." },
];

export const inspectable = () => ASSET_INVENTORY.filter((a) => a.url);
