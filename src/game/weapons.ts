/** Weapon feel data: guns carry the constant combat rhythm, abilities are the spikes. */
export type WeaponId = "AUTO" | "PULSE" | "HEAVY" | "SWORD";

export type WeaponDef = {
  id: WeaponId;
  name: string;
  kind: "gun" | "sword";
  damage: number; // multiplier on base bullet damage
  fireRate: number; // seconds between trigger pulls
  burst: number; // shots per trigger pull
  burstGap: number;
  spread: number; // radians, hip fire
  adsSpread: number; // multiplier while aiming
  recoil: number; // pitch kick per shot (radians)
  knock: number;
  heat: number;
  punch: number; // camera punch strength
};

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  AUTO: { id: "AUTO", name: "Auto Rifle", kind: "gun", damage: 1, fireRate: 0.11, burst: 1, burstGap: 0, spread: 0.035, adsSpread: 0.35, recoil: 0.006, knock: 0.8, heat: 0.7, punch: 0.6 },
  PULSE: { id: "PULSE", name: "Pulse Rifle", kind: "gun", damage: 1.3, fireRate: 0.42, burst: 3, burstGap: 0.06, spread: 0.02, adsSpread: 0.3, recoil: 0.01, knock: 1, heat: 0.8, punch: 0.8 },
  HEAVY: { id: "HEAVY", name: "Heavy Cannon", kind: "gun", damage: 4.5, fireRate: 0.9, burst: 1, burstGap: 0, spread: 0.01, adsSpread: 0.5, recoil: 0.05, knock: 3.5, heat: 2.2, punch: 3 },
  SWORD: { id: "SWORD", name: "Fracture Blade", kind: "sword", damage: 3.2, fireRate: 0.55, burst: 0, burstGap: 0, spread: 0, adsSpread: 1, recoil: 0, knock: 4, heat: 0, punch: 1.6 },
};

export const WEAPON_ORDER: WeaponId[] = ["AUTO", "PULSE", "HEAVY", "SWORD"];

/** Frame-rate independent spring back for recoil/punch/crosshair bloom. */
export const decay = (v: number, k: number, dt: number) => v * Math.exp(-k * dt);
