// @ts-ignore bun:test types
import { describe, expect, test } from "bun:test";
import { findQuadrupedLegs, legAngles, type RestBone } from "./skeleton-gait";
// @ts-ignore node builtins in tests
import { readFileSync } from "node:fs";

type M = number[]; // column-major 4x4
const mul = (a: M, b: M): M => { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r]! * b[c * 4 + k]!; return o; };
function trs(n: { translation?: number[]; rotation?: number[]; scale?: number[]; matrix?: number[] }): M {
  if (n.matrix) return n.matrix;
  const [x, y, z, w] = n.rotation ?? [0, 0, 0, 1]; const [sx, sy, sz] = n.scale ?? [1, 1, 1]; const [tx, ty, tz] = n.translation ?? [0, 0, 0];
  return [
    (1 - 2 * (y! * y! + z! * z!)) * sx!, (2 * (x! * y! + z! * w!)) * sx!, (2 * (x! * z! - y! * w!)) * sx!, 0,
    (2 * (x! * y! - z! * w!)) * sy!, (1 - 2 * (x! * x! + z! * z!)) * sy!, (2 * (y! * z! + x! * w!)) * sy!, 0,
    (2 * (x! * z! + y! * w!)) * sz!, (2 * (y! * z! - x! * w!)) * sz!, (1 - 2 * (x! * x! + y! * y!)) * sz!, 0,
    tx!, ty!, tz!, 1,
  ];
}

function restBones(path: string): RestBone[] {
  const buf = readFileSync(path) as Uint8Array;
  const len = new DataView(buf.buffer, buf.byteOffset).getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(buf.subarray(20, 20 + len))) as { nodes: { name?: string; children?: number[] }[]; skins: { joints: number[] }[] };
  const parent = new Map<number, number>();
  json.nodes.forEach((n, i) => n.children?.forEach((c) => parent.set(c, i)));
  const world = (i: number): M => { const p = parent.get(i); const local = trs(json.nodes[i] as never); return p === undefined ? local : mul(world(p), local); };
  const joints = new Set(json.skins[0]!.joints);
  return json.skins[0]!.joints.map((i) => {
    const w = world(i); const p = parent.get(i);
    return { index: i, parent: p !== undefined && joints.has(p) ? p : null, children: (json.nodes[i]!.children ?? []).filter((c) => joints.has(c)).length, x: w[12]!, y: w[13]!, z: w[14]! };
  });
}

describe("procedural gait for clip-less quadrupeds", () => {
  test("finds the four legs of the Rime Alpha frost wolf", () => {
    const rig = findQuadrupedLegs(restBones("public/models/bosses/frost-wolf.glb"));
    expect(rig).not.toBeNull();
    expect(rig!.legs).toHaveLength(4);
    expect(rig!.legs.filter((l) => l.front)).toHaveLength(2);
    expect(rig!.legs.filter((l) => l.left)).toHaveLength(2);
    expect(Math.abs(rig!.axis.z)).toBeGreaterThan(Math.abs(rig!.axis.x));
    expect(new Set(rig!.legs.map((l) => l.hip)).size).toBe(4);
  });
  test("a skeleton without legs is refused", () => {
    expect(findQuadrupedLegs([{ index: 0, parent: null, children: 0, x: 0, y: 0, z: 0 }])).toBeNull();
  });
  test("standing still means no leg motion; walking alternates diagonal legs", () => {
    const leg = (front: boolean, left: boolean) => ({ hip: 0, knee: 1, foot: 2, front, left });
    expect(legAngles(leg(true, true), 1, 0)).toEqual({ hip: 0, knee: 0 });
    const a = legAngles(leg(true, true), 1, 1).hip, b = legAngles(leg(true, false), 1, 1).hip;
    expect(Math.sign(a)).toBe(-Math.sign(b));
  });
});
