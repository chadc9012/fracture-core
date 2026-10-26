/** The rifle-slot class models (scripts/build-weapon-classes.py, heldModels.ts RIFLE_VARIANTS): present, with the rifle's node
 * contract so the viewmodel rig and reloads work, and a muzzle offset that matches the barrel actually built. */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { RIFLE_VARIANTS } from "../components/game/heldModels";
import { FRAMES } from "./weapon-classes";

function glb(path: string) {
  const b = readFileSync(`public${path}`);
  const n = b.readUInt32LE(12);
  const j = JSON.parse(b.subarray(20, 20 + n).toString("utf8")) as { nodes: { name?: string; mesh?: number }[]; meshes: { primitives: { attributes: { POSITION: number } }[] }[]; accessors: { min: number[]; max: number[] }[] };
  const bounds = (name: string) => {
    const node = j.nodes.find((x) => x.name === name);
    if (!node || node.mesh === undefined) return null;
    const acc = j.accessors[j.meshes[node.mesh]!.primitives[0]!.attributes.POSITION]!;
    return { min: acc.min, max: acc.max };
  };
  return { names: j.nodes.map((x) => x.name), bounds, bytes: b.length };
}

describe("rifle-slot class models", () => {
  const rifle = glb("/models/weapons/rifle.glb");
  test("every class that takes the rifle's slot has a model, and every model is a real class", () => {
    for (const v of Object.keys(RIFLE_VARIANTS)) expect(v in FRAMES, v).toBe(true);
    for (const f of ["SMG", "SNIPER", "FUSION"]) expect(f in RIFLE_VARIANTS, f).toBe(true);
  });
  for (const [v, spec] of Object.entries(RIFLE_VARIANTS)) {
    test(`${v}: rifle node contract, sane size, muzzle offset matches the barrel built`, () => {
      const m = glb(spec.url);
      expect(m.names).toContain("RifleBody");
      expect(m.names).toContain("RifleMag");
      expect(m.bytes).toBeLessThan(2_500_000);
      const body = m.bounds("RifleBody")!, rb = rifle.bounds("RifleBody")!;
      // the barrel points along -Z: the muzzle is the body's smallest z
      expect(body.min[2]! - rb.min[2]!).toBeCloseTo(spec.muzzleDz, 1);
      // the grip stays at the origin (the hand holds the same place)
      expect(body.min[2]!).toBeLessThan(0); expect(body.max[2]!).toBeGreaterThan(0);
    });
  }
  test("they read as their class: the SMG is shorter than the rifle, the sniper longer", () => {
    const len = (u: string) => { const b = glb(u).bounds("RifleBody")!; return b.max[2]! - b.min[2]!; };
    const r = len("/models/weapons/rifle.glb");
    expect(len(RIFLE_VARIANTS.SMG.url)).toBeLessThan(r * 0.85);
    expect(len(RIFLE_VARIANTS.SNIPER.url)).toBeGreaterThan(r * 1.25);
  });
});
