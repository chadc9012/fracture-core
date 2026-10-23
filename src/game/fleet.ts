/** Vehicle fleet and garages (pure). The fleet manual's vehicles are named builds of the vehicles the game already drives
 * (vehicles.ts), so buying one unlocks a real, drivable vehicle through rewardVehicle; tuning nodes change that vehicle's
 * real handling numbers (Scene reads `tunedVehicle`). Garages are base properties in four regions; a fleet vehicle is
 * stored in, and bought at, its home garage.
 *
 * Costs are in materials the game already pays out (vehicle parts, fuel, scrap, alloy, circuits); there is no separate
 * paid currency. Saved as `progression.fleet` (merge: owned/garages union, tuning levels max, newer paint wins). */
import { REGIONS, scaleSite } from "./world";
import { NEON_CENTER } from "./living-world";
import { DOCK_DECK_Y, airlockSite } from "./thalassia-sectors";
import type { MaterialId } from "./inventory";
import { HOLLOW_CROWN } from "./godforge";
import type { VehicleDefinition, VehicleId } from "./vehicles";

export type GarageId = "base-01" | "base-02" | "base-03" | "base-04";
const frost = REGIONS.find((r) => r.id === "frostspire")!;
export const GARAGES: Record<GarageId, { id: GarageId; name: string; region: string; x: number; z: number; /** underwater deck height (Thalassia) */ deckY?: number; /** which region's map lists it (Thalassia sits under the Swamps, like destinations.ts) */ mapRegion: string; cost: Partial<Record<MaterialId, number>>; blurb: string }> = {
  "base-01": { id: "base-01", name: "Wastelands Scrap-Hangar", region: "The Wastelands", mapRegion: "wastelands", ...(() => { const s = scaleSite(12, -6); return { x: s.x + 20, z: s.z - 8 }; })(), cost: { scrapMetal: 40 }, blurb: "Corrugated hangar at Rust Port. Trucks, buggies and rigs." },
  "base-02": { id: "base-02", name: "Neon City Spire Vault", region: "Neon City", mapRegion: "nexus", x: NEON_CENTER.x + 18, z: NEON_CENTER.z - 22, cost: { microCircuits: 20, reinforcedAlloy: 10 }, blurb: "A sealed vault under the Aegis Spire. Aircraft and hover bikes." },
  "base-03": { id: "base-03", name: "Frostspire Bunkered Base", region: "Frostspire Mountains", mapRegion: "frostspire", x: frost.x - frost.radius * 0.2, z: frost.z + frost.radius * 0.35, cost: { reinforcedAlloy: 25, cryoCrystal: 10 }, blurb: "Blast-proof bays cut into the mountain. Heavy armor." },
  // on the Sentry Dock's pressurised deck, beside the airlock (the only dry-footed spot in Thalassia)
  "base-04": { id: "base-04", name: "Thalassia Sub-Dock", region: "Thalassia", mapRegion: "swamps", x: airlockSite().x - 6, z: airlockSite().z - 4, deckY: DOCK_DECK_Y, cost: { dataShards: 12, bioCatalyst: 6 }, blurb: "A pressure dock on the Thalassia shelf. Boats and submersibles." },
};
export const GARAGE_REACH = 6;
export function garageNear(x: number, z: number): GarageId | null {
  for (const g of Object.values(GARAGES)) if (Math.hypot(x - g.x, z - g.z) < GARAGE_REACH) return g.id;
  return null;
}

export type TuneStat = "speed" | "hull" | "handling" | "ram";
export type TuneNode = { id: string; name: string; text: string; stat: TuneStat; perLevel: number; maxLevel: number; cost: Partial<Record<MaterialId, number>> };
export type FleetEntry = {
  id: string; name: string; category: "LAND" | "AIR" | "HEAVY" | "AQUATIC"; base: VehicleId; garage: GarageId;
  cost: Partial<Record<MaterialId, number>>; hardpoints: string[]; ability: string; paints: string[]; nodes: TuneNode[];
};
const node = (id: string, name: string, text: string, stat: TuneStat, perLevel: number, maxLevel: number, cost: Partial<Record<MaterialId, number>>): TuneNode => ({ id, name, text, stat, perLevel, maxLevel, cost });

export const FLEET: readonly FleetEntry[] = [
  { id: "goliath-4x4", name: "Goliath-4x4 Apex", category: "LAND", base: "wasteland-jeep", garage: "base-01", cost: { vehicleParts: 8, scrapMetal: 30 }, hardpoints: ["Roof: 12.7mm auto-turret", "Bumper: kinetic ramming grill"], ability: "Fracture Overcharge (nitro)", paints: ["Rust-Orange Matte", "Stealth Black", "Desert Camo"],
    nodes: [node("engine", "Supercharger", "+6% top speed per stage", "speed", 0.06, 3, { vehicleParts: 3, fuel: 4 }), node("armor", "Composite Shell", "+12% hull per stage", "hull", 0.12, 3, { reinforcedAlloy: 4 }), node("grill", "Ram Grill", "+10% ram per stage", "ram", 0.1, 2, { scrapMetal: 10 })] },
  { id: "behemoth-v16", name: "Behemoth-Crusher V16", category: "LAND", base: "raider-buggy", garage: "base-01", cost: { vehicleParts: 10, reinforcedAlloy: 8 }, hardpoints: ["Top: 20mm autocannon", "Under-chassis flame jets"], ability: "Crush & Trample", paints: ["Rust King Red", "Bone White"],
    nodes: [node("hydraulics", "Hydraulic Lift", "+15% ram per stage", "ram", 0.15, 3, { vehicleParts: 3 }), node("plate", "Scrap Plating", "+10% hull per stage", "hull", 0.1, 3, { scrapMetal: 12 })] },
  { id: "dune-stalker", name: "Dune-Stalker Trike", category: "LAND", base: "aether-hoverbike", garage: "base-01", cost: { vehicleParts: 6, fuel: 10 }, hardpoints: ["Front twin heavy MGs", "Rear mine dropper"], ability: "Dune Leap", paints: ["Sand", "Night Raid"],
    nodes: [node("boost", "Rocket Boost", "+7% top speed per stage", "speed", 0.07, 3, { fuel: 6 }), node("steer", "Dune Steering", "+8% handling per stage", "handling", 0.08, 2, { vehicleParts: 2 })] },
  { id: "aegis-siege", name: "Aegis Siege Breaker", category: "HEAVY", base: "goliath-tank", garage: "base-03", cost: { reinforcedAlloy: 20, vehicleParts: 12, aegisCore: 1 }, hardpoints: ["Turret: 120mm plasma smoothbore", "Pintle: pulse machine gun"], ability: "Fortress Protocol", paints: ["Standard Olive", "Winter Camo", "Fracture Gold"],
    nodes: [node("treads", "All-Terrain Treads", "+8% handling per stage", "handling", 0.08, 2, { vehicleParts: 4 }), node("armor", "Reactive Plating", "+10% hull per stage", "hull", 0.1, 3, { reinforcedAlloy: 6 }), node("drive", "Turbine Drive", "+6% top speed per stage", "speed", 0.06, 2, { fuel: 8 })] },
  { id: "valkyrie-vtol", name: "Valkyrie VTOL-MkII", category: "AIR", base: "rift-helicopter", garage: "base-02", cost: { microCircuits: 14, vehicleParts: 10 }, hardpoints: ["Nose: 30mm rotary cannon", "Pylons: lock-on rocket pods"], ability: "Vector Thruster Pivot", paints: ["Stealth Anodized Black", "Syndicate White", "Cobalt Blue"],
    nodes: [node("ion", "Ion Afterburner", "+7% top speed per stage", "speed", 0.07, 3, { microCircuits: 4, fuel: 4 }), node("gyro", "Gyro Stabiliser", "+8% handling per stage", "handling", 0.08, 2, { microCircuits: 3 })] },
  { id: "ghost-ray", name: "Ghost-Ray Hover Bike", category: "LAND", base: "aether-hoverbike", garage: "base-02", cost: { microCircuits: 10, vehicleParts: 6 }, hardpoints: ["Thermal sniper / pulse array"], ability: "Optical Cloak", paints: ["Ghost Grey", "Neon Magenta"],
    nodes: [node("lift", "Anti-Grav Coils", "+6% top speed per stage", "speed", 0.06, 3, { microCircuits: 3 }), node("frame", "Carbon Frame", "+12% hull per stage", "hull", 0.12, 2, { reinforcedAlloy: 3 })] },
  { id: "f39-jupiter", name: "F-39 Jupiter", category: "AIR", base: "vanguard-jet", garage: "base-02", cost: { microCircuits: 20, aegisCore: 1, vehicleParts: 12 }, hardpoints: ["Arc cannon", "RQ-44 Remora drone dock"], ability: "Suborbital Interdiction", paints: ["Picket Grey", "Strike White"],
    nodes: [node("intake", "Scramjet Intake", "+5% top speed per stage", "speed", 0.05, 3, { fuel: 8 }), node("airframe", "Airframe Bracing", "+10% handling per stage", "handling", 0.1, 2, { reinforcedAlloy: 4 })] },
  { id: "nautilus-abyss", name: "Nautilus Abyss-01", category: "AQUATIC", base: "hydro-sub-skiff", garage: "base-04", cost: { dataShards: 10, vehicleParts: 10, bioCatalyst: 4 }, hardpoints: ["Torpedo bay: sonic torpedoes", "Hull: mining laser"], ability: "Crush-Depth Cavitation", paints: ["Abyssal Yellow", "Deep Sea Navy"],
    nodes: [node("bulkheads", "Titanium Bulkheads", "+12% hull per stage", "hull", 0.12, 3, { reinforcedAlloy: 5 }), node("jets", "Waterjet Turbines", "+7% top speed per stage", "speed", 0.07, 2, { vehicleParts: 3 })] },
  { id: "triton-hydrospear", name: "Triton Hydrospear-9", category: "AQUATIC", base: "scrap-patrol-boat", garage: "base-04", cost: { vehicleParts: 8, fuel: 10 }, hardpoints: ["Micro torpedo racks", "Plasma arc turret"], ability: "Sub-Surface Dive", paints: ["Canal Green", "Harbour Grey"],
    nodes: [node("foils", "Hydrofoils", "+8% top speed per stage", "speed", 0.08, 3, { vehicleParts: 3 }), node("rudder", "Twin Rudders", "+8% handling per stage", "handling", 0.08, 2, { scrapMetal: 10 })] },
  // the owner's vehicle catalogue (October sheet): named builds on the chassis the game already drives, so each one is real and tunable
  { id: "nomad-bike", name: "Nomad Bike", category: "LAND", base: "aether-hoverbike", garage: "base-01", cost: { vehicleParts: 4, fuel: 6 }, hardpoints: ["Bar-mounted twin SMGs"], ability: "Slipstream Lean", paints: ["Rust", "Dust Rider", "Chrome"],
    nodes: [node("throttle", "Short-Shift Throttle", "+7% top speed per stage", "speed", 0.07, 3, { fuel: 4 }), node("forks", "Long-Travel Forks", "+8% handling per stage", "handling", 0.08, 2, { vehicleParts: 2 })] },
  { id: "rift-runner", name: "Rift Runner", category: "LAND", base: "scrap-interceptor", garage: "base-01", cost: { vehicleParts: 6, scrapMetal: 20 }, hardpoints: ["Hood: rift-shot cannon", "Rear: caltrop launcher"], ability: "Rift Boost", paints: ["Rift Violet", "Matte Black", "Hazard Orange"],
    nodes: [node("nitro", "Rift Nitro", "+6% top speed per stage", "speed", 0.06, 3, { fuel: 5 }), node("cage", "Roll Cage", "+10% hull per stage", "hull", 0.1, 3, { scrapMetal: 10 })] },
  { id: "sandstalker-atv", name: "Sandstalker ATV", category: "LAND", base: "wasteland-jeep", garage: "base-01", cost: { vehicleParts: 5, fuel: 8 }, hardpoints: ["Roll bar: light machine gun"], ability: "Dune Grip", paints: ["Sand", "Scorpion", "Ash"],
    nodes: [node("tyres", "Paddle Tyres", "+10% handling per stage", "handling", 0.1, 2, { vehicleParts: 2 }), node("bash", "Bash Plate", "+10% ram per stage", "ram", 0.1, 3, { scrapMetal: 10 })] },
  { id: "void-chaser", name: "Void Chaser", category: "LAND", base: "ai-interceptor", garage: "base-02", cost: { microCircuits: 12, vehicleParts: 8 }, hardpoints: ["Twin void lances", "EMP mine dispenser"], ability: "Phase Dash", paints: ["Void Black", "Neon Teal", "White Noise"],
    nodes: [node("core", "Void Core", "+6% top speed per stage", "speed", 0.06, 3, { microCircuits: 4 }), node("shell", "Phase Shell", "+10% hull per stage", "hull", 0.1, 2, { reinforcedAlloy: 4 })] },
  { id: "civic-rover", name: "Civic Rover", category: "LAND", base: "wasteland-jeep", garage: "base-02", cost: { vehicleParts: 3, scrapMetal: 15 }, hardpoints: ["None — a city runabout"], ability: "Courier Lane", paints: ["Taxi Yellow", "Civic Blue", "Pearl"],
    nodes: [node("eco", "City Tune", "+8% handling per stage", "handling", 0.08, 2, { vehicleParts: 2 }), node("bumper", "Reinforced Bumpers", "+8% hull per stage", "hull", 0.08, 2, { scrapMetal: 8 })] },
  { id: "neon-drift", name: "Neon Drift", category: "LAND", base: "scrap-interceptor", garage: "base-02", cost: { microCircuits: 8, vehicleParts: 6 }, hardpoints: ["Underglow arc emitters"], ability: "Drift Charge", paints: ["Magenta Glow", "Cyan Glow", "Gold Chrome"],
    nodes: [node("diff", "Drift Diff", "+10% handling per stage", "handling", 0.1, 3, { microCircuits: 3 }), node("turbo", "Twin Turbo", "+6% top speed per stage", "speed", 0.06, 3, { fuel: 5 })] },
  { id: "war-rig", name: "War Rig", category: "HEAVY", base: "tech-transport", garage: "base-03", cost: { reinforcedAlloy: 16, vehicleParts: 12 }, hardpoints: ["Cab: flak turret", "Trailer: twin heavy MG nests"], ability: "Convoy Wall", paints: ["Rust Red", "Gunmetal", "Raider Stripes"],
    nodes: [node("plates", "Slab Armor", "+12% hull per stage", "hull", 0.12, 3, { reinforcedAlloy: 6 }), node("ramguard", "Cow Catcher", "+12% ram per stage", "ram", 0.12, 3, { scrapMetal: 14 })] },
  { id: "apex-hauler", name: "Apex Hauler", category: "HEAVY", base: "tech-transport", garage: "base-03", cost: { reinforcedAlloy: 12, vehicleParts: 10, cryoCrystal: 4 }, hardpoints: ["Roof: point-defence laser"], ability: "Cold-Chain Haul", paints: ["Frost White", "Industrial Yellow", "Tech Grey"],
    nodes: [node("drive", "Six-Wheel Drive", "+8% handling per stage", "handling", 0.08, 2, { vehicleParts: 4 }), node("engine", "Diesel-Fracture Hybrid", "+5% top speed per stage", "speed", 0.05, 3, { fuel: 6 })] },
  { id: "skyhawk", name: "Skyhawk", category: "AIR", base: "rift-helicopter", garage: "base-02", cost: { microCircuits: 12, vehicleParts: 8 }, hardpoints: ["Chin: 20mm gun", "Pylons: flare pods"], ability: "Hover Lock", paints: ["Sky Grey", "Rescue Orange", "Night"],
    nodes: [node("rotor", "Composite Rotors", "+7% top speed per stage", "speed", 0.07, 3, { microCircuits: 3 }), node("armor", "Cockpit Armour", "+10% hull per stage", "hull", 0.1, 2, { reinforcedAlloy: 4 })] },
  { id: "riftwing", name: "Riftwing", category: "AIR", base: "vanguard-jet", garage: "base-03", cost: { microCircuits: 16, vehicleParts: 10, cryoCrystal: 6 }, hardpoints: ["Wing-root rift cannons"], ability: "Rift Slipstream", paints: ["Glacier", "Rift Violet", "Carbon"],
    nodes: [node("wing", "Swept Wings", "+8% handling per stage", "handling", 0.08, 2, { reinforcedAlloy: 4 }), node("burner", "Rift Afterburner", "+6% top speed per stage", "speed", 0.06, 3, { fuel: 8 })] },
  { id: "solara-falcon", name: "Solara Falcon", category: "AIR", base: "vanguard-jet", garage: "base-01", cost: { vehicleParts: 10, fuel: 14, microCircuits: 8 }, hardpoints: ["Nose: solar beam", "Wings: rocket rails"], ability: "Sunstrike Dive", paints: ["Desert Gold", "Sunset", "Bone White"],
    nodes: [node("cells", "Solar Cells", "+6% top speed per stage", "speed", 0.06, 3, { microCircuits: 3 }), node("frame", "Heat-Shield Frame", "+10% hull per stage", "hull", 0.1, 2, { reinforcedAlloy: 4 })] },
];
export const fleetById = (id: string) => FLEET.find((f) => f.id === id);

/** Visual-only modifications (stage 53, kept from the uploaded build): saved per owned build, shown on the authored model in
 * the garage preview and on the road. They never change speed, hull, handling or ram. */
export type VehicleCosmetics = { wheels: "standard" | "sport" | "offroad"; body: "stock" | "widebody" | "aero"; spoiler: "none" | "lip" | "wing"; armor: "stock" | "reinforced"; glow: "off" | "cyan" | "magenta" };
export const DEFAULT_VEHICLE_COSMETICS: VehicleCosmetics = { wheels: "standard", body: "stock", spoiler: "none", armor: "stock", glow: "off" };
export const VEHICLE_COSMETIC_OPTIONS: { [K in keyof VehicleCosmetics]: readonly VehicleCosmetics[K][] } = {
  wheels: ["standard", "sport", "offroad"], body: ["stock", "widebody", "aero"], spoiler: ["none", "lip", "wing"], armor: ["stock", "reinforced"], glow: ["off", "cyan", "magenta"],
};
export function normalizeVehicleCosmetics(raw: unknown): VehicleCosmetics {
  const r = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const result = { ...DEFAULT_VEHICLE_COSMETICS };
  for (const key of Object.keys(VEHICLE_COSMETIC_OPTIONS) as (keyof VehicleCosmetics)[]) {
    const value = r[key];
    if (typeof value === "string" && (VEHICLE_COSMETIC_OPTIONS[key] as readonly string[]).includes(value)) (result as Record<string, string>)[key] = value;
  }
  return result;
}
export type FleetState = { owned: string[]; garages: GarageId[]; tuning: Record<string, Record<string, number>>; paint: Record<string, string>; active: string | null; cosmetics?: Record<string, VehicleCosmetics> };
export const EMPTY_FLEET: FleetState = { owned: [], garages: [], tuning: {}, paint: {}, active: null, cosmetics: {} };

export function normalizeFleet(raw: unknown): FleetState {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<FleetState>;
  const ids = (v: unknown) => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string"))] : []);
  const tuning: FleetState["tuning"] = {};
  if (r.tuning && typeof r.tuning === "object") for (const [k, v] of Object.entries(r.tuning)) if (v && typeof v === "object") { tuning[k] = {}; for (const [n, l] of Object.entries(v)) if (typeof l === "number" && l > 0) tuning[k]![n] = Math.floor(l); }
  const paint: FleetState["paint"] = {};
  if (r.paint && typeof r.paint === "object") for (const [k, v] of Object.entries(r.paint)) if (typeof v === "string") paint[k] = v;
  const cosmetics: Record<string, VehicleCosmetics> = {};
  if (r.cosmetics && typeof r.cosmetics === "object") for (const [id, value] of Object.entries(r.cosmetics as Record<string, unknown>)) if (fleetById(id)) cosmetics[id] = normalizeVehicleCosmetics(value);
  return { owned: ids(r.owned).filter((x) => fleetById(x)), garages: ids(r.garages).filter((g): g is GarageId => g in GARAGES), tuning, paint, active: typeof r.active === "string" && fleetById(r.active) ? r.active : null, cosmetics };
}
export function mergeFleet(a: FleetState, b: FleetState, aIsNewer: boolean): FleetState {
  const tuning: FleetState["tuning"] = {};
  for (const src of [a.tuning, b.tuning]) for (const [k, v] of Object.entries(src)) { tuning[k] ??= {}; for (const [n, l] of Object.entries(v)) tuning[k]![n] = Math.max(tuning[k]![n] ?? 0, l); }
  const newer = aIsNewer ? a : b, older = aIsNewer ? b : a;
  return { owned: [...new Set([...a.owned, ...b.owned])], garages: [...new Set([...a.garages, ...b.garages])], tuning, paint: { ...older.paint, ...newer.paint }, active: newer.active ?? older.active, cosmetics: { ...(older.cosmetics ?? {}), ...(newer.cosmetics ?? {}) } };
}

type FleetSave = { fleet: FleetState; materials: Partial<Record<MaterialId, number>>; ownedVehicles: VehicleId[]; garageLoadout: VehicleId[]; selectedVehicle: VehicleId | null };
export type FleetResult<P> = { progression: P; message: string } | { error: string };
function pay<P extends FleetSave>(p: P, cost: Partial<Record<MaterialId, number>>): P | string {
  for (const [k, v] of Object.entries(cost) as [MaterialId, number][]) if ((p.materials[k] ?? 0) < v) return `Needs ${v} ${k} (you have ${p.materials[k] ?? 0})`;
  const materials = { ...p.materials };
  for (const [k, v] of Object.entries(cost) as [MaterialId, number][]) materials[k] = (materials[k] ?? 0) - v;
  return { ...p, materials };
}
const fleetOf = (p: { fleet?: FleetState }) => p.fleet ?? EMPTY_FLEET;

export function buyGarage<P extends FleetSave>(p: P, id: GarageId): FleetResult<P> {
  const f = fleetOf(p);
  if (f.garages.includes(id)) return { error: "You already own this base" };
  const paid = pay(p, GARAGES[id].cost);
  if (typeof paid === "string") return { error: paid };
  return { progression: { ...paid, fleet: { ...f, garages: [...f.garages, id] } }, message: `${GARAGES[id].name} is yours` };
}

/** Buy a fleet vehicle at its home garage: unlocks its base vehicle for driving and makes it the active one. */
export function buyFleetVehicle<P extends FleetSave>(p: P, id: string): FleetResult<P> {
  const e = fleetById(id), f = fleetOf(p);
  if (!e) return { error: "Unknown vehicle" };
  if (f.owned.includes(id)) return { error: "Already in your fleet" };
  if (!f.garages.includes(e.garage)) return { error: `Needs the ${GARAGES[e.garage].name}` };
  const paid = pay(p, e.cost);
  if (typeof paid === "string") return { error: paid };
  const ownedVehicles = paid.ownedVehicles.includes(e.base) ? paid.ownedVehicles : [...paid.ownedVehicles, e.base];
  const garageLoadout = paid.garageLoadout.includes(e.base) ? paid.garageLoadout : [...paid.garageLoadout, e.base].slice(-3);
  return { progression: { ...paid, ownedVehicles, garageLoadout, selectedVehicle: e.base, fleet: { ...f, owned: [...f.owned, id], active: id } }, message: `${e.name} added to your fleet and set as your active vehicle` };
}

export function setActiveFleet<P extends FleetSave>(p: P, id: string): FleetResult<P> {
  const e = fleetById(id), f = fleetOf(p);
  if (!e || !f.owned.includes(id)) return { error: "Not in your fleet" };
  return { progression: { ...p, selectedVehicle: e.base, fleet: { ...f, active: id } }, message: `${e.name} is your active vehicle` };
}

export function tuneNode<P extends FleetSave>(p: P, id: string, nodeId: string): FleetResult<P> {
  const e = fleetById(id), f = fleetOf(p);
  if (!e || !f.owned.includes(id)) return { error: "Not in your fleet" };
  const n = e.nodes.find((x) => x.id === nodeId);
  if (!n) return { error: "Unknown tuning node" };
  const lvl = f.tuning[id]?.[nodeId] ?? 0;
  if (lvl >= n.maxLevel) return { error: `${n.name} is maxed` };
  const paid = pay(p, n.cost);
  if (typeof paid === "string") return { error: paid };
  return { progression: { ...paid, fleet: { ...f, tuning: { ...f.tuning, [id]: { ...(f.tuning[id] ?? {}), [nodeId]: lvl + 1 } } } }, message: `${e.name}: ${n.name} stage ${lvl + 1}` };
}

export function setPaint<P extends FleetSave>(p: P, id: string, paint: string): FleetResult<P> {
  const e = fleetById(id), f = fleetOf(p);
  if (!e || !f.owned.includes(id) || !e.paints.includes(paint)) return { error: "Not available" };
  return { progression: { ...p, fleet: { ...f, paint: { ...f.paint, [id]: paint } } }, message: `${e.name} painted ${paint}` };
}

/** The base vehicle's numbers with the active fleet build's tuning applied (only when the active build uses this base). */
export function tunedVehicle(def: VehicleDefinition, fleet: FleetState | undefined): VehicleDefinition {
  const active = fleet?.active ? fleetById(fleet.active) : undefined;
  if (!active || active.base !== def.id) return def;
  const t = fleet!.tuning[active.id] ?? {};
  const mult: Record<TuneStat, number> = { speed: 1, hull: 1, handling: 1, ram: 1 };
  for (const n of active.nodes) mult[n.stat] += n.perLevel * (t[n.id] ?? 0);
  return { ...def, name: active.name, speed: def.speed * mult.speed, hull: def.hull * mult.hull, handling: def.handling * mult.handling, ram: def.ram * mult.ram };
}

/** Small player sanctuaries: owned garage bases and Vael's forge once its Heart is claimed. Hostiles are pushed out
 * (sim.ts `sanctuaries`) and the player heals as in a safe zone, so a menu opened there is never a death trap. */
export const SANCTUARY_RADIUS = 16;
export function sanctuariesFor(p: { earnedRewards: readonly string[]; fleet?: FleetState | undefined }): { x: number; z: number; radius: number }[] {
  const out: { x: number; z: number; radius: number }[] = [];
  for (const id of p.fleet?.garages ?? []) { const g = GARAGES[id]; if (g && g.deckY === undefined) out.push({ x: g.x, z: g.z - 4, radius: SANCTUARY_RADIUS }); }
  if (p.earnedRewards.includes("godforge:heart")) out.push({ x: HOLLOW_CROWN.x, z: HOLLOW_CROWN.z, radius: HOLLOW_CROWN.radius + 4 });
  return out;
}

/** Visual-only modification of an owned build (saved in progression.fleet.cosmetics). */
export function setVehicleCosmetic<P extends FleetSave, K extends keyof VehicleCosmetics>(p: P, id: string, key: K, value: VehicleCosmetics[K]): FleetResult<P> {
  const e = fleetById(id), f = fleetOf(p);
  if (!e || !f.owned.includes(id)) return { error: "Not in your fleet" };
  if (!(VEHICLE_COSMETIC_OPTIONS[key] as readonly string[]).includes(value)) return { error: "Invalid cosmetic option" };
  const current = normalizeVehicleCosmetics(f.cosmetics?.[id]);
  return { progression: { ...p, fleet: { ...f, cosmetics: { ...(f.cosmetics ?? {}), [id]: { ...current, [key]: value } } } }, message: `${e.name}: ${key} set to ${value}` };
}
