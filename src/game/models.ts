/* Hosted CC0 model URLs, always read from their .asset.json so they match what scripts/bundle-hosted-assets.mjs puts in the
 * APK (Nov 9: nine of these were hand-pasted ids from an older upload, so the APK asked for files it never had and the
 * traffic, police, garages and two tower kinds were missing on the phone). NPC copies have their missing external color
 * maps removed. */
import npcA from "@/assets/models/npc-a-repaired.glb.asset.json";
import npcB from "@/assets/models/npc-b-repaired.glb.asset.json";
import npcC from "@/assets/models/npc-c-repaired.glb.asset.json";
import blockAAsset from "@/assets/models/block-a.glb.asset.json";
import blockBAsset from "@/assets/models/block-b.glb.asset.json";
import policeAsset from "@/assets/models/police.glb.asset.json";
import raceFutureAsset from "@/assets/models/race-future.glb.asset.json";
import suvAsset from "@/assets/models/suv.glb.asset.json";
import towerAAsset from "@/assets/models/tower-a.glb.asset.json";
import towerBAsset from "@/assets/models/tower-b.glb.asset.json";
import truckAsset from "@/assets/models/truck.glb.asset.json";
import vanAsset from "@/assets/models/van.glb.asset.json";

export const MODELS = {
  block_a: blockAAsset.url,
  block_b: blockBAsset.url,
  npc_a: npcA.url,
  npc_b: npcB.url,
  npc_c: npcC.url,
  police: policeAsset.url,
  race_future: raceFutureAsset.url,
  suv: suvAsset.url,
  tower_a: towerAAsset.url,
  tower_b: towerBAsset.url,
  truck: truckAsset.url,
  van: vanAsset.url,
  /** authored for this game (scripts/build-vehicles.py): off-road tyre on a beadlock rim, same size/axle as the kit wheel */
  wheel: "/models/vehicles/wheel-offroad.glb",
  /** authored Scrap-Built Interceptor body (scripts/build-vehicles.py); wheels come from <Car> */
  interceptor: "/models/vehicles/interceptor.glb",
} as const;
// Note: an earlier "nature-kit" tree/rock GLB pack (hosted off a third-party GitHub repo via
// jsdelivr) was removed from here — the repo never actually contained a nature-kit directory,
// so every one of those seven URLs 404'd. They weren't wired into Terrain.tsx, but Vehicle.tsx
// preloads every entry in MODELS unconditionally, so they were still a live black-screen risk
// identical to the Poly Haven rock URLs that already took the world down once. World props are
// now built as noise-deformed procedural geometry instead (see src/game/organic-geometry.ts),
// which carries no load-time failure mode at all.

export type ModelKey = keyof typeof MODELS;
