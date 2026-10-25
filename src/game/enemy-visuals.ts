/**
 * Enemy visual configuration (pure data): which authored model each enemy faction/role wears, its target
 * height in world units, and the animation style. Combat/AI never reads this.
 * Raiders, Overclocked and Vanguard (regular/elite/boss) are generated from the owner's faction sheet
 * (public/refs/enemies), remeshed to ~10k tris and rigged in Meshy with idle/walk/run/shoot clips
 * (public/models/enemies, built by scripts/build-operator-authored.py --base-tex=1024); EnemyModel.tsx blends the clips
 * from real speed/aim (enemy-anim.ts). Skyborn (Legionary / Axiom / Harbinger) come from the owner's Skyborn sheet
 * (docs/reference/enemies-skyborn-wildlife.jpg) the same way. Aberrations come from the same sheet: the Viper is rigged; Crawler and Queen are static meshes with procedural creature motion.
 */
import ch1 from "@/assets/models/enemies/enemy-character.glb.asset.json";
import ch2 from "@/assets/models/enemies/enemy-character-2.glb.asset.json";
import ch3 from "@/assets/models/enemies/enemy-character-3.glb.asset.json";
import ch4 from "@/assets/models/enemies/enemy-character-4.glb.asset.json";
import craw from "@/assets/models/enemies/enemy-fracture-mutated-craw.glb.asset.json";
import warrior from "@/assets/models/enemies/enemy-scifi-armored-warrior.glb.asset.json";
import viper from "@/assets/models/enemies/enemy-silicon-fused-viper.glb.asset.json";

export type EnemyKind = "RAIDER" | "OVERCLOCKED" | "ABERRATION" | "VANGUARD" | "SKYBORN";
export type EnemyRole = "standard" | "elite" | "boss";
export type EnemyVisual = { id: string; url: string; height: number; motion: "biped" | "creature" | "hover"; note: string };

const M = (f: string) => `/models/enemies/${f}.glb`;
const V = {
  raiderRegular: { id: "raider-regular", url: M("raider-regular"), height: 1.85, motion: "biped", note: "Raider (Wastelands) from the faction sheet; rigged" },
  raiderElite: { id: "raider-elite", url: M("raider-elite"), height: 1.95, motion: "biped", note: "Raider Skirmisher; rigged" },
  raiderBoss: { id: "raider-boss", url: M("raider-boss"), height: 2.18, motion: "biped", note: "Raider Warbringer; rigged" },
  ocRegular: { id: "overclocked-regular", url: M("overclocked-regular"), height: 1.85, motion: "biped", note: "Overclocked Operative (Nexus); rigged" },
  ocElite: { id: "overclocked-elite", url: M("overclocked-elite"), height: 1.95, motion: "biped", note: "Overclocked Augmented; rigged" },
  ocBoss: { id: "overclocked-boss", url: M("overclocked-boss"), height: 2.18, motion: "biped", note: "Overclocked Executor; rigged" },
  vgRegular: { id: "vanguard-regular", url: M("vanguard-regular"), height: 1.9, motion: "biped", note: "Vanguard Enforcer (Frostspire); rigged" },
  vgElite: { id: "vanguard-elite", url: M("vanguard-elite"), height: 2.04, motion: "biped", note: "Vanguard Juggernaut; rigged" },
  vgBoss: { id: "vanguard-boss", url: M("vanguard-boss"), height: 2.23, motion: "biped", note: "Vanguard Champion; rigged" },
  abRegular: { id: "aberration-regular", url: M("aberration-regular"), height: 1.33, motion: "creature", note: "Aberration Crawler (Swamps) from the faction sheet; static mesh (Smart Rig, no clips), display base stripped" },
  abElite: { id: "aberration-elite", url: M("aberration-elite"), height: 1.8, motion: "biped", note: "Aberration Viper; rigged walk/run/alert/attack" },
  skyRegular: { id: "skyborn-regular", url: M("skyborn-regular"), height: 2.0, motion: "biped", note: "Skyborn Legionary (Ember Peaks) from the Skyborn sheet; rigged" },
  skyElite: { id: "skyborn-elite", url: M("skyborn-elite"), height: 2.05, motion: "biped", note: "Skyborn Axiom; rigged" },
  skyBoss: { id: "skyborn-boss", url: M("skyborn-boss"), height: 2.3, motion: "biped", note: "Skyborn Harbinger (commander); rigged" },
  abBoss: { id: "aberration-boss", url: M("aberration-boss"), height: 2.56, motion: "creature", note: "Aberration Queen; static mesh" },
  raider: { id: "ember-raider", url: ch3.url, height: 1.85, motion: "biped", note: "orange/black scavenger trooper" },
  overclocked: { id: "nexus-overclocked", url: ch2.url, height: 1.85, motion: "biped", note: "black/red/cyan cyber trooper" },
  vanguard: { id: "frost-crystal-brute", url: ch1.url, height: 2.09, motion: "biped", note: "wide cyan crystal heavy" },
  sandElite: { id: "solara-shard-elite", url: ch4.url, height: 1.95, motion: "biped", note: "tan/blue crystal elite" },
  craw: { id: "fracture-craw", url: craw.url, height: 1.23, motion: "creature", note: "green mutated crawler (static mesh)" },
  viper: { id: "silicon-viper", url: viper.url, height: 1.52, motion: "creature", note: "silicon-fused viper (static mesh)" },
  warrior: { id: "armored-warlord", url: warrior.url, height: 2.56, motion: "biped", note: "armored warrior boss (static mesh)" },
} satisfies Record<string, EnemyVisual>;

export const ENEMY_VISUALS: Record<EnemyKind, Record<EnemyRole, EnemyVisual>> = {
  RAIDER: { standard: V.raiderRegular, elite: V.raiderElite, boss: V.raiderBoss },
  OVERCLOCKED: { standard: V.ocRegular, elite: V.ocElite, boss: V.ocBoss },
  ABERRATION: { standard: V.abRegular, elite: V.abElite, boss: V.abBoss },
  VANGUARD: { standard: V.vgRegular, elite: V.vgElite, boss: V.vgBoss },
  SKYBORN: { standard: V.skyRegular, elite: V.skyElite, boss: V.skyBoss },
};

export const roleOf = (m: { elite: boolean; boss: boolean }): EnemyRole => (m.boss ? "boss" : m.elite ? "elite" : "standard");
export const enemyVisual = (kind: EnemyKind, role: EnemyRole) => ENEMY_VISUALS[kind][role];
/** distinct model ids, for preloading and the asset inspector */
export const ENEMY_MODEL_URLS = [...new Set(Object.values(ENEMY_VISUALS).flatMap((r) => Object.values(r).map((v) => v.url)))];

/** Life size (October 2026 scale pass): trooper heights above are real metres (a regular 1.85 m, elites about 2 m, faction
 * bosses 2.2–2.6 m). The sim's `scale` (0.8–2.5) still drives hit and push radii; on screen it only adds a little bulk, so an
 * elite is a head taller and a region boss towers at about 3.5 m instead of 12 m. */
export const enemyBodyScale = (simScale: number) => 1 + (simScale - 1) * 0.35;
