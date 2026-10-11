/**
 * Audited inventory of the 3D assets the game actually ships (Stage 1 realism audit, inspected GLB headers).
 * Status: A = real and in gameplay, B = placeholder (procedural primitives), C = exists but not integrated,
 * D = missing, E = plan/data only. Keep honest — the asset inspector reads this list.
 */
export type AssetStatus = "A" | "B" | "C" | "D" | "E";
export type AssetEntry = { id: string; category: "operator" | "boss" | "enemy" | "civilian" | "merchant" | "weapon" | "vehicle" | "building" | "nature"; status: AssetStatus; url?: string; note: string };

export const ASSET_INVENTORY: AssetEntry[] = [
  { id: "goliath", category: "operator", status: "A", url: "/models/operators/goliath-hd.glb", note: "Rigged single mesh (Meshy original subdivided once offline, ~12k tris, scripts/build-operator-hd.ts); clips walk/run/showcase/stagger/squat. Armor regions, visor and wear are painted into a runtime texture through the UVs." },
  { id: "nyx", category: "operator", status: "A", url: "/models/operators/nyx-hd.glb", note: "Rigged single mesh (subdivided once offline, ~12k tris), painted at runtime; clips walk/run/idle/slide/charge/combo/punch/sideshot." },
  { id: "cipher", category: "operator", status: "A", url: "/models/operators/cipher-authored.glb", note: "Authored Meshy body (3k tris, own 2K textures, 75-joint Mixamo-named skeleton); clips walk/run only (no idle). Not painted at runtime; cipher-hd.glb stays as the procedural-paint source." },
  { id: "modular-armor", category: "operator", status: "B", note: "Starter procedural helmet/chest+pauldron/gauntlet/thigh+shin pieces parented to rig bones (armor-pieces.ts); replaceable by authored GLBs per piece." },
  { id: "frost-wolf", category: "boss", status: "A", url: "/models/bosses/frost-wolf.glb", note: "Baked texture, skinned but zero animation clips; legs are found from the skeleton and walked/galloped procedurally (skeleton-gait.ts)." },
  { id: "fox", category: "nature", status: "A", url: "/models/animals/fox.glb", note: "Khronos sample Fox (model CC0 PixelMannen; rig/animation CC BY 4.0 tomkranis; credited). Clips Survey/Walk/Run driven by ground speed; procedural fox fallback." },
  { id: "wildlife", category: "nature", status: "B", note: "Deer (bucks with antlers), rabbits, songbirds, vultures, fish, snakes, dogs, cats: jointed procedural rigs with distance-driven gaits, grazing/alert head poses and wing beats (Wildlife.tsx); behaviour and placement are pure and tested (wildlife.ts, wildlife-habitat.ts). Replaceable per species by rigged GLBs." },
  { id: "dark-knight", category: "boss", status: "A", url: "/models/bosses/dark-knight.glb", note: "Baked texture, static (no skin, no clips)." },
  { id: "regional-troops", category: "enemy", status: "A", note: "Seven user-supplied Meshy GLBs mapped per faction/role in enemy-visuals.ts (textures 1024 WebP). Rigs use generic bones with no clips, so motion is procedural; EnemyModel.tsx troopers are the fallback." },
  { id: "npc-a/b/c", category: "civilian", status: "A", note: "Repaired CC0 GLBs walk the Nexus plaza (NexusCity.tsx); regional Civilians.tsx still uses primitives." },
  { id: "shopkeepers", category: "merchant", status: "B", note: "ShopStalls.tsx stalls and keepers are primitives." },
  { id: "weapons", category: "weapon", status: "D", note: "No weapon models; weapons are data in weapons.ts with procedural viewmodels." },
  { id: "suv/police/truck", category: "vehicle", status: "A", note: "CC0 GLBs used by Vehicle.tsx and NexusCity.tsx." },
  { id: "van/race-future/wheel", category: "vehicle", status: "C", note: "Registered and preloaded; wheel used by Vehicle.tsx, van/race-future not placed." },
  { id: "tower-a/b, block-a/b", category: "building", status: "A", note: "CC0 city blocks used in Nexus/Neon City." },
  { id: "poly-haven-nature", category: "nature", status: "A", note: "Trees, shrubs, fern, boulder, moss rocks, trunk + 6 ground textures, with primitive fallback. Frostspire boulders, swamp dead trunks and forest saplings/brush now use them (docs/realistic-assets.md); wrecks, cacti, reeds and arid rocks are still primitives." },
];

import { ENEMY_MODEL_URLS } from "./enemy-visuals";
ASSET_INVENTORY.push(...ENEMY_MODEL_URLS.map((url, i) => ({ id: `enemy-${i + 1}`, category: "enemy" as const, status: "A" as const, url, note: "Meshy enemy model" })));
export const inspectable = () => ASSET_INVENTORY.filter((a) => a.url);
