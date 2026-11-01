/**
 * Geometry for worn cosmetics (cosmetics.ts): capes and cloaks, backpacks, wings, pauldrons and spikes, belts and pouches,
 * scarves, masks, amulets, rings, earrings, charms and auras, each built in the space of the bone it rides (metres on a 1.85 m
 * operator; Y runs along the bone, +Z is the character's front, as in armor-pieces.ts). OperatorModel attaches them to the
 * rig so they follow every clip. Pure three.js geometry, no scene.
 */
import * as THREE from "three";
import type { Cosmetic } from "./cosmetics.ts";

export type CosmeticMaterial = { color: string; roughness?: number; metalness?: number; emissive?: string; emissiveIntensity?: number; opacity?: number; doubleSide?: boolean };
export type CosmeticPart = { geometry: THREE.BufferGeometry; material: CosmeticMaterial };
export type CosmeticPiece = { bone: string; name: string; parts: CosmeticPart[] };

const B = "mixamorig:";
const cloth = (color: string): CosmeticMaterial => ({ color, roughness: 0.92, doubleSide: true });
const metal = (color: string): CosmeticMaterial => ({ color, roughness: 0.4, metalness: 0.8 });
const glow = (color: string, k = 1.2): CosmeticMaterial => ({ color, emissive: color, emissiveIntensity: k, roughness: 0.3, doubleSide: true });

/** a hanging sheet: an open cylinder segment behind the back, flaring a little toward the hem */
function sheet(width: number, length: number, color: string, hood = false): CosmeticPart[] {
  const g = new THREE.CylinderGeometry(width * 0.5, width * 0.62, length, 18, 4, true, Math.PI * 0.58, Math.PI * 0.84);
  g.translate(0, 0.16 - length / 2, -0.02);
  const parts: CosmeticPart[] = [{ geometry: g, material: cloth(color) }];
  if (hood) {
    const h = new THREE.SphereGeometry(0.14, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55);
    h.scale(1, 1.1, 1.05); h.translate(0, 0.3, -0.08);
    parts.push({ geometry: h, material: cloth(color) });
  }
  return parts;
}

function wing(side: 1 | -1, color: string, glowHex: string): CosmeticPart[] {
  // three feathered vanes fanning up and out from the shoulder blade
  const parts: CosmeticPart[] = [];
  for (let i = 0; i < 3; i++) {
    const len = 0.8 - i * 0.14, w = 0.16 - i * 0.03;
    const shape = new THREE.Shape();
    shape.moveTo(0, 0); shape.quadraticCurveTo(side * len * 0.6, w * 1.2, side * len, w * 0.2); shape.quadraticCurveTo(side * len * 0.55, -w * 0.3, 0, -w * 0.25); shape.closePath();
    const g = new THREE.ShapeGeometry(shape, 12);
    g.rotateY(side * -0.6); g.rotateZ(side * (0.5 - i * 0.3));
    g.translate(side * 0.06, 0.12 + i * 0.02, -0.1);
    parts.push({ geometry: g, material: { ...glow(glowHex, 0.7), color, opacity: 0.85 } });
  }
  return parts;
}

/** The pieces for the worn cosmetics. */
export function cosmeticPieces(worn: readonly Cosmetic[]): CosmeticPiece[] {
  const out: CosmeticPiece[] = [];
  for (const item of worn) {
    const v = item.visual, g = v.glow ?? v.accent ?? v.color;
    switch (v.kind) {
      case "cape": out.push({ bone: `${B}Spine2`, name: `cosmetic:${item.id}`, parts: sheet(0.5, 0.95, v.color) }); break;
      case "cloak": out.push({ bone: `${B}Spine2`, name: `cosmetic:${item.id}`, parts: [...sheet(0.56, 1.05, v.color, true), ...(v.glow ? [{ geometry: new THREE.TorusGeometry(0.16, 0.005, 6, 24).rotateX(Math.PI / 2).translate(0, 0.17, -0.02), material: glow(v.glow) }] : [])] }); break;
      case "backpack": out.push({ bone: `${B}Spine2`, name: `cosmetic:${item.id}`, parts: [
        { geometry: new THREE.BoxGeometry(0.3, 0.38, 0.16).translate(0, 0.02, -0.2), material: cloth(v.color) },
        { geometry: new THREE.CylinderGeometry(0.07, 0.07, 0.34, 10).rotateZ(Math.PI / 2).translate(0, -0.2, -0.2), material: cloth(v.accent ?? v.color) },
        ...(v.glow ? [{ geometry: new THREE.BoxGeometry(0.03, 0.03, 0.01).translate(0.1, 0.16, -0.285), material: glow(v.glow, 1.8) }] : []),
      ] }); break;
      case "wings": out.push({ bone: `${B}Spine2`, name: `cosmetic:${item.id}`, parts: [...wing(1, v.color, g), ...wing(-1, v.color, g)] }); break;
      case "pauldrons": for (const s of [1, -1] as const) out.push({ bone: `${B}${s === 1 ? "Left" : "Right"}Arm`, name: `cosmetic:${item.id}`, parts: [
        { geometry: new THREE.SphereGeometry(0.11, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55).scale(1.05, 0.8, 1.1).translate(0, 0.04, 0), material: metal(v.color) },
        ...(v.accent ? [{ geometry: new THREE.TorusGeometry(0.1, 0.012, 6, 20).rotateX(Math.PI / 2).translate(0, 0.0, 0), material: metal(v.accent) }] : []),
      ] }); break;
      case "spikes": for (const s of [1, -1] as const) out.push({ bone: `${B}${s === 1 ? "Left" : "Right"}Arm`, name: `cosmetic:${item.id}`, parts: [
        { geometry: new THREE.SphereGeometry(0.1, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5).scale(1, 0.7, 1).translate(0, 0.04, 0), material: metal(v.color) },
        ...[0, 1, 2].map((i) => ({ geometry: new THREE.ConeGeometry(0.02, 0.11, 6).rotateZ(s * -(0.6 + i * 0.4)).translate(s * (0.02 + i * 0.03), 0.09 - i * 0.02, (i - 1) * 0.05), material: metal(v.accent ?? v.color) })),
      ] }); break;
      case "belt": out.push({ bone: `${B}Hips`, name: `cosmetic:${item.id}`, parts: [{ geometry: new THREE.CylinderGeometry(0.2, 0.21, 0.07, 20, 1, true).translate(0, 0.02, 0), material: cloth(v.color) }] }); break;
      case "pouches": out.push({ bone: `${B}Hips`, name: `cosmetic:${item.id}`, parts: [
        { geometry: new THREE.CylinderGeometry(0.19, 0.195, 0.04, 20, 1, true).translate(0, 0.02, 0), material: { color: v.color, roughness: 0.7 } },
        { geometry: new THREE.BoxGeometry(0.05, 0.04, 0.02).translate(0, 0.02, 0.2), material: metal(v.accent ?? "#8a7a5a") },
        ...[-1, 1].map((s) => ({ geometry: new THREE.BoxGeometry(0.09, 0.1, 0.06).translate(s * 0.16, -0.03, 0.08), material: cloth(v.color) })),
      ] }); break;
      case "scarf": out.push({ bone: `${B}Neck`, name: `cosmetic:${item.id}`, parts: [
        { geometry: new THREE.TorusGeometry(0.11, 0.035, 8, 20).rotateX(Math.PI / 2).translate(0, 0.0, 0), material: cloth(v.color) },
        { geometry: new THREE.BoxGeometry(0.09, 0.36, 0.02).rotateX(0.2).translate(0.06, -0.22, 0.1), material: cloth(v.accent ?? v.color) },
      ] }); break;
      case "mask": out.push({ bone: `${B}Head`, name: `cosmetic:${item.id}`, parts: [
        { geometry: new THREE.SphereGeometry(0.1, 16, 10, Math.PI * 0.6, Math.PI * 0.8, Math.PI * 0.42, Math.PI * 0.3).scale(1, 1, 1.05).translate(0, 0.07, 0.0), material: { color: v.color, roughness: 0.6 } },
        ...(v.accent ? [{ geometry: new THREE.BoxGeometry(0.06, 0.006, 0.004).translate(0, 0.055, 0.1), material: glow(v.accent, 1.5) }] : []),
      ] }); break;
      case "amulet": out.push({ bone: `${B}Neck`, name: `cosmetic:${item.id}`, parts: [
        { geometry: new THREE.TorusGeometry(0.1, 0.003, 6, 24).rotateX(Math.PI / 2 + 0.3).translate(0, -0.02, 0.02), material: metal("#c9c1b3") },
        { geometry: new THREE.OctahedronGeometry(0.02, 0).scale(0.7, 1.3, 0.7).translate(0, -0.14, 0.1), material: glow(g, 1.4) },
      ] }); break;
      case "rings": for (const s of [1, -1] as const) out.push({ bone: `${B}${s === 1 ? "Left" : "Right"}Hand`, name: `cosmetic:${item.id}`, parts: [0, 1].map((i) => ({ geometry: new THREE.TorusGeometry(0.011, 0.003, 6, 14).rotateX(Math.PI / 2).translate(s * (0.012 + i * 0.022), 0.08, 0), material: metal(v.color) })) }); break;
      case "earrings": for (const s of [1, -1] as const) out.push({ bone: `${B}Head`, name: `cosmetic:${item.id}`, parts: [{ geometry: v.glow ? new THREE.SphereGeometry(0.005, 8, 6).translate(s * 0.078, 0.045, -0.01) : new THREE.TorusGeometry(0.012, 0.002, 6, 14).translate(s * 0.08, 0.035, -0.01), material: v.glow ? glow(v.glow, 1.8) : metal(v.color) }] }); break;
      case "charm": out.push({ bone: `${B}RightHand`, name: `cosmetic:${item.id}`, parts: [
        { geometry: new THREE.CylinderGeometry(0.002, 0.002, 0.08, 5).translate(0, 0.02, 0.03), material: metal("#9aa3ad") },
        { geometry: new THREE.OctahedronGeometry(0.014, 0).translate(0, -0.03, 0.03), material: glow(g, 1.2) },
      ] }); break;
      case "aura": out.push({ bone: `${B}Hips`, name: `cosmetic:${item.id}`, parts: [
        { geometry: new THREE.RingGeometry(0.42, 0.55, 40).rotateX(-Math.PI / 2).translate(0, -0.98, 0), material: { ...glow(g, 1.1), opacity: 0.55 } },
        { geometry: new THREE.RingGeometry(0.3, 0.33, 40).rotateX(-Math.PI / 2).translate(0, -0.975, 0), material: { ...glow(g, 1.6), opacity: 0.8 } },
      ] }); break;
    }
  }
  return out;
}
