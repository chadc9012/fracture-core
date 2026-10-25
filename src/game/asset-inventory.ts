/**
 * Audited inventory of the 3D assets the game actually ships (Stage 1 realism audit, inspected GLB headers).
 * Status: A = real and in gameplay, B = placeholder (procedural primitives), C = exists but not integrated,
 * D = missing, E = plan/data only. Keep honest — the asset inspector reads this list.
 */
export type AssetStatus = "A" | "B" | "C" | "D" | "E";
export type AssetEntry = { id: string; category: "operator" | "boss" | "enemy" | "civilian" | "merchant" | "weapon" | "vehicle" | "building" | "nature"; status: AssetStatus; url?: string; note: string };

export const ASSET_INVENTORY: AssetEntry[] = [
  { id: "goliath-hd", category: "operator", status: "A", url: "/models/operators/goliath-hd.glb", note: "Paint source (no longer the live body). Rigged single mesh (Meshy original subdivided once offline, ~12k tris, scripts/build-operator-hd.ts); clips walk/run/showcase/stagger/squat. Armor regions, visor and wear are painted into a runtime texture through the UVs." },
  { id: "nyx-hd", category: "operator", status: "A", url: "/models/operators/nyx-hd.glb", note: "Paint source (no longer the live body). Rigged single mesh (subdivided once offline, ~12k tris), painted at runtime; clips walk/run/idle/slide/charge/combo/punch/sideshot." },
  { id: "goliath", category: "operator", status: "A", url: "/models/operators/goliath-authored.glb", note: "Rookie Bulwark: Meshy image-to-3D from docs/reference/rookie-goliath.jpg (the rookie armor sheet), remeshed to 30k tris, Mixamo rig, 2K textures; clips walk/run/idle/combat. The previous Goliath Destroyer body (with idle/showcase/taunt clips) is kept at goliath-legacy-authored.glb" },
  { id: "nyx", category: "operator", status: "A", url: "/models/operators/nyx-authored.glb", note: "Rookie Shadow: Meshy image-to-3D from docs/reference/rookie-nyx.jpg (the rookie armor sheet), remeshed to 31k tris, Mixamo rig, 2K textures; clips walk/run/idle/combat. The previous Nyx Rift body (with idle/combat stance clips) is kept at nyx-rift-authored.glb" },
  { id: "cipher", category: "operator", status: "A", url: "/models/operators/cipher-authored.glb", note: "Rookie Arcanist: Meshy image-to-3D from docs/reference/rookie-cipher.jpg (the rookie armor sheet), remeshed to 30k tris, Mixamo rig, 2K textures; clips walk/run/idle/combat. The previous Cipher Tech body is kept at cipher-legacy-authored.glb; cipher-hd.glb stays as the procedural-paint source." },
  { id: "modular-armor", category: "operator", status: "B", note: "Starter procedural helmet/chest+pauldron/gauntlet/thigh+shin pieces parented to rig bones (armor-pieces.ts); replaceable by authored GLBs per piece." },
  { id: "frost-wolf", category: "boss", status: "A", url: "/models/bosses/frost-wolf.glb", note: "Baked texture, skinned but zero animation clips; legs are found from the skeleton and walked/galloped procedurally (skeleton-gait.ts)." },
  { id: "fox", category: "nature", status: "A", url: "/models/animals/fox.glb", note: "Khronos sample Fox (model CC0 PixelMannen; rig/animation CC BY 4.0 tomkranis; credited). Clips Survey/Walk/Run driven by ground speed; procedural fox fallback." },
  { id: "wildlife", category: "nature", status: "B", note: "Deer (bucks with antlers), rabbits, songbirds, vultures, fish, snakes, dogs, cats: jointed procedural rigs with distance-driven gaits, grazing/alert head poses and wing beats (Wildlife.tsx); behaviour and placement are pure and tested (wildlife.ts, wildlife-habitat.ts). Replaceable per species by rigged GLBs." },
  { id: "dark-knight", category: "boss", status: "A", url: "/models/bosses/dark-knight.glb", note: "Baked texture, static (no skin, no clips)." },
  { id: "regional-troops", category: "enemy", status: "A", note: "Raiders, Overclocked and Vanguard (regular/elite/boss) are rigged Meshy models generated from the faction sheet with idle/walk/run/shoot clips (public/models/enemies); Aberrations: rigged Viper, static Crawler and Queen. EnemyModel.tsx troopers are the fallback." },
  { id: "npc-a/b/c", category: "civilian", status: "A", note: "Repaired CC0 GLBs walk the Nexus plaza (NexusCity.tsx); regional Civilians.tsx still uses primitives." },
  { id: "shopkeepers", category: "merchant", status: "A", url: "/models/npcs/merchants/", note: "The six sheet merchants (merchant-models.ts) are authored Meshy bodies from docs/reference/merchant-*-front.jpg: ~30k tris, Mixamo rig, 1K textures, walk/run/idle. Other keepers wear the civilian vendor body." },
  { id: "weapons", category: "weapon", status: "D", note: "No weapon models; weapons are data in weapons.ts with procedural viewmodels." },
  { id: "suv/police/truck", category: "vehicle", status: "A", note: "CC0 GLBs used by Vehicle.tsx and NexusCity.tsx." },
  { id: "van/race-future/wheel", category: "vehicle", status: "C", note: "Registered and preloaded; wheel used by Vehicle.tsx, van/race-future not placed." },
  { id: "tower-a/b, block-a/b", category: "building", status: "A", note: "CC0 city blocks used in Nexus/Neon City." },
  { id: "poly-haven-nature", category: "nature", status: "A", note: "Trees, shrubs, fern, boulder, moss rocks, trunk + 6 ground textures, with primitive fallback. Frostspire boulders, swamp dead trunks and forest saplings/brush now use them (docs/realistic-assets.md); wrecks, cacti, reeds and arid rocks are still primitives." },
];

import { ENEMY_MODEL_URLS } from "./enemy-visuals";
ASSET_INVENTORY.push(...ENEMY_MODEL_URLS.map((url, i) => ({ id: `enemy-${i + 1}`, category: "enemy" as const, status: "A" as const, url, note: "Meshy enemy model" })));
export const inspectable = () => ASSET_INVENTORY.filter((a) => a.url);
