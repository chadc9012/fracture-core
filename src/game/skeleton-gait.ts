/** Procedural walk/run for skinned quadruped models that ship with a skeleton but no animation clips
 * (the Rime Alpha frost wolf). Pure: works on rest-pose bone positions, so the leg finding is testable
 * without three.js. ScenarioBosses.tsx applies the angles to the real bones.
 *
 * Leg finding: feet are leaf bones near the ground; each foot's chain climbs to the first ancestor whose
 * parent branches (the shoulder/hip). The knee is the middle of that chain. Legs whose hips share a parent
 * bone form a pair (shoulders, pelvis); the line between the pairs is the body axis. */
export type RestBone = { index: number; parent: number | null; children: number; x: number; y: number; z: number };
export type Leg = { hip: number; knee: number; foot: number; front: boolean; left: boolean };
/** `axis` is the horizontal body direction (hind → front), `lateral` the horizontal side-to-side axis legs swing about. */
export type QuadrupedRig = { legs: Leg[]; axis: { x: number; z: number }; lateral: { x: number; z: number }; height: number };

export function findQuadrupedLegs(bones: readonly RestBone[]): QuadrupedRig | null {
  if (bones.length < 8) return null;
  const byIndex = new Map(bones.map((b) => [b.index, b]));
  const minY = Math.min(...bones.map((b) => b.y)), maxY = Math.max(...bones.map((b) => b.y));
  const height = maxY - minY;
  if (height <= 0) return null;
  const feet = bones.filter((b) => b.children === 0 && b.y < minY + height * 0.18).sort((a, b) => a.y - b.y);
  const legs: Omit<Leg, "front" | "left">[] = [];
  const used = new Set<number>();
  for (const foot of feet) {
    // climb to the bone just below the branch point
    const chain: number[] = [foot.index];
    let cur = foot;
    while (cur.parent !== null) {
      const parent = byIndex.get(cur.parent);
      if (!parent || parent.children > 1) break;
      chain.push(parent.index); cur = parent;
    }
    if (chain.length < 3) continue;
    const hip = chain[chain.length - 1]!;
    if (used.has(hip)) continue;
    used.add(hip);
    legs.push({ hip, knee: chain[Math.floor(chain.length / 2)]!, foot: foot.index });
    if (legs.length === 4) break;
  }
  if (legs.length !== 4) return null;
  // the front and hind legs each hang from their own girdle: legs whose hips share a parent are a pair
  const parentOf = (i: number) => byIndex.get(i)?.parent ?? -1;
  const firstParent = parentOf(legs[0]!.hip);
  let pairA = legs.map((_, i) => i).filter((i) => parentOf(legs[i]!.hip) === firstParent);
  const fp = legs.map((l) => byIndex.get(l.foot)!);
  if (pairA.length !== 2) {
    // no shared girdle bone: fall back to the two feet closest to the first one
    const d = (a: number, b: number) => Math.hypot(fp[a]!.x - fp[b]!.x, fp[a]!.z - fp[b]!.z);
    const near = [1, 2, 3].sort((a, b) => d(0, a) - d(0, b))[0]!;
    pairA = [0, near];
  }
  const pairB = [0, 1, 2, 3].filter((i) => !pairA.includes(i));
  const centre = (pair: number[]) => ({ x: (fp[pair[0]!]!.x + fp[pair[1]!]!.x) / 2, z: (fp[pair[0]!]!.z + fp[pair[1]!]!.z) / 2 });
  const ca = centre(pairA), cb = centre(pairB);
  const len = Math.hypot(ca.x - cb.x, ca.z - cb.z) || 1;
  // body axis points from the hind pair (B) to the front pair (A); which end is the head does not matter for a gait
  const axis = { x: (ca.x - cb.x) / len, z: (ca.z - cb.z) / len };
  const lateral = { x: axis.z, z: -axis.x };
  const out: Leg[] = legs.map((l, i) => {
    const f = fp[i]!, c = pairA.includes(i) ? ca : cb;
    return { ...l, front: pairA.includes(i), left: (f.x - c.x) * lateral.x + (f.z - c.z) * lateral.z < 0 };
  });
  if (out.filter((l) => l.front && l.left).length !== 1 || out.filter((l) => !l.front && l.left).length !== 1) return null;
  return { legs: out, axis, lateral, height };
}

/** Hip and knee angles (radians, about the body's side-to-side axis) for one leg at gait phase `phase`
 * (radians) and normalised speed `k` (0 still .. 1 walk .. 2 run). Walk is a four-beat lateral sequence,
 * run a gallop with the front and hind pairs nearly together. */
export function legAngles(leg: Leg, phase: number, k: number): { hip: number; knee: number } {
  if (k <= 0.02) return { hip: 0, knee: 0 };
  const running = k > 1.3;
  const offset = running
    ? (leg.front ? 0 : 0.5) + (leg.left ? 0 : 0.1)
    : (leg.front ? 0.25 : 0) + (leg.left ? 0 : 0.5);
  const t = phase / (Math.PI * 2) + offset;
  const sw = Math.sin(t * Math.PI * 2);
  const lift = Math.max(0, Math.cos(t * Math.PI * 2));
  const amp = Math.min(1, k) * (running ? 0.6 : 0.35);
  return { hip: sw * amp, knee: (leg.front ? 1 : -1) * lift * amp * 1.4 };
}
