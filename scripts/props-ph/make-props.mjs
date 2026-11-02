// Usage: node make-props.mjs <out dir> [names]  (run from a folder with @gltf-transform/cli, meshoptimizer and sharp installed; SRC = the downloaded Poly Haven 1k glTFs)
// Final phone-ready props from the Poly Haven 1k glTFs: one variant, grounded and centred, simplified, 512px webp.
import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, weld, simplify, textureCompress, resample, flatten, join, center } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'fs';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const SRC = '../ph/src/models', OUT = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });
// [out name, source id, keep node prefix (or null), simplify ratio, texture size]
const ONLY = process.argv[3]?.split(',');
const JOBS = [
  ['leaves', 'potted_plant_02', 'name:potted_plant_02_leaves', 0.3, 512],
  ['street-lamp', 'street_lamp_01', null, 0.4, 512],
  ['trash-can', 'metal_trash_can', '+x', 0.5, 512],
  ['cafe-set', 'outdoor_table_chair_set_01', null, 0.6, 512],
  ['bush', 'shrub_02', null, 0.6, 512],
  ['hydrant', 'fire_hydrant', '-x', 0.25, 256],
  ['pot-plant', 'potted_plant_02', null, 0.25, 512],
  ['plant-tall', 'potted_plant_01', null, 0.12, 512],
  ['plant-small', 'potted_plant_04', null, 0.5, 256],
  ['armchair', 'modern_arm_chair_01', null, 1, 512],
  ['bar-stool', 'bar_chair_round_01', null, 0.3, 256],
  ['pillows', 'throw_pillows_01', null, 1, 512],
  ['vase', 'ceramic_vase_01', null, 0.4, 256],
  ['photo-frame', 'standing_picture_frame_01', null, 1, 256],
  ['side-table', 'side_table_tall_01', null, 1, 256],
  ['bench', 'modular_street_seating', null, 0.35, 512],
];
for (const [name, id, keep, ratio, size] of JOBS.filter((j) => !ONLY || ONLY.includes(j[0]))) {
  const doc = await io.read(`${SRC}/${id}/${id}_1k.gltf`);
  const root = doc.getRoot();
  if (keep && keep.startsWith('name:')) { for (const n of root.listNodes()) if (n.getMesh() && n.getName() !== keep.slice(5)) n.dispose(); } else if (keep) for (const n of root.listNodes()) if (n.getMesh()) { const b = getBounds(n), cx = (b.min[0] + b.max[0]) / 2; if ((keep === '+x') !== (cx > 0)) n.dispose(); }
  await doc.transform(prune(), flatten(), dedup(), weld());
  if (ratio < 1) await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.02 }));
  // ground at y=0, centre in x/z
  await doc.transform(center({ pivot: 'below' }), prune());
  await doc.transform(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [size, size], quality: 80 }));
  await io.write(`${OUT}/${name}.glb`, doc);
  const b = getBounds(root.listScenes()[0]); let tris = 0;
  for (const m of root.listMeshes()) for (const p of m.listPrimitives()) tris += (p.getIndices()?.getCount() ?? 0) / 3;
  console.log(name.padEnd(12), b.max.map((v, i) => (v - b.min[i]).toFixed(2)).join('x'), 'tris', tris | 0, (fs.statSync(`${OUT}/${name}.glb`).size / 1024) | 0, 'KB');
}
