/** Nexus City Residences (owner's concept sheets, Nov 1 2026: "Nexus City Residences — Player Apartment Building" and
 * "Nexus City Apartment — Player Home, Starting Residence"): the player's apartment tower in Nexus City, as walk-in floors.
 *
 * Floors, as on the sheet's Building Overview: L Main Lobby & Reception (front desk, lounge, mail room), 11 Resident
 * Amenities (lounge and game room, movie theater), 12 Fitness / Wellness (gym, pool, hot tub), 12-04 the player's
 * apartment (the sheet's floor plan: living room, bedroom, kitchen / dining, bathroom, storage / utility, balcony with the
 * city view, a personal PC and a workout corner) and R the Rooftop Lounge & Sky Deck. Each floor is a pocket room like
 * every interior (interiors.ts): an elevator bank on each floor rides to every other floor, and only the lobby has a
 * street door. The apartment is the starting residence: always open, no purchase.
 *
 * Pure layout data, no three.js: boxes in each floor's local frame (residences.ts Box: origin at the floor's centre, y up,
 * +z toward the street door), the elevator pads, collision walls for every partition and large piece of furniture, and
 * the apartment's interaction spots. Rendered by NexusResidences.tsx; tested in nexus-residences.test.ts. */
import type { Box } from "./residences";
import type { Wall } from "./walls";

export type ResidenceFloorId = "nexus-apartment" | "nexus-tower-lounge" | "nexus-res-fitness" | "nexus-res-1204" | "nexus-res-roof";
/** what you can do at a spot in the apartment (GameCanvas shows the button, Scene / the panels do it) */
export type SpotAction = "rest" | "pc" | "tv" | "stash" | "wardrobe" | "workout" | "radio";
export type Spot = { id: string; action: SpotAction; label: string; x: number; z: number; r: number };
export type ResidenceFloor = {
  id: ResidenceFloorId;
  /** the sheet's floor code (L, 11, 12, 12-04, R) */
  code: string;
  name: string;
  /** the room's half extents (metres): you walk inside ±hx, ±hz */
  hx: number; hz: number;
  /** where the room sits, far from every other interior (200 m apart, so a balcony's skyline never shows a neighbour) */
  origin: { x: number; z: number };
  /** open to the sky (the roof) */
  open?: boolean;
  /** a lit skyline outside its glass (north, -z) */
  skyline?: boolean;
  floorColor: string; wallColor: string; ceilingColor: string;
  /** the room's own light colour */
  light: string;
  npcName?: string;
  npcAt?: { x: number; z: number };
  /** which wall the elevator bank stands on: the west wall, or the south wall by the apartment's front door */
  bank: "west" | "south";
  /** where you arrive from the elevator */
  arrive: { x: number; z: number };
};

export const FLOOR_ORDER: readonly ResidenceFloorId[] = ["nexus-apartment", "nexus-res-1204", "nexus-tower-lounge", "nexus-res-fitness", "nexus-res-roof"];
const COLUMN_X = 3600;
const FLOORS_RAW: Omit<ResidenceFloor, "origin" | "arrive" | "bank">[] = [
  { id: "nexus-apartment", code: "L", name: "Nexus City Residences · Main Lobby", hx: 9, hz: 7, floorColor: "#cfc9c0", wallColor: "#3a3240", ceilingColor: "#1e1a24", light: "#ffe2b8", npcName: "Mara, off-shift Vanguard tech", npcAt: { x: 4.5, z: 2.2 } },
  { id: "nexus-res-1204", code: "12-04", name: "Nexus City Residences · Apartment 1204", hx: 8, hz: 6, skyline: true, floorColor: "#6b5a4a", wallColor: "#2c2a30", ceilingColor: "#1c1b20", light: "#ffd9b0" },
  { id: "nexus-tower-lounge", code: "11", name: "Nexus City Residences · Floor 11 Resident Lounge", hx: 9, hz: 7, skyline: true, floorColor: "#3a3442", wallColor: "#2a2533", ceilingColor: "#17141d", light: "#d9b8ff", npcName: "Sky Lounge concierge", npcAt: { x: 6.5, z: 4.5 } },
  { id: "nexus-res-fitness", code: "12", name: "Nexus City Residences · Floor 12 Fitness & Pool", hx: 10, hz: 7, skyline: true, floorColor: "#8a8f96", wallColor: "#2f3238", ceilingColor: "#1a1c20", light: "#e4f1ff" },
  { id: "nexus-res-roof", code: "R", name: "Nexus City Residences · Rooftop Sky Deck", hx: 10, hz: 8, open: true, skyline: true, floorColor: "#5a5048", wallColor: "#2f2c33", ceilingColor: "#000000", light: "#ffcf9a" },
];
/** the elevator bank: one pad per other floor, 2.4 m apart, along the west wall (the apartment: by its front door, south) */
export const PAD_R = 1.0;
const bankOf = (id: string): "west" | "south" => (id === "nexus-res-1204" ? "south" : "west");
const arriveAt = (f: { hx: number; hz: number }, bank: "west" | "south") => (bank === "west" ? { x: -f.hx + 3.9, z: 0 } : { x: 0, z: f.hz - 3.4 });
export const FLOORS: readonly ResidenceFloor[] = FLOORS_RAW.map((f, i) => ({ ...f, origin: { x: COLUMN_X, z: i * 200 }, bank: bankOf(f.id), arrive: arriveAt(f, bankOf(f.id)) }));
export const residenceFloor = (id: string | null | undefined): ResidenceFloor | null => FLOORS.find((f) => f.id === id) ?? null;

/** the elevator pads on a floor: one to every other floor, in building order, centred on z 0 */
export function elevatorPads(id: ResidenceFloorId): { to: ResidenceFloorId; pad: { x: number; z: number }; label: string }[] {
  const f = residenceFloor(id)!, others = FLOOR_ORDER.filter((o) => o !== id);
  return others.map((to, k) => {
    const t = residenceFloor(to)!, along = (k - (others.length - 1) / 2) * 2.4;
    return { to, pad: f.bank === "west" ? { x: -f.hx + 1.3, z: along } : { x: along, z: f.hz - 1.3 }, label: `Lift · ${t.code} · ${t.name.split(" · ")[1]}` };
  });
}

/* ---------------- geometry ---------------- */

const S = (x: number, y: number, z: number, sx: number, sy: number, sz: number, color: string, surface?: Box["surface"]): Box => (surface ? { x, y, z, sx, sy, sz, color, mat: "solid", surface } : { x, y, z, sx, sy, sz, color, mat: "solid" });
const G = (x: number, y: number, z: number, sx: number, sy: number, sz: number, color: string): Box => ({ x, y, z, sx, sy, sz, color, mat: "glass" });
const L = (x: number, y: number, z: number, sx: number, sy: number, sz: number, color: string): Box => ({ x, y, z, sx, sy, sz, color, mat: "lamp" });
/** a box standing on the floor: y given as its height */
const on = (x: number, z: number, sx: number, h: number, sz: number, color: string, surface?: Box["surface"]) => S(x, h / 2, z, sx, h, sz, color, surface);
const PURPLE = "#b06bff", CYAN = "#6fd8ff", WARM = "#ffdcae", DARK = "#1d1c22", LEATHER = "#2a2624", STEEL = "#8a9096", WOOD = "#6a4a34", PLANT = "#3f7a3a", POT = "#3a3634";
const plant = (x: number, z: number, h = 1.4): Box[] => [on(x, z, 0.55, 0.5, 0.55, POT), S(x, 0.5 + h / 2, z, 0.8, h, 0.8, PLANT)];

/** the shell: floor, ceiling, walls with a glass north wall where there is a skyline; the street door gap in the lobby */
function shell(f: ResidenceFloor): Box[] {
  const { hx, hz } = f, H = 3.6, out: Box[] = [];
  out.push(S(0, -0.05, 0, hx * 2, 0.1, hz * 2, f.floorColor, f.id === "nexus-res-roof" ? "stone" : undefined));
  if (!f.open) out.push(S(0, H + 0.05, 0, hx * 2, 0.1, hz * 2, f.ceilingColor));
  if (f.open) {
    // the roof: a parapet with a glass balustrade all round
    for (const s of [-1, 1]) { out.push(on(0, s * hz, hx * 2, 0.5, 0.3, f.wallColor), G(0, 0.95, s * hz, hx * 2, 0.9, 0.06, "#9fc4d8")); out.push(on(s * hx, 0, 0.3, 0.5, hz * 2, f.wallColor), G(s * hx, 0.95, 0, 0.06, 0.9, hz * 2, "#9fc4d8")); }
    return out;
  }
  // west and east walls
  for (const s of [-1, 1]) out.push(on(s * hx, 0, 0.3, H, hz * 2, f.wallColor));
  // north: glass to the skyline (mullions every 2 m), or a solid wall
  if (f.skyline) {
    out.push(G(0, H / 2, -hz, hx * 2, H, 0.08, "#4a6a84"));
    for (let x = -hx; x <= hx + 0.01; x += 2) out.push(on(x, -hz, 0.12, H, 0.16, DARK));
    out.push(on(0, -hz, hx * 2, 0.12, 0.3, DARK), S(0, H - 0.06, -hz, hx * 2, 0.12, 0.3, DARK));
  } else out.push(on(0, -hz, hx * 2, H, 0.3, f.wallColor));
  // south: the lobby's street doors (a 3.6 m gap at x 0) or a solid wall with the apartment's front door
  if (f.id === "nexus-apartment") {
    for (const s of [-1, 1]) out.push(on(s * (hx + 1.8) / 2, hz, hx - 1.8, H, 0.3, f.wallColor));
    out.push(S(0, H - 0.4, hz, 3.6, 0.8, 0.3, f.wallColor));
  } else out.push(on(0, hz, hx * 2, H, 0.3, f.wallColor));
  return out;
}

/** the elevator bank on the west wall: steel doors behind each pad, a lit call sign */
function bank(f: ResidenceFloor): Box[] {
  const out: Box[] = [];
  for (const p of elevatorPads(f.id)) {
    if (f.bank === "west") out.push(on(-f.hx + 0.2, p.pad.z, 0.12, 2.5, 1.5, STEEL), L(-f.hx + 0.28, 2.75, p.pad.z, 0.04, 0.18, 0.9, CYAN));
    else out.push(on(p.pad.x, f.hz - 0.2, 1.5, 2.5, 0.12, STEEL), L(p.pad.x, 2.75, f.hz - 0.28, 0.9, 0.18, 0.04, CYAN));
  }
  return out;
}

const LOBBY: Box[] = [
  // reception: a long stone desk with a purple light line, the Residences wall behind it with its shield emblem
  on(2, -4.6, 5.2, 1.1, 1.0, "#d9d3c8", "stone"), L(2, 1.12, -4.08, 5.2, 0.05, 0.05, PURPLE),
  on(2, -6.7, 7, 3.6, 0.2, "#2b2433"), L(2, 3.05, -6.55, 0.9, 0.9, 0.04, PURPLE), L(2, 1.3, -6.55, 3.4, 0.12, 0.04, WARM),
  // the lounge: two sofas round a low table on a rug
  S(-1.5, 0.01, 1.5, 5, 0.02, 3.6, "#4a4252"), on(-1.5, 0.2, 2.6, 0.75, 0.9, "#3b3640"), on(-1.5, 2.9, 2.6, 0.75, 0.9, "#3b3640"), on(-1.5, 1.55, 1.4, 0.4, 0.8, "#2a2228"),
  // chandelier: three lit rings under the ceiling
  L(1, 3.1, -0.5, 3.2, 0.06, 0.06, WARM), L(1, 3.1, -0.5, 0.06, 0.06, 3.2, WARM), L(1, 3.25, -0.5, 1.8, 0.06, 1.8, WARM),
  // the mail room along the east wall: a wall of package lockers and mailboxes, a kiosk
  on(8.6, -2, 0.5, 2.4, 4.2, "#5c5f66"), L(8.32, 2.5, -2, 0.03, 0.12, 4, CYAN), on(8.4, 2.6, 0.8, 1.6, 0.8, "#2b2f36"), L(8.0, 1.2, 2.6, 0.02, 0.5, 0.4, CYAN),
  ...plant(-7.4, -6), ...plant(7.6, -6), ...plant(-2.6, 6.2, 1.1), ...plant(2.6, 6.2, 1.1),
];

/** Apartment 1204, after the sheet's floor plan: bedroom north-west, bathroom and storage south-west, the open living
 * room north and centre, kitchen / dining south-east, the front door south, the balcony north beyond the glass. */
const APT_WALL = "#3a363c";
const APARTMENT: Box[] = [
  // partitions: bedroom (x -8..-2.4, z -6..-0.6) with a door gap; bathroom (x -8..-4.4, z -0.6..2.6); storage (x -8..-4.4, z 2.6..6)
  on(-2.4, -4.6, 0.14, 3.6, 2.8, APT_WALL), on(-2.4, -0.95, 0.14, 3.6, 0.7, APT_WALL),
  on(-6.3, -0.6, 3.4, 3.6, 0.14, APT_WALL), on(-4.4, 1, 0.14, 3.6, 3.2, APT_WALL), on(-6.2, 2.6, 3.6, 3.6, 0.14, APT_WALL), on(-4.4, 4.9, 0.14, 3.6, 2.2, APT_WALL),
  // living room: sectional sofa facing the TV wall, coffee table, rug, the TV with a glowing screen and a media unit
  S(2, 0.01, -2.4, 5.6, 0.02, 3.8, "#5a5048"),
  // the sectional faces the TV (west): its long run along the east side of the rug, a chaise returning along the south
  on(4.3, -2.7, 1.0, 0.5, 3.0, LEATHER), S(4.85, 0.75, -2.7, 0.22, 0.9, 3.0, LEATHER), on(3.4, -0.85, 2.0, 0.5, 0.9, LEATHER), S(3.4, 0.75, -0.42, 2.0, 0.9, 0.22, LEATHER),
  on(2, -2.6, 1.6, 0.42, 0.9, "#2b2622"), L(2, 0.44, -2.6, 0.5, 0.04, 0.5, WARM),
  on(-2.2, -3.0, 0.3, 0.55, 3.0, "#201d22"), L(-2.12, 1.75, -3.0, 0.04, 1.3, 2.3, "#6f7cff"), L(-2.0, 0.6, -3.0, 0.04, 0.04, 3.0, WARM),
  // personal PC: a desk in the north-east corner, two monitors and a gaming chair
  on(6.9, -5.3, 2.0, 0.76, 0.8, DARK), L(6.6, 1.15, -5.6, 0.7, 0.42, 0.04, PURPLE), L(7.35, 1.15, -5.6, 0.7, 0.42, 0.04, CYAN), on(6.9, -4.4, 0.6, 1.2, 0.6, "#3a2a4a"),
  // workout corner by the east wall: bench, a hanging heavy bag, a mat
  S(7.0, 0.01, -1.6, 2.0, 0.02, 1.6, "#2a2a2e"), on(7.0, -1.9, 1.2, 0.45, 0.4, STEEL), S(7.5, 1.25, -0.9, 0.45, 1.1, 0.45, "#a42a2a"),
  // kitchen: a counter and fridge along the east wall, a stove with its hood, an island with stools
  on(7.6, 3.6, 0.7, 0.92, 4.2, "#2c2c30"), S(7.6, 0.95, 3.6, 0.72, 0.05, 4.2, "#d8d3ca"), on(7.55, 1.2, 0.8, 2.0, 0.8, "#c9ccd1"), L(7.6, 0.97, 4.2, 0.5, 0.02, 0.5, "#ff8a4a"),
  on(3.8, 2.5, 2.8, 0.94, 1.1, "#2c2c30"), S(3.8, 0.96, 2.5, 2.9, 0.05, 1.2, "#e3ddd2"), ...[2.9, 3.8, 4.7].map((x) => on(x, 3.4, 0.4, 0.7, 0.4, DARK)),
  L(3.8, 3.0, 2.5, 2.4, 0.04, 0.04, WARM), ...plant(7.4, 5.4, 1.0),
  // bedroom: a bed with its headboard on the west wall, nightstands with lamps, a wardrobe, the shield banner
  on(-5.6, -3.4, 2.2, 0.55, 2.1, "#4a4450"), S(-5.6, 0.62, -3.4, 2.0, 0.14, 1.9, "#d9d4cc"), on(-7.85, -3.4, 0.14, 1.3, 2.4, "#2b2630"),
  ...[-4.85, -1.95].map((z) => on(-7.5, z, 0.5, 0.55, 0.5, WOOD)), ...[-4.85, -1.95].map((z) => L(-7.5, 0.75, z, 0.18, 0.25, 0.18, WARM)),
  on(-3.0, -5.6, 1.1, 2.2, 0.6, "#2b2630"), L(-7.88, 2.2, -3.4, 0.03, 0.9, 0.6, PURPLE),
  // bathroom: a glass shower, toilet, vanity and lit mirror
  G(-7.2, 1.1, 0.4, 1.4, 2.2, 1.4, "#9fd6e0"), L(-7.95, 2.1, 0.4, 0.03, 0.8, 1.2, CYAN), on(-5.0, 2.1, 0.5, 0.45, 0.6, "#e9e9e6"), on(-7.6, 1.9, 0.6, 0.85, 1.1, "#2f2f33"), L(-7.92, 1.6, 1.9, 0.03, 0.8, 0.9, "#cfe6ff"),
  // storage / utility: shelving with crates, a washer
  on(-7.6, 4.3, 0.6, 2.0, 2.6, "#3c3c40"), ...[0.6, 1.2, 1.8].map((y) => S(-7.6, y, 4.3, 0.62, 0.04, 2.6, STEEL)), on(-7.5, 3.6, 0.5, 0.4, 0.5, "#b08a3a"), on(-7.5, 4.9, 0.5, 0.4, 0.5, "#4a6a8a"), on(-5.0, 5.4, 0.7, 0.9, 0.7, "#d6d8dc"),
  // ceiling lights: the living room ring, the bedroom, the kitchen
  L(2, 3.5, -2.6, 2.6, 0.06, 0.06, WARM), L(2, 3.5, -2.6, 0.06, 0.06, 2.6, WARM), L(-5.4, 3.5, -3.4, 0.7, 0.04, 0.7, WARM),
  // the balcony beyond the north glass: a slab, a railing and two chairs (seen, not walked: the glass is the room's edge)
  S(0, -0.1, -7.5, 16, 0.2, 3, "#4a4644"), S(0, 1.0, -8.95, 16, 0.06, 0.06, DARK), ...[-6, -3, 0, 3, 6].map((x) => S(x, 0.5, -8.95, 0.05, 1.0, 0.05, DARK)),
  on(-1, -7.6, 0.8, 0.7, 0.8, LEATHER), on(1, -7.6, 0.8, 0.7, 0.8, LEATHER), L(0, 0.5, -7.6, 0.3, 0.3, 0.3, "#ffb066"),
];

const LOUNGE: Box[] = [
  // the game room: a pool table, two arcade cabinets, a big screen on the east wall
  on(1.5, -3, 2.6, 0.82, 1.4, "#3b2a1e"), S(1.5, 0.84, -3, 2.3, 0.04, 1.15, "#1f7a6a"), L(1.5, 2.6, -3, 1.6, 0.05, 0.3, WARM),
  ...[6.4, 7.6].map((x) => on(x, -5.9, 0.9, 1.8, 0.8, "#1b1730")), ...[6.4, 7.6].map((x) => L(x, 1.4, -5.48, 0.6, 0.5, 0.04, x > 7 ? CYAN : PURPLE)),
  L(8.85, 1.8, 0, 0.04, 1.5, 2.8, "#7f6dff"),
  // the resident lounge: sofas round a table facing the big screen
  on(4.6, -0.2, 0.9, 0.75, 2.8, "#3b3640"), on(4.6, 2.2, 0.9, 0.75, 1.6, "#3b3640"), on(6.6, 1, 1.0, 0.4, 1.2, "#2a2228"),
  // the movie theater: a screen on the south wall, three rows of red seats
  L(-1, 2.2, 6.82, 5.6, 2.4, 0.04, "#9fb4ff"), ...[1.4, 2.8, 4.2].flatMap((z) => [-3, -1, 1].map((x) => on(x, 6.8 - z, 1.6, 0.8, 0.8, "#7a1f2e"))),
  ...plant(-7.4, -6), ...plant(8.2, 6.2, 1.0),
];

const FITNESS: Box[] = [
  // the pool: a long lit basin (glass water) with a stone surround, loungers beside it
  S(3, -0.02, -2.5, 8.6, 0.06, 4.6, "#d6d0c4", "stone"), G(3, 0.02, -2.5, 8, 0.05, 4, "#3fc7e8"), L(3, -0.01, -2.5, 7.8, 0.02, 3.8, "#2aa8d8"),
  ...[-0.6, 1.4, 3.4].map((x) => on(x, -6.0, 0.8, 0.4, 1.8, "#e8e2d6")),
  // the hot tub: a round-ish lit basin in the corner
  on(8.3, -5.4, 2.4, 0.55, 2.4, "#d6d0c4", "stone"), L(8.3, 0.57, -5.4, 2.0, 0.02, 2.0, "#7fe0ff"),
  // the gym: treadmills facing the glass, a rack and a bench, a mirror wall, mats
  ...[-5.5, -3.8, -2.1].map((x) => on(x, 4.2, 0.9, 1.3, 1.8, "#2c2f34")), ...[-5.5, -3.8, -2.1].map((x) => L(x, 1.35, 3.4, 0.5, 0.3, 0.04, CYAN)),
  on(4, 5.8, 3.2, 1.0, 0.6, "#3a3d42"), on(6.6, 4.4, 1.4, 0.45, 0.5, STEEL), L(2, 1.5, 6.82, 8, 2.4, 0.04, "#cfd8e0"), S(-4, 0.01, 1.2, 5, 0.02, 2, "#2a2a2e"),
  ...plant(9.2, 6.2, 1.0),
];

const ROOF: Box[] = [
  // the sky deck: lounge sofas round a fire pit, a cabana with string lights, the bar, planters
  on(-2, 1.0, 1.2, 0.5, 1.2, "#3a3532", "stone"), L(-2, 0.55, 1.0, 0.9, 0.08, 0.9, "#ff8a3a"),
  on(-2, -1.6, 3.6, 0.75, 1.0, "#d9d2c6"), on(-2, 3.6, 3.6, 0.75, 1.0, "#d9d2c6"), on(-4.6, 1.0, 1.0, 0.75, 3.6, "#d9d2c6"),
  on(5.5, -5, 4.8, 1.05, 1.0, "#2b2a2e"), L(5.5, 1.08, -4.5, 4.8, 0.04, 0.04, PURPLE),
  ...[-6, -3, 0, 3, 6].map((x) => L(x, 2.8, -2.0, 0.12, 0.12, 0.12, WARM)), ...[-6, -3, 0, 3, 6].map((x) => S(x, 1.4, -2.0, 0.08, 2.8, 0.08, DARK)),
  ...[-5, 0, 5].flatMap((z) => plant(8.6, z, 1.0)), ...[-4, 0, 4].flatMap((x) => plant(x, 7.3, 1.0)),
];

export function floorBoxes(id: ResidenceFloorId): Box[] {
  const f = residenceFloor(id)!;
  const body = id === "nexus-apartment" ? LOBBY : id === "nexus-res-1204" ? APARTMENT : id === "nexus-tower-lounge" ? LOUNGE : id === "nexus-res-fitness" ? FITNESS : ROOF;
  return [...shell(f), ...(f.open ? [] : bank(f)), ...(f.open ? bankRoof(f) : []), ...body];
}
/** the roof's bank stands under a small lift lobby canopy on the west parapet */
function bankRoof(f: ResidenceFloor): Box[] {
  return [...bank(f), S(-f.hx + 1.2, 2.9, 0, 2.6, 0.2, elevatorPads(f.id).length * 2.4 + 0.6, DARK), ...[-1, 1].map((s) => S(-f.hx + 2.4, 1.45, s * (elevatorPads(f.id).length * 1.2 + 0.2), 0.12, 2.9, 0.12, DARK))];
}

/** the solid things you bump into, as wall segments in the floor's local frame (base/top relative to the floor):
 * every partition and piece of furniture standing more than 0.35 m tall, except the lounge's ceiling lights */
export function floorWalls(id: ResidenceFloorId): Wall[] {
  const f = residenceFloor(id)!, out: Wall[] = [];
  for (const b of floorBoxes(id)) {
    if (b.mat === "lamp" || b.sy < 0.35 || b.y - b.sy / 2 > 1.2) continue;      // lights, rugs, mats and anything overhead
    if (Math.abs(b.z) > f.hz + 0.2 && !f.open) continue;                          // the balcony and outside the glass
    const x0 = b.x - b.sx / 2, x1 = b.x + b.sx / 2, z0 = b.z - b.sz / 2, z1 = b.z + b.sz / 2, base = b.y - b.sy / 2, top = b.y + b.sy / 2;
    // a thin box is one segment along its length; a block is its four sides
    if (b.sx < 0.35) out.push({ ax: b.x, az: z0, bx: b.x, bz: z1, half: Math.max(0.07, b.sx / 2), base, top });
    else if (b.sz < 0.35) out.push({ ax: x0, az: b.z, bx: x1, bz: b.z, half: Math.max(0.07, b.sz / 2), base, top });
    else for (const [ax, az, bx, bz] of [[x0, z0, x1, z0], [x1, z0, x1, z1], [x1, z1, x0, z1], [x0, z1, x0, z0]] as const) out.push({ ax, az, bx, bz, half: 0.06, base, top });
  }
  return out;
}

/** the apartment's interaction spots (local frame): walk within r of one and its button shows */
export const APARTMENT_SPOTS: readonly Spot[] = [
  { id: "bed", action: "rest", label: "Rest · restore your hull", x: -5.6, z: -1.6, r: 1.4 },
  { id: "pc", action: "pc", label: "Use your PC · missions, news & intel", x: 6.9, z: -3.6, r: 1.3 },
  { id: "tv", action: "tv", label: "Watch the news", x: 0.3, z: -3.6, r: 1.4 },
  { id: "stash", action: "stash", label: "Open your stash", x: -6.2, z: 4.3, r: 1.3 },
  { id: "wardrobe", action: "wardrobe", label: "Change outfit & gear", x: -3.0, z: -4.6, r: 1.2 },
  { id: "workout", action: "workout", label: "Work out", x: 6.6, z: -0.6, r: 1.2 },
  { id: "radio", action: "radio", label: "World Fracture Radio", x: -1.4, z: -1.8, r: 1.0 },
];
/** the spot you stand at in an apartment floor (local metres), or null */
export function spotAt(id: string | null, x: number, z: number): Spot | null {
  if (id !== "nexus-res-1204") return null;
  let best: Spot | null = null, bd = Infinity;
  for (const s of APARTMENT_SPOTS) { const d = Math.hypot(x - s.x, z - s.z); if (d < s.r && d < bd) { bd = d; best = s; } }
  return best;
}
