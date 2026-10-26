/**
 * Exports the rest of the built world from the web build into unreal/DataTables/WorldBuildings.json for AWFWorldBuildings:
 *  - Neon City's tower grid (neon-layout.ts, minus the venue lots, nightlife.ts) on its plateau, with its street lights
 *  - every walk-in home (suburban houses, townhouses, duplexes, courtyards, apartments, condos, lofts, villas) and its
 *    garage in Nexus and Neon City (residences.ts homeBoxes / garageBoxes: walls with door gaps, floors, roofs, glass, lamps)
 *  - the jungle-reclaimed city in Verdant Forest (reclaimed-city.ts towers and their broken concrete pieces)
 *  - the transit terminals: an airport and a seaport for every landing zone (travel.ts)
 *  - the fleet model each vehicle shows (fleet-models.ts), for AWFVehicle
 *
 * Every box is written in Unreal's frame, already turned: [x, y, z] metres (Unreal X/Y/Z: web x, z, y), the rotation as a
 * quaternion [qx, qy, qz, qw] and the size along the box's own Unreal axes, plus a colour index, a material kind and a
 * roof-prism flag. Each group carries the web build's ground height at its anchor so Unreal can move it onto its own
 * terrain (identical except where it levels ground, such as under Nexus City).
 *
 * Run from the repo root:
 *   npx esbuild unreal/tools/export-world-buildings.ts --bundle --platform=node --format=esm --alias:@=./src --outfile=/tmp/wb.mjs && node /tmp/wb.mjs
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { heightAt, neonPlateauLevel } from "../../src/game/terrain";
import { neonTowersWorld, neonStreetLightsWorld, TOWER_FOOTPRINT, GLOWS, type TowerVariant } from "../../src/game/neon-layout";
import { venueLots } from "../../src/game/nightlife";
import { residences, homeBoxes, garageBoxes, neonKeepOut, type Box } from "../../src/game/residences";
import { reclaimedCity, towerPieces, PIECE_SIZE } from "../../src/game/reclaimed-city";
import { TERMINALS, TERMINAL_RADIUS } from "../../src/game/travel";
import { BASE_MODEL, BUILD_MODEL, FLEET_MODELS } from "../../src/game/fleet-models";

const r3 = (v: number) => Math.round(v * 1000) / 1000;

// ---- 3x3 rotation matrices (row-major), web frame ----
type M3 = number[];
const mul = (a: M3, b: M3): M3 => [0, 1, 2].flatMap((i) => [0, 1, 2].map((j) => a[i * 3]! * b[j]! + a[i * 3 + 1]! * b[3 + j]! + a[i * 3 + 2]! * b[6 + j]!));
const rx = (t: number): M3 => [1, 0, 0, 0, Math.cos(t), -Math.sin(t), 0, Math.sin(t), Math.cos(t)];
const ry = (t: number): M3 => [Math.cos(t), 0, Math.sin(t), 0, 1, 0, -Math.sin(t), 0, Math.cos(t)];
const rz = (t: number): M3 => [Math.cos(t), -Math.sin(t), 0, Math.sin(t), Math.cos(t), 0, 0, 0, 1];
/** three.js Euler in "XYZ" order: R = Rx * Ry * Rz; "YXZ": R = Ry * Rx * Rz */
const eulerXYZ = (x: number, y: number, z: number) => mul(mul(rx(x), ry(y)), rz(z));
const apply = (m: M3, v: [number, number, number]): [number, number, number] => [0, 1, 2].map((i) => m[i * 3]! * v[0] + m[i * 3 + 1]! * v[1] + m[i * 3 + 2]! * v[2]) as [number, number, number];
/** web (x, y, z) -> Unreal (x, z, y): a swap of two axes, so a web rotation R becomes P R P in Unreal */
const P: M3 = [1, 0, 0, 0, 0, 1, 0, 1, 0];
function quat(m: M3): [number, number, number, number] {
  const [a, b, c, d, e, f, g, h, i] = m as [number, number, number, number, number, number, number, number, number];
  const tr = a + e + i;
  let qw: number, qx: number, qy: number, qz: number;
  if (tr > 0) { const s = Math.sqrt(tr + 1) * 2; qw = s / 4; qx = (h - f) / s; qy = (c - g) / s; qz = (d - b) / s; }
  else if (a > e && a > i) { const s = Math.sqrt(1 + a - e - i) * 2; qw = (h - f) / s; qx = s / 4; qy = (b + d) / s; qz = (c + g) / s; }
  else if (e > i) { const s = Math.sqrt(1 + e - a - i) * 2; qw = (c - g) / s; qx = (b + d) / s; qy = s / 4; qz = (f + h) / s; }
  else { const s = Math.sqrt(1 + i - a - e) * 2; qw = (d - b) / s; qx = (c + g) / s; qy = (f + h) / s; qz = s / 4; }
  return [r3(qx), r3(qy), r3(qz), r3(qw)];
}

// ---- colours: one shared palette, boxes refer to it by index ----
const palette: string[] = [];
const colorIndex = (c: string) => { const k = c.toLowerCase(); let i = palette.indexOf(k); if (i < 0) { palette.push(k); i = palette.length - 1; } return i; };
const MATS = ["solid", "glass", "lamp"] as const;

type OutBox = number[];
/** a box at web-local (x, y, z) with size (sx, sy, sz) inside a group placed at web (ox, oy, oz) turned by rotation G */
function place(G: M3, ox: number, oy: number, oz: number, local: M3, x: number, y: number, z: number, sx: number, sy: number, sz: number, color: string, mat: string, prism = false): OutBox {
  const [wx, wy, wz] = apply(G, [x, y, z]);
  const R = mul(P, mul(mul(G, local), P));
  const [qx, qy, qz, qw] = quat(R);
  return [r3(ox + wx), r3(oz + wz), r3(oy + wy), qx, qy, qz, qw, r3(sx), r3(sz), r3(sy), colorIndex(color), Math.max(0, MATS.indexOf(mat as never)), prism ? 1 : 0];
}
const I3: M3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const boxesOf = (list: Box[], G: M3, ox: number, oy: number, oz: number) => list.map((b) => place(G, ox, oy, oz, I3, b.x, b.y, b.z, b.sx, b.sy, b.sz, b.color, b.mat, !!b.prism));

/** WebGround: the web build's terrain height at the anchor (X, Z), so Unreal can shift the group onto its own terrain by the
 * difference there (zero almost everywhere; under Nexus City's levelled pad it is not) */
type Group = { Kind: string; Id: string; X: number; Z: number; WebGround: number; Boxes: OutBox[]; Variant?: string; Glow?: number; Yaw?: number; Floor?: number };
const groups: Group[] = [];

// ---- Neon City towers (detailed GLB neon-v-<variant> in the web build; massing heights from NeonTowerBlocks.tsx) ----
const NEON_H: Record<TowerVariant, number> = { A: 56, B: 64, C: 80, D: 26, E: 92, F: 50 };
const allTowers = neonTowersWorld(neonKeepOut());
const taken = new Set(venueLots(allTowers).map((l) => `${l.x},${l.z}`));
const plateau = neonPlateauLevel();
for (const t of allTowers.filter((q) => !taken.has(`${q.x},${q.z}`))) {
  const [hx, hz] = TOWER_FOOTPRINT[t.variant];
  const h = NEON_H[t.variant], G = ry((t.rot * Math.PI) / 2), glow = t.glow;
  const boxes: OutBox[] = [
    place(G, t.x, plateau, t.z, I3, 0, h / 2, 0, hx * 2, h, hz * 2, "#1a1d24", "solid"),
    // neon edge strips up the four corners and a lit crown band, in the tower's glow
    ...[[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([sx, sz]) => place(G, t.x, plateau, t.z, I3, sx! * (hx + 0.06), h / 2 + 2, sz! * (hz + 0.06), 0.16, h - 4, 0.16, glow, "lamp")),
    place(G, t.x, plateau, t.z, I3, 0, h - 1.5, 0, hx * 2 + 0.3, 0.6, hz * 2 + 0.3, glow, "lamp"),
    // lit floors every fourth storey on the two long faces
    ...Array.from({ length: Math.floor((h - 8) / 13.6) }, (_, k) => 6 + k * 13.6).flatMap((y) => [1, -1].map((s) => place(G, t.x, plateau, t.z, I3, 0, y, s * (hz + 0.04), hx * 1.7, 0.5, 0.06, "#7fc8ff", "lamp"))),
  ];
  groups.push({ Kind: "neon-tower", Id: `neon-${t.x}-${t.z}`, X: r3(t.x), Z: r3(t.z), WebGround: r3(heightAt(t.x, t.z)), Boxes: boxes, Variant: t.variant, Glow: GLOWS.indexOf(glow), Yaw: r3((t.rot * Math.PI) / 2), Floor: r3(plateau) });
}
const neonLights = neonStreetLightsWorld(neonKeepOut()).map((l) => [r3(l.x), r3(l.z), r3(l.yaw), colorIndex(l.glow), r3(heightAt(l.x, l.z))]);

// ---- walk-in homes and their garages ----
for (const h of residences()) {
  const G = ry(h.rot);
  groups.push({ Kind: `home-${h.style}`, Id: h.id, X: r3(h.x), Z: r3(h.z), WebGround: r3(heightAt(h.x, h.z)), Boxes: boxesOf(homeBoxes(h.style, h.floor - h.base), G, h.x, h.floor, h.z) });
  if (h.garage) {
    const g = h.garage;
    groups.push({ Kind: "garage", Id: `${h.id}:garage`, X: r3(g.x), Z: r3(g.z), WebGround: r3(heightAt(g.x, g.z)), Boxes: boxesOf(garageBoxes(g, g.floor - g.base), ry(g.rot), g.x, g.floor, g.z) });
  }
}

// ---- the jungle-reclaimed city (tower frame: yaw then lean, "YXZ"; pieces "XYZ") ----
const city = reclaimedCity();
if (city) for (const t of city.towers) {
  const G = mul(ry(t.yaw), rx(t.lean));
  const boxes = towerPieces(t).map((p) => {
    const [bx, by, bz] = PIECE_SIZE[p.g];
    return place(G, t.x, t.base, t.z, eulerXYZ(p.rx, p.ry, p.rz), p.x, p.y, p.z, bx * p.sx, by * p.sy, bz * p.sz, p.g === "rubble" ? "#5e5a52" : "#8a857a", "solid");
  });
  groups.push({ Kind: "ruin", Id: `ruin-${r3(t.x)}-${r3(t.z)}`, X: r3(t.x), Z: r3(t.z), WebGround: r3(heightAt(t.x, t.z)), Boxes: boxes });
}

// ---- transit terminals (ContinentTransit.tsx TerminalKiosk): pad, posts, canopy, departures board, beacon mast ----
const R = TERMINAL_RADIUS;
for (const t of TERMINALS) {
  const y = heightAt(t.x, t.z), sea = t.kind === "SEAPORT";
  const b = (x: number, yy: number, z: number, sx: number, sy: number, sz: number, c: string, m = "solid") => place(I3, t.x, y, t.z, I3, x, yy, z, sx, sy, sz, c, m);
  const boxes = [
    b(0, 0.17, 0, (R + 1.2) * 2, 0.35, (R + 1.2) * 2, "#8a8780"),
    b(0, 0.37, 0, R * 2, 0.04, R * 2, sea ? "#ffb347" : "#5ee7ff", "lamp"),
    ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => b(sx! * R * 1.15, 2.1, sz! * R * 0.75, 0.36, 4.2, 0.36, "#7d868f")),
    b(0, 4.35, 0, R * 2.6, 0.35, R * 1.8, "#3b4148"),
    b(0, 3.2, -R * 0.78, 2.6, 1.3, 0.2, "#3b4148"),
    b(0, 3.2, -R * 0.78 + 0.11, 2.4, 1.1, 0.12, "#7fd8ff", "lamp"),
    b(R * 1.6, 7, -R * 0.8, 0.3, 14, 0.3, "#7d868f"),
    b(R * 1.6, 14.2, -R * 0.8, 0.7, 0.7, 0.7, "#ffb347", "lamp"),
    ...(sea ? [-2, -1, 0, 1, 2].map((i) => b(i * 1.8, 0.55, R * 1.3, 0.5, 1.1, 0.5, "#3b4148")) : []),
  ];
  groups.push({ Kind: sea ? "seaport" : "airport", Id: t.id, X: r3(t.x), Z: r3(t.z), WebGround: r3(y), Boxes: boxes });
}

// ---- which fleet model each vehicle shows ----
const FleetModels = { Base: BASE_MODEL, Build: BUILD_MODEL, Scale: Object.fromEntries(Object.values(FLEET_MODELS).map((m) => [m.id, m.scale])) };

const out = {
  Source: "src/game: neon-layout.ts, nightlife.ts, residences.ts, reclaimed-city.ts, travel.ts, fleet-models.ts",
  Units: "metres in Unreal's frame (X = web x, Y = web z, Z = up); boxes [x, y, z, qx, qy, qz, qw, sx, sy, sz, color, mat 0 solid 1 glass 2 lamp, prism]",
  Palette: palette,
  Groups: groups,
  NeonPlateau: r3(plateau),
  // [x, y(web z), yaw, color, web ground]
  NeonStreetLights: neonLights,
  Terminals: TERMINALS.map((t) => ({ Id: t.id, Name: t.name, Kind: t.kind, X: r3(t.x), Z: r3(t.z), Region: t.regionId })),
  FleetModels,
};
const file = join(process.cwd(), "unreal", "DataTables", "WorldBuildings.json");
writeFileSync(file, JSON.stringify(out) + "\n");
const kinds = new Map<string, number>();
for (const g of groups) kinds.set(g.Kind, (kinds.get(g.Kind) ?? 0) + 1);
console.log(`WorldBuildings.json: ${[...kinds].map(([k, n]) => `${k} ${n}`).join(", ")}; ${groups.reduce((a, g) => a + g.Boxes.length, 0)} boxes, ${neonLights.length} Neon street lights, ${palette.length} colours`);
