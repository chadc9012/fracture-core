/**
 * Vehicle weapons (pure). Every vehicle fires the hardpoints its catalogue entry lists (vehicles.ts `weapon`), not one
 * shared rifle: a tank's cannon is slow and splashes, a helicopter's chain gun chatters, a jet's guns converge ahead of
 * the nose and its missiles track, a bike's twin emitters alternate. Primary fire is bullets (sim.fireBullet), secondary
 * fire is ordnance (sim.fireOrdnance, ordnance.ts rules).
 *
 * Where the shot starts and where it goes:
 *  - muzzles are offsets in the vehicle's own frame (right, up, forward, metres), turned by the vehicle's yaw, pitch and
 *    roll, so rounds leave the gun barrels — never the driver's seat or the inside of the hull;
 *  - rounds inherit the vehicle's velocity, so a jet at 90 m/s never flies into its own tracers and a strafing car's
 *    rounds don't drift behind it;
 *  - turrets (tank, jeep pintle, boat deck gun, helicopter chin gun) aim where the camera looks; fixed guns (jets, bikes,
 *    cars) aim along the nose, with a little camera pitch allowed so a pilot can walk rounds onto a target.
 */
import type { HandlingKind } from "./vehicle-handling";
import type { VehicleId } from "./vehicles";
import { kitGun, type Kit } from "./vehicle-foundry";

export type VehicleGun = {
  name: string;
  /** seconds between shots */
  rate: number;
  /** bullet-equivalent damage per round (a rifle round is 1) */
  damage: number;
  /** radians of random spread */
  spread: number;
  /** muzzle velocity, m/s (added to the vehicle's own velocity) */
  speed: number;
  /** knockback per round */
  knock: number;
  /** heat per round, as a fraction of a foot weapon's */
  heat: number;
  /** barrel offsets [right, up, forward]; consecutive shots alternate through them */
  muzzles: readonly (readonly [number, number, number])[];
  /** turret: aims with the camera; fixed: aims along the nose (camera pitch clamped to ±pitchAssist) */
  mount: "TURRET" | "FIXED";
  pitchAssist: number;
  /** fixed guns converge on a point this far ahead (m); 0 = parallel */
  converge: number;
  sound: "VEHICLE" | "AUTO" | "PULSE";
  /** cannons fire shells: ordnance with this splash radius (m) instead of bullets */
  shell?: number;
};
export type VehicleOrdnance = {
  /** ordnance.ts id */
  ordnance: string;
  name: string;
  /** seconds between launches, and launches per salvo (pods ripple) */
  rate: number; salvo: number; salvoGap: number;
  damage: number;
  muzzles: readonly (readonly [number, number, number])[];
  mount: "TURRET" | "FIXED";
};
/** `primary` null = unarmed (a city runabout). `secondaryGun`: a build whose second hardpoint is a gun (a pintle MG, trailer nests)
 * fires it on the secondary trigger instead of ordnance. */
export type VehicleArmament = { primary: VehicleGun | null; secondary: VehicleOrdnance | null; secondaryGun?: VehicleGun | null };

const gun = (g: Partial<VehicleGun> & Pick<VehicleGun, "name" | "muzzles">): VehicleGun => ({ rate: 0.12, damage: 1, spread: 0.012, speed: 160, knock: 1, heat: 0.6, mount: "FIXED", pitchAssist: 0.18, converge: 0, sound: "VEHICLE", ...g });

/** armament per handling class; individual vehicles below override it */
const BY_KIND: Record<HandlingKind, VehicleArmament> = {
  RACER: { primary: gun({ name: "Roof repeater", rate: 0.11, damage: 0.9, muzzles: [[0.35, 1.25, 1.2], [-0.35, 1.25, 1.2]], converge: 60 }), secondary: null },
  OFFROAD: { primary: gun({ name: "Pintle machine gun", rate: 0.1, damage: 1, spread: 0.016, muzzles: [[0, 2.1, 0.4]], mount: "TURRET" }), secondary: null },
  TANK: {
    primary: gun({ name: "120mm fracture cannon", rate: 1.4, damage: 9, spread: 0.002, speed: 220, knock: 6, heat: 3, muzzles: [[0, 2.35, 4.6]], mount: "TURRET", sound: "VEHICLE", shell: 4.5 }),
    secondary: { ordnance: "guided-missile", name: "Guided anti-armor missile", rate: 6, salvo: 1, salvoGap: 0, damage: 22, muzzles: [[0.9, 2.6, 0.5]], mount: "TURRET" },
  },
  JET: {
    primary: gun({ name: "Arc cannon", rate: 0.07, damage: 1.2, spread: 0.008, speed: 260, muzzles: [[1.1, 0.8, 3.2], [-1.1, 0.8, 3.2]], converge: 220, pitchAssist: 0.12, sound: "PULSE", heat: 0.45 }),
    secondary: { ordnance: "air-missile", name: "Missiles", rate: 2.2, salvo: 2, salvoGap: 0.18, damage: 16, muzzles: [[2.4, 0.6, 0.6], [-2.4, 0.6, 0.6]], mount: "FIXED" },
  },
  HELI: {
    primary: gun({ name: "Chin chain gun", rate: 0.065, damage: 0.9, spread: 0.02, speed: 200, heat: 0.35, muzzles: [[0, 0.55, 2.6]], mount: "TURRET", sound: "AUTO" }),
    secondary: { ordnance: "rocket-pod", name: "Rocket pods", rate: 2.6, salvo: 6, salvoGap: 0.09, damage: 8, muzzles: [[1.6, 0.9, 0.8], [-1.6, 0.9, 0.8]], mount: "FIXED" },
  },
  BOAT: { primary: gun({ name: "Heavy deck gun", rate: 0.16, damage: 1.6, spread: 0.014, speed: 170, knock: 2, heat: 0.9, muzzles: [[0, 2.2, 2.2]], mount: "TURRET" }), secondary: null },
  SUB: {
    primary: gun({ name: "Bow cannon", rate: 0.2, damage: 1.4, spread: 0.01, speed: 120, muzzles: [[0, 0.4, 3]], mount: "FIXED", pitchAssist: 0.3 }),
    secondary: { ordnance: "phase-torpedo", name: "Phase torpedoes", rate: 3.5, salvo: 1, salvoGap: 0, damage: 20, muzzles: [[0, -0.3, 3]], mount: "FIXED" },
  },
};

const BY_ID: Partial<Record<VehicleId, { primary?: Partial<VehicleGun>; secondary?: VehicleOrdnance | null }>> = {
  "aether-hoverbike": { primary: { name: "Twin pulse emitters", rate: 0.09, damage: 0.8, muzzles: [[0.3, 0.75, 1.1], [-0.3, 0.75, 1.1]], converge: 50, sound: "PULSE" } },
  "scrap-interceptor": { primary: { name: "Roof repeater", rate: 0.1, damage: 1 } },
  "raider-buggy": { primary: { name: "Ram-cage SMGs", rate: 0.08, damage: 0.7, spread: 0.022, mount: "FIXED", muzzles: [[0.6, 1.1, 1.6], [-0.6, 1.1, 1.6]], converge: 40 } },
  "tech-transport": { primary: { name: "Pulse-laser array", rate: 0.09, damage: 1.1, spread: 0.008, speed: 220, muzzles: [[0, 3.2, 1.5]], mount: "TURRET", sound: "PULSE" } },
  "void-skimmer": { primary: { name: "Void lance", rate: 0.35, damage: 4, spread: 0.002, speed: 320, muzzles: [[0, 0.7, 4]], sound: "PULSE" } },
  "ai-interceptor": { primary: { name: "Continuous laser", rate: 0.05, damage: 0.7, spread: 0.003, speed: 300, heat: 0.3, muzzles: [[0, 0.7, 2.5]], sound: "PULSE" } },
  leviathan: { primary: { name: "Heavy energy batteries", rate: 0.3, damage: 3, spread: 0.01, speed: 200, knock: 3, muzzles: [[2.5, 4, 6], [-2.5, 4, 6]], mount: "TURRET", sound: "PULSE" } },
};

type Override = { primary?: Partial<VehicleGun> | null; secondary?: VehicleOrdnance | null; secondaryGun?: Partial<VehicleGun> & Pick<VehicleGun, "name" | "muzzles"> };

/** Fleet builds (fleet.ts) fire what their own hardpoint list names, on top of their chassis. Non-gun hardpoints (mine and
 * caltrop droppers, flare pods, flame jets, the Remora drone dock, the breach thruster, the ramming grill) are gadgets in
 * vehicle-gadgets.ts on the secondary trigger, so those builds carry no secondary ordnance here. */
const pulse = "PULSE" as const;
export const BY_BUILD: Record<string, Override> = {
  "goliath-4x4": { primary: { name: "12.7mm auto-turret", rate: 0.09, damage: 1.2, spread: 0.014, knock: 1.4, muzzles: [[0, 2.15, 0.2]], mount: "TURRET" } },
  "behemoth-v16": { primary: { name: "20mm autocannon", rate: 0.18, damage: 2.2, spread: 0.012, speed: 180, knock: 2.2, heat: 0.9, muzzles: [[0, 1.9, 0.6]], mount: "TURRET", converge: 0 } },
  "dune-stalker": { primary: { name: "Front twin heavy MGs", rate: 0.1, damage: 1.1, spread: 0.016, muzzles: [[0.35, 0.8, 1.2], [-0.35, 0.8, 1.2]], converge: 60, sound: "AUTO" } },
  "aegis-siege": {
    primary: { name: "120mm plasma smoothbore", sound: pulse },
    secondary: null,
    secondaryGun: { name: "Pintle: pulse machine gun", rate: 0.08, damage: 0.9, spread: 0.016, speed: 220, heat: 0.4, muzzles: [[-0.7, 3.0, 0.8]], mount: "TURRET", sound: pulse },
  },
  "valkyrie-vtol": {
    primary: { name: "30mm rotary cannon", rate: 0.08, damage: 1.4, spread: 0.018, speed: 210, heat: 0.4, muzzles: [[0, 0.5, 3.2]] },
    secondary: { ordnance: "guided-missile", name: "Lock-on rocket pods", rate: 3, salvo: 4, salvoGap: 0.12, damage: 9, muzzles: [[1.7, 0.9, 0.8], [-1.7, 0.9, 0.8]], mount: "FIXED" },
  },
  "ghost-ray": { primary: { name: "Thermal sniper / pulse array", rate: 0.6, damage: 4.5, spread: 0.001, speed: 320, knock: 2, heat: 1.4, muzzles: [[0, 0.85, 1.2]], converge: 0, sound: pulse } },
  "f39-jupiter": { primary: { name: "Arc cannon" }, secondary: null },
  "nautilus-abyss": {
    primary: { name: "Hull: mining laser", rate: 0.05, damage: 0.6, spread: 0.002, speed: 260, heat: 0.3, sound: pulse },
    secondary: { ordnance: "phase-torpedo", name: "Sonic torpedoes", rate: 3.5, salvo: 1, salvoGap: 0, damage: 20, muzzles: [[0, -0.3, 3]], mount: "FIXED" },
  },
  "triton-hydrospear": {
    primary: { name: "Plasma arc turret", rate: 0.12, damage: 1.3, spread: 0.012, speed: 220, sound: pulse },
    secondary: { ordnance: "phase-torpedo", name: "Micro torpedo racks", rate: 3, salvo: 3, salvoGap: 0.15, damage: 10, muzzles: [[1, 0.4, 2], [-1, 0.4, 2]], mount: "FIXED" },
  },
  "nomad-bike": { primary: { name: "Bar-mounted twin SMGs", rate: 0.07, damage: 0.65, spread: 0.02, muzzles: [[0.3, 0.85, 1], [-0.3, 0.85, 1]], converge: 45, sound: "AUTO" } },
  "rift-runner": { primary: { name: "Hood: rift-shot cannon", rate: 0.45, damage: 3, spread: 0.004, speed: 220, knock: 2.5, heat: 1.2, muzzles: [[0, 1, 2]], converge: 0, sound: pulse } },
  "sandstalker-atv": { primary: { name: "Roll bar: light machine gun", rate: 0.1, damage: 0.9 } },
  "void-chaser": { primary: { name: "Twin void lances", rate: 0.3, damage: 2.6, spread: 0.002, speed: 320, knock: 1.8, heat: 0.9, muzzles: [[0.6, 0.7, 2.2], [-0.6, 0.7, 2.2]], converge: 120, sound: pulse }, secondary: null },
  "civic-rover": { primary: null, secondary: null },
  "neon-drift": { primary: { name: "Underglow arc emitters", rate: 0.08, damage: 0.8, spread: 0.03, speed: 110, heat: 0.5, muzzles: [[0.8, 0.4, 1.6], [-0.8, 0.4, 1.6]], converge: 30, sound: pulse } },
  "war-rig": {
    primary: { name: "Cab: flak turret", rate: 0.22, damage: 1.8, spread: 0.03, speed: 170, knock: 2, heat: 0.8, muzzles: [[0, 3.4, 2]], mount: "TURRET" },
    secondaryGun: { name: "Trailer: twin heavy MG nests", rate: 0.08, damage: 1, spread: 0.018, speed: 170, heat: 0.4, muzzles: [[1.2, 3.1, -3.5], [-1.2, 3.1, -3.5]], mount: "TURRET", sound: "AUTO" },
  },
  "apex-hauler": { primary: { name: "Roof: point-defence laser", rate: 0.06, damage: 0.7, spread: 0.002, speed: 300, heat: 0.3, muzzles: [[0, 3.4, 1]], mount: "TURRET", sound: pulse } },
  skyhawk: { primary: { name: "Chin: 20mm gun", rate: 0.1, damage: 1.2, spread: 0.016 }, secondary: null },
  riftwing: { primary: { name: "Wing-root rift cannons", rate: 0.12, damage: 1.8, spread: 0.006, speed: 280, muzzles: [[1.6, 0.8, 1.5], [-1.6, 0.8, 1.5]], converge: 200 }, secondary: null },
  "solara-falcon": {
    primary: { name: "Nose: solar beam", rate: 0.05, damage: 0.8, spread: 0.002, speed: 320, heat: 0.35, muzzles: [[0, 0.8, 4]], converge: 0, sound: pulse },
    secondary: { ordnance: "rocket-pod", name: "Wing rocket rails", rate: 2.4, salvo: 4, salvoGap: 0.1, damage: 9, muzzles: [[2.4, 0.6, 0.6], [-2.4, 0.6, 0.6]], mount: "FIXED" },
  },
  "void-skimmer-prototype": { primary: { name: "Bow: void lance array", rate: 0.25, damage: 4, spread: 0.002, speed: 320, muzzles: [[0.8, 0.7, 4], [0, 0.9, 4.2], [-0.8, 0.7, 4]], converge: 160 }, secondary: null },
};

function apply(base: VehicleArmament, o: Override | undefined): VehicleArmament {
  if (!o) return base;
  const primary = o.primary === null ? null : o.primary === undefined ? base.primary : base.primary ? { ...base.primary, ...o.primary } : gun({ name: "Gun", muzzles: [[0, 1, 1]], ...o.primary });
  return {
    primary,
    secondary: o.secondary === undefined ? base.secondary : o.secondary,
    secondaryGun: o.secondaryGun === undefined ? (base.secondaryGun ?? null) : o.secondaryGun && gun(o.secondaryGun),
  };
}

/** a chassis's armament, refined by the fleet build being driven when one is given (fleet.ts id) */
export function armamentFor(id: VehicleId | string, kind: HandlingKind, buildId?: string | null, kit?: Kit): VehicleArmament {
  const chassis = apply(BY_KIND[kind], BY_ID[id as VehicleId] as Override | undefined);
  const a = buildId ? apply(chassis, BY_BUILD[buildId]) : chassis;
  // a foundry kit (vehicle-foundry.ts) scales the guns: damage, fire interval, heat
  if (!kit || kit.id === "stock") return a;
  return { ...a, primary: a.primary && kitGun(a.primary, kit), secondaryGun: a.secondaryGun ? kitGun(a.secondaryGun, kit) : (a.secondaryGun ?? null) };
}

export type VehiclePose = { x: number; y: number; z: number; yaw: number; pitch: number; roll: number };

/** a point in the vehicle's frame (right, up, forward) in world space. Yaw 0 faces +z; positive pitch is nose up. */
export function vehiclePoint(p: VehiclePose, local: readonly [number, number, number]): { x: number; y: number; z: number } {
  const [r, u, f] = local;
  // roll about forward, then pitch about right, then yaw about up
  const cr = Math.cos(p.roll), sr = Math.sin(p.roll);
  const r1 = r * cr - u * sr, u1 = r * sr + u * cr;
  const cp = Math.cos(p.pitch), sp = Math.sin(p.pitch);
  const u2 = u1 * cp + f * sp, f2 = -u1 * sp + f * cp;
  const cy = Math.cos(p.yaw), sy = Math.sin(p.yaw);
  // right vector at yaw: (-cos, 0, sin)… in this game's frame forward = (sin yaw, cos yaw); right = (-cos yaw, sin yaw)
  return { x: p.x + f2 * sy - r1 * cy, y: p.y + u2, z: p.z + f2 * cy + r1 * sy };
}

/** aim for a shot: turrets follow the camera; fixed guns follow the nose with a little camera pitch, converging ahead */
export function aimFor(mount: "TURRET" | "FIXED", pose: VehiclePose, camYaw: number, camPitch: number, pitchAssist: number, muzzle: { x: number; y: number; z: number }, converge: number): { yaw: number; pitch: number } {
  if (mount === "TURRET") return { yaw: camYaw, pitch: camPitch };
  const pitch = pose.pitch + Math.max(-pitchAssist, Math.min(pitchAssist, camPitch));
  if (converge <= 0) return { yaw: pose.yaw, pitch };
  // wing/bumper guns toe in sideways to meet on the centre line ahead; they keep the nose's pitch (converging on the
  // vehicle's ground-level origin aimed every car and bike gun into the dirt 28-59 m ahead)
  const tx = pose.x + Math.sin(pose.yaw) * converge - muzzle.x, tz = pose.z + Math.cos(pose.yaw) * converge - muzzle.z;
  return { yaw: Math.atan2(tx, tz), pitch };
}

/** the vehicle's world velocity from its handling state (forward speed along yaw, climb rate) */
export const vehicleVelocity = (yaw: number, speed: number, vy: number) => ({ vx: Math.sin(yaw) * speed, vy, vz: Math.cos(yaw) * speed });
