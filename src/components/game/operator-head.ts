/**
 * Skins a chosen face (operator-faces.ts) onto a headless operator body. The head GLB was cut from another operator
 * (scripts/build-operator-heads.py) and keeps that rig's skin weights; here its meshes are re-bound to the BODY's skeleton by
 * bone name, moved so its Head bone's rest position lands on the body's, and given the player's skin tone (humans) or plating
 * and optics colours (robots). The head then follows every clip the body plays, with no per-frame work.
 */
import * as THREE from "three";
import { cinematicImported } from "@/game/cinematic-materials";
import type { FaceLook } from "@/game/operator-faces";

const isHeadBone = (name: string) => /Head$/.test(name) && !/HeadTop/.test(name);

/** the bone's rest position in the mesh's own (bind) space */
function restPosition(mesh: THREE.SkinnedMesh, index: number): THREE.Vector3 {
  const boneWorld = mesh.skeleton.boneInverses[index]!.clone().invert();
  return new THREE.Vector3().setFromMatrixPosition(mesh.bindMatrixInverse.clone().multiply(boneWorld));
}

/** skin tone in linear RGB; keeps each texel's shading relative to the head's own mean skin luminance */
const SKIN_UNIFORMS = "uniform vec3 wfSkin; uniform float wfSkinLum;";
const SKIN_MAP = `{
  vec3 c = diffuseColor.rgb;
  float l = dot(c, vec3(0.3, 0.59, 0.11));
  float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b));
  float sat = (mx - mn) / (mx + 1e-4);
  // skin: warm (red over blue, green between), moderately saturated, not near-black (hair, brows) or vivid (a red scarf, lips)
  float k = smoothstep(0.015, 0.05, c.r - c.b) * smoothstep(0.12, 0.25, sat) * (1.0 - smoothstep(0.78, 0.9, sat))
    * smoothstep(0.012, 0.035, l) * step(c.b, c.g + 0.04);
  vec3 tone = wfSkin * clamp(l / wfSkinLum, 0.0, 2.2);
  diffuseColor.rgb = mix(c, tone, k);
}`;

function tintSkin(material: THREE.Material, hex: string, skinLum: number) {
  if (!(material instanceof THREE.MeshStandardMaterial) || !hex) return;
  const tone = new THREE.Color(hex); // THREE.Color stores linear values (colour management on)
  material.onBeforeCompile = (shader) => {
    shader.uniforms["wfSkin"] = { value: new THREE.Vector3(tone.r, tone.g, tone.b) };
    shader.uniforms["wfSkinLum"] = { value: skinLum };
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `#include <common>\n${SKIN_UNIFORMS}`)
      .replace("#include <map_fragment>", `#include <map_fragment>\n${SKIN_MAP}`);
  };
  material.customProgramCacheKey = () => `operator-skin-${hex}-${skinLum}`;
  material.needsUpdate = true;
}

function robotColours(material: THREE.Material, look: FaceLook) {
  if (!(material instanceof THREE.MeshStandardMaterial)) return;
  if (/RobotPlate/.test(material.name) && look.plating) material.color.set(look.plating);
  if (/RobotOptic/.test(material.name) && look.optics) { material.color.set(look.optics); material.emissive.set(look.optics); material.emissiveIntensity = 1.4; }
}

/** adds the head meshes beside the body mesh; returns the materials made (for disposal), or [] when the rigs don't match */
export function attachHead(object: THREE.Object3D, headScene: THREE.Object3D, look: FaceLook): THREE.Material[] {
  let body: THREE.SkinnedMesh | null = null;
  object.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (m.isSkinnedMesh && (!body || m.geometry.getAttribute("position").count > body.geometry.getAttribute("position").count)) body = m;
  });
  const sources: THREE.SkinnedMesh[] = [];
  headScene.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) sources.push(o as THREE.SkinnedMesh); });
  const b = body as THREE.SkinnedMesh | null;
  if (!b || !b.parent || !sources.length) return [];
  const bodyHead = b.skeleton.bones.findIndex((x) => isHeadBone(x.name));
  if (bodyHead < 0) return [];
  const byName = new Map(b.skeleton.bones.map((x, i) => [x.name, i]));
  const made: THREE.Material[] = [];
  for (const src of sources) {
    const srcHead = src.skeleton.bones.findIndex((x) => isHeadBone(x.name));
    if (srcHead < 0) continue;
    const geo = src.geometry.clone();
    const d = restPosition(b, bodyHead).sub(restPosition(src, srcHead));
    geo.translate(d.x, d.y, d.z);
    // the head's joints, by name, on the body's skeleton (a bone the body lacks goes to its Head)
    const remap = src.skeleton.bones.map((x) => byName.get(x.name) ?? bodyHead);
    const si = geo.getAttribute("skinIndex") as THREE.BufferAttribute;
    for (let i = 0; i < si.count; i++) for (let c = 0; c < 4; c++) si.setComponent(i, c, remap[si.getComponent(i, c)] ?? bodyHead);
    si.needsUpdate = true;
    const mats = (Array.isArray(src.material) ? src.material : [src.material]).map((m) => {
      const copy = cinematicImported(m);
      if (look.skin) tintSkin(copy, look.skin, look.skinLum);
      robotColours(copy, look);
      made.push(copy);
      return copy;
    });
    const mesh = new THREE.SkinnedMesh(geo, Array.isArray(src.material) ? mats : mats[0]!);
    mesh.name = "FaceHead";
    mesh.position.copy(b.position); mesh.quaternion.copy(b.quaternion); mesh.scale.copy(b.scale);
    mesh.frustumCulled = false; mesh.castShadow = b.castShadow; mesh.receiveShadow = true;
    b.parent.add(mesh);
    mesh.bind(b.skeleton, b.bindMatrix);
  }
  return made;
}
