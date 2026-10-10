/** Weapon feel data: guns carry the constant combat rhythm, abilities are the spikes. */
import type { DamageElement } from "./scenario-gimmicks";
import type { LauncherId } from "./launchers";
export type WeaponId = "AUTO" | "PULSE" | "HEAVY" | "SWORD" | LauncherId;

export type WeaponDef = {
  id: WeaponId;
  name: string;
  kind: "gun" | "sword" | "launcher";
  /** only some weapons carry an element (Pulse ARC, Heavy THERMAL, the elemental launchers); undefined = no status, legacy behaviour */
  element?: DamageElement;
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
  mag: number; // rounds per magazine (0 = no ammo, melee)
  reserve: number; // starting reserve rounds
  reload: number; // seconds
};

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  AUTO: { id: "AUTO", name: "Auto Rifle", kind: "gun", damage: 1, fireRate: 0.11, burst: 1, burstGap: 0, spread: 0.035, adsSpread: 0.35, recoil: 0.006, knock: 0.8, heat: 0.7, punch: 0.6, mag: 32, reserve: 192, reload: 1.6 },
  PULSE: { id: "PULSE", name: "Pulse Rifle", kind: "gun", damage: 1.3, fireRate: 0.42, burst: 3, burstGap: 0.06, element: "ARC", spread: 0.02, adsSpread: 0.3, recoil: 0.01, knock: 1, heat: 0.8, punch: 0.8, mag: 24, reserve: 144, reload: 1.9 },
  HEAVY: { id: "HEAVY", name: "Heavy Cannon", kind: "gun", element: "THERMAL", damage: 4.5, fireRate: 0.9, burst: 1, burstGap: 0, spread: 0.01, adsSpread: 0.5, recoil: 0.05, knock: 3.5, heat: 2.2, punch: 3, mag: 4, reserve: 20, reload: 2.6 },
  ROCKET: { id: "ROCKET", name: "Breacher Launcher", kind: "launcher", element: "KINETIC", damage: 5, fireRate: 1.3, burst: 1, burstGap: 0, spread: 0.012, adsSpread: 0.5, recoil: 0.06, knock: 4, heat: 3, punch: 3.2, mag: 2, reserve: 10, reload: 3.2 },
  CINDER: { id: "CINDER", name: "Cinder Launcher", kind: "launcher", element: "THERMAL", damage: 4, fireRate: 1.5, burst: 1, burstGap: 0, spread: 0.014, adsSpread: 0.5, recoil: 0.055, knock: 2.5, heat: 3, punch: 3, mag: 2, reserve: 8, reload: 3.4 },
  FROSTBITE: { id: "FROSTBITE", name: "Frostbite Missile", kind: "launcher", element: "CRYO", damage: 4.5, fireRate: 1.8, burst: 1, burstGap: 0, spread: 0.01, adsSpread: 0.6, recoil: 0.05, knock: 2, heat: 3, punch: 2.8, mag: 1, reserve: 6, reload: 3.6 },
  VITRIOL: { id: "VITRIOL", name: "Vitriol Launcher", kind: "launcher", element: "BIO", damage: 3.5, fireRate: 1.5, burst: 1, burstGap: 0, spread: 0.016, adsSpread: 0.5, recoil: 0.05, knock: 1.5, heat: 3, punch: 2.8, mag: 3, reserve: 9, reload: 3.4 },
  SWORD: { id: "SWORD", name: "Fracture Blade", kind: "sword", damage: 3.2, fireRate: 0.55, burst: 0, burstGap: 0, spread: 0, adsSpread: 1, recoil: 0, knock: 4, heat: 0, punch: 1.6, mag: 0, reserve: 0, reload: 0 },
};

export const WEAPON_ORDER: WeaponId[] = ["AUTO", "PULSE", "HEAVY", "SWORD", "ROCKET", "CINDER", "FROSTBITE", "VITRIOL"];

/** Frame-rate independent spring back for recoil/punch/crosshair bloom. */
export const decay = (v: number, k: number, dt: number) => v * Math.exp(-k * dt);

export type AmmoState = Record<WeaponId, { mag: number; reserve: number }>;
export const freshAmmo = (): AmmoState => Object.fromEntries(WEAPON_ORDER.map((id) => [id, { mag: WEAPONS[id].mag, reserve: WEAPONS[id].reserve }])) as AmmoState;
