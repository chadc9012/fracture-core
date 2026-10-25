import { describe, expect, test } from "bun:test";
import { DEATHS, DEATH_BONES, deathBonesAt, deathFall, deathRoot, deathStyleFor, type DeathStyle } from "./death-animations";

const STYLES = Object.keys(DEATHS) as DeathStyle[];
// a body facing +z (rot 0): a hit travelling -z came from in front of it, +z from behind, +x/-x from a side
const FRONT = [0, -1] as const, BACK = [0, 1] as const, FROM_RIGHT = [1, 0] as const;

describe("death animation timelines", () => {
  test("every style starts standing, ends flat on the ground, and its keys run forward in time", () => {
    for (const s of STYLES) {
      const a = DEATHS[s];
      expect(deathRoot(s, 0).tip, s).toBe(0);
      expect(deathRoot(s, a.duration).tip, s).toBeCloseTo(1, 6);
      expect(deathRoot(s, a.duration + 5).tip, s).toBeCloseTo(1, 6);
      for (let i = 1; i < a.keys.length; i++) expect(a.keys[i]!.t, s).toBeGreaterThan(a.keys[i - 1]!.t);
      expect(a.keys.at(-1)!.t, s).toBe(a.duration);
    }
  });
  test("bodies are never thrown absurdly: hips sink under half the height, slides stay under 2.5 m, lifts under half a metre", () => {
    for (const s of STYLES) for (let t = 0; t <= DEATHS[s].duration; t += 0.02) {
      const r = deathRoot(s, t);
      expect(r.drop).toBeLessThan(0.5); expect(r.slide).toBeLessThan(2.5); expect(r.lift).toBeLessThan(0.5); expect(r.tip).toBeLessThanOrEqual(1);
    }
  });
  test("the pose is continuous: no bone jumps more than a quarter turn between 30 fps frames", () => {
    for (const s of STYLES) {
      let prev = deathBonesAt(s, 0, 0.3);
      for (let t = 1 / 30; t <= DEATHS[s].duration; t += 1 / 30) {
        const cur = deathBonesAt(s, t, 0.3);
        for (const [b, e] of Object.entries(cur)) { const p = prev[b] ?? [0, 0, 0]; for (let i = 0; i < 3; i++) expect(Math.abs(e[i]! - p[i]!), `${s} ${b}`).toBeLessThan(Math.PI / 4); }
        prev = cur;
      }
    }
  });
  test("each body varies (by seed) but replays the same way; a mirrored death swaps left and right", () => {
    const a = deathBonesAt("KNEES", 0.6, 0.12), b = deathBonesAt("KNEES", 0.6, 0.87);
    expect(deathBonesAt("KNEES", 0.6, 0.12)).toEqual(a);
    expect(a).not.toEqual(b);
    const m = deathBonesAt("SPIN", 0.3, 0.5, true), n = deathBonesAt("SPIN", 0.3, 0.5, false);
    expect(m["RightArm"]![2]).toBeCloseTo(-n["LeftArm"]![2]!, 6);
    expect(deathFall("SPIN", 0.5, true)).toBeLessThan(0);
    expect(deathFall("SPIN", 0.5, false)).toBeGreaterThan(0);
  });
  test("every bone the animations move is a standard Mixamo bone name", () => {
    const mixamo = new Set(["Hips", "Spine", "Spine1", "Spine2", "Neck", "Head", "LeftShoulder", "RightShoulder", "LeftArm", "RightArm", "LeftForeArm", "RightForeArm", "LeftHand", "RightHand", "LeftUpLeg", "RightUpLeg", "LeftLeg", "RightLeg", "LeftFoot", "RightFoot"]);
    for (const b of DEATH_BONES) expect(mixamo.has(b), b).toBe(true);
  });
});

describe("which death", () => {
  const pick = (cause: Parameters<typeof deathStyleFor>[0], power: number, hit: readonly [number, number], seeds = 40) => {
    const seen = new Set<DeathStyle>();
    for (let i = 0; i < seeds; i++) seen.add(deathStyleFor(cause, power, hit[0], hit[1], 0, i / seeds).style);
    return seen;
  };
  test("shot from the front: drops to its knees or crumples; a huge hit throws it back", () => {
    expect([...pick("BULLET", 0.3, FRONT)].sort()).toEqual(["CRUMPLE", "KNEES"]);
    expect([...pick("BULLET", 0.95, FRONT)]).toEqual(["BLOWN_BACK"]);
  });
  test("shot in the back: stumbles forward onto its face", () => {
    expect([...pick("BULLET", 0.3, BACK)]).toEqual(["STAGGER"]);
    expect(DEATHS.STAGGER.fall).toBe(0);
  });
  test("shot from the side: spins (or crumples) and falls away from the shot", () => {
    expect(pick("BULLET", 0.3, FROM_RIGHT).has("SPIN")).toBe(true);
    // a hit travelling +x pushes a +z-facing body toward its left (+x in this game's frame is the body's left at rot 0)
    for (let i = 0; i < 20; i++) {
      const d = deathStyleFor("BULLET", 0.3, 1, 0, 0, i / 20);
      if (d.style !== "SPIN") continue;
      const fall = deathFall(d.style, i / 20, d.mirror);
      expect(Math.sin(fall), "falls toward +x").toBeGreaterThan(0.5);
    }
  });
  test("blasts and point-blank scatter throw it onto its back; a blade cut doubles it over", () => {
    expect([...pick("BLAST", 0.2, FRONT)]).toEqual(["BLOWN_BACK"]);
    expect([...pick("PELLET", 0.6, FRONT)]).toEqual(["BLOWN_BACK"]);
    expect(pick("BLADE", 0.3, FRONT).has("CLUTCH")).toBe(true);
    expect(DEATHS.BLOWN_BACK.fall).toBeCloseTo(Math.PI, 6);
  });
});
