/** Nexus City outer districts (pure layout, no three.js). The safe-zone hub keeps its authored 26 m radius and dome; this
 * grows the city around it to ~95 m: a street grid of blocks, each split into lots with a building whose height and style
 * come from its district (Spire high-rises to the north, Arcology residential to the west, the Shipyard's industrial
 * sheds to the south, Market commercial to the east), rooftop detail, street lamps and parked cars.
 *
 * Rules: blocks never sit on a supply road, water or steep ground; each building's foundation reaches its lowest corner so
 * nothing floats on a slope; heights fall off with distance from the hub so the skyline reads as a city centre.
 * NexusDistricts.tsx draws it; buildings register as solid obstacles. */
import { REGIONS, NEON_OFFSET } from "./world";
import { heightAt, slopeAt, WATER_LEVEL } from "./terrain";
import { distanceToRoad, LANE_HALF_WIDTH } from "./lanes";
import { mulberry32 } from "./rng";

export const NEXUS = REGIONS.find((r) => r.id === "nexus")!;
export const CITY_INNER = NEXUS.radius + 9;
export const CITY_OUTER = 95;
export const BLOCK = 17;
export const STREET = 7;
export const PITCH = BLOCK + STREET;

export type District = "spire" | "arcology" | "shipyard" | "market";
export type Style = "glass" | "concrete" | "industrial";
export type Building = {
  x: number; z: number; w: number; d: number; yaw: number;
  /** foundation bottom (lowest footprint corner, sunk) and roof height, world y */
  base: number; top: number;
  floors: number; style: Style; district: District;
  /** setback crown: a narrower top section for tall towers */
  crown: boolean; roof: RoofKind;
};
export type RoofKind = "tanks" | "hvac" | "antenna" | "helipad" | "garden" | "none";
export type Lamp = { x: number; z: number; yaw: number };
export type Car = { x: number; z: number; yaw: number; tint: number };
export type Block = { x: number; z: number; district: District; ground: number };

const FLOOR = 3.4;

/** district by bearing from the hub (north = world −z) */
export function districtAt(x: number, z: number): District {
  const a = Math.atan2(x - NEXUS.x, -(z - NEXUS.z)); // 0 = north, +π/2 = east
  if (a > -Math.PI / 4 && a <= Math.PI / 4) return "spire";
  if (a > Math.PI / 4 && a <= (3 * Math.PI) / 4) return "market";
  if (a > -(3 * Math.PI) / 4 && a <= -Math.PI / 4) return "arcology";
  return "shipyard";
}

const NEON = { x: NEXUS.x + NEON_OFFSET.x, z: NEXUS.z + NEON_OFFSET.z };

/** a footprint corner/centre is buildable */
function ground(x: number, z: number): boolean {
  if (heightAt(x, z) < WATER_LEVEL + 0.8) return false;
  if (distanceToRoad(x, z) < LANE_HALF_WIDTH + 2) return false;
  if (Math.hypot(x - NEON.x, z - NEON.z) < 120) return false; // Neon City has its own district
  return true;
}

export function blocks(): Block[] {
  const out: Block[] = [];
  const n = Math.ceil(CITY_OUTER / PITCH);
  for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
    const x = NEXUS.x + i * PITCH, z = NEXUS.z + j * PITCH;
    const d = Math.hypot(x - NEXUS.x, z - NEXUS.z);
    if (d < CITY_INNER + BLOCK * 0.5 || d > CITY_OUTER) continue;
    const h = BLOCK / 2;
    const pts = [[x, z], [x - h, z - h], [x + h, z - h], [x - h, z + h], [x + h, z + h]] as const;
    if (!pts.every(([px, pz]) => ground(px, pz))) continue;
    if (slopeAt(x, z) > 0.4) continue;
    out.push({ x, z, district: districtAt(x, z), ground: Math.min(...pts.map(([px, pz]) => heightAt(px, pz))) });
  }
  return out;
}

const STYLE: Record<District, Style[]> = { spire: ["glass", "glass", "concrete"], market: ["concrete", "glass", "concrete"], arcology: ["concrete", "concrete", "glass"], shipyard: ["industrial", "industrial", "concrete"] };
const FLOORS: Record<District, [number, number]> = { spire: [10, 34], market: [4, 14], arcology: [6, 18], shipyard: [2, 5] };

export function buildings(): Building[] {
  const rnd = mulberry32(0x7e5c);
  const out: Building[] = [];
  for (const b of blocks()) {
    const d = Math.hypot(b.x - NEXUS.x, b.z - NEXUS.z), near = 1 - (d - CITY_INNER) / (CITY_OUTER - CITY_INNER);
    const [lo, hi] = FLOORS[b.district];
    // a tall district block is sometimes one tower filling the block; otherwise a 2×2 of lots
    const single = b.district === "spire" ? rnd() < 0.55 : b.district === "shipyard" ? rnd() < 0.5 : rnd() < 0.2;
    const lots = single ? [{ x: b.x, z: b.z, w: BLOCK - 3, d: BLOCK - 3 }] : [-1, 1].flatMap((sx) => [-1, 1].map((sz) => ({ x: b.x + sx * BLOCK / 4, z: b.z + sz * BLOCK / 4, w: BLOCK / 2 - 2, d: BLOCK / 2 - 2 })));
    for (const lot of lots) {
      if (rnd() < 0.08 && !single) continue; // the odd empty lot (a yard, a car park)
      const floors = Math.max(1, Math.round(lo + (hi - lo) * (0.25 + 0.75 * near) * (0.55 + rnd() * 0.45) * (single ? 1.15 : 1)));
      const style = STYLE[b.district][Math.floor(rnd() * 3)]!;
      const w = lot.w * (0.8 + rnd() * 0.2), dd = lot.d * (0.8 + rnd() * 0.2);
      const hw = w / 2, hd = dd / 2;
      const low = Math.min(heightAt(lot.x - hw, lot.z - hd), heightAt(lot.x + hw, lot.z - hd), heightAt(lot.x - hw, lot.z + hd), heightAt(lot.x + hw, lot.z + hd));
      const high = Math.max(heightAt(lot.x - hw, lot.z - hd), heightAt(lot.x + hw, lot.z - hd), heightAt(lot.x - hw, lot.z + hd), heightAt(lot.x + hw, lot.z + hd));
      const tall = floors >= 14;
      const roofs: RoofKind[] = tall ? ["antenna", "helipad", "tanks"] : style === "industrial" ? ["hvac", "none"] : ["tanks", "hvac", "garden", "none"];
      out.push({
        x: lot.x, z: lot.z, w, d: dd, yaw: 0,
        base: low - 1, top: high + floors * FLOOR,
        floors, style, district: b.district, crown: tall && rnd() < 0.6, roof: roofs[Math.floor(rnd() * roofs.length)]!,
      });
    }
  }
  return out;
}

/** a lamp at every street intersection that is on buildable ground */
export function lamps(): Lamp[] {
  const out: Lamp[] = [];
  const n = Math.ceil(CITY_OUTER / PITCH);
  for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
    const x = NEXUS.x + (i + 0.5) * PITCH, z = NEXUS.z + (j + 0.5) * PITCH;
    const d = Math.hypot(x - NEXUS.x, z - NEXUS.z);
    if (d < CITY_INNER || d > CITY_OUTER) continue;
    if (heightAt(x, z) < WATER_LEVEL + 0.5 || distanceToRoad(x, z) < LANE_HALF_WIDTH) continue;
    out.push({ x: x - STREET * 0.35, z: z - STREET * 0.35, yaw: Math.PI / 4 });
  }
  return out;
}

/** cars parked along block kerbs */
export function parkedCars(): Car[] {
  const rnd = mulberry32(0xca25), out: Car[] = [];
  for (const b of blocks()) {
    if (rnd() < 0.35) continue;
    const side = Math.floor(rnd() * 4), along = (rnd() - 0.5) * (BLOCK - 6), off = BLOCK / 2 + 1.6;
    const [x, z, yaw] = side === 0 ? [b.x + along, b.z - off, Math.PI / 2] : side === 1 ? [b.x + off, b.z + along, 0] : side === 2 ? [b.x + along, b.z + off, Math.PI / 2] : [b.x - off, b.z + along, 0];
    if (heightAt(x, z) < WATER_LEVEL + 0.5 || distanceToRoad(x, z) < LANE_HALF_WIDTH) continue;
    out.push({ x, z, yaw: yaw + (rnd() < 0.5 ? Math.PI : 0), tint: Math.floor(rnd() * 6) });
  }
  return out;
}
