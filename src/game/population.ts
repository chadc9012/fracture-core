/** Regional population roster (pure data + seeded picks): 33 civilian face/voice PROFILES, a distinct keeper profile for each of the 15
 * existing shops, and the regular/elite/boss enemy roster per region, taken from the World Fracture character concept boards.
 *
 * Honesty rules (the boards are concept art, not game assets):
 *  - a civilian "face" is an appearance PROFILE (skin tone, hair, outfit, accessory) applied to whatever civilian model exists. No 33
 *    distinct 3D face models exist; `assetStatus` says so and /dev/assets can list it.
 *  - a voice profile is a distinct delivery direction for the existing server TTS. No 33 recorded voices exist (`voiceStatus`).
 *  - shopkeepers are procedural placeholder figures until authored models exist (`assetStatus`).
 *  - enemy ranks only describe labels and which existing model (enemy-visuals.ts) stands in; combat/AI/loot data is not touched here.
 * Nothing in this file changes stats, prices, stock, drops or AI. */

export type PopulationRegion = "nexus" | "neon" | "thalassia" | "wastelands" | "veridan" | "swamps" | "solara" | "frostspire" | "ember";
export const POPULATION_REGIONS: readonly PopulationRegion[] = ["nexus", "neon", "thalassia", "wastelands", "veridan", "swamps", "solara", "frostspire", "ember"];
export const REGION_LABEL: Record<PopulationRegion, string> = { nexus: "Nexus City", neon: "Neon City", thalassia: "Thalassia", wastelands: "Wastelands", veridan: "Veridan Forest", swamps: "Shrouded Swamps", solara: "Solara Desert", frostspire: "Frostspire Mountains", ember: "Ember Peaks" };
export type AssetStatus = "profile-only" | "procedural-placeholder" | "existing-model" | "temporary-placeholder" | "missing";

/** deterministic, dependency-free hash + rng (this module must stay importable without React) */
export function hashSeed(...parts: (string | number)[]): number {
  let h = 2166136261 >>> 0;
  for (const ch of parts.join("|")) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* ------------------------------ civilians: 33 face + voice profiles ------------------------------ */
export const SKIN_TONES = ["#f2d3b8", "#e0b48f", "#c68e63", "#a8714a", "#8a5a3b", "#6b412b", "#4d2e20", "#d9a78a"] as const;
export const HAIR_STYLES = ["short crop", "long loose", "tied back", "braids", "shaved", "curly", "swept", "hooded", "bun", "mohawk"] as const;
export const HAIR_COLORS = ["#1a1411", "#3b2a1d", "#6b4a2b", "#a07844", "#c9c1b3", "#8a2f1e", "#2a3a5c", "#4c5b3a"] as const;
type Occupation = "commuter" | "worker" | "student" | "security" | "wanderer" | "mechanic" | "trader" | "scavenger" | "researcher" | "engineer" | "settler" | "guide" | "botanist" | "herbalist" | "caravan" | "prospector" | "miner" | "forge-hand" | "diver" | "salvager" | "refugee";
const ACCESSORY: Record<Occupation, string> = {
  commuter: "satchel", worker: "work gloves", student: "data slate", security: "shoulder radio", wanderer: "scarf", mechanic: "tool belt", trader: "ledger tablet", scavenger: "goggles",
  researcher: "field recorder", engineer: "diagnostic wand", settler: "patched cloak", guide: "walking staff", botanist: "sample case", herbalist: "herb pouch", caravan: "dust veil",
  prospector: "scanner pick", miner: "headlamp", "forge-hand": "heat apron", diver: "rebreather", salvager: "salvage hook", refugee: "bundle pack",
};
const REGION_CLOTHING: Record<PopulationRegion, { coat: string; trim: string; note: string }> = {
  nexus: { coat: "#2a3445", trim: "#66e0ff", note: "clean urban tech wear" }, neon: { coat: "#2b2340", trim: "#ff5fd2", note: "street fashion, neon trim" },
  thalassia: { coat: "#16394a", trim: "#4fd1c5", note: "pressure-rated layers" }, wastelands: { coat: "#5a4630", trim: "#d9822b", note: "patched salvage leathers" },
  veridan: { coat: "#3d5230", trim: "#a3d977", note: "field-research greens" }, swamps: { coat: "#33402f", trim: "#9ccf4a", note: "waxed marsh gear" },
  solara: { coat: "#a98a58", trim: "#f0c987", note: "layered desert wraps" }, frostspire: { coat: "#33425c", trim: "#cfe6ff", note: "fur-lined cold weather" }, ember: { coat: "#4a2a24", trim: "#ff7a3c", note: "heat-treated work wear" },
};

export type VoiceProfile = { id: string; pitch: number; pace: number; timbre: "warm" | "dry" | "bright" | "gravelly" | "soft" | "crisp"; /** the delivery direction handed to the existing TTS */ direction: string; voiceStatus: "synthesized-fallback" };
const TIMBRES: VoiceProfile["timbre"][] = ["warm", "dry", "bright", "gravelly", "soft", "crisp"];
export type CivilianProfile = {
  id: string; name: string; region: PopulationRegion; occupation: Occupation;
  skin: string; hair: string; hairColor: string; accessory: string; coat: string; trim: string; voiceId: string;
  assetStatus: "profile-only";
};
const CIVILIAN_TABLE: readonly [string, PopulationRegion, Occupation][] = [
  ["Mara Okoye", "nexus", "commuter"], ["Tomas Reyes", "nexus", "worker"], ["Ilyan Voss", "nexus", "student"], ["Sera Lindqvist", "nexus", "security"], ["Dev Anand", "nexus", "engineer"],
  ["Juno Park", "neon", "student"], ["Kade Mercer", "neon", "trader"], ["Rhea Castillo", "neon", "worker"], ["Nix Abara", "neon", "commuter"],
  ["Orla Finch", "wastelands", "scavenger"], ["Brannock", "wastelands", "mechanic"], ["Zeke Tallow", "wastelands", "trader"], ["Hana Duarte", "wastelands", "wanderer"],
  ["Dr. Ines Halvard", "frostspire", "researcher"], ["Piotr Sable", "frostspire", "engineer"], ["Yuki Anders", "frostspire", "settler"],
  ["Wren Alder", "swamps", "guide"], ["Mother Tamsin", "swamps", "herbalist"], ["Cole Bracken", "swamps", "refugee"],
  ["Amara Sol", "solara", "caravan"], ["Idris Kaleb", "solara", "prospector"], ["Safiya Noor", "solara", "mechanic"],
  ["Elio Fenn", "veridan", "botanist"], ["Briar Voss", "veridan", "guide"], ["Lena Moss", "veridan", "researcher"], ["Gus Hartwell", "veridan", "settler"],
  ["Cinder Roake", "ember", "miner"], ["Maeve Ashby", "ember", "forge-hand"], ["Taro Vale", "ember", "prospector"],
  ["Nerea Tide", "thalassia", "diver"], ["Calder Brine", "thalassia", "salvager"], ["Dr. Isla Marek", "thalassia", "researcher"], ["Oren Keel", "thalassia", "worker"],
];
export const CIVILIAN_COUNT = 33;
export const VOICE_PROFILES: readonly VoiceProfile[] = Array.from({ length: CIVILIAN_COUNT }, (_, i) => {
  const timbre = TIMBRES[i % TIMBRES.length]!;
  const pitch = Math.round((0.82 + (i * 7 % CIVILIAN_COUNT) * (0.36 / (CIVILIAN_COUNT - 1))) * 100) / 100;
  const pace = Math.round((0.9 + (i * 7 % 9) * 0.03) * 100) / 100;
  return { id: `voice-${String(i + 1).padStart(2, "0")}`, pitch, pace, timbre, direction: `${timbre} timbre, pitch ${pitch}, pace ${pace}, a grounded survivor`, voiceStatus: "synthesized-fallback" as const };
});
export const CIVILIAN_PROFILES: readonly CivilianProfile[] = CIVILIAN_TABLE.map(([name, region, occupation], i) => {
  const cloth = REGION_CLOTHING[region];
  return {
    id: `civ-${String(i + 1).padStart(2, "0")}`, name, region, occupation,
    skin: SKIN_TONES[(i * 5) % SKIN_TONES.length]!, hair: HAIR_STYLES[(i * 7) % HAIR_STYLES.length]!, hairColor: HAIR_COLORS[(i * 3 + 1) % HAIR_COLORS.length]!,
    accessory: ACCESSORY[occupation], coat: cloth.coat, trim: cloth.trim, voiceId: VOICE_PROFILES[i]!.id, assetStatus: "profile-only" as const,
  };
});
export const civilianById = (id: string) => CIVILIAN_PROFILES.find((c) => c.id === id);
export const voiceById = (id: string) => VOICE_PROFILES.find((v) => v.id === id);
/** which face "key" a profile has; two profiles never share it */
export const faceKey = (c: CivilianProfile) => `${c.skin}|${c.hair}|${c.hairColor}`;

/** Stable per (region, seed) picks. Never places the same profile twice in a row; reloads give the same crowd. Falls back to the
 * nearest-region pool shape (all profiles) only if a region has none. */
export function civilianPicks(region: PopulationRegion, count: number, seed = 0): CivilianProfile[] {
  const own = CIVILIAN_PROFILES.filter((c) => c.region === region);
  const pool = own.length ? own : [...CIVILIAN_PROFILES];
  const rand = rng(hashSeed("civ", region, seed));
  const out: CivilianProfile[] = [];
  let bag: CivilianProfile[] = [];
  while (out.length < count) {
    if (!bag.length) { bag = [...pool]; for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [bag[i], bag[j]] = [bag[j]!, bag[i]!]; } if (out.length && bag.length > 1 && bag[0]!.id === out[out.length - 1]!.id) bag.push(bag.shift()!); }
    out.push(bag.shift()!);
  }
  return out;
}

/* ------------------------------ shopkeepers: one per existing shop ------------------------------ */
export type KeeperRole = "weapons-dealer" | "armorer" | "tech-specialist" | "general-store" | "material-trader" | "vehicle-dealer" | "relic-curator" | "gunsmith" | "alliance-quartermaster";
export type ShopkeeperProfile = {
  shopId: string; name: string; role: KeeperRole; title: string; region: PopulationRegion;
  coat: string; accent: string; skin: string; tools: string; personality: string; greeting: string; assetStatus: "procedural-placeholder";
};
const K = (shopId: string, name: string, role: KeeperRole, title: string, region: PopulationRegion, coat: string, accent: string, skin: string, tools: string, personality: string, greeting: string): ShopkeeperProfile =>
  ({ shopId, name, role, title, region, coat, accent, skin, tools, personality, greeting, assetStatus: "procedural-placeholder" });
export const SHOPKEEPERS: readonly ShopkeeperProfile[] = [
  K("nexus-armory", "Quartermaster Ostrander", "weapons-dealer", "Nexus Weapons Specialist", "nexus", "#2b3340", "#ff7a3c", SKIN_TONES[3]!, "weapon racks, tactical harness", "Regulation first, no haggling", "Everything on this rack is registered. Pick one."),
  K("nexus-plate", "Armorer Delphine Cray", "armorer", "Bastion Fittings Armorer", "nexus", "#39424f", "#66e0ff", SKIN_TONES[1]!, "plate stand, fitting gauges", "Precise, proud of her seams", "Stand still. I'll tell you what fits."),
  K("nexus-calibration", "Calibrator Ruiz", "gunsmith", "Range Calibrator", "nexus", "#2a2f38", "#ffd27a", SKIN_TONES[2]!, "bench vise, optics loupe", "Quiet, obsessed with tolerances", "Bring me what's rattling. I'll find why."),
  K("nexus-outfitter", "Wen Halloran", "general-store", "Field Outfitter", "nexus", "#2f3f33", "#8fe08a", SKIN_TONES[0]!, "supply crates, kit satchels", "Cheerful, remembers every loadout", "Mission kits, patch kits, fuel. What's the job?"),
  K("neon-dealer", "Vex", "weapons-dealer", "Neon Street Dealer", "neon", "#2b2340", "#ff5fd2", SKIN_TONES[4]!, "hidden-holster coat, neon case", "Fast-talking, never gives a real name", "Civilian-legal. Mostly. What do you need?"),
  K("neon-mods", "Glitch Marisol", "tech-specialist", "Mod Tinkerer", "neon", "#1f2a44", "#c86bff", SKIN_TONES[7]!, "diagnostic goggles, solder arm", "Playful, talks to the circuits", "Infusions, tunings, small miracles. Sit."),
  K("thal-curator", "Curator Ilesh Marr", "relic-curator", "Thalassia Armor Curator", "thalassia", "#16394a", "#4fd1c5", SKIN_TONES[5]!, "display cases, pressure seals", "Reverent, wary of the surface", "These were made before the water. Handle them as such."),
  K("waste-trader", "Rust-Jaw Tolliver", "material-trader", "Rust Port Trader", "wastelands", "#5a4630", "#d9822b", SKIN_TONES[6]!, "salvage hooks, cargo nets", "Gruff, fair, hates waste", "Scrap, fuel, patch kits. Coin or metal."),
  K("waste-garage", "Mechanic Sal Okonkwo", "vehicle-dealer", "Rust-Runner Garage Chief", "wastelands", "#3b3226", "#e8f4ff", SKIN_TONES[3]!, "wrench rig, grease apron", "Loud, loves a rebuilt engine", "Bring it in. I'll make it ugly and fast."),
  K("veridan-broker", "Botanist Fenwick Aldous", "material-trader", "Grove Research Broker", "veridan", "#3d5230", "#a3d977", SKIN_TONES[0]!, "sample cases, glass vials", "Gentle, absent-minded, precise about spores", "Careful with the jars. They're alive."),
  K("swamp-relics", "Hag-Mother Vesper", "relic-curator", "Bog Relic Dealer", "swamps", "#262f3a", "#9ccf4a", SKIN_TONES[5]!, "toxin flasks, respirator hood", "Cryptic, tells the truth sideways", "Relics remember. Buy the ones that remember kindly."),
  K("solara-heavy", "Sergeant Kaleb Dunmore", "weapons-dealer", "Dune Heavy-Arms Specialist", "solara", "#7a6540", "#f0c987", SKIN_TONES[4]!, "launcher rack, ammo drums", "Blunt, ex-convoy, loves big bangs", "Go big or go home. Mostly big."),
  K("solara-garage", "Technician Zahra Quill", "vehicle-dealer", "Convoy Workshop Technician", "solara", "#8a7448", "#ffb347", SKIN_TONES[2]!, "plating jacks, welding visor", "Dry humor, reinforcement evangelist", "Plating, mounts, reinforcement. Pick your armor, not your enemies."),
  K("frost-research", "Gearmaster Anselm Rime", "gunsmith", "Spire Gearmaster", "frostspire", "#33425c", "#cfe6ff", SKIN_TONES[0]!, "calibration frames, frost-proof gloves", "Patient, speaks in measurements", "Cold metal tells the truth. Show me your rifle."),
  K("ember-alliance", "Forge-Warden Ashka Veyr", "alliance-quartermaster", "Ember Alliance Quartermaster", "ember", "#4a2a24", "#ff7a3c", SKIN_TONES[6]!, "forge tongs, alliance seal", "Proud, tests people before selling", "The Alliance arms those who've earned it. Have you?"),
];
export const keeperFor = (shopId: string) => SHOPKEEPERS.find((k) => k.shopId === shopId);

/* ------------------------------ enemies: regular / elite / boss per region ------------------------------ */
export type EnemyRank = "regular" | "elite" | "boss";
export type EnemyFactionId = "RAIDER" | "OVERCLOCKED" | "VANGUARD" | "ABERRATION";
export const FACTION_LABEL: Record<EnemyFactionId, string> = { RAIDER: "Raiders", OVERCLOCKED: "Overclocked", VANGUARD: "Vanguard", ABERRATION: "Aberrations" };
export const ENEMY_NAMES: Record<EnemyFactionId, Record<EnemyRank, string>> = {
  RAIDER: { regular: "Raider Trooper", elite: "Skirmisher", boss: "Warbringer" },
  OVERCLOCKED: { regular: "Tactical Operative", elite: "Augmented Elite", boss: "Executor" },
  VANGUARD: { regular: "Crystal Enforcer", elite: "Frost Juggernaut", boss: "Vanguard Champion" },
  ABERRATION: { regular: "Fracture Crawler", elite: "Silicon Viper", boss: "Aberration Queen" },
};
/** Which existing model stands in for each rank (mirrors enemy-visuals.ts) and whether it is the intended unique design. The boards show
 * unique elites/bosses for most factions; where only a reused model exists the status says so. */
export const ENEMY_MODEL_STATUS: Record<EnemyFactionId, Record<EnemyRank, { model: string; status: AssetStatus; note: string }>> = {
  RAIDER: { regular: { model: "ember-raider", status: "existing-model", note: "orange/black trooper" }, elite: { model: "solara-shard-elite", status: "temporary-placeholder", note: "tan/blue elite reused; Skirmisher design not authored" }, boss: { model: "armored-warlord", status: "temporary-placeholder", note: "Warbringer not authored; Armored Warrior stands in" } },
  OVERCLOCKED: { regular: { model: "nexus-overclocked", status: "existing-model", note: "black/red/cyan trooper" }, elite: { model: "nexus-overclocked", status: "temporary-placeholder", note: "Augmented Elite not authored; regular model scaled" }, boss: { model: "armored-warlord", status: "temporary-placeholder", note: "Executor not authored; Armored Warrior stands in" } },
  VANGUARD: { regular: { model: "frost-crystal-brute", status: "existing-model", note: "cyan crystal brute" }, elite: { model: "frost-crystal-brute", status: "temporary-placeholder", note: "Frost Juggernaut not authored" }, boss: { model: "armored-warlord", status: "temporary-placeholder", note: "Champion not authored; Armored Warrior stands in" } },
  ABERRATION: { regular: { model: "fracture-craw", status: "existing-model", note: "green mutated crawler (static mesh)" }, elite: { model: "silicon-viper", status: "existing-model", note: "silicon-fused viper (static mesh)" }, boss: { model: "silicon-viper", status: "temporary-placeholder", note: "Queen not authored; Viper stands in" } },
};
/** Region -> faction. Regions the boards give no faction for return null: no enemy models exist for them and that is reported, not faked. */
export const REGION_FACTION: Record<PopulationRegion, EnemyFactionId | null> = { nexus: "OVERCLOCKED", neon: "OVERCLOCKED", thalassia: null, wastelands: "RAIDER", veridan: null, swamps: "ABERRATION", solara: "RAIDER", frostspire: "VANGUARD", ember: null };
export function enemyProfile(region: PopulationRegion, rank: EnemyRank) {
  const faction = REGION_FACTION[region];
  if (!faction) return { region, rank, faction: null, name: `${REGION_LABEL[region]} ${rank} (no authored enemy)`, model: null, status: "missing" as AssetStatus, note: "no enemy faction or model authored for this region yet" };
  const m = ENEMY_MODEL_STATUS[faction][rank];
  return { region, rank, faction, name: ENEMY_NAMES[faction][rank], model: m.model, status: m.status, note: m.note };
}

/** Everything /dev/assets needs in one list (profiles, status, assignment). */
export function populationAudit() {
  return {
    civilians: CIVILIAN_PROFILES.map((c) => ({ id: c.id, name: c.name, region: c.region, status: c.assetStatus, voice: c.voiceId })),
    voices: { total: VOICE_PROFILES.length, status: "synthesized-fallback" as const },
    keepers: SHOPKEEPERS.map((k) => ({ shopId: k.shopId, name: k.name, role: k.role, status: k.assetStatus })),
    enemies: POPULATION_REGIONS.flatMap((r) => (["regular", "elite", "boss"] as const).map((rank) => enemyProfile(r, rank))),
  };
}
