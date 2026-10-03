/* Hosted CC0 model URLs. NPC copies have their missing external color maps removed. */
import npcA from "@/assets/models/npc-a-repaired.glb.asset.json";
import npcB from "@/assets/models/npc-b-repaired.glb.asset.json";
import npcC from "@/assets/models/npc-c-repaired.glb.asset.json";

export const MODELS = {
  block_a: "/__l5e/assets-v1/67e47f03-75d9-4efe-b2ce-f3ee07cf02f2/block-a.glb",
  block_b: "/__l5e/assets-v1/07ffecaf-c36d-4fac-ab3f-012562dda640/block-b.glb",
  npc_a: npcA.url,
  npc_b: npcB.url,
  npc_c: npcC.url,
  police: "/__l5e/assets-v1/e28351df-4c60-45b1-b6a3-ec9e905feb04/police.glb",
  race_future: "/__l5e/assets-v1/1b1e563b-b63e-4d7e-b485-f83cd08d2270/race-future.glb",
  suv: "/__l5e/assets-v1/00592969-a097-4816-9c4f-3e788f8921ee/suv.glb",
  tower_a: "/__l5e/assets-v1/18d6c1cc-423e-4d06-8467-2e055bb55caf/tower-a.glb",
  tower_b: "/__l5e/assets-v1/5092d44c-5549-41c4-b51a-f3e216886c1b/tower-b.glb",
  truck: "/__l5e/assets-v1/6c088128-5442-434b-b5ed-3ccbc6d52326/truck.glb",
  van: "/__l5e/assets-v1/c0075348-1bc6-4e67-81dd-990ce9905412/van.glb",
  wheel: "/__l5e/assets-v1/95ab0f27-e0d2-453c-8486-229d401f5cc0/wheel.glb",
} as const;
// Note: an earlier "nature-kit" tree/rock GLB pack (hosted off a third-party GitHub repo via
// jsdelivr) was removed from here — the repo never actually contained a nature-kit directory,
// so every one of those seven URLs 404'd. They weren't wired into Terrain.tsx, but Vehicle.tsx
// preloads every entry in MODELS unconditionally, so they were still a live black-screen risk
// identical to the Poly Haven rock URLs that already took the world down once. World props are
// now built as noise-deformed procedural geometry instead (see src/game/organic-geometry.ts),
// which carries no load-time failure mode at all.

export type ModelKey = keyof typeof MODELS;
