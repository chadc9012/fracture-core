/** Vehicle Foundry: weaponization kits with trade-offs (owner's foundry brief, Oct 25: four fabrication hubs where every vehicle
 * can be weaponized with pros and cons, so you build a fast glass cannon or a slow armoured killing machine).
 *
 * The four fleet garages (fleet.ts) are the four hubs, each with its foundry name: the Wastelands Scrap-Hangar is the Chop Shop
 * (cars and bikes), the Frostspire bunker is the Armory Bastion (heavy armour), the Thalassia Sub-Dock is the Abyssal Drydock
 * (boats and subs) and the Neon City Spire Vault is the Aero-Garrison (aircraft and hover bikes). At its home hub an owned
 * fleet build fits one kit; the kit scales the build's handling numbers (fleet.ts tunedVehicle) and its guns
 * (vehicle-weapons.ts armamentFor). Pure. Saved as `fleet.kits[buildId]`; installing costs materials and swapping back to
 * Stock is free. */
import type { GarageId, TuneStat } from "./fleet";
import type { MaterialId } from "./inventory";

export const FOUNDRY_HUB: Record<GarageId, { name: string; focus: string }> = {
  "base-01": { name: "The Chop Shop", focus: "Cars & bikes" },
  "base-02": { name: "Aero-Garrison", focus: "Aircraft & gunships" },
  "base-03": { name: "Armory Bastion", focus: "Military heavy vehicles" },
  "base-04": { name: "Abyssal Drydock", focus: "Submersibles & boats" },
};

export type KitId = "stock" | "heavy-ordnance" | "rapid-fire" | "armored" | "stripped" | "ram-cage";
export type Kit = {
  id: KitId; name: string; pros: string; cons: string;
  /** handling multipliers (1 = unchanged) */
  stats: Partial<Record<TuneStat, number>>;
  /** gun multipliers: damage per round, seconds between rounds, heat per round */
  gun: { damage: number; rate: number; heat: number };
  cost: Partial<Record<MaterialId, number>>;
};
const k = (id: KitId, name: string, pros: string, cons: string, stats: Kit["stats"], gun: Partial<Kit["gun"]>, cost: Kit["cost"]): Kit => ({ id, name, pros, cons, stats, gun: { damage: 1, rate: 1, heat: 1, ...gun }, cost });

export const KITS: readonly Kit[] = [
  k("stock", "Stock", "Balanced factory fit", "No edge anywhere", {}, {}, {}),
  k("heavy-ordnance", "Heavy Ordnance", "+60% damage per round", "Slower to fire, -10% top speed, -8% handling", { speed: 0.9, handling: 0.92 }, { damage: 1.6, rate: 1.35, heat: 1.2 }, { vehicleParts: 6, reinforcedAlloy: 6 }),
  k("rapid-fire", "Rapid-Fire Feed", "Fires 40% faster", "-15% damage per round, runs hotter, -10% hull", { hull: 0.9 }, { damage: 0.85, rate: 0.6, heat: 1.25 }, { vehicleParts: 5, microCircuits: 6 }),
  k("armored", "Armour Plating", "+35% hull, +15% ram", "-12% top speed, -10% handling", { hull: 1.35, ram: 1.15, speed: 0.88, handling: 0.9 }, {}, { reinforcedAlloy: 10, scrapMetal: 20 }),
  k("stripped", "Stripped Racer", "+12% top speed, +12% handling", "-30% hull, -20% damage", { speed: 1.12, handling: 1.12, hull: 0.7 }, { damage: 0.8 }, { vehicleParts: 4, fuel: 8 }),
  k("ram-cage", "Ram Cage", "+45% ram, +10% hull", "-6% top speed, guns fire 15% slower", { ram: 1.45, hull: 1.1, speed: 0.94 }, { rate: 1.15 }, { scrapMetal: 30, vehicleParts: 3 }),
];
export const kitById = (id: string | undefined): Kit => KITS.find((x) => x.id === id) ?? KITS[0]!;

/** the multiplier a kit applies to one handling stat */
export const kitStat = (kit: Kit, stat: TuneStat) => kit.stats[stat] ?? 1;

/** a gun scaled by a kit (only the fields a kit touches) */
export function kitGun<G extends { damage: number; rate: number; heat: number }>(g: G, kit: Kit): G {
  if (kit.id === "stock") return g;
  return { ...g, damage: g.damage * kit.gun.damage, rate: g.rate * kit.gun.rate, heat: g.heat * kit.gun.heat };
}
