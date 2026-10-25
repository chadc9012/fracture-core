/** Which merchants and enemy groups from the owner's reference sheets belong in which region (pure data, no gameplay change).
 * The sheets name some homes outright (merchant locations, wildlife regions); the rest are placed by what each sheet's own text
 * says about where the group lives. Every placement carries its reason so it can be argued with.
 *
 * Honest limits: this decides WHERE, it does not add models, shops or spawns. A group with no authored enemy model, or a merchant
 * with no shop to stand at, says so (`built` / `shopId: null`). population.ts REGION_FACTION still decides what actually spawns. */
import type { PopulationRegion } from "./population";

export type Merchant = {
  id: string; name: string; role: string; region: PopulationRegion; place: string;
  /** the existing regionalShop this character now keeps; null = no such shop exists yet */
  shopId: string | null; reason: string;
};
export const REFERENCE_MERCHANTS: readonly Merchant[] = [
  { id: "selene-voss", name: "Selene Voss", role: "Armor Merchant / Fabricator", region: "nexus", place: "Voss Armorworks, Nexus City", shopId: "nexus-plate", reason: "Sheet places her in Nexus City; Bastion Fittings is the Nexus armor shop." },
  { id: "jax-kane", name: "Jax \"Trigger\" Kane", role: "Weapons Merchant / Gunsmith", region: "nexus", place: "Kane Arms, Nexus City", shopId: "nexus-armory", reason: "Sheet places him in Nexus City; the Nexus Armory is the Nexus weapons shop." },
  { id: "cruz-mendez", name: "Cruz \"Gearshift\" Mendez", role: "Vehicle Merchant / Customization", region: "nexus", place: "The Drive Hub, Nexus City", shopId: null, reason: "Sheet places him at the Nexus Drive Hub, but Nexus has no vehicle shop (vehicle shops are in the Wastelands and Solara). Needs a Nexus vehicle shop." },
  { id: "rafiq-kaleem", name: "Rafiq \"Sands\" Kaleem", role: "Exotic Merchant / Rare Goods", region: "solara", place: "Dune Gate Outpost, Solara Desert", shopId: null, reason: "Sheet places him at the Solara Dune Gate Outpost; Solara's two shops are heavy arms and a garage, so exotics and artifacts need their own shop." },
];

export type EnemyGroupId = "raiders" | "shadeborn" | "nexus-forces" | "wildlife" | "ancient-guardians" | "abyssal" | "skyborn" | "aberrations";
export type EnemyGroup = {
  id: EnemyGroupId; name: string;
  /** regions where it spawns or is encountered, primary first */
  regions: readonly PopulationRegion[];
  /** only inside fracture zones / anomaly sites within those regions, not roaming the open map */
  zonesOnly?: boolean;
  /** the population.ts faction that already exists for it, if any */
  existingFaction?: "RAIDER" | "OVERCLOCKED" | "ABERRATION";
  reason: string;
};
export const ENEMY_GROUPS: readonly EnemyGroup[] = [
  { id: "raiders", name: "Fracture Raiders", regions: ["wastelands", "solara"], existingFaction: "RAIDER", reason: "Sheet: found in deserts, ruins and abandoned cities. Matches the Raider regions already in the game." },
  { id: "nexus-forces", name: "Nexus Forces", regions: ["nexus", "neon"], existingFaction: "OVERCLOCKED", reason: "Sheet: the organization that enforces order with advanced tech. They hold the two safe-zone cities." },
  { id: "aberrations", name: "Fracture Aberrations", regions: ["swamps"], zonesOnly: true, existingFaction: "ABERRATION", reason: "Sheet: rare, born from fracture anomalies. Kept to the swamp anomaly sites where they already live." },
  { id: "shadeborn", name: "Shadeborn", regions: ["veridan", "swamps", "ember", "wastelands", "thalassia", "frostspire", "solara"], zonesOnly: true, reason: "Sheet: found in fracture zones across all regions, so every wild region, but only inside fracture zones. Not the two safe cities." },
  { id: "ancient-guardians", name: "Ancient Guardians", regions: ["solara", "thalassia", "ember"], reason: "Sheet: constructs guarding ancient locations. Solara's obelisk ruins, Thalassia's pre-flood ark city and Ember's old forge sites." },
  { id: "abyssal", name: "Abyssal", regions: ["thalassia"], reason: "Sheet: ocean-depth creatures adapted to Thalassia's pressure. Thalassia only." },
  { id: "skyborn", name: "Skyborn", regions: ["frostspire", "ember"], reason: "Sheet: aerial faction near mountains, floating islands and fracture storms. Frostspire's peaks first, Ember's storms second." },
  { id: "wildlife", name: "Wildlife", regions: ["solara", "veridan", "frostspire", "thalassia", "wastelands", "ember"], reason: "Sheet names Dune Stalker and Thunder Beast for Solara, Verdant Prowler for Verdant Forest, Ice Leviathan for Frostspire and Thalassia Beast for Thalassia; Stone Herd is listed for multiple regions, placed in the dry regions." },
];

/** Named wildlife the sheet pins to one region; Stone Herd is the shared herd creature. */
export const WILDLIFE_BY_REGION: Partial<Record<PopulationRegion, readonly string[]>> = {
  solara: ["Dune Stalker", "Thunder Beast", "Stone Herd"],
  veridan: ["Verdant Prowler"],
  frostspire: ["Ice Leviathan"],
  thalassia: ["Thalassia Beast"],
  wastelands: ["Stone Herd"],
  ember: ["Stone Herd"],
};

export const groupsInRegion = (r: PopulationRegion) => ENEMY_GROUPS.filter((g) => g.regions.includes(r));
export const merchantsInRegion = (r: PopulationRegion) => REFERENCE_MERCHANTS.filter((m) => m.region === r);
