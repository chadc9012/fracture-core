/** Shared racing framework + every regional course. One race lifecycle for cars, rally vehicles, submersibles, parkour and skating:
 * discover -> register (a board/discovery activity) -> stage at the start line -> countdown -> ordered checkpoints -> finish -> result -> save.
 * Races are ACTIVITIES (activities.ts): they share its real-time attempts, cooldowns, reputation, shaders and idempotent payouts, and add
 * racing records on top (personal bests, medals, ranks, championships). Nothing here is a second currency or reward path.
 *
 * What is real: ordered checkpoints (a skipped one can never finish), depth gates, timed "reality gate" windows, authored shortcuts, off-course
 * detection with recovery from the last checkpoint, movement-mode checks, collision and recovery penalties, deterministic rival pace, medals,
 * ranks, championships, time limits per difficulty.
 * What is NOT here: rival collision/blocking AI, traffic, weather, falling debris and creature pursuit (courses list them as `hazards` for the
 * world layer to build), relay/co-op (needs multiplayer), live leaderboards and friend times (needs a backend).
 * Courses are laid out as shapes round each area's centre; every VEHICLE course is then routed over drivable ground (race-routing.ts,
 * baked per world scale into race-routes.generated.ts and re-checked by race-routing.test.ts). Foot and dive courses keep their shape. */
import { ACTIVITIES, AREAS, EXTRA_DEFS, NO_DEATH, R, activityById, hooks, pointWorld, type ActivityDef, type Run, type Tick } from "./activities";
import { DISCOVERIES, type Discovery } from "./discoveries";
import type { PlayerProgression } from "./progression";
import type { MaterialId } from "./inventory";
import { BAKED_ROUTES } from "./race-routes.generated";
import { WORLD_SCALE } from "./world";
import { WATER_LEVEL, heightAt } from "./terrain";
import { drivablePoint } from "./race-routing";

export type RaceMode = "foot" | "vehicle" | "dive";
export type Difficulty = "standard" | "advanced" | "legendary";
export const DIFFICULTIES: readonly Difficulty[] = ["standard", "advanced", "legendary"];
export type RacePoint = { f: readonly [number, number]; /** dive gate depth (negative y) */ depth?: number; /** reality gate: passable only while time % period < open */ window?: { period: number; open: number } };
export type Shortcut = { /** the checkpoint index this replaces */ at: number; via: readonly [number, number]; skipTo: number };
export type RaceDef = {
  id: string; area: string; name: string; type: string; mode: RaceMode; brief: string; hazards: readonly string[]; points: readonly RacePoint[]; shortcuts: readonly Shortcut[];
  par: number; rivals: number; crew: string; faction: string; rank: number; style: boolean; hidden?: { markers: readonly string[]; need: number };
  /** laps of a circuit; `points` already holds every lap's gates */
  laps: number;
};
/** which lap a racer heading for gate `next` is on (1-based) */
export const lapOf = (def: RaceDef, next: number) => Math.min(def.laps, 1 + Math.floor(Math.max(0, next - 1) / ((def.points.length - 1) / def.laps)));
export type Championship = { id: string; area: string; name: string; rounds: readonly string[]; rank: number };

/* ------------------------------ geometry & constants ------------------------------ */
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
const rng = (seed: number) => () => { seed = (Math.imul(seed ^ (seed >>> 15), 2246822507) + 0x6d2b79f5) >>> 0; return seed / 4294967296; };
export const CHECKPOINT_RADIUS: Record<RaceMode, number> = { foot: 7, vehicle: 14, dive: 12 };
export const CORRIDOR: Record<RaceMode, number> = { foot: 45, vehicle: 90, dive: 70 };
const SPEED: Record<string, number> = { street: 26, rally: 20, climb: 15, endurance: 22, pursuit: 25, parkour: 8.5, skate: 11, dive: 14, hazard: 18, tech: 21 };
export const COUNTDOWN_S = 3, START_RADIUS = 30, WRONG_MODE_NOTE = "Wrong movement mode for this race";
export const TIME_LIMIT_MULT: Record<Difficulty, number> = { standard: 1.8, advanced: 1.45, legendary: 1.2 };
const GOLD_MULT: Record<Difficulty, number> = { standard: 1, advanced: 0.93, legendary: 0.86 };
export const DIFF_REWARD: Record<Difficulty, number> = { standard: 1, advanced: 1.4, legendary: 2 };
export const RANKS = ["Rookie", "Contender", "Veteran", "Elite", "Legend"] as const;
const RANK_AT = [0, 10, 28, 60, 110] as const;

type Shape = "loop" | "line" | "zig" | "drop";
type Row = { id: string; area: string; name: string; type: string; mode: RaceMode; shape: Shape; n: number; rw: number; brief: string; hazards?: string[]; rank?: number; rivals?: number; depth?: [number, number]; windows?: boolean; shortcut?: boolean; style?: boolean; crew?: string; faction?: string; par?: number; hidden?: { markers: string[]; need: number } };

function layout(row: Row): { points: RacePoint[]; shortcuts: Shortcut[] } {
  const r = rng(hash(row.id)), a0 = r() * Math.PI * 2, R_ = AREAS[row.area]!.radius, rw = Math.max(row.rw, row.mode === "vehicle" ? 110 : row.mode === "dive" ? 45 : 35);
  const fr = (ang: number, rad: number): [number, number] => [Math.sin(ang) * rad / R_, Math.cos(ang) * rad / R_];
  const pts: RacePoint[] = [];
  const depthAt = (i: number) => (row.depth ? row.depth[0] + (row.depth[1] - row.depth[0]) * (i / Math.max(1, row.n)) : undefined);
  const add = (f: [number, number], i: number) => { const d = depthAt(i); pts.push({ f, ...(d !== undefined ? { depth: Math.round(d) } : {}) }); };
  if (row.shape === "loop") {
    for (let i = 0; i <= row.n; i++) add(fr(a0 + (i / row.n) * Math.PI * 2, rw * (1 + (i % 2 ? 0.07 : -0.05))), i % row.n);
    pts[pts.length - 1] = { f: pts[0]!.f, ...(pts[0]!.depth !== undefined ? { depth: pts[0]!.depth } : {}) };
  } else {
    const ax = Math.sin(a0) * rw, az = Math.cos(a0) * rw, bx = -Math.sin(a0) * rw * 0.9, bz = -Math.cos(a0) * rw * 0.9, nx = -(bz - az), nz = bx - ax, len = Math.hypot(nx, nz) || 1;
    for (let i = 0; i <= row.n; i++) {
      const u = i / row.n, side = row.shape === "zig" ? (i % 2 ? 1 : -1) * 0.18 : Math.sin(u * 5 + a0) * 0.07;
      add([(ax + (bx - ax) * u + (nx / len) * rw * side) / R_, (az + (bz - az) * u + (nz / len) * rw * side) / R_], i);
    }
  }
  if (row.windows) for (const i of [Math.floor(row.n / 2), row.n - 1]) if (i > 0 && i < pts.length - 1) pts[i] = { ...pts[i]!, window: { period: 8, open: 5 } };
  const shortcuts: Shortcut[] = [];
  if (row.shortcut && row.n >= 5) {
    const a = pts[2]!.f, b = pts[4]!.f;
    shortcuts.push({ at: 3, via: [(a[0] + b[0]) / 2 + 0.18 * Math.cos(a0), (a[1] + b[1]) / 2 - 0.18 * Math.sin(a0)], skipTo: 4 });
  }
  return { points: pts, shortcuts };
}
function polyLength(points: readonly RacePoint[], area: string): number { let L = 0; for (let i = 1; i < points.length; i++) { const a = pointWorld(area, points[i - 1]!.f), b = pointWorld(area, points[i]!.f); L += Math.hypot(a.x - b.x, a.z - b.z); } return L; }

/* ------------------------------ catalogue ------------------------------ */
const FACTION: Record<string, string> = { neon: "syndicate", nexus: "guild", "neon-core": "aegis", veridan: "wardens", thalassia: "tidewardens", ember: "forgeborn", wastelands: "rebels", swamps: "wardens", solara: "covenant", frostspire: "wardens" };
const ROWS: Row[] = [
  // Neon City
  { id: "nc-circuit", area: "neon", name: "Midnight Circuit", type: "street", mode: "vehicle", shape: "loop", n: 8, rw: 150, brief: "A high-speed loop through neon-lit streets, tunnels and elevated expressways.", hazards: ["traffic", "tunnel", "elevated expressway"], rank: 0, shortcut: true, crew: "Midnight Circuit regulars" },
  { id: "nc-riot", area: "neon", name: "Rail Riot", type: "skate", mode: "foot", shape: "loop", n: 7, rw: 55, brief: "Grind rails, jump between platforms, slide under obstacles and chain tricks together.", hazards: ["rail gaps"], rank: 0, style: true },
  { id: "nc-ghost", area: "neon", name: "Ghostline Run", type: "parkour", mode: "foot", shape: "loop", n: 6, rw: 48, brief: "Cross rooftops, wall-run, slide and reach the finish before the timer expires.", hazards: ["rooftop gaps"], rank: 1, style: true },
  { id: "r-nc-blacktop", area: "neon", name: "Blacktop Takeover", type: "street", mode: "vehicle", shape: "loop", n: 9, rw: 165, brief: "Race through rival gang territory while crews try to block shortcuts.", hazards: ["gang blockades", "tight alleys"], rank: 1, shortcut: true, crew: "Blacktop crews" },
  { id: "r-nc-skybridge", area: "neon", name: "Skybridge Sprint", type: "parkour", mode: "foot", shape: "line", n: 6, rw: 55, brief: "Race across elevated walkways and glass bridges with more than one route.", hazards: ["glass bridges"], rank: 1, shortcut: true, style: true },
  { id: "r-nc-lastexit", area: "neon", name: "The Last Exit", type: "pursuit", mode: "vehicle", shape: "line", n: 8, rw: 170, brief: "Reach the finish while rival racers and security vehicles try to stop you.", hazards: ["security vehicles", "rival blocking"], rank: 2 },
  // Nexus City
  { id: "r-nx-gridlock", area: "nexus", name: "Gridlock Grand Prix", type: "street", mode: "vehicle", shape: "loop", n: 9, rw: 150, brief: "Tight corners, moving traffic and changing road signals.", hazards: ["traffic", "signals"], rank: 0, crew: "Nexus precision teams" },
  { id: "r-nx-sentinel", area: "nexus", name: "Sentinel Chase", type: "pursuit", mode: "vehicle", shape: "line", n: 8, rw: 160, brief: "Outrun security drones and reach the checkpoints before they close.", hazards: ["security drones"], rank: 1 },
  { id: "r-nx-vertical", area: "nexus", name: "Vertical Velocity", type: "parkour", mode: "foot", shape: "zig", n: 6, rw: 45, brief: "Climb security towers, cross suspended walkways and descend through industrial structures.", hazards: ["tower faces"], rank: 1, style: true },
  { id: "r-nx-powergrid", area: "nexus", name: "Power Grid Run", type: "tech", mode: "vehicle", shape: "zig", n: 8, rw: 140, brief: "Infrastructure corridors with barriers and changing routes that demand precise control.", hazards: ["barriers"], rank: 1, windows: true },
  { id: "r-nx-skyline", area: "nexus", name: "Skyline Relay", type: "relay", mode: "vehicle", shape: "loop", n: 8, rw: 150, brief: "A team relay along a city circuit. Needs multiplayer: runs solo here as a plain circuit.", hazards: ["team handoffs (multiplayer only)"], rank: 2 },
  // Neon Core
  { id: "r-ncd-coreline", area: "neon-core", name: "Coreline GP", type: "street", mode: "vehicle", shape: "loop", n: 9, rw: 140, brief: "A demanding circuit around the district's central infrastructure.", hazards: ["security hazards"], rank: 2, crew: "Core elite racers" },
  { id: "r-ncd-aegisdrop", area: "neon-core", name: "Aegis Drop", type: "parkour", mode: "foot", shape: "zig", n: 7, rw: 45, brief: "From the upper levels of Aegis Spire down through suspended platforms and industrial passages.", hazards: ["suspended platforms"], rank: 2, style: true },
  { id: "r-ncd-redline", area: "neon-core", name: "Redline Protocol", type: "pursuit", mode: "vehicle", shape: "line", n: 8, rw: 150, brief: "Reach the extraction point while security vehicles and drones intercept.", hazards: ["security vehicles", "drones"], rank: 3 },
  { id: "r-ncd-flux", area: "neon-core", name: "Flux Runner", type: "tech", mode: "vehicle", shape: "zig", n: 8, rw: 135, brief: "Temporary energy gates open and close on a predictable sequence.", hazards: ["energy gates"], rank: 3, windows: true },
  { id: "r-ncd-blacksector", area: "neon-core", name: "Black Sector Invitational", type: "street", mode: "vehicle", shape: "loop", n: 10, rw: 155, brief: "Restricted routes with specialised vehicles and high entry stakes.", hazards: ["restricted routes"], rank: 3, shortcut: true },
  // Verdant Forest
  { id: "r-vf-wildroot", area: "veridan", name: "Wildroot Rally", type: "rally", mode: "vehicle", shape: "line", n: 8, rw: 170, brief: "Forest trails, muddy bends and narrow clearings.", hazards: ["mud", "fallen trees"], rank: 0, crew: "Verdant off-road drivers" },
  { id: "r-vf-canopy", area: "veridan", name: "Canopy Rush", type: "parkour", mode: "foot", shape: "loop", n: 6, rw: 48, brief: "Tree platforms, hanging bridges, branches and ancient ruins.", hazards: ["gaps"], rank: 0, style: true },
  { id: "r-vf-riverbreak", area: "veridan", name: "Riverbreak Run", type: "rally", mode: "vehicle", shape: "line", n: 8, rw: 165, brief: "Cross shallow streams; pick the fast, risky ford or the longer trail.", hazards: ["water", "riverbanks"], rank: 1, shortcut: true },
  { id: "r-vf-ruin", area: "veridan", name: "Ruin Runner", type: "parkour", mode: "foot", shape: "zig", n: 7, rw: 45, brief: "Climb ancient structures and leap between broken platforms.", hazards: ["broken platforms"], rank: 1, style: true },
  { id: "r-vf-stalker", area: "veridan", name: "Stalker Trail", type: "hazard", mode: "vehicle", shape: "line", n: 8, rw: 165, brief: "Reach the finish while a powerful regional creature pursues the racers.", hazards: ["pursuing creature"], rank: 2 },
  // Thalassia
  { id: "r-th-abyssal", area: "thalassia", name: "Abyssal Sprint", type: "dive", mode: "dive", shape: "loop", n: 8, rw: 55, brief: "Underwater streets, pressure gates and submerged transit corridors.", hazards: ["pressure gates"], rank: 0, depth: [-12, -18], crew: "Thalassia submersible teams" },
  { id: "r-th-trench", area: "thalassia", name: "Trench Runner", type: "dive", mode: "dive", shape: "zig", n: 8, rw: 55, brief: "A winding course along a trench with tight turns and limited visibility.", hazards: ["limited visibility"], rank: 1, depth: [-24, -34] },
  { id: "r-th-pressure", area: "thalassia", name: "Pressure Drop", type: "dive", mode: "dive", shape: "drop", n: 8, rw: 50, brief: "Dive through successive checkpoints at different depths.", hazards: ["structures"], rank: 1, depth: [-8, -48] },
  { id: "r-th-sunken", area: "thalassia", name: "Sunken City Circuit", type: "dive", mode: "dive", shape: "loop", n: 9, rw: 58, brief: "Ruined buildings, underwater tunnels and submerged plazas.", hazards: ["collapsing structures"], rank: 1, depth: [-14, -22] },
  { id: "r-th-leviathan", area: "thalassia", name: "Leviathan Run", type: "hazard", mode: "dive", shape: "loop", n: 8, rw: 58, brief: "Cross a creature's territory without being caught or forced off course.", hazards: ["leviathan", "currents"], rank: 2, depth: [-20, -30] },
  // Ember Peaks
  { id: "r-em-ashfall", area: "ember", name: "Ashfall Rally", type: "rally", mode: "vehicle", shape: "zig", n: 9, rw: 170, brief: "Volcanic roads, loose gravel and steep switchbacks.", hazards: ["gravel", "switchbacks"], rank: 0, crew: "Ember industrial racers" },
  { id: "r-em-lavaline", area: "ember", name: "Lava Line", type: "rally", mode: "vehicle", shape: "loop", n: 8, rw: 150, brief: "Around active lava fields and unstable ground.", hazards: ["lava", "unstable ground"], rank: 1 },
  { id: "r-em-foundry", area: "ember", name: "Foundry Run", type: "tech", mode: "vehicle", shape: "zig", n: 8, rw: 140, brief: "Mining facilities, processing plants and narrow service corridors.", hazards: ["service corridors"], rank: 1, shortcut: true },
  { id: "r-em-cinder", area: "ember", name: "Cinder Climb", type: "climb", mode: "vehicle", shape: "line", n: 8, rw: 160, brief: "Race uphill through increasingly difficult terrain.", hazards: ["steep terrain"], rank: 1 },
  { id: "r-em-magma", area: "ember", name: "Magma Descent", type: "rally", mode: "vehicle", shape: "zig", n: 8, rw: 160, brief: "Down steep mountain roads with tight corners and drops.", hazards: ["drops", "heat haze"], rank: 2 },
  // Wastelands
  { id: "wl-devil", area: "wastelands", name: "Dust Devil Rally", type: "rally", mode: "vehicle", shape: "line", n: 9, rw: 180, brief: "Dunes, dry riverbeds and rocky desert trails.", hazards: ["dunes", "rocks"], rank: 0, shortcut: true, crew: "Wasteland rebel drivers" },
  { id: "r-wl-rust", area: "wastelands", name: "Rust Run", type: "tech", mode: "vehicle", shape: "zig", n: 9, rw: 150, brief: "Wrecked vehicles, abandoned industry and narrow passages.", hazards: ["wrecks"], rank: 1 },
  { id: "r-wl-convoy", area: "wastelands", name: "Convoy Breaker (Race)", type: "pursuit", mode: "vehicle", shape: "line", n: 8, rw: 170, brief: "Race a moving convoy; reach the checkpoints while avoiding its escorts.", hazards: ["convoy escorts"], rank: 1 },
  { id: "r-wl-canyon", area: "wastelands", name: "Canyon King", type: "tech", mode: "vehicle", shape: "zig", n: 9, rw: 160, brief: "Narrow canyon roads with steep drops and sharp turns.", hazards: ["drops"], rank: 2 },
  { id: "r-wl-rebelroad", area: "wastelands", name: "Rebel Road Rally", type: "rally", mode: "vehicle", shape: "line", n: 9, rw: 175, brief: "Race rebel drivers along routes held by rival factions.", hazards: ["faction checkpoints"], rank: 2 },
  { id: "r-wl-warrig", area: "wastelands", name: "War Rig Challenge", type: "rally", mode: "vehicle", shape: "loop", n: 8, rw: 160, brief: "A heavy transport through a course built around momentum, turning and durability.", hazards: ["narrow passes"], rank: 2 },
  { id: "r-wl-endurance", area: "wastelands", name: "Wasteland Endurance", type: "endurance", mode: "vehicle", shape: "line", n: 12, rw: 190, brief: "Multiple stages across the desert; vehicle condition carries between stages.", hazards: ["wear"], rank: 3 },
  // Swamps
  { id: "r-sw-mire", area: "swamps", name: "Mire Runner", type: "rally", mode: "vehicle", shape: "line", n: 8, rw: 160, brief: "Muddy tracks, shallow water and winding trails.", hazards: ["mud", "shallows"], rank: 0, crew: "Swamp mud-run specialists" },
  { id: "r-sw-fogline", area: "swamps", name: "Fogline Sprint", type: "parkour", mode: "foot", shape: "zig", n: 7, rw: 45, brief: "Obscured ruins and narrow walkways, guided by directional markers.", hazards: ["fog"], rank: 0, style: true },
  { id: "r-sw-bog", area: "swamps", name: "Bog Breaker", type: "rally", mode: "vehicle", shape: "loop", n: 8, rw: 150, brief: "Difficult terrain: keep momentum and avoid deep mud.", hazards: ["deep mud"], rank: 1, shortcut: true },
  { id: "r-sw-causeway", area: "swamps", name: "Sunken Causeway", type: "parkour", mode: "foot", shape: "line", n: 7, rw: 50, brief: "Short on-foot sections through ruined structures (the vehicle leg needs the mixed-mode loop, not built yet).", hazards: ["broken bridges"], rank: 1, style: true },
  { id: "r-sw-predator", area: "swamps", name: "Predator's Path", type: "hazard", mode: "vehicle", shape: "line", n: 8, rw: 160, brief: "Reach the finish while creatures pursue the racers.", hazards: ["pursuing creatures"], rank: 2 },
  // Solara
  { id: "r-so-sunfire", area: "solara", name: "Sunfire Rally", type: "rally", mode: "vehicle", shape: "line", n: 9, rw: 180, brief: "Dunes, dry riverbeds and rocky terrain.", hazards: ["dunes"], rank: 0, crew: "Solara desert champions" },
  { id: "r-so-dunedevil", area: "solara", name: "Dune Devil", type: "street", mode: "vehicle", shape: "loop", n: 8, rw: 170, brief: "Hold speed over rolling dunes; control the jumps and landings.", hazards: ["jumps"], rank: 1 },
  { id: "r-so-sandstone", area: "solara", name: "Sandstone Sprint", type: "tech", mode: "vehicle", shape: "zig", n: 9, rw: 150, brief: "Tight canyon bends and narrow passages between rock formations.", hazards: ["rock walls"], rank: 1, shortcut: true },
  { id: "r-so-mirage", area: "solara", name: "Mirage Run", type: "rally", mode: "vehicle", shape: "line", n: 8, rw: 180, brief: "Follow distant markers through heat distortion; several routes.", hazards: ["heat haze"], rank: 1, shortcut: true },
  { id: "r-so-scorpion", area: "solara", name: "Scorpion's Chase", type: "hazard", mode: "vehicle", shape: "line", n: 8, rw: 170, brief: "Race while a dangerous desert creature pursues the competitors.", hazards: ["pursuing creature"], rank: 2 },
  { id: "so-sunspire", area: "solara", name: "Sunspire Ascent", type: "parkour", mode: "foot", shape: "zig", n: 5, rw: 38, brief: "A timed climb through fractured sandstone structures.", hazards: ["ledges"], rank: 1, style: true },
  { id: "r-so-caravan", area: "solara", name: "Caravan Cup", type: "endurance", mode: "vehicle", shape: "line", n: 12, rw: 190, brief: "Several stages between desert settlements; vehicle condition carries over.", hazards: ["wear", "sandstorm (telegraphed)"], rank: 3 },
  // Frost Spire
  { id: "r-fs-whiteout", area: "frostspire", name: "Whiteout Rally", type: "rally", mode: "vehicle", shape: "zig", n: 9, rw: 165, brief: "Snow roads, tight mountain bends and reduced visibility.", hazards: ["snow", "low visibility"], rank: 0, crew: "Frost mountain rally teams" },
  { id: "r-fs-glacier", area: "frostspire", name: "Glacier Circuit", type: "street", mode: "vehicle", shape: "loop", n: 8, rw: 150, brief: "Frozen surfaces where braking and cornering demand precision.", hazards: ["ice"], rank: 1 },
  { id: "r-fs-frostline", area: "frostspire", name: "Frostline Climb", type: "climb", mode: "vehicle", shape: "line", n: 8, rw: 160, brief: "A steep mountain ascent with narrow turns and difficult traction.", hazards: ["traction"], rank: 1 },
  { id: "r-fs-avalanche", area: "frostspire", name: "Avalanche Run", type: "hazard", mode: "vehicle", shape: "zig", n: 8, rw: 160, brief: "Race while avoiding collapsing snow and other hazards.", hazards: ["avalanche (telegraphed)"], rank: 2 },
  { id: "r-fs-express", area: "frostspire", name: "Frozen Express", type: "pursuit", mode: "vehicle", shape: "line", n: 8, rw: 165, brief: "Follow a moving transport through a snow-covered route.", hazards: ["transport"], rank: 2 },
  { id: "fs-vertical", area: "frostspire", name: "Icebreaker Challenge", type: "parkour", mode: "foot", shape: "zig", n: 5, rw: 42, brief: "On-foot climbing, sliding and jumps across frozen structures.", hazards: ["ice"], rank: 1, style: true },
  // Hidden events (never on the board; found through discoveries)
  { id: "h-nc-ghostcircuit", area: "neon", name: "The Ghost Circuit", type: "street", mode: "vehicle", shape: "loop", n: 10, rw: 170, brief: "A secret race that starts only after you have found the underground racing markers.", hazards: ["unmarked"], rank: 2, hidden: { markers: ["nc-raceflag", "nc-parkour", "nc-signal"], need: 3 } },
  { id: "h-nx-blackout", area: "nexus", name: "Blackout Run", type: "tech", mode: "vehicle", shape: "zig", n: 9, rw: 150, brief: "A night race through restricted infrastructure corridors.", hazards: ["darkness"], rank: 2, hidden: { markers: ["nx-beacon"], need: 1 } },
  { id: "h-ncd-nulltrack", area: "neon-core", name: "The Null Track", type: "tech", mode: "vehicle", shape: "zig", n: 9, rw: 140, brief: "An experimental course with unstable geometry.", hazards: ["unstable geometry"], rank: 3, windows: true, hidden: { markers: ["ncd-term-a", "ncd-term-b", "ncd-signal"], need: 3 } },
  { id: "h-vf-ancient", area: "veridan", name: "The Ancient Run", type: "rally", mode: "vehicle", shape: "loop", n: 9, rw: 160, brief: "A forgotten course marked by symbols that only show once the nearby beacons are lit.", hazards: ["ruins"], rank: 1, hidden: { markers: ["vf-beacon"], need: 1 } },
  { id: "h-th-ghostfleet", area: "thalassia", name: "The Ghost Fleet", type: "dive", mode: "dive", shape: "loop", n: 9, rw: 58, brief: "An unmarked race through abandoned underwater vessels.", hazards: ["wrecks"], rank: 2, depth: [-18, -28], hidden: { markers: ["th-beacon"], need: 1 } },
  { id: "h-em-furnace", area: "ember", name: "The Furnace Run", type: "tech", mode: "vehicle", shape: "zig", n: 9, rw: 145, brief: "An illegal race through abandoned industrial tunnels.", hazards: ["tunnels"], rank: 2, hidden: { markers: ["em-beacon", "em-flag"], need: 2 } },
  { id: "h-wl-crown", area: "wastelands", name: "The Scavenger's Crown", type: "endurance", mode: "vehicle", shape: "line", n: 12, rw: 190, brief: "A secret multi-stage race; find the wrecked race markers first.", hazards: ["wrecks"], rank: 3, hidden: { markers: ["wl-flag", "wl-convoy", "wl-trail"], need: 3 } },
  { id: "h-sw-drowned", area: "swamps", name: "The Drowned Circuit", type: "rally", mode: "vehicle", shape: "loop", n: 9, rw: 150, brief: "An abandoned course through a partly submerged ruin.", hazards: ["submerged ruin"], rank: 2, hidden: { markers: ["sw-beacon"], need: 1 } },
  { id: "h-so-sunking", area: "solara", name: "The Sun King's Run", type: "rally", mode: "vehicle", shape: "line", n: 10, rw: 185, brief: "A secret course through remote desert ruins.", hazards: ["ruins"], rank: 3, hidden: { markers: ["so-beacon"], need: 1 } },
  { id: "h-fs-frozenghost", area: "frostspire", name: "The Frozen Ghost", type: "rally", mode: "vehicle", shape: "line", n: 9, rw: 165, brief: "An abandoned mountain transit route, found through a signal under the snow.", hazards: ["ice"], rank: 2, hidden: { markers: ["fs-beacon"], need: 1 } },
  // Fracture Runs (predictable reality gates)
  { id: "r-nc-fracture", area: "neon", name: "Fracture Run · Glitch Avenue", type: "tech", mode: "vehicle", shape: "zig", n: 8, rw: 150, brief: "Roads shift between stable and corrupted states on a fixed beat.", hazards: ["reality gates"], rank: 2, windows: true },
  { id: "r-wl-fracture", area: "wastelands", name: "Fracture Run · Shattered Highway", type: "tech", mode: "vehicle", shape: "line", n: 8, rw: 175, brief: "Reality gates open and close along a broken highway.", hazards: ["reality gates"], rank: 3, windows: true },
];

const PAR_BONUS_PER_CP = 1.5;
/** a dive gate never sits below the sea floor (Pressure Drop's deepest gates were under the seabed) or at the surface */
const DIVE_CLEAR = 3;
function diveSafe(area: string, pt: RacePoint): RacePoint {
  if (pt.depth === undefined) return pt;
  const w = pointWorld(area, pt.f), floor = heightAt(w.x, w.z);
  return { ...pt, depth: Math.round(Math.min(WATER_LEVEL - DIVE_CLEAR, Math.max(floor + DIVE_CLEAR, pt.depth)) * 10) / 10 };
}
/** the authored layout of a vehicle course in world coordinates (scripts/bake-race-routes.ts routes these) */
/** the authored on-foot courses in world coordinates (the bake moves any gate that stands in water or inside a building) */
export const rawFootCourses = () => ROWS.filter((r) => r.mode === "foot").map((r) => ({ id: r.id, points: layout(r).points.map((p) => pointWorld(r.area, p.f)) }));
export const rawVehicleCourses = () => ROWS.filter((r) => r.mode === "vehicle").map((r) => { const l = layout(r); return { id: r.id, area: r.area, points: l.points.map((p) => pointWorld(r.area, p.f)), shortcut: l.shortcuts[0] ? { at: l.shortcuts[0].at, skipTo: l.shortcuts[0].skipTo, via: pointWorld(r.area, l.shortcuts[0].via) } : null }; });
/** a vehicle course routed over drivable ground (race-routing.ts), baked for this world scale; else the authored shape */
function routed(row: Row): { points: RacePoint[]; shortcuts: Shortcut[] } {
  const lay = layout(row), baked = row.mode !== "dive" ? BAKED_ROUTES[WORLD_SCALE]?.[row.id] : undefined;
  if (row.mode === "dive") return { ...lay, points: lay.points.map((pt) => diveSafe(row.area, pt)) };
  if (!baked) return lay;
  // on foot: the same gates, only moved off water and out of buildings, so the authored shortcut still lines up
  if (row.mode === "foot") { const a = AREAS[row.area]!; return { points: lay.points.map((pt, i) => { const b = baked.p[i]; return b ? { ...pt, f: [(b[0] - a.x) / a.radius, (b[1] - a.z) / a.radius] as const } : pt; }), shortcuts: lay.shortcuts }; }
  const a = AREAS[row.area]!, f = ([x, z]: readonly [number, number]) => [(x - a.x) / a.radius, (z - a.z) / a.radius] as const;
  const points: RacePoint[] = baked.p.map((xz) => ({ f: f(xz) }));
  // reality gates keep their place along the course (half way and the last gate before the finish)
  if (row.windows) for (const i of [Math.floor(points.length / 2), points.length - 2]) if (i > 0 && i < points.length - 1) points[i] = { ...points[i]!, window: { period: 8, open: 5 } };
  // the shortcut was routed too: a drivable cut from one checkpoint past the next (scripts/bake-race-routes.ts)
  return { points, shortcuts: baked.s ? [{ at: baked.s.at, via: f(baked.s.via), skipTo: baked.s.skipTo }] : [] };
}
/** laps of a circuit (reference: "LAP 1/3"): street and tech circuits run three, rally and dive loops two, foot loops one */
const LAPS: Record<string, number> = { street: 3, tech: 3, rally: 2, dive: 2, hazard: 2 };
export const lapsFor = (row: Pick<Row, "shape" | "type" | "mode">) => (row.shape === "loop" && row.mode !== "foot" ? LAPS[row.type] ?? 1 : 1);
/** repeat a loop's gates for each lap (the finish of one lap is the start line of the next); shortcuts repeat per lap */
function withLaps(c: { points: RacePoint[]; shortcuts: Shortcut[] }, laps: number): { points: RacePoint[]; shortcuts: Shortcut[] } {
  if (laps <= 1) return c;
  const per = c.points.length - 1, points = [...c.points], shortcuts = [...c.shortcuts];
  for (let l = 1; l < laps; l++) { points.push(...c.points.slice(1)); for (const s of c.shortcuts) shortcuts.push({ ...s, at: s.at + l * per, skipTo: s.skipTo + l * per }); }
  return { points, shortcuts };
}
function build(row: Row): RaceDef {
  const laps = lapsFor(row);
  const { points, shortcuts } = withLaps(routed(row), laps);
  const mode = row.mode, len = polyLength(points, row.area), speed = SPEED[row.type] ?? 20;
  const par = row.par ?? Math.max(20, Math.round(len / speed + row.n * PAR_BONUS_PER_CP));
  return { id: row.id, area: row.area, name: row.name, type: row.type, mode, brief: row.brief, hazards: row.hazards ?? [], points, shortcuts, par, rivals: row.rivals ?? 5, crew: row.crew ?? `${AREAS[row.area]!.name} racers`, faction: row.faction ?? FACTION[row.area] ?? "wardens", rank: row.rank ?? 0, style: Boolean(row.style), laps, ...(row.hidden ? { hidden: row.hidden } : {}) };
}
export const RACES: readonly RaceDef[] = ROWS.map(build);
export const raceById = (id: string) => RACES.find((r) => r.id === id);
export const racesIn = (area: string) => RACES.filter((r) => r.area === area && !r.hidden);

const C = (id: string, area: string, name: string, rank: number, rounds: string[]): Championship => ({ id, area, name, rank, rounds });
export const CHAMPIONSHIPS: readonly Championship[] = [
  C("ch-neon-gp", "neon", "Neon Grand Prix", 1, ["nc-circuit", "r-nc-blacktop", "r-nc-lastexit", "r-nc-fracture"]),
  C("ch-nexus", "nexus", "Nexus Championship", 1, ["r-nx-gridlock", "r-nx-sentinel", "r-nx-powergrid", "r-nx-vertical"]),
  C("ch-core-apex", "neon-core", "Aegis Apex Championship", 3, ["r-ncd-coreline", "r-ncd-aegisdrop", "r-ncd-redline", "r-ncd-flux"]),
  C("ch-verdant", "veridan", "Verdant Rally Championship", 1, ["r-vf-wildroot", "r-vf-canopy", "r-vf-riverbreak", "r-vf-ruin"]),
  C("ch-thalassia", "thalassia", "Thalassia Deep Championship", 1, ["r-th-abyssal", "r-th-trench", "r-th-pressure", "r-th-sunken"]),
  C("ch-ember", "ember", "Ember Apex Championship", 1, ["r-em-ashfall", "r-em-cinder", "r-em-foundry", "r-em-magma"]),
  C("ch-wastes", "wastelands", "Black-Market Grand Prix", 2, ["wl-devil", "r-wl-rust", "r-wl-canyon", "r-wl-rebelroad"]),
  C("ch-swamp", "swamps", "Swamp King Championship", 1, ["r-sw-mire", "r-sw-fogline", "r-sw-bog", "r-sw-causeway"]),
  C("ch-solara", "solara", "Solara Grand Championship", 1, ["r-so-sunfire", "r-so-dunedevil", "r-so-sandstone", "r-so-mirage"]),
  C("ch-frost", "frostspire", "Frost Spire Championship", 1, ["r-fs-whiteout", "r-fs-glacier", "r-fs-frostline", "fs-vertical"]),
  C("ch-world-rally", "wastelands", "World Rally Series", 2, ["r-vf-wildroot", "r-em-ashfall", "r-so-sunfire", "r-fs-whiteout", "r-wl-endurance"]),
];
export const championshipById = (id: string) => CHAMPIONSHIPS.find((c) => c.id === id);
export const POINTS_BY_PLACE = [15, 12, 10, 8, 6, 4, 2, 1] as const;

/* ------------------------------ records (saved in earnedRewards; cloud merge unions them) ------------------------------ */
type Store = Pick<PlayerProgression, "earnedRewards">;
const pbKey = (id: string, d: Difficulty) => `race-pb:${id}:${d}:`;
const medalKey = (id: string, d: Difficulty, m: Medal) => `race-medal:${id}:${d}:${m}`;
const champKey = (c: string, r: string) => `champ:${c}:${r}:`;
export type Medal = "gold" | "silver" | "bronze";
const MEDAL_VALUE: Record<Medal, number> = { bronze: 1, silver: 2, gold: 3 }, DIFF_SCORE: Record<Difficulty, number> = { standard: 1, advanced: 1.5, legendary: 2.5 };
export function personalBest(p: Store, id: string, d: Difficulty): number | null { const k = p.earnedRewards.find((r) => r.startsWith(pbKey(id, d))); return k ? Number(k.slice(pbKey(id, d).length)) / 1000 : null; }
export const bestMedal = (p: Store, id: string, d: Difficulty): Medal | null => (["gold", "silver", "bronze"] as const).find((m) => p.earnedRewards.includes(medalKey(id, d, m))) ?? null;
export function racingScore(p: Store): number {
  let s = 0;
  for (const r of RACES) for (const d of DIFFICULTIES) { const m = bestMedal(p, r.id, d); if (m) s += MEDAL_VALUE[m] * DIFF_SCORE[d]; }
  return s;
}
export const championshipsWon = (p: Store) => CHAMPIONSHIPS.filter((c) => p.earnedRewards.includes(`champ-done:${c.id}`)).length;
/** rank follows real results (medals weighted by difficulty), not races entered; Legend also needs two championships */
export function rankIndex(p: Store): number { const s = racingScore(p); let r = 0; for (let i = 0; i < RANK_AT.length; i++) if (s >= RANK_AT[i]!) r = i; return r === 4 && championshipsWon(p) < 2 ? 3 : r; }
export const rankName = (p: Store) => RANKS[rankIndex(p)]!;
export function championshipPoints(p: Store, c: Championship): { perRound: Record<string, number>; total: number; complete: boolean } {
  const perRound: Record<string, number> = {};
  for (const r of c.rounds) { const k = p.earnedRewards.find((e) => e.startsWith(champKey(c.id, r))); if (k) perRound[r] = Number(k.slice(champKey(c.id, r).length)); }
  return { perRound, total: Object.values(perRound).reduce((a, b) => a + b, 0), complete: c.rounds.every((r) => r in perRound) };
}
export function difficultyLocked(p: Store, id: string, d: Difficulty): string | null {
  if (d === "advanced" && !bestMedal(p, id, "standard")) return "Earn a medal on Standard first";
  if (d === "legendary" && bestMedal(p, id, "advanced") !== "gold") return "Earn a gold on Advanced first";
  return null;
}

/* ------------------------------ run state ------------------------------ */
export type RaceResult = { valid: boolean; time: number; penalties: number; par: number; medal: Medal | null; place: number; field: number; style: number; difficulty: Difficulty };
export type RaceRun = {
  raceId: string; difficulty: Difficulty; phase: "staging" | "countdown" | "running" | "finished" | "failed"; wall0: number; countdown: number; time: number; next: number; passed: number[];
  penalties: number; collisions: number; /** track obstacles already struck (each counts once) */ hitObstacles?: string[]; /** 0..1, decays: a fresh obstacle hit caps the car's speed (raceSpeedFactor) */ impact?: number; recoveries: number; outside: number; style: number; notice: string | null; failReason?: string; viaShortcut: boolean;
  /** set when the player must be put back on the course; the host teleports and clears it */ recover: { x: number; z: number; depth?: number } | null; result?: RaceResult;
};
export const newRaceRun = (def: RaceDef, difficulty: Difficulty, now: number): RaceRun => ({ raceId: def.id, difficulty, phase: "staging", wall0: now, countdown: COUNTDOWN_S, time: 0, next: 1, passed: [], penalties: 0, collisions: 0, recoveries: 0, outside: 0, style: 0, notice: null, viaShortcut: false, recover: null });
export const timeLimit = (def: RaceDef, d: Difficulty) => Math.round(def.par * TIME_LIMIT_MULT[d]);
export const worldPoint = (def: RaceDef, i: number) => { const pt = def.points[Math.max(0, Math.min(def.points.length - 1, i))]!; return { ...pointWorld(def.area, pt.f), ...(pt.depth !== undefined ? { depth: pt.depth } : {}) }; };

const MAX_RECOVERIES = 4, COLLISION_PENALTY = 1.5, COLLISION_CAP = 12, RECOVERY_PENALTY = 5, WRECK_PENALTY = 8, STAGING_TIMEOUT_S = 600;
function segDist(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number { const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz; const u = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2)) : 0; return Math.hypot(px - (ax + u * dx), pz - (az + u * dz)); }
export const windowOpen = (pt: RacePoint, time: number) => !pt.window || (time % pt.window.period) < pt.window.open;

/** one tick of the race. Time only advances in running frames and is clamped per frame, so a long pause cannot bank or lose seconds;
 * a wall-clock guard fails a race that is left open far past its limit. */
export function tickRace(def: RaceDef, run: RaceRun, t: Pick<Tick, "x" | "z" | "dt" | "now" | "mode" | "y" | "vehicleDisabled" | "fell" | "collisions" | "style">): RaceRun {
  if (run.phase === "finished" || run.phase === "failed") return run;
  const limit = timeLimit(def, run.difficulty), dt = Math.max(0, Math.min(t.dt, 0.25)), cr = CHECKPOINT_RADIUS[def.mode];
  const fail = (why: string) => { run.phase = "failed"; run.failReason = why; };
  if ((t.now - run.wall0) / 1000 > (run.phase === "staging" ? STAGING_TIMEOUT_S : limit * 1.6 + 30)) { fail(run.phase === "staging" ? "Never reached the start line" : "Out of time"); return run; }
  const modeOk = (t.mode ?? def.mode) === def.mode;
  run.notice = modeOk ? null : WRONG_MODE_NOTE;
  const start = worldPoint(def, 0);
  if (run.phase === "staging") { if (modeOk && Math.hypot(t.x - start.x, t.z - start.z) <= START_RADIUS) { run.phase = "countdown"; run.countdown = COUNTDOWN_S; } return run; }
  if (run.phase === "countdown") {
    if (!modeOk || Math.hypot(t.x - start.x, t.z - start.z) > START_RADIUS) { run.phase = "staging"; run.notice = modeOk ? "Stay on the start line" : WRONG_MODE_NOTE; return run; }
    run.countdown -= dt; if (run.countdown <= 0) { run.phase = "running"; run.countdown = 0; } return run;
  }
  // running
  run.time += dt;
  if (run.time > limit) { fail("Out of time"); return run; }
  run.collisions += t.collisions ?? 0;
  // track obstacles (hazard courses): striking one is a collision penalty and a moment of lost speed, once per obstacle
  run.impact = Math.max(0, (run.impact ?? 0) - dt * 0.55);
  if (modeOk && def.mode === "vehicle") {
    const hits = (run.hitObstacles ??= []);
    for (const o of raceObstacles(def)) {
      if (o.segment !== run.next || hits.includes(o.id) || Math.hypot(t.x - o.x, t.z - o.z) > o.radius) continue;
      hits.push(o.id); run.collisions++; run.impact = 1; run.notice = "Hit a track obstacle: collision penalty";
    }
  }
  run.style += Math.max(0, t.style ?? 0);
  const collisionPenalty = Math.min(COLLISION_CAP, run.collisions * COLLISION_PENALTY);
  const recover = (penalty: number, why: string) => { if (++run.recoveries > MAX_RECOVERIES) { fail("Too many recoveries"); return; } run.penalties += penalty; const back = worldPoint(def, run.next > 1 ? run.next - 1 : 0); run.recover = { x: back.x, z: back.z, ...(back.depth !== undefined ? { depth: back.depth } : {}) }; run.notice = why; run.outside = 0; };
  if (t.vehicleDisabled && def.mode === "vehicle") { recover(WRECK_PENALTY, "Vehicle wrecked: recovered to the last checkpoint"); return run; }
  if (t.fell) { recover(RECOVERY_PENALTY, "Recovered to the last checkpoint"); return run; }
  // staying on the course: distance to the leg you are on (and the shortcut leg, if one is offered here)
  const prev = worldPoint(def, run.next - 1), nxt = worldPoint(def, run.next);
  let off = segDist(t.x, t.z, prev.x, prev.z, nxt.x, nxt.z);
  const sc = def.shortcuts.find((s) => s.at === run.next);
  if (sc) { const v = pointWorld(def.area, sc.via); off = Math.min(off, segDist(t.x, t.z, prev.x, prev.z, v.x, v.z)); }
  if (off > CORRIDOR[def.mode]) { run.outside += dt; if (run.outside > 8) { recover(RECOVERY_PENALTY, "Left the course: recovered to the last checkpoint"); return run; } if (run.outside > 3) run.notice = "Return to the course"; } else run.outside = 0;
  if (!modeOk) return run;
  const depthOk = (pt: RacePoint) => pt.depth === undefined || t.y === undefined || Math.abs(t.y - pt.depth) <= 8;
  const near = (w: { x: number; z: number }) => Math.hypot(t.x - w.x, t.z - w.z) <= cr;
  // shortcut: an authored alternative gate that lets you skip ahead, only by actually passing through it
  if (sc && near(pointWorld(def.area, sc.via))) { for (let k = run.next; k < sc.skipTo; k++) run.passed.push(k); run.next = sc.skipTo; run.viaShortcut = true; run.notice = "Shortcut taken"; }
  const pt = def.points[run.next];
  if (pt && near(nxt) && depthOk(pt)) {
    if (!windowOpen(pt, run.time)) { run.notice = "Gate closed: wait for it to open"; }
    else { run.passed.push(run.next); run.next++; }
  }
  if (run.next >= def.points.length) {
    // the last index is the finish; reaching it in order, with every gate counted, is the only valid finish
    run.phase = "finished";
    run.result = evaluate(def, run, collisionPenalty);
  }
  return run;
}

/* ------------------------------ rivals ------------------------------ */
/** deterministic pace multipliers (of par) for each rival. Higher difficulty tightens the field; rivals never get speed they could not have on the same course */
export function rivalTimes(def: RaceDef, d: Difficulty): number[] {
  const r = rng(hash(`${def.id}:${d}`)), [lo, hi] = d === "standard" ? [0.98, 1.35] : d === "advanced" ? [0.94, 1.2] : [0.88, 1.08];
  return Array.from({ length: def.rivals }, () => def.par * (lo + (hi - lo) * r())).sort((a, b) => a - b);
}
export function rivalPositions(def: RaceDef, d: Difficulty, time: number): { x: number; z: number; depth?: number; progress: number }[] {
  const legs: number[] = []; let total = 0;
  for (let i = 1; i < def.points.length; i++) { const a = worldPoint(def, i - 1), b = worldPoint(def, i); const l = Math.hypot(a.x - b.x, a.z - b.z); legs.push(l); total += l; }
  return rivalTimes(def, d).map((rt, k) => {
    let dist = Math.min(1, time / rt) * total, i = 0; while (i < legs.length - 1 && dist > legs[i]!) { dist -= legs[i]!; i++; }
    const a = worldPoint(def, i), b = worldPoint(def, i + 1), u = legs[i] ? Math.min(1, dist / legs[i]!) : 0, lateral = (k % 2 ? 1 : -1) * (3 + k);
    const nx = -(b.z - a.z) / (legs[i] || 1), nz = (b.x - a.x) / (legs[i] || 1);
    return { x: a.x + (b.x - a.x) * u + nx * lateral, z: a.z + (b.z - a.z) * u + nz * lateral, ...(a.depth !== undefined && b.depth !== undefined ? { depth: a.depth + (b.depth - a.depth) * u } : {}), progress: Math.min(1, time / rt) };
  });
}
export function evaluate(def: RaceDef, run: RaceRun, collisionPenalty: number): RaceResult {
  const total = run.time + run.penalties + collisionPenalty, d = run.difficulty, gold = def.par * GOLD_MULT[d];
  // a shortcut counts the gates it skips as passed (tickRace), so every valid finish has passed them all
  const valid = run.next >= def.points.length && run.passed.length >= def.points.length - 1;
  const medal: Medal | null = !valid ? null : total <= gold ? "gold" : total <= gold * 1.15 ? "silver" : total <= gold * 1.35 ? "bronze" : null;
  const field = rivalTimes(def, d), place = 1 + field.filter((rt) => rt < total).length;
  return { valid, time: Math.round(total * 1000) / 1000, penalties: Math.round((run.penalties + collisionPenalty) * 1000) / 1000, par: def.par, medal, place, field: field.length + 1, style: Math.round(run.style), difficulty: d };
}

/* ------------------------------ saving a result ------------------------------ */
const PLACE_BONUS = [0.5, 0.3, 0.15] as const;
export type RaceReward = { nexBonus: number; personalBest: boolean; medal: Medal | null; newMedal: boolean; championshipPoints: number | null; championshipDone: boolean; rankUp: string | null };
/** Apply a finished race to the save. Idempotent per run: the Nex ledger key is the run itself, so a repeated completion event pays and records nothing twice.
 * The activity engine has already paid the base reward; this adds placement/medal Nex and the racing records. */
export function applyRaceResult(p: PlayerProgression, def: ActivityDef, run: Run): { progression: PlayerProgression; reward: RaceReward } | { error: string } {
  const rr = run.race as RaceRun | undefined, race = rr && raceById(rr.raceId);
  if (!rr || !race || rr.phase !== "finished" || !rr.result?.valid) return { error: "No valid result" };
  const key = `race-run:${def.id}:${run.startedAt}`;
  if (p.nexLedger[key] !== undefined) return { error: "Already recorded" };
  const res = rr.result, d = res.difficulty, before = rankIndex(p);
  let earned = [...p.earnedRewards];
  const best = personalBest({ earnedRewards: earned }, race.id, d), isPb = best === null || res.time < best;
  if (isPb) earned = [...earned.filter((e) => !e.startsWith(pbKey(race.id, d))), `${pbKey(race.id, d)}${Math.round(res.time * 1000)}`];
  let newMedal = false;
  if (res.medal) for (const m of ["gold", "silver", "bronze"] as const) if (MEDAL_VALUE[m] <= MEDAL_VALUE[res.medal] && !earned.includes(medalKey(race.id, d, m))) { earned.push(medalKey(race.id, d, m)); if (m === res.medal) newMedal = true; }
  const bonusMult = (PLACE_BONUS[res.place - 1] ?? 0) + (res.medal === "gold" ? 0.3 : res.medal === "silver" ? 0.15 : 0) + (DIFF_REWARD[d] - 1);
  const nexBonus = Math.round(def.rewards.nex * bonusMult);
  let next: PlayerProgression = { ...p, earnedRewards: earned, nexLedger: { ...p.nexLedger, [key]: nexBonus } };
  // championship rounds: keep your best score per round
  let champPts: number | null = null, champDone = false;
  for (const c of CHAMPIONSHIPS) if (c.rounds.includes(race.id)) {
    const pts = POINTS_BY_PLACE[res.place - 1] ?? 0; champPts = pts;
    const prevKey = next.earnedRewards.find((e) => e.startsWith(champKey(c.id, race.id))), prev = prevKey ? Number(prevKey.slice(champKey(c.id, race.id).length)) : -1;
    if (pts > prev) next = { ...next, earnedRewards: [...next.earnedRewards.filter((e) => e !== prevKey), `${champKey(c.id, race.id)}${pts}`] };
    const status = championshipPoints(next, c);
    if (status.complete && !next.earnedRewards.includes(`champ-done:${c.id}`)) {
      champDone = true;
      next = { ...next, earnedRewards: [...next.earnedRewards, `champ-done:${c.id}`, `race-title:${c.id}`], nexLedger: { ...next.nexLedger, [`champ-reward:${c.id}`]: 400 + c.rank * 150 } };
    }
  }
  const after = rankIndex(next);
  return { progression: next, reward: { nexBonus, personalBest: isPb, medal: res.medal, newMedal, championshipPoints: champPts, championshipDone: champDone, rankUp: after > before ? RANKS[after]! : null } };
}

/* ------------------------------ activities, discoveries, hooks ------------------------------ */
const REGION_MATERIAL: Record<string, MaterialId[]> = { neon: ["microCircuits", "energyToken"], nexus: ["microCircuits", "reinforcedAlloy"], "neon-core": ["dataChip", "anomalyCore"], veridan: ["sporeFiber", "bioCatalyst"], thalassia: ["abyssCore", "reinforcedAlloy"], ember: ["thermalShards", "magmaCore"], wastelands: ["vehicleParts", "scrapMetal"], swamps: ["bioCatalyst", "sporeFiber"], solara: ["runeDust", "relicFragment"], frostspire: ["cryoCrystal", "zeroCore"] };
const gateFor = (race: RaceDef) => (p: Pick<PlayerProgression, "earnedRewards" | "missionRuns">): string | null => (rankIndex(p) >= race.rank ? null : `Requires racing rank ${RANKS[race.rank]}`);
export function hiddenUnlocked(p: Pick<PlayerProgression, "missionRuns">, race: RaceDef): boolean { if (!race.hidden) return true; return race.hidden.markers.filter((m) => p.missionRuns[`act:d-${m}`] !== undefined).length >= race.hidden.need; }
function raceActivity(race: RaceDef): ActivityDef {
  const [m1, m2] = REGION_MATERIAL[race.area] ?? ["scrapMetal", "energyToken"], core = race.area === "neon-core";
  const foot = race.mode === "foot";
  return {
    id: race.id, area: race.area, name: race.name, kind: foot ? "parkour" : "race", difficulty: (Math.min(4, 1 + race.rank) as 1 | 2 | 3 | 4), faction: race.faction, brief: race.brief,
    attempts: core || race.hidden ? 2 : 3, cooldownMin: core ? 60 : race.rank >= 2 ? 30 : 20,
    stages: [{ kind: "race", raceId: race.id, timeLimit: timeLimit(race, "standard"), label: race.name }], challenge: { id: "gold", label: "Finish with a gold-medal time" },
    rewards: R(90 + race.rank * 45 + (race.hidden ? 120 : 0), 55 + race.rank * 25, 10 + race.rank * 4, { [m1!]: 2 + race.rank, [m2!]: 1 + race.rank }, race.hidden ? 0.25 : 0.05 + race.rank * 0.02),
    ...(race.mode === "dive" ? { submerged: true } : {}), gate: gateFor(race),
  };
}
(function register() {
  for (const race of RACES) {
    const def = raceActivity(race);
    if (race.hidden) {
      EXTRA_DEFS.push(def);
      const d: Discovery = { id: race.id, area: race.area, kind: "movement", name: race.name, sign: race.brief, at: race.points[0]!.f, hidden: true, def, unlock: (p) => hiddenUnlocked(p, race) };
      (DISCOVERIES as Discovery[]).push(d);
    } else (ACTIVITIES as ActivityDef[]).push(def);
  }
})();

export const isRaceActivity = (def: ActivityDef) => def.stages[0]?.kind === "race";
hooks.race = (def, run, o, t) => {
  const race = raceById(o.raceId); if (!race) { run.status = "failed"; run.failReason = "Unknown race"; return; }
  const st = (run.race ??= newRaceRun(race, ((run.difficulty as Difficulty | undefined) ?? "standard"), t.now)) as RaceRun;
  tickRace(race, st, t);
  if (st.phase === "finished") { run.progress = 1; if (st.result?.valid) run.status = "complete"; else { run.status = "failed"; run.failReason = "Invalid finish"; } }
  else if (st.phase === "failed") { run.status = "failed"; run.failReason = st.failReason ?? "Failed"; }
};
hooks.raceTarget = (def, run) => {
  const o = def.stages[0]; if (!o || o.kind !== "race") return null;
  const race = raceById(o.raceId), st = run.race as RaceRun | undefined; if (!race) return null;
  const i = !st || st.phase === "staging" || st.phase === "countdown" ? 0 : st.next;
  const w = worldPoint(race, i);
  return { x: w.x, z: w.z, label: i === 0 ? "Start line" : i >= race.points.length - 1 ? "Finish" : `Checkpoint ${i}/${race.points.length - 2}` };
};

/* ------------------------------ live standings (HUD) ------------------------------ */
/** how far along the course a racer is, 0..1 by distance: legs done plus the share of the current leg covered */
export function courseProgress(def: RaceDef, next: number, x: number, z: number): number {
  const legs: number[] = []; let total = 0;
  for (let i = 1; i < def.points.length; i++) { const a = worldPoint(def, i - 1), b = worldPoint(def, i); const l = Math.hypot(a.x - b.x, a.z - b.z); legs.push(l); total += l; }
  if (!total) return 0;
  const leg = Math.max(1, Math.min(def.points.length - 1, next));
  let done = 0; for (let i = 0; i < leg - 1; i++) done += legs[i]!;
  const a = worldPoint(def, leg - 1), b = worldPoint(def, leg), dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz;
  const u = l2 ? Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l2)) : 0;
  return Math.min(1, (done + u * (legs[leg - 1] ?? 0)) / total);
}
/** your place in the field right now (1 = leading), against the rivals' deterministic pace on the same course */
export function livePlace(def: RaceDef, run: RaceRun, x: number, z: number): { place: number; field: number } {
  if (run.phase !== "running") return { place: def.rivals + 1, field: def.rivals + 1 };
  const me = courseProgress(def, run.next, x, z), rivals = rivalPositions(def, run.difficulty, run.time);
  return { place: 1 + rivals.filter((r) => r.progress > me).length, field: rivals.length + 1 };
}

/* ------------------------------ track obstacles ------------------------------ */
/** Hazard courses put an obstacle (boulder, debris, barrier) a little off the line on each long leg: steer round it or
 * take a collision penalty and lose speed for a moment. Deterministic per course; the renderer (RaceCourse.tsx) and
 * tickRace use the same list. Only on drivable ground (race-routing.ts), so one never sits in a river or a wall. */
export type RaceObstacle = { id: string; x: number; z: number; radius: number; segment: number };
const obstacleCache = new Map<string, RaceObstacle[]>();
export function raceObstacles(def: RaceDef): RaceObstacle[] {
  const hit = obstacleCache.get(def.id);
  if (hit) return hit;
  const out: RaceObstacle[] = [];
  if (def.mode === "vehicle" && def.hazards.length) for (let i = 1; i < def.points.length; i++) {
    const a = worldPoint(def, i - 1), b = worldPoint(def, i), dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
    if (len < 40) continue;
    const side = hash(`${def.id}:${i}`) & 1 ? 1 : -1, x = a.x + dx * 0.52 + (side * dz / len) * 4.5, z = a.z + dz * 0.52 - (side * dx / len) * 4.5;
    if (!drivablePoint(x, z)) continue;
    out.push({ id: `${def.id}:ob:${i}`, x, z, radius: 2.8, segment: i });
  }
  obstacleCache.set(def.id, out);
  return out;
}
/** the car's speed ceiling while recovering from an obstacle hit: 55% at the moment of impact, back to full as it fades */
export const raceSpeedFactor = (impact: number | undefined) => 1 - 0.45 * Math.max(0, Math.min(1, impact ?? 0));
