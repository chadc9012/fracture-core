/**
 * Skins a chosen face (operator-faces.ts) onto a headless operator body. The head GLB was cut from another operator
 * (scripts/build-operator-heads.py) and keeps that rig's skin weights; here its meshes are re-bound to the BODY's skeleton by
 * bone name, moved so its Head bone's rest position lands on the body's, and given the player's skin tone (humans) or plating
 * and optics colours (robots). The head then follows every clip the body plays, with no per-frame work.
 */
import * as THREE from "three";
import { cinematicImported } from "@/game/cinematic-materials";
import type { FaceLook } from "@/game/operator-faces";
import { skinProgram, type HairMode } from "@/game/operator-skin-shader";
import { bindHairToBone, fitSkull, hairGeometry, scalpGeometry, strandTexture, type Skull } from "@/game/hair-geometry";
import { MORPHS, morphDisplacement, morphPositions, type FaceMorphs } from "@/game/face-morphs";
import { accessoryPieces, headgearPieces, type GearPiece } from "@/game/gear-geometry";

const isHeadBone = (name: string) => /Head$/.test(name) && !/HeadTop/.test(name);
const isHeadTop = (name: string) => /HeadTop_End$/.test(name);
/** the rig's metres per unit from the Head → HeadTop_End distance (0.18 m on a 1.85 m human); 1 when the rig has no top bone */
function headUnit(mesh: THREE.SkinnedMesh, headIndex: number): number {
  const top = mesh.skeleton.bones.findIndex((x) => isHeadTop(x.name));
  if (top < 0) return 1;
  const d = restPosition(mesh, top).distanceTo(restPosition(mesh, headIndex));
  return d > 1e-4 ? d / 0.18 : 1;
}

/** the bone's rest position in the mesh's own (bind) space */
function restPosition(mesh: THREE.SkinnedMesh, index: number): THREE.Vector3 {
  const boneWorld = mesh.skeleton.boneInverses[index]!.clone().invert();
  return new THREE.Vector3().setFromMatrixPosition(mesh.bindMatrixInverse.clone().multiply(boneWorld));
}

/** The skin material's program (operator-skin-shader.ts): skin tone, the authored hair's treatment for the chosen style, and
 * the markings. `head`/`unit` place the shapes in head space: the Head bone's rest position and the rig's metres-per-unit. */
function patchSkin(material: THREE.Material, look: FaceLook, head: THREE.Vector3, unit: number) {
  if (!(material instanceof THREE.MeshStandardMaterial)) return;
  const hairMode: HairMode = look.style.hair.kind === "authored" ? 0 : look.style.hair.kind === "none" ? 1 : 2;
  if (!look.skin && hairMode === 0 && look.style.marks.length === 0 && look.style.beard === "clean") return; // nothing to change: keep the authored head as is
  const program = skinProgram({ skinHex: look.skin, skinLum: look.skinLum, hairMode, hairHex: look.style.hairHex, marks: look.style.marks, beard: look.style.beard });
  const tone = look.skin ? new THREE.Color(look.skin) : new THREE.Color(0, 0, 0); // THREE.Color stores linear values (colour management on)
  const hair = new THREE.Color(look.style.hairHex || "#120f0e");
  // a bald scalp with the skin left "as modelled": a warm tone at the head's own skin brightness
  const bald = look.skin ? tone.clone() : new THREE.Color(look.skinLum * 1.9, look.skinLum * 1.35, look.skinLum * 1.05);
  material.onBeforeCompile = (shader) => {
    shader.uniforms["wfSkin"] = { value: new THREE.Vector3(tone.r, tone.g, tone.b) };
    shader.uniforms["wfSkinLum"] = { value: look.skinLum };
    shader.uniforms["wfHead"] = { value: head.clone() };
    shader.uniforms["wfUnit"] = { value: unit };
    shader.uniforms["wfHair"] = { value: new THREE.Vector3(hair.r, hair.g, hair.b) };
    shader.uniforms["wfHairMode"] = { value: hairMode };
    shader.uniforms["wfBald"] = { value: new THREE.Vector3(bald.r, bald.g, bald.b) };
    // facial hair takes the hair colour; with the hair "as modelled" it is near-black
    const beardTone = new THREE.Color(look.style.hairHex || "#1a1411");
    shader.uniforms["wfBeardTone"] = { value: new THREE.Vector3(beardTone.r, beardTone.g, beardTone.b) };
    shader.vertexShader = shader.vertexShader.replace("#include <common>", `#include <common>\n${program.vertexDecl}`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>\n${program.vertexAssign}`);
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `#include <common>\n${program.fragmentDecl}`)
      .replace("#include <map_fragment>", `#include <map_fragment>\n${program.fragmentBody}`)
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>\n${program.emissive}`);
  };
  material.customProgramCacheKey = () => program.key;
  material.needsUpdate = true;
}

/** The face editor's sculpt (face-morphs.ts) applied to the head geometry in head space (`head` = the Head bone's rest position,
 * `unit` = the rig's units per metre); normals are rebuilt so the new shape shades right. */
function sculpt(geo: THREE.BufferGeometry, morphs: FaceMorphs, head: THREE.Vector3, unit: number) {
  if (MORPHS.every((m) => !(morphs[m.id] ?? 0))) return;
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const [dx, dy, dz] = morphDisplacement(morphs, (pos.getX(i) - head.x) / unit, (pos.getY(i) - head.y) / unit, (pos.getZ(i) - head.z) / unit);
    if (dx || dy || dz) pos.setXYZ(i, pos.getX(i) + dx * unit, pos.getY(i) + dy * unit, pos.getZ(i) + dz * unit);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
}

/** Helmet off on a body that has its own head: every texel above halfway between the Neck and Head bones (bind space) is cut,
 * so the face head's neck meets the collar. Chains onto any program patch the body already carries (the colourway). */
function cutAboveNeck(body: THREE.SkinnedMesh, headIndex: number) {
  const neck = body.skeleton.bones.findIndex((x) => /Neck$/.test(x.name));
  const headY = restPosition(body, headIndex).y, neckY = neck >= 0 ? restPosition(body, neck).y : headY - 0.1;
  const cut = (headY + neckY) / 2;
  for (const mat of Array.isArray(body.material) ? body.material : [body.material]) {
    const m = mat as THREE.MeshStandardMaterial;
    if (m.userData["wfCut"] === cut) continue;
    const prior = m.onBeforeCompile, priorKey = m.customProgramCacheKey?.bind(m);
    m.onBeforeCompile = (shader, renderer) => {
      prior?.(shader, renderer);
      shader.uniforms["wfCut"] = { value: cut };
      shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nvarying float wfBindY;").replace("#include <begin_vertex>", "#include <begin_vertex>\nwfBindY = position.y;");
      shader.fragmentShader = shader.fragmentShader.replace("#include <common>", "#include <common>\nuniform float wfCut; varying float wfBindY;").replace("#include <map_fragment>", "#include <map_fragment>\nif (wfBindY > wfCut) discard;");
    };
    m.customProgramCacheKey = () => `${priorKey ? priorKey() : ""}|cut:${cut}`;
    m.userData["wfCut"] = cut;
    m.needsUpdate = true;
  }
}

/** The head texture's own skin colour (its mean over skin-like texels), as a hex, so a bare scalp matches an untinted face;
 * null when the image can't be read (no DOM, a GPU-compressed texture). Cached per texture. */
const skinSamples = new WeakMap<THREE.Texture, string | null>();
function sampleSkinTone(material: THREE.Material | THREE.Material[]): string | null {
  const m = (Array.isArray(material) ? material[0] : material) as THREE.MeshStandardMaterial;
  const tex = m?.map;
  if (!tex || typeof document === "undefined") return null;
  if (skinSamples.has(tex)) return skinSamples.get(tex)!;
  let out: string | null = null;
  try {
    const img = tex.image as CanvasImageSource & { width?: number; height?: number };
    const w = 96, h = 96, canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (ctx && img && (img.width ?? 0) > 0) {
      ctx.drawImage(img, 0, 0, w, h);
      const d = ctx.getImageData(0, 0, w, h).data;
      let r = 0, g = 0, bl = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) {
        const R = d[i]! / 255, G = d[i + 1]! / 255, B = d[i + 2]! / 255;
        const mx = Math.max(R, G, B), mn = Math.min(R, G, B), sat = (mx - mn) / (mx + 1e-4), lum = 0.3 * R + 0.59 * G + 0.11 * B;
        if (R - B > 0.06 && sat > 0.15 && sat < 0.8 && lum > 0.12 && B <= G + 0.04) { r += R; g += G; bl += B; n++; }
      }
      if (n > 50) out = "#" + [r / n, g / n, bl / n].map((c) => Math.round(Math.min(1, c) * 255).toString(16).padStart(2, "0")).join("");
    }
  } catch { out = null; }
  skinSamples.set(tex, out);
  return out;
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
  if (look.cutBody) cutAboveNeck(b, bodyHead);
  const headRest = restPosition(b, bodyHead);
  // head space is scaled by the HEAD's own rig (the head keeps the size it was cut at; the body's rig may differ)
  const firstSrc = sources.find((src) => src.skeleton.bones.some((x) => isHeadBone(x.name)));
  const unit = firstSrc ? headUnit(firstSrc, firstSrc.skeleton.bones.findIndex((x) => isHeadBone(x.name))) : headUnit(b, bodyHead);
  // the head's own skull in head space (metres), so hair caps hug this head and off-skull hair is told apart
  let skull: Skull | null = null;
  if (firstSrc) {
    const pos = firstSrc.geometry.getAttribute("position") as THREE.BufferAttribute;
    const srcHeadIdx = firstSrc.skeleton.bones.findIndex((x) => isHeadBone(x.name));
    const origin = restPosition(firstSrc, srcHeadIdx);
    const xyz = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) { xyz[i * 3] = (pos.getX(i) - origin.x) / unit; xyz[i * 3 + 1] = (pos.getY(i) - origin.y) / unit; xyz[i * 3 + 2] = (pos.getZ(i) - origin.z) / unit; }
    morphPositions(xyz, look.morphs); // the sculpted head is what the hair sits on
    skull = fitSkull(xyz);
  }
  for (const src of sources) {
    const srcHead = src.skeleton.bones.findIndex((x) => isHeadBone(x.name));
    if (srcHead < 0) continue;
    const geo = src.geometry.clone();
    const d = restPosition(b, bodyHead).sub(restPosition(src, srcHead));
    geo.translate(d.x, d.y, d.z);
    sculpt(geo, look.morphs, headRest, unit);
    // the head's joints, by name, on the body's skeleton (a bone the body lacks goes to its Head)
    const remap = src.skeleton.bones.map((x) => byName.get(x.name) ?? bodyHead);
    const si = geo.getAttribute("skinIndex") as THREE.BufferAttribute;
    for (let i = 0; i < si.count; i++) for (let c = 0; c < 4; c++) si.setComponent(i, c, remap[si.getComponent(i, c)] ?? bodyHead);
    si.needsUpdate = true;
    const mats = (Array.isArray(src.material) ? src.material : [src.material]).map((m) => {
      const copy = cinematicImported(m);
      patchSkin(copy, look, headRest, unit);
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
  const skinMesh = (geo: THREE.BufferGeometry, mat: THREE.Material, name: string) => {
    const mesh = new THREE.SkinnedMesh(geo, mat);
    mesh.name = name;
    mesh.position.copy(b.position); mesh.quaternion.copy(b.quaternion); mesh.scale.copy(b.scale);
    mesh.frustumCulled = false; mesh.castShadow = b.castShadow; mesh.receiveShadow = true;
    b.parent!.add(mesh);
    mesh.bind(b.skeleton, b.bindMatrix);
    return mesh;
  };
  // a style other than the head's own hair: the authored hair is cut away by the shader, so a skin-toned skull closes the head
  if (look.style.hair.kind !== "authored" && firstSrc) {
    const fitted = skull ?? fitSkull([]);
    const skinHex = look.skin || sampleSkinTone(firstSrc.material) || "#a8764f";
    const scalpMat = new THREE.MeshStandardMaterial({ color: skinHex, roughness: 0.62, metalness: 0 });
    made.push(scalpMat);
    skinMesh(bindHairToBone(scalpGeometry(fitted), bodyHead, unit, headRest), scalpMat, "FaceScalp").userData["skull"] = fitted;
  }
  // the chosen hairstyle (operator-styling.ts), built in head space and ridden on the Head bone
  const hairGeo = hairGeometry(look.style.hair, skull ?? undefined);
  if (hairGeo) {
    bindHairToBone(hairGeo, bodyHead, unit, headRest);
    const tex = strandTexture();
    const hairMat = new THREE.MeshStandardMaterial({ color: look.style.hairHex || "#120f0e", roughness: 0.72, metalness: 0, vertexColors: true, map: tex,
      ...(look.style.hair.id === "buzz" ? { transparent: true, opacity: 0.7 } : {}) });
    made.push(hairMat);
    skinMesh(hairGeo, hairMat, "FaceHair");
  }
  // accessories and headgear (gear-geometry.ts): each piece with its own material, over the hair
  if (firstSrc) {
    const fitted = skull ?? fitSkull([]);
    const hairLift = look.style.hair.kind === "built" ? Math.max(0.012, ...(look.style.hair.parts ?? []).map((p) => (p.kind === "cap" ? p.thick : p.kind === "afro" ? p.lift + 0.02 : 0.012))) : look.style.hair.kind === "none" ? 0.002 : 0.012;
    const pieces: GearPiece[] = [...accessoryPieces(look.style.accessory, fitted), ...headgearPieces(look.style.headgear, fitted, hairLift)];
    for (const piece of pieces) {
      const m = piece.material;
      const mat = new THREE.MeshStandardMaterial({ color: m.color, roughness: m.roughness ?? 0.6, metalness: m.metalness ?? 0, side: THREE.DoubleSide,
        ...(m.opacity !== undefined ? { transparent: true, opacity: m.opacity } : {}),
        ...(m.emissive ? { emissive: m.emissive, emissiveIntensity: m.emissiveIntensity ?? 1 } : {}) });
      made.push(mat);
      skinMesh(bindHairToBone(piece.geometry, bodyHead, unit, headRest), mat, piece.name);
    }
  }
  return made;
}
