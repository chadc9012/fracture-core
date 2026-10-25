/**
 * Enemy death animations (pure presentation; combat never reads this).
 *
 * Every body used to fall the same way: a one-pose collapse blended in while the whole body tipped along the hit.
 * Now each death is one of six keyframed animations, chosen from how and where the enemy was hit:
 *  - KNEES       shot from the front: rocks back, drops to its knees, slumps forward onto its face
 *  - BLOWN_BACK  blasts, point-blank scatter, rams and overkill: thrown off its feet onto its back, arms flung out
 *  - SPIN        shot from the side: twisted round by the hit, legs fold, falls on its side
 *  - STAGGER     shot in the back: stumbles forward a step or two and pitches onto its face
 *  - CLUTCH      cut by a blade: doubles over clutching the wound, folds at the knees, falls sideways
 *  - CRUMPLE     anything else: the legs simply go and it drops where it stood
 *
 * An animation is bone keys plus whole-body ("root") keys:
 *  - bone keys are additive rotations (radians, bone-local Euler XYZ) on the rig's rest pose, Mixamo bone names without the
 *    prefix. Additive on each rig's own rest pose is what lets one animation drive every enemy rig: their bones have different
 *    rest orientations, so copying absolute rotations between rigs twists them (see AGENTS.md on clip grafting);
 *  - root keys: `tip` 0 (standing) .. 1 (flat) about the feet toward the fall direction, `drop` how far the hips sink while
 *    upright (body heights), `slide` metres travelled along the fall, `lift` metres off the ground (thrown), `twist` radians
 *    turned about the vertical.
 * The fall direction is relative to the way the body faced (`fall`: 0 = forward onto the face, π = backward onto the back,
 * ±π/2 = onto a side), so the pose and the fall always agree. Axes were set by rendering the raider rig (scripts in
 * the PR notes): +X on Spine curls forward, on UpLeg swings the thigh forward, on Leg bends the knee; Arm Z raises the
 * arm sideways (left negative). GoreFx.tsx applies root keys to the corpse slot, EnemyModel.tsx applies bone keys.
 */

export type DeathStyle = "KNEES" | "BLOWN_BACK" | "SPIN" | "STAGGER" | "CLUTCH" | "CRUMPLE";
export type Vec3 = [number, number, number];
export type RootKey = { tip: number; drop: number; slide: number; lift: number; twist: number };
type Key = { t: number; bones?: Record<string, Vec3>; root?: Partial<RootKey> };
export type DeathAnim = { duration: number; /** fall direction relative to facing (rad) */ fall: number; keys: Key[] };

const LIMP_ARMS: Record<string, Vec3> = { LeftArm: [0.1, 0, 0.15], RightArm: [0.1, 0, -0.15], LeftForeArm: [0, 0, -0.3], RightForeArm: [0, 0, 0.3] };

export const DEATHS: Record<DeathStyle, DeathAnim> = {
  KNEES: {
    duration: 1.45, fall: 0,
    keys: [
      { t: 0, root: { tip: 0, drop: 0 } },
      // the hit: rocks back, head snaps back, arms come up off the gun
      { t: 0.14, bones: { Spine: [-0.18, 0, 0], Spine1: [-0.12, 0, 0], Neck: [-0.25, 0, 0], Head: [-0.25, 0, 0], LeftArm: [-0.3, 0, -0.25], RightArm: [-0.3, 0, 0.25] }, root: { tip: -0.04 } },
      // the legs go: down onto the knees, torso upright, head dropping
      { t: 0.55, bones: { Spine: [0.15, 0, 0], Spine1: [0.1, 0, 0], Neck: [0.3, 0, 0], Head: [0.25, 0, 0], LeftUpLeg: [0.25, 0, 0.05], RightUpLeg: [0.2, 0, -0.05], LeftLeg: [1.5, 0, 0], RightLeg: [1.45, 0, 0], ...LIMP_ARMS }, root: { tip: 0, drop: 0.26 } },
      { t: 0.8, bones: { Spine: [0.3, 0, 0], Spine1: [0.2, 0, 0], Neck: [0.4, 0, 0], Head: [0.3, 0, 0], LeftUpLeg: [0.3, 0, 0.05], RightUpLeg: [0.25, 0, -0.05], LeftLeg: [1.5, 0, 0], RightLeg: [1.45, 0, 0], ...LIMP_ARMS }, root: { tip: 0.06, drop: 0.26 } },
      // slumps forward onto the face, legs straighten out behind
      { t: 1.25, bones: { Spine: [0.1, 0, 0], Spine1: [0.05, 0, 0], Neck: [-0.2, 0, 0], Head: [-0.1, 0.5, 0], LeftUpLeg: [0.05, 0, 0.05], RightUpLeg: [0.05, 0, -0.05], LeftLeg: [0.35, 0, 0], RightLeg: [0.3, 0, 0], LeftArm: [0.9, 0, 0.3], RightArm: [0.9, 0, -0.3], LeftForeArm: [0, 0, -0.4], RightForeArm: [0, 0, 0.4] }, root: { tip: 1, drop: 0.12, slide: 0.15 } },
      { t: 1.45, root: { tip: 1, drop: 0.12, slide: 0.15 } },
    ],
  },
  BLOWN_BACK: {
    duration: 1.15, fall: Math.PI,
    keys: [
      { t: 0, root: { tip: 0, lift: 0, slide: 0 } },
      // thrown: back arches, arms fly up and out, legs kick forward as the body leaves the ground
      { t: 0.22, bones: { Spine: [-0.35, 0, 0], Spine1: [-0.25, 0, 0], Neck: [-0.35, 0, 0], Head: [-0.35, 0, 0], LeftArm: [-0.4, 0, -1.1], RightArm: [-0.4, 0, 1.1], LeftForeArm: [0, 0, -0.3], RightForeArm: [0, 0, 0.3], LeftUpLeg: [0.55, 0, 0.1], RightUpLeg: [0.35, 0, -0.1], LeftLeg: [0.4, 0, 0], RightLeg: [0.6, 0, 0] }, root: { tip: 0.35, lift: 0.35, slide: 0.9 } },
      { t: 0.5, bones: { Spine: [-0.2, 0, 0], Spine1: [-0.15, 0, 0], Neck: [-0.2, 0, 0], Head: [-0.3, 0, 0], LeftArm: [-0.2, 0, -1.25], RightArm: [-0.2, 0, 1.25], LeftForeArm: [0, 0, -0.2], RightForeArm: [0, 0, 0.2], LeftUpLeg: [0.7, 0, 0.12], RightUpLeg: [0.5, 0, -0.12], LeftLeg: [0.5, 0, 0], RightLeg: [0.8, 0, 0] }, root: { tip: 1, lift: 0.05, slide: 1.8 } },
      // lands flat on its back: legs drop, arms fall to the ground, head lolls
      { t: 0.85, bones: { Spine: [0, 0, 0], Neck: [0, 0, 0], Head: [-0.1, 0.6, 0], LeftArm: [0, 0, -1.0], RightArm: [0, 0, 1.0], LeftForeArm: [0, 0, -0.25], RightForeArm: [0, 0, 0.25], LeftUpLeg: [0.2, 0, 0.15], RightUpLeg: [0.1, 0, -0.1], LeftLeg: [0.35, 0, 0], RightLeg: [0.2, 0, 0] }, root: { tip: 1, lift: 0, slide: 2.1 } },
      { t: 1.15, root: { tip: 1, lift: 0, slide: 2.1 } },
    ],
  },
  SPIN: {
    duration: 1.2, fall: Math.PI / 2,
    keys: [
      { t: 0, root: { tip: 0, twist: 0 } },
      // twisted round by the hit: shoulders lead, the arm on the hit side flung out
      { t: 0.3, bones: { Spine: [0.1, 0.35, 0], Spine1: [0.05, 0.25, 0], Head: [0, 0.4, 0], LeftArm: [-0.2, 0, -0.9], RightArm: [0.2, 0, 0.3], LeftUpLeg: [0.2, 0, 0], RightLeg: [0.5, 0, 0] }, root: { tip: 0.08, twist: 1.0, drop: 0.05 } },
      // legs fold under as it turns
      { t: 0.62, bones: { Spine: [0.3, 0.2, 0.15], Spine1: [0.2, 0.15, 0.1], Neck: [0.25, 0, 0], Head: [0.3, 0.4, 0], LeftArm: [0, 0, -0.6], RightArm: [0.3, 0, 0.2], LeftUpLeg: [0.6, 0, 0], RightUpLeg: [0.3, 0, 0], LeftLeg: [1.2, 0, 0], RightLeg: [0.9, 0, 0] }, root: { tip: 0.3, twist: 1.6, drop: 0.18 } },
      // down on its side
      { t: 1.0, bones: { Spine: [0.25, 0, 0.1], Spine1: [0.15, 0, 0.05], Neck: [0.1, 0, 0.2], Head: [0.1, 0.3, 0.2], LeftArm: [0.3, 0, -0.4], RightArm: [0.6, 0, 0.2], LeftForeArm: [0, 0, -0.5], RightForeArm: [0, 0, 0.6], LeftUpLeg: [0.7, 0, 0], RightUpLeg: [0.4, 0, 0], LeftLeg: [1.0, 0, 0], RightLeg: [0.6, 0, 0] }, root: { tip: 1, twist: 1.75, drop: 0.08, slide: 0.3 } },
      { t: 1.2, root: { tip: 1, twist: 1.75, drop: 0.08, slide: 0.3 } },
    ],
  },
  STAGGER: {
    duration: 1.3, fall: 0,
    keys: [
      { t: 0, root: { tip: 0, slide: 0 } },
      // shoved forward: back arches from the hit, a stumbling step
      { t: 0.18, bones: { Spine: [-0.2, 0, 0], Neck: [-0.3, 0, 0], Head: [-0.3, 0, 0], LeftArm: [-0.2, 0, -0.4], RightArm: [-0.2, 0, 0.4], RightUpLeg: [0.5, 0, 0], RightLeg: [0.5, 0, 0] }, root: { tip: 0.06, slide: 0.35 } },
      { t: 0.45, bones: { Spine: [0.4, 0, 0], Spine1: [0.25, 0, 0], Neck: [0.2, 0, 0], LeftUpLeg: [0.6, 0, 0], LeftLeg: [0.6, 0, 0], RightUpLeg: [-0.2, 0, 0], RightLeg: [0.3, 0, 0], LeftArm: [0.5, 0, -0.2], RightArm: [0.5, 0, 0.2] }, root: { tip: 0.2, slide: 0.9, drop: 0.06 } },
      // pitches onto its face, arms half out to break the fall
      { t: 0.9, bones: { Spine: [0.15, 0, 0], Neck: [-0.25, 0, 0], Head: [-0.1, -0.5, 0], LeftUpLeg: [0.1, 0, 0.05], RightUpLeg: [-0.05, 0, -0.05], LeftLeg: [0.3, 0, 0], RightLeg: [0.4, 0, 0], LeftArm: [1.1, 0, -0.35], RightArm: [1.0, 0, 0.35], LeftForeArm: [0, 0, -0.6], RightForeArm: [0, 0, 0.6] }, root: { tip: 1, slide: 1.4, drop: 0.04 } },
      { t: 1.3, root: { tip: 1, slide: 1.45, drop: 0.04 } },
    ],
  },
  CLUTCH: {
    duration: 1.6, fall: -Math.PI / 2,
    keys: [
      { t: 0, root: { tip: 0 } },
      // doubles over, both hands to the wound
      { t: 0.35, bones: { Spine: [0.45, 0, 0], Spine1: [0.3, 0, 0], Neck: [0.35, 0, 0], Head: [0.3, 0, 0], LeftArm: [0.9, 0, 0.35], RightArm: [0.9, 0, -0.35], LeftForeArm: [0, 0, -1.4], RightForeArm: [0, 0, 1.4] }, root: { tip: 0.04, drop: 0.04 } },
      // folds at the knees, still clutching
      { t: 0.8, bones: { Spine: [0.55, 0, 0], Spine1: [0.35, 0, 0], Neck: [0.4, 0, 0], Head: [0.35, 0, 0], LeftArm: [0.9, 0, 0.35], RightArm: [0.9, 0, -0.35], LeftForeArm: [0, 0, -1.4], RightForeArm: [0, 0, 1.4], LeftUpLeg: [0.4, 0, 0], RightUpLeg: [0.35, 0, 0], LeftLeg: [1.3, 0, 0], RightLeg: [1.2, 0, 0] }, root: { tip: 0.08, drop: 0.24 } },
      // keels over sideways and curls
      { t: 1.35, bones: { Spine: [0.5, 0, 0.1], Spine1: [0.3, 0, 0], Neck: [0.3, 0, 0.2], Head: [0.2, 0, 0.2], LeftArm: [0.8, 0, 0.3], RightArm: [0.8, 0, -0.3], LeftForeArm: [0, 0, -1.2], RightForeArm: [0, 0, 1.2], LeftUpLeg: [0.9, 0, 0], RightUpLeg: [0.8, 0, 0], LeftLeg: [1.4, 0, 0], RightLeg: [1.3, 0, 0] }, root: { tip: 1, drop: 0.1, slide: 0.1 } },
      { t: 1.6, root: { tip: 1, drop: 0.1, slide: 0.1 } },
    ],
  },
  CRUMPLE: {
    duration: 0.9, fall: 0.4,
    keys: [
      { t: 0, root: { tip: 0 } },
      // the legs simply go: knees buckle, spine curls, arms limp (the old collapse, now with a real timeline)
      { t: 0.35, bones: { Spine: [0.35, 0, 0], Spine1: [0.3, 0, 0], Spine2: [0.2, 0, 0], Neck: [0.35, 0, 0], Head: [0.3, 0.2, 0], LeftUpLeg: [0.5, 0, 0], RightUpLeg: [0.3, 0, 0], LeftLeg: [1.0, 0, 0], RightLeg: [0.7, 0, 0], LeftArm: [-0.2, 0, -0.35], RightArm: [-0.2, 0, 0.35], LeftForeArm: [0, 0, -0.4], RightForeArm: [0, 0, 0.4] }, root: { tip: 0.15, drop: 0.2 } },
      { t: 0.7, bones: { Spine: [0.25, 0, 0], Spine1: [0.2, 0, 0], Spine2: [0.1, 0, 0], Neck: [0.1, 0, 0], Head: [0.1, 0.4, 0], LeftUpLeg: [0.45, 0, 0], RightUpLeg: [0.25, 0, 0], LeftLeg: [0.8, 0, 0], RightLeg: [0.6, 0, 0], LeftArm: [0.3, 0, -0.3], RightArm: [0.3, 0, 0.3], LeftForeArm: [0, 0, -0.4], RightForeArm: [0, 0, 0.4] }, root: { tip: 1, drop: 0.1 } },
      { t: 0.9, root: { tip: 1, drop: 0.1 } },
    ],
  },
};

/** every bone any death animation moves (EnemyModel captures their rest rotations once) */
export const DEATH_BONES: readonly string[] = [...new Set(Object.values(DEATHS).flatMap((a) => a.keys.flatMap((k) => Object.keys(k.bones ?? {}))))];

const ROOT0: RootKey = { tip: 0, drop: 0, slide: 0, lift: 0, twist: 0 };
const ease = (u: number) => u * u * (3 - 2 * u);

/** per-body variation from a seed: limb amounts scaled 0.8..1.2, head turned either way, the fall swung a little */
export function deathVariation(seed: number): { limb: (bone: string) => number; headSide: number; fallJitter: number } {
  let s = (Math.floor(seed * 2654435761) >>> 0) || 1;
  const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  const headSide = rnd() < 0.5 ? -1 : 1, fallJitter = (rnd() - 0.5) * 0.5;
  const per = new Map<string, number>();
  for (const b of DEATH_BONES) per.set(b, 0.8 + rnd() * 0.4);
  return { limb: (b) => per.get(b) ?? 1, headSide, fallJitter };
}

/** swap left/right bones and flip the sideways axes, so a SPIN or CLUTCH can go either way */
const MIRROR: Record<string, string> = {};
for (const b of ["Arm", "ForeArm", "UpLeg", "Leg", "Shoulder", "Hand"]) { MIRROR[`Left${b}`] = `Right${b}`; MIRROR[`Right${b}`] = `Left${b}`; }
const mirrorBone = (name: string, v: Vec3): [string, Vec3] => [MIRROR[name] ?? name, [v[0], -v[1], -v[2]]];

/** the root at `age` seconds: interpolated between root keys (missing fields hold their last value) */
export function deathRoot(style: DeathStyle, age: number): RootKey {
  const keys = DEATHS[style].keys;
  // fill each field forward so every key has a full root
  const filled: { t: number; r: RootKey }[] = [];
  let cur: RootKey = { ...ROOT0 };
  for (const k of keys) { cur = { ...cur, ...(k.root ?? {}) }; filled.push({ t: k.t, r: cur }); }
  if (age <= filled[0]!.t) return filled[0]!.r;
  for (let i = 1; i < filled.length; i++) {
    const a = filled[i - 1]!, b = filled[i]!;
    if (age <= b.t) {
      const u = ease((age - a.t) / Math.max(1e-6, b.t - a.t));
      // the fall itself accelerates (gravity) rather than easing in and out
      const ut = b.r.tip > a.r.tip ? ((age - a.t) / Math.max(1e-6, b.t - a.t)) ** 2 : u;
      return { tip: a.r.tip + (b.r.tip - a.r.tip) * ut, drop: a.r.drop + (b.r.drop - a.r.drop) * u, slide: a.r.slide + (b.r.slide - a.r.slide) * u, lift: a.r.lift + (b.r.lift - a.r.lift) * u, twist: a.r.twist + (b.r.twist - a.r.twist) * u };
    }
  }
  return filled[filled.length - 1]!.r;
}

/** the bone pose at `age`: each bone interpolated between the keys that mention it (0 before its first), varied by seed */
export function deathBonesAt(style: DeathStyle, age: number, seed: number, mirror = false): Record<string, Vec3> {
  const v = deathVariation(seed);
  const keys = DEATHS[style].keys;
  const out: Record<string, Vec3> = {};
  for (const bone of DEATH_BONES) {
    // this bone's own track: (t, value) with a zero at t=0
    const track: { t: number; v: Vec3 }[] = [{ t: 0, v: [0, 0, 0] }];
    for (const k of keys) { const b = k.bones?.[bone]; if (b) track.push({ t: k.t, v: b }); }
    if (track.length === 1) continue;
    let val: Vec3 = track[track.length - 1]!.v;
    for (let i = 1; i < track.length; i++) {
      const a = track[i - 1]!, b = track[i]!;
      if (age <= b.t) { const u = ease(Math.max(0, (age - a.t) / Math.max(1e-6, b.t - a.t))); val = [a.v[0] + (b.v[0] - a.v[0]) * u, a.v[1] + (b.v[1] - a.v[1]) * u, a.v[2] + (b.v[2] - a.v[2]) * u]; break; }
    }
    const k = v.limb(bone);
    let e: Vec3 = bone === "Head" ? [val[0] * k, val[1] * v.headSide, val[2]] : [val[0] * k, val[1] * k, val[2] * k];
    let name = bone;
    if (mirror) [name, e] = mirrorBone(bone, e);
    out[name] = e;
  }
  return out;
}

/** the fall direction relative to facing (+π/2 is onto the body's left), mirrored for falls to the right, plus jitter */
export function deathFall(style: DeathStyle, seed: number, mirror = false): number {
  return (mirror ? -DEATHS[style].fall : DEATHS[style].fall) + deathVariation(seed).fallJitter;
}
/** SPIN turns the other way when mirrored */
export const deathTwistSign = (mirror: boolean) => (mirror ? -1 : 1);

export type DeathCause = "BULLET" | "PELLET" | "BLADE" | "BLAST" | "CRUSH" | "ABILITY";
/**
 * Which death: from the cause, how hard the killing hit was (power 0..1 of max health, overkill counts), and where it came
 * from relative to the way the body faced (`hitX/hitZ` = the direction the hit travelled; facing yaw `rot`, 0 = +z).
 */
export function deathStyleFor(cause: DeathCause, power: number, hitX: number, hitZ: number, rot: number, seed: number): { style: DeathStyle; mirror: boolean } {
  const l = Math.hypot(hitX, hitZ);
  // how the hit pushes the body: forward (shot in the back) is +1, backward (shot from the front) is -1; sideways, toward its left is +1
  const push = l > 1e-3 ? (hitX * Math.sin(rot) + hitZ * Math.cos(rot)) / l : -1;
  const left = l > 1e-3 ? (hitX * Math.cos(rot) - hitZ * Math.sin(rot)) / l : 0;
  const r = deathVariation(seed + 0.37).limb("Spine"); // a second, independent roll in 0.8..1.2
  const roll = (r - 0.8) / 0.4;
  // sideways falls go the way the hit pushes (no push: either way)
  const mirror = Math.abs(left) > 0.15 ? left < 0 : roll < 0.5;
  const pick = (style: DeathStyle) => ({ style, mirror: style === "SPIN" || style === "CLUTCH" || style === "CRUMPLE" ? mirror : false });
  if (cause === "BLADE") return pick(roll < 0.7 ? "CLUTCH" : "SPIN");
  if (cause === "BLAST" || cause === "CRUSH" || (cause === "PELLET" && power > 0.45) || power > 0.85) return pick(push > 0.3 ? "STAGGER" : "BLOWN_BACK");
  if (push > 0.5) return pick("STAGGER");
  if (push > -0.5) return pick(roll < 0.65 ? "SPIN" : "CRUMPLE");
  return pick(roll < 0.6 ? "KNEES" : "CRUMPLE");
}
