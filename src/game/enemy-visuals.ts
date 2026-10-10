/**
 * Enemy visual configuration (pure data): which authored model each enemy faction/role wears, its target
 * height in world units, and the animation style. Combat/AI never reads this. The models are the user's
 * Meshy GLBs, textures downsized to 1024 WebP (viper decimated from ~2M to ~8.5k tris). The rigged ones use
 * generic Bone_### skeletons with no clips, so motion is procedural (gait bob/lean) until clips exist.
 */
import ch1 from "@/assets/models/enemies/enemy-character.glb.asset.json";
import ch2 from "@/assets/models/enemies/enemy-character-2.glb.asset.json";
import ch3 from "@/assets/models/enemies/enemy-character-3.glb.asset.json";
import ch4 from "@/assets/models/enemies/enemy-character-4.glb.asset.json";
import craw from "@/assets/models/enemies/enemy-fracture-mutated-craw.glb.asset.json";
import warrior from "@/assets/models/enemies/enemy-scifi-armored-warrior.glb.asset.json";
import viper from "@/assets/models/enemies/enemy-silicon-fused-viper.glb.asset.json";

export type EnemyKind = "RAIDER" | "OVERCLOCKED" | "ABERRATION" | "VANGUARD";
export type EnemyRole = "standard" | "elite" | "boss";
export type EnemyVisual = { id: string; url: string; height: number; motion: "biped" | "creature" | "hover"; note: string };

const V = {
  raider: { id: "ember-raider", url: ch3.url, height: 3.9, motion: "biped", note: "orange/black scavenger trooper" },
  overclocked: { id: "nexus-overclocked", url: ch2.url, height: 3.9, motion: "biped", note: "black/red/cyan cyber trooper" },
  vanguard: { id: "frost-crystal-brute", url: ch1.url, height: 4.4, motion: "biped", note: "wide cyan crystal heavy" },
  sandElite: { id: "solara-shard-elite", url: ch4.url, height: 4.1, motion: "biped", note: "tan/blue crystal elite" },
  craw: { id: "fracture-craw", url: craw.url, height: 2.6, motion: "creature", note: "green mutated crawler (static mesh)" },
  viper: { id: "silicon-viper", url: viper.url, height: 3.2, motion: "creature", note: "silicon-fused viper (static mesh)" },
  warrior: { id: "armored-warlord", url: warrior.url, height: 5.4, motion: "biped", note: "armored warrior boss (static mesh)" },
} satisfies Record<string, EnemyVisual>;

export const ENEMY_VISUALS: Record<EnemyKind, Record<EnemyRole, EnemyVisual>> = {
  RAIDER: { standard: V.raider, elite: V.sandElite, boss: V.warrior },
  OVERCLOCKED: { standard: V.overclocked, elite: V.overclocked, boss: V.warrior },
  ABERRATION: { standard: V.craw, elite: V.viper, boss: V.viper },
  VANGUARD: { standard: V.vanguard, elite: V.sandElite, boss: V.warrior },
};

export const roleOf = (m: { elite: boolean; boss: boolean }): EnemyRole => (m.boss ? "boss" : m.elite ? "elite" : "standard");
export const enemyVisual = (kind: EnemyKind, role: EnemyRole) => ENEMY_VISUALS[kind][role];
/** distinct model ids, for preloading and the asset inspector */
export const ENEMY_MODEL_URLS = [...new Set(Object.values(V).map((v) => v.url))];
