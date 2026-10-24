/** Shared weapon presentation (combat spec §2): one system, every weapon supplies a handling profile. The
 * gameplay (fire rate, damage, ammo, reload time) stays in weapons.ts and Scene; this module only turns that
 * live state into how the weapon is held and moves in first person: draw/holster on swap, aim-down-sights,
 * recoil kick with spring recovery, sprint lowering, reload choreography (magazine / shell / cell) and the
 * per-shot action (slide, pump, bolt). Pure and frame-rate independent, so every motion is testable.
 *
 * Coordinates are camera space in metres: +x right, +y up, -z forward. Rotations are radians (x = pitch up,
 * y = yaw left, z = roll left). */
import { WEAPONS, type WeaponId } from "./weapons";

export type HandlingClass = "rifle" | "pistol" | "shotgun" | "heavy" | "launcher" | "sword";
export type Handling = HandlingClass;
export type ReloadStyle = "mag" | "shell" | "cell" | "none";
export type Cycle = "none" | "slide" | "pump" | "bolt";
export type V3 = [number, number, number];

export type HandlingProfile = {
  cls: HandlingClass;
  /** hip and aim-down-sights positions of the weapon grip in camera space */
  hip: V3;
  ads: V3;
  /** seconds to raise the weapon on swap, and to lower the old one */
  draw: number;
  holster: number;
  /** seconds to settle into ADS */
  adsTime: number;
  /** per-shot kick: backwards (m), muzzle climb (rad), random roll (rad) */
  kickBack: number;
  kickPitch: number;
  kickRoll: number;
  /** recovery spring stiffness (higher = snappier return) */
  recover: number;
  /** look/move sway multiplier */
  sway: number;
  reload: ReloadStyle;
  cycle: Cycle;
  /** seconds the per-shot action (slide/pump/bolt) takes */
  cycleTime: number;
  /** how low and turned-in the weapon sits while sprinting */
  sprintPos: V3;
  sprintRot: V3;
};

/** ADS z keeps every gun's rear edge (plus its full recoil kick) beyond the camera's 0.04 m near plane; closer, the stock was
 * cut open on screen while aiming. */
export const HANDLING: Record<HandlingClass, HandlingProfile> = {
  rifle: { cls: "rifle", hip: [0.2, -0.2, -0.48], ads: [0, -0.115, -0.4], draw: 0.42, holster: 0.22, adsTime: 0.18, kickBack: 0.035, kickPitch: 0.035, kickRoll: 0.025, recover: 18, sway: 1, reload: "mag", cycle: "none", cycleTime: 0, sprintPos: [0.08, -0.12, 0.06], sprintRot: [-0.35, 0.7, 0.25] },
  pistol: { cls: "pistol", hip: [0.18, -0.18, -0.42], ads: [0, -0.1, -0.38], draw: 0.25, holster: 0.15, adsTime: 0.12, kickBack: 0.03, kickPitch: 0.16, kickRoll: 0.04, recover: 14, sway: 1.2, reload: "mag", cycle: "slide", cycleTime: 0.08, sprintPos: [0.02, -0.2, 0.12], sprintRot: [-0.9, 0.2, 0.1] },
  shotgun: { cls: "shotgun", hip: [0.21, -0.22, -0.46], ads: [0, -0.12, -0.44], draw: 0.5, holster: 0.26, adsTime: 0.22, kickBack: 0.09, kickPitch: 0.12, kickRoll: 0.05, recover: 9, sway: 0.9, reload: "shell", cycle: "pump", cycleTime: 0.32, sprintPos: [0.1, -0.12, 0.05], sprintRot: [-0.3, 0.85, 0.3] },
  heavy: { cls: "heavy", hip: [0.24, -0.26, -0.5], ads: [0.02, -0.15, -0.47], draw: 0.6, holster: 0.32, adsTime: 0.28, kickBack: 0.11, kickPitch: 0.09, kickRoll: 0.03, recover: 7, sway: 0.7, reload: "cell", cycle: "bolt", cycleTime: 0.45, sprintPos: [0.12, -0.14, 0.05], sprintRot: [-0.25, 0.9, 0.3] },
  launcher: { cls: "launcher", hip: [0.25, -0.2, -0.45], ads: [0.05, -0.13, -0.5], draw: 0.65, holster: 0.35, adsTime: 0.3, kickBack: 0.13, kickPitch: 0.1, kickRoll: 0.02, recover: 6, sway: 0.6, reload: "cell", cycle: "none", cycleTime: 0, sprintPos: [0.12, -0.15, 0.05], sprintRot: [-0.25, 0.8, 0.3] },
  sword: { cls: "sword", hip: [0.28, -0.3, -0.45], ads: [0.28, -0.3, -0.45], draw: 0.35, holster: 0.2, adsTime: 0.2, kickBack: 0, kickPitch: 0, kickRoll: 0, recover: 10, sway: 1.1, reload: "none", cycle: "none", cycleTime: 0, sprintPos: [0.05, -0.12, 0.1], sprintRot: [-0.4, 0.2, -0.3] },
};

/** A weapon's handling class: its own `handling` field, else derived from its kind (HEAVY reads as a heavy gun). */
export function handlingClass(id: WeaponId): HandlingClass {
  const def = WEAPONS[id];
  if (!def) return "rifle";
  if (def.handling) return def.handling;
  if (def.kind === "sword") return "sword";
  if (def.kind === "launcher") return "launcher";
  return id === "HEAVY" ? "heavy" : "rifle";
}
export const handlingFor = (id: WeaponId): HandlingProfile => HANDLING[handlingClass(id)];

/** Armor mobility (0..~1.5 from loadoutEffects) speeds draw/ADS and steadies sway; defense makes kick feel heavier. */
export type ArmorFeel = { mobility: number; defense: number };
export const NEUTRAL_FEEL: ArmorFeel = { mobility: 0, defense: 0 };

export type ViewState = {
  weapon: WeaponId;
  /** 0 = lowered out of view, 1 = ready */
  raise: number;
  /** weapon currently being put away (swap in progress) */
  lowering: WeaponId | null;
  ads: number;
  sprint: number;
  /** recoil spring: displacement and velocity for back, pitch, roll */
  kick: V3;
  kickVel: V3;
  /** seconds since the last shot, drives the slide/pump/bolt */
  sinceShot: number;
  shots: number;
  /** melee swing direction for the current combo hit (1 = right-to-left, -1 = left-to-right, 0 = overhead) */
  swingDir: number;
};

export const initialView = (weapon: WeaponId): ViewState => ({ weapon, raise: 1, lowering: null, ads: 0, sprint: 0, kick: [0, 0, 0], kickVel: [0, 0, 0], sinceShot: 9, shots: 0, swingDir: 1 });

export type ViewInput = {
  /** weapon the gameplay has equipped */
  weapon: WeaponId;
  aiming: boolean;
  sprinting: boolean;
  /** shots fired this frame (0 most frames) */
  fired: number;
  /** 0..1 progress through a reload, or -1 when not reloading */
  reload: number;
  /** 0..1 through a melee swing, or -1 */
  swing: number;
  combo: number;
  feel: ArmorFeel;
  /** deterministic -1..1 noise for this frame's shot roll (callers pass a seeded value; tests pass 0) */
  noise: number;
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const approach = (v: number, to: number, rate: number, dt: number) => v + (to - v) * (1 - Math.exp(-rate * dt));

/** Advance the view state one frame. Swaps lower the old weapon, then raise the new one (never pops). */
export function stepView(s: ViewState, input: ViewInput, dt: number): ViewState {
  const quick = 1 + Math.max(0, input.feel.mobility) * 0.35;
  let { weapon, raise, lowering } = s;
  if (input.weapon !== weapon && !lowering) { lowering = weapon; }
  if (lowering) {
    raise -= (dt / handlingFor(lowering).holster) * quick;
    if (raise <= 0) { raise = 0; weapon = input.weapon; lowering = null; }
  } else if (raise < 1) {
    raise = Math.min(1, raise + (dt / handlingFor(weapon).draw) * quick);
  }
  const p = handlingFor(weapon);
  const ready = !lowering && raise >= 1;
  const reloading = input.reload >= 0;
  const ads = approach(s.ads, input.aiming && ready && !input.sprinting && !reloading && p.cls !== "sword" ? 1 : 0, (1 / p.adsTime) * 3 * quick, dt);
  const sprint = approach(s.sprint, input.sprinting && !reloading ? 1 : 0, 10, dt);
  // recoil: impulse per shot, then a damped spring back to rest
  const heavy = 1 + Math.max(0, input.feel.defense) * 0.15;
  const adsDamp = 1 - ads * 0.45;
  const kv: V3 = [...s.kickVel];
  const k: V3 = [...s.kick];
  if (input.fired > 0 && ready) {
    for (let i = 0; i < input.fired; i++) {
      kv[0] += p.kickBack * 30 * adsDamp * heavy;
      kv[1] += p.kickPitch * 30 * adsDamp * heavy;
      kv[2] += p.kickRoll * 30 * input.noise * adsDamp;
    }
  }
  const stiff = p.recover * p.recover, damp = 2 * p.recover * 0.85;
  for (let i = 0; i < 3; i++) {
    const a = -stiff * k[i]! - damp * kv[i]!;
    kv[i] = kv[i]! + a * dt;
    k[i] = k[i]! + kv[i]! * dt;
  }
  const sinceShot = input.fired > 0 ? 0 : s.sinceShot + dt;
  const shots = s.shots + (input.fired > 0 ? 1 : 0);
  const swingDir = input.swing >= 0 && input.swing < 0.05 ? (input.combo % 3 === 0 ? 0 : input.combo % 2 ? 1 : -1) : s.swingDir;
  return { weapon, raise, lowering, ads, sprint, kick: k, kickVel: kv, sinceShot, shots, swingDir };
}

export type ViewPose = {
  pos: V3;
  rot: V3;
  /** which model to draw */
  weapon: WeaponId;
  /** magazine / shell / cell offset below its seat, metres (0 = seated) and whether it is in the gun */
  magDrop: number;
  magVisible: boolean;
  /** slide / pump / bolt travel, 0..1 */
  action: number;
  /** support hand: 0 on the foregrip, 1 at the magazine well (reloading) */
  supportReach: number;
  /** muzzle flash intensity 0..1 */
  flash: number;
};

/** Reload choreography as a pure function of progress: [tilt, magDrop, magVisible, action, supportReach]. */
export function reloadPose(style: ReloadStyle, t: number): { tilt: number; drop: number; visible: boolean; action: number; reach: number } {
  if (style === "none" || t < 0) return { tilt: 0, drop: 0, visible: true, action: 0, reach: 0 };
  const tilt = Math.sin(Math.min(1, t) * Math.PI);
  if (style === "shell") {
    // shells go in one by one through the loading port, then a pump at the end
    const loading = t > 0.15 && t < 0.8;
    const pump = t >= 0.8 ? Math.sin(((t - 0.8) / 0.2) * Math.PI) : 0;
    return { tilt, drop: loading ? Math.abs(Math.sin(t * Math.PI * 10)) * 0.04 : 0, visible: true, action: pump, reach: loading ? 1 : pump > 0 ? 0 : 0.3 };
  }
  // magazine / cell: out (0.15-0.4), in (0.45-0.7), charge (0.75-0.9)
  const out = clamp01((t - 0.15) / 0.25);
  const back = clamp01((t - 0.45) / 0.25);
  const drop = (out - back) * 0.35;
  const visible = !(t > 0.38 && t < 0.47);
  const charge = t > 0.75 && t < 0.9 ? Math.sin(((t - 0.75) / 0.15) * Math.PI) : 0;
  const reach = t > 0.1 && t < 0.72 ? 1 : 0;
  return { tilt: tilt * (style === "cell" ? 0.7 : 1), drop: Math.max(0, drop), visible, action: charge, reach };
}

/** The pose to draw this frame. `bob`/`swayX` come from the movement feel (movement-feel.ts). */
export function viewPose(s: ViewState, input: Pick<ViewInput, "reload" | "swing">, bob: number, swayX: number, feel: ArmorFeel = NEUTRAL_FEEL): ViewPose {
  const p = handlingFor(s.weapon);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const base: V3 = [lerp(p.hip[0], p.ads[0], s.ads), lerp(p.hip[1], p.ads[1], s.ads), lerp(p.hip[2], p.ads[2], s.ads)];
  const steady = (1 - s.ads * 0.8) * p.sway * (1 - Math.min(0.5, Math.max(0, feel.mobility) * 0.25));
  // lowered (swap) weapons drop down and roll out of view
  const lower = 1 - s.raise;
  const rl = reloadPose(p.reload, input.reload);
  const pos: V3 = [
    base[0] + swayX * 0.6 * steady + p.sprintPos[0] * s.sprint + lower * 0.05,
    base[1] + bob * 0.5 * steady + p.sprintPos[1] * s.sprint - lower * 0.35 - rl.tilt * 0.05,
    base[2] + s.kick[0] + p.sprintPos[2] * s.sprint + rl.tilt * 0.04,
  ];
  const rot: V3 = [
    s.kick[1] + p.sprintRot[0] * s.sprint - lower * 0.6 + rl.tilt * 0.35,
    p.sprintRot[1] * s.sprint + rl.tilt * 0.45,
    s.kick[2] + p.sprintRot[2] * s.sprint + lower * 0.3 + rl.tilt * -0.5,
  ];
  if (p.cls === "sword" && input.swing >= 0) {
    // directional slashes: wind up, cut across, recover
    const t = input.swing, cut = Math.sin(Math.min(1, t) * Math.PI);
    if (s.swingDir === 0) { rot[0] += 1.2 - t * 2.6; pos[1] += 0.12 * cut; }
    else { rot[2] += s.swingDir * (1.4 - t * 2.8); pos[0] += -s.swingDir * 0.25 * cut; rot[0] -= 0.5 * cut; }
  }
  const actionShot = p.cycleTime > 0 && s.sinceShot < p.cycleTime ? Math.sin((s.sinceShot / p.cycleTime) * Math.PI) : 0;
  return {
    pos, rot, weapon: s.weapon,
    magDrop: rl.drop, magVisible: rl.visible,
    action: Math.max(actionShot, rl.action),
    supportReach: rl.reach,
    flash: s.sinceShot < 0.05 && p.cls !== "sword" ? 1 - s.sinceShot / 0.05 : 0,
  };
}
