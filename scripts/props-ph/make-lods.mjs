// Usage: node make-lods.mjs <model.glb> <model-lod.glb> <target triangles>  (needs @gltf-transform/core, functions, extensions and meshoptimizer)
// Traffic/parked LODs for the fleet: same materials and textures, geometry simplified to ~TARGET triangles (unlocked borders,
// then sloppy for anything that won't go), so a dozen parked cars stop costing as much as the whole plaza.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { simplify, weld, prune, dedup } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const [src, out, target] = [process.argv[2], process.argv[3], +process.argv[4]];
const tris = (d) => { let t = 0; for (const m of d.getRoot().listMeshes()) for (const p of m.listPrimitives()) t += (p.getIndices()?.getCount() ?? 0) / 3; return t | 0; };
const doc = await io.read(src); const before = tris(doc);
await doc.transform(weld({ tolerance: 0.0005 }));
for (const error of [0.005, 0.01, 0.02]) { if (tris(doc) <= target) break; await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: target / tris(doc), error, lockBorder: false })); }
if (tris(doc) > target * 1.15) {
  const total = tris(doc);
  for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) {
    const idx = p.getIndices(); if (!idx) continue; const n = idx.getCount();
    if (n / 3 < 300) continue; // small parts (lights, badges) keep their shape
    const want = Math.max(36, Math.floor((n / 3) * target / total) * 3);
    const [res] = MeshoptSimplifier.simplifySloppy(new Uint32Array(idx.getArray()), new Float32Array(p.getAttribute('POSITION').getArray()), 3, null, Math.min(want, n), 0.01);
    idx.setArray(new Uint32Array(res));
  }
}
await doc.transform(prune(), dedup());
await io.write(out, doc); console.log(src.split('/').pop(), before, '->', tris(doc));
