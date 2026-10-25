/** Everyday civilian life across the destinations (owner, Ambient Life & Beaches pass 15): office workers, shoppers,
 * clubgoers, hikers, miners, scrap buyers… dressed and talking for where they live, on top of the named roster in
 * Civilians.tsx (never replacing it). They use the existing civilian wander/greet/flee AI and role bodies; `clothing`
 * and `line` are their art direction and greeting, carried into the spec's lore.
 *
 * Beachgoers stand where the land really meets water: `beachSpots` walks out from a coastal region to its first shoreline,
 * keeps a gentle dry stretch just above the waterline, and puts a couple of people there (with a patch of sand under them,
 * CoastalBeaches.tsx). A region whose shore is all cliff, or that has no shore in reach, gets none.
 *
 * Thalassia's profiles are kept but not spawned in the open world: its people live on the dome decks under the sea, and
 * the walker AI only knows the terrain surface (it would stand them on the seabed outside the domes).
 *
 * Pure apart from reading the terrain. */
import type { CivilianRole, CivilianSpec } from "./civilians";
import { REGIONS } from "./world";
import { NEON_CENTER } from "./living-world";
import { THALASSIA_CENTER } from "./thalassia-site";
import { WATER_LEVEL, heightAt } from "./terrain";
import { COASTLINE_ENABLED, cliffiness } from "./coastline";

export type AmbientActivity = "commuting" | "shopping" | "nightlife" | "working" | "beach" | "travelling";
export type AmbientCivilian = {
  id: string; region: string; name: string; role: CivilianRole; title: string;
  activity: AmbientActivity; clothing: string; line: string; dx: number; dz: number;
};

export const AMBIENT_CIVILIANS: readonly AmbientCivilian[] = [
  { id: "nx-office-01", region: "nexus", name: "Office Commuter", role: "OBSERVER", title: "Transit Passenger", activity: "commuting", clothing: "Slate blazer, holo-pass, practical shoes", line: "The shuttle is late again.", dx: 25, dz: -16 },
  { id: "nx-shop-01", region: "nexus", name: "Arcade Shopper", role: "VENDOR", title: "Market Customer", activity: "shopping", clothing: "Casual layered jacket and shopping sling", line: "I'm comparing prices. Everything's gone up.", dx: 58, dz: 6 },
  { id: "nx-dock-02", region: "nexus", name: "Cargo Driver", role: "ENGINEER", title: "Dock Freight Worker", activity: "working", clothing: "Reflective vest, utility boots, driving gloves", line: "Delivery lane's blocked. Give me a minute.", dx: 12, dz: 57 },
  { id: "nx-evening-01", region: "nexus", name: "After-Shift Local", role: "ARTISAN", title: "Lounge Regular", activity: "nightlife", clothing: "Relaxed streetwear with luminous cuff", line: "Best part of my day starts after work.", dx: -17, dz: -20 },
  { id: "ne-club-01", region: "neon", name: "Clubgoer", role: "OBSERVER", title: "Nightlife Regular", activity: "nightlife", clothing: "Iridescent bomber, LED shoes, chrome earrings", line: "You here for the music or the crowd?", dx: 18, dz: -12 },
  { id: "ne-club-02", region: "neon", name: "Door Host", role: "ENGINEER", title: "Club Queue Attendant", activity: "nightlife", clothing: "Black tailored security coat and neon earpiece", line: "Keep the entrance clear, please.", dx: 21, dz: -16 },
  { id: "ne-shop-01", region: "neon", name: "Street Shopper", role: "VENDOR", title: "Night Market Customer", activity: "shopping", clothing: "Oversized neon raincoat and shoulder bag", line: "There's a repair stall around the corner.", dx: -11, dz: 19 },
  { id: "ne-commute-01", region: "neon", name: "Shift Commuter", role: "OBSERVER", title: "Transit Rider", activity: "commuting", clothing: "Weatherproof techwear, transit pass, headset", line: "Last train's in ten. I should move.", dx: 31, dz: 14 },
  { id: "vd-trail-01", region: "veridan", name: "Trail Hiker", role: "OBSERVER", title: "Forest Visitor", activity: "travelling", clothing: "Light hiking shell, daypack and gaiters", line: "I came for the view, stayed for the quiet.", dx: 19, dz: 7 },
  { id: "vd-camp-01", region: "veridan", name: "Camp Cook", role: "ARTISAN", title: "Outpost Cook", activity: "working", clothing: "Green work shirt, canvas apron and boots", line: "Stew's ready when the sun goes down.", dx: -12, dz: 9 },
  { id: "so-market-01", region: "solara", name: "Oasis Trader", role: "VENDOR", title: "Desert Bazaar Shopper", activity: "shopping", clothing: "Breathable sand wraps and copper sun visor", line: "Shade first. Business second.", dx: 15, dz: 8 },
  { id: "so-travel-01", region: "solara", name: "Convoy Traveller", role: "OBSERVER", title: "Roadside Traveller", activity: "travelling", clothing: "Dust cloak, hydration pack and goggles", line: "We travel at dawn. Too hot by noon.", dx: -18, dz: -7 },
  { id: "fr-visitor-01", region: "frostspire", name: "Mountain Tourist", role: "OBSERVER", title: "Snow Lodge Guest", activity: "travelling", clothing: "Puffy blue parka, knit cap, snow boots", line: "I thought the wind would be less fierce.", dx: 16, dz: 10 },
  { id: "fr-worker-01", region: "frostspire", name: "Lift Mechanic", role: "ENGINEER", title: "Cable Lift Crew", activity: "working", clothing: "Orange insulated coveralls, safety harness", line: "Don't step under the cable.", dx: -14, dz: 7 },
  { id: "em-worker-01", region: "ember", name: "Shift Miner", role: "SCAVENGER", title: "Volcanic Quarry Worker", activity: "working", clothing: "Heat shield suit, charcoal helmet", line: "Cooling break. Even the tools overheat.", dx: 12, dz: -9 },
  { id: "em-travel-01", region: "ember", name: "Ash Route Courier", role: "OBSERVER", title: "Supply Runner", activity: "travelling", clothing: "Ashproof poncho and respirator", line: "Road's open until the next eruption.", dx: -13, dz: 9 },
  { id: "wa-shop-01", region: "wastelands", name: "Scrap Customer", role: "VENDOR", title: "Salvage Market Shopper", activity: "shopping", clothing: "Patchwork coat, dusty satchel and work boots", line: "That part's worth more if it still works.", dx: 16, dz: 11 },
  { id: "wa-road-01", region: "wastelands", name: "Convoy Mechanic", role: "ENGINEER", title: "Roadside Repair Crew", activity: "working", clothing: "Reinforced overalls, welding visor", line: "Keep the engine running. Don't linger.", dx: -14, dz: -8 },
  { id: "sw-local-01", region: "swamps", name: "Marsh Resident", role: "OBSERVER", title: "Boardwalk Walker", activity: "travelling", clothing: "Waterproof hood, knee-high boots", line: "Watch where the boards get dark.", dx: 12, dz: 7 },
  { id: "sw-trade-01", region: "swamps", name: "Reed Merchant", role: "VENDOR", title: "Wetland Stallkeeper", activity: "shopping", clothing: "Waxed coat and sealed produce satchel", line: "Fresh reeds, dry bundles. Take your pick.", dx: -11, dz: 9 },
  { id: "th-market-01", region: "thalassia", name: "Dome Shopper", role: "VENDOR", title: "Aquatic Market Visitor", activity: "shopping", clothing: "Pearl-gray hydrofabric coat and sealed tote", line: "Surface fruit is a luxury down here.", dx: 12, dz: 8 },
  { id: "th-commute-01", region: "thalassia", name: "Tunnel Commuter", role: "OBSERVER", title: "Undersea Transit Rider", activity: "commuting", clothing: "Blue pressure-knit jacket and clear visor", line: "Next tram connects to the east dome.", dx: -12, dz: -7 },
];

/** destinations whose people are not walked on the terrain surface (see the header) */
export const OFF_SURFACE_REGIONS: ReadonlySet<string> = new Set(["thalassia"]);

/** the centre a profile's offset is measured from */
export function regionCentre(region: string): { x: number; z: number } | null {
  if (region === "neon") return NEON_CENTER;
  if (region === "thalassia") return THALASSIA_CENTER;
  const r = REGIONS.find((v) => v.id === region);
  return r ? { x: r.x, z: r.z } : null;
}

/** dry, walkable ground (not water, not the shoreline wash) */
const dry = (x: number, z: number) => heightAt(x, z) > WATER_LEVEL + 0.4;
/** a new home must not crowd an existing one (the named roster, other ambient people) */
const MIN_SPACING = 4;

/** the surface people as civilian specs: skips off-surface destinations, wet ground and homes on top of someone else's */
export function ambientCivilianSpecs(existing: readonly { homeX: number; homeZ: number }[] = []): CivilianSpec[] {
  const taken = existing.map((e) => ({ x: e.homeX, z: e.homeZ }));
  const out: CivilianSpec[] = [];
  for (const a of AMBIENT_CIVILIANS) {
    if (OFF_SURFACE_REGIONS.has(a.region)) continue;
    const c = regionCentre(a.region);
    if (!c) continue;
    const x = c.x + a.dx, z = c.z + a.dz;
    if (!dry(x, z) || taken.some((t) => Math.hypot(t.x - x, t.z - z) < MIN_SPACING)) continue;
    taken.push({ x, z });
    out.push({ id: a.id, name: a.name, role: a.role, title: a.title, lore: `${a.line} (${a.clothing}.)`, homeX: x, homeZ: z });
  }
  return out;
}

/* ---------- beaches ---------- */

/** coastal destinations that get beachgoers where their shore is a real beach */
export const BEACH_REGIONS = ["veridan", "swamps", "solara", "wastelands"] as const;
/** a beachgoer's post sits this far inland of the waterline, so their wander (<= 9 m) reaches the water's edge, not the deep */
const POST_INLAND = 9;
/** the shore must rise less than this (metres above the water) 10 m inland of the edge: a beach, not a bank */
const GENTLE_RISE = 3;
const SPOT_SPACING = 70;
const SPOTS_PER_REGION = 2;
const BEARINGS = 96;

/** `x,z` is the post (dry sand); `edgeX,edgeZ` the waterline; `yaw` faces the water */
export type BeachSpot = { region: string; x: number; z: number; edgeX: number; edgeZ: number; yaw: number };

/** Gentle shore where the land really meets water, found by walking out from each coastal region along evenly spaced
 * bearings until the terrain first dips under the water, stepping back to the dry edge, and keeping it only if the ground
 * behind rises gently (most of the world's water is edged by banks, which get no beachgoers). Works on whatever makes the
 * shore: the painted coastline at world scale 4, the landform's own seas and lakes otherwise. Deterministic. */
export function beachSpots(): BeachSpot[] {
  const out: BeachSpot[] = [];
  for (const id of BEACH_REGIONS) {
    const r = REGIONS.find((v) => v.id === id);
    if (!r) continue;
    let n = 0;
    for (let i = 0; i < BEARINGS && n < SPOTS_PER_REGION; i++) {
      const a = (i / BEARINGS) * Math.PI * 2, ux = Math.cos(a), uz = Math.sin(a);
      const at = (d: number) => heightAt(r.x + ux * d, r.z + uz * d);
      let wet = -1;
      for (let d = r.radius * 0.5; d < r.radius * 4; d += 2) if (at(d) < WATER_LEVEL) { wet = d; break; }
      if (wet < 0) continue;
      let e = wet;
      while (e > 0 && at(e) < WATER_LEVEL + 0.6) e -= 0.5;
      if (at(e - 10) >= WATER_LEVEL + GENTLE_RISE || at(e - POST_INLAND) <= WATER_LEVEL + 0.4) continue;
      const x = r.x + ux * (e - POST_INLAND), z = r.z + uz * (e - POST_INLAND);
      if (COASTLINE_ENABLED && cliffiness(x, z) >= 0.3) continue;
      if (!out.every((p) => Math.hypot(p.x - x, p.z - z) > SPOT_SPACING)) continue;
      out.push({ region: id, x, z, edgeX: r.x + ux * e, edgeZ: r.z + uz * e, yaw: Math.atan2(ux, uz) });
      n++;
    }
  }
  return out;
}

const BEACHGOERS: readonly { name: string; role: CivilianRole; title: string; clothing: string; line: string }[] = [
  { name: "Beachgoer", role: "OBSERVER", title: "Day Off by the Water", clothing: "Swim shorts, open linen shirt, sandals", line: "First clear sky in weeks. I'm not moving." },
  { name: "Shore Vendor", role: "VENDOR", title: "Cold Drinks Seller", clothing: "Sun hat, cooler bag, rolled-up trousers", line: "Cold drinks! Filtered water, no ash in it." },
];

/** two beachgoers per beach spot: a sunbather and a drinks seller */
export function beachgoerSpecs(spots: readonly BeachSpot[] = beachSpots()): CivilianSpec[] {
  return spots.flatMap((s, i) => BEACHGOERS.map((b, j) => ({
    id: `beach-${s.region}-${i}-${j}`, name: b.name, role: b.role, title: b.title,
    lore: `${b.line} (${b.clothing}.)`,
    // the second stands 5 m along the shore from the first
    homeX: s.x + Math.cos(s.yaw) * 5 * j, homeZ: s.z - Math.sin(s.yaw) * 5 * j,
  })));
}
