import { useMemo, useRef, type ReactElement } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { handlingClass, type HandlingClass, type ViewPose } from "@/game/weapon-handling";

/**
 * First-person weapons and hands (combat spec §1). One model per handling class, drawn in camera space at the
 * pose weapon-handling.ts computes each frame (hip/ADS, recoil spring, sprint, swap, reload, slide/pump/bolt).
 * Moving parts are separate groups: the magazine drops out on reload, the slide/pump/bolt cycles after each
 * shot, and the support hand moves from the foregrip to the magazine well. A muzzle flash (sprite + light)
 * fires on each shot.
 *
 * Depth: the viewmodel draws last, in the transparent pass, after clearing the depth buffer, so the weapon is
 * never cut by nearby walls while world water and particles still depth-sort correctly before it.
 * Origin of every model is the firing hand's grip; the barrel points down -z.
 */
type Colors = { armor: string; cloth: string; accent: string };
type PartProps = { geo: "box" | "cyl" | "sphere"; size: [number, number, number]; at?: [number, number, number]; rot?: [number, number, number]; mat: THREE.Material };

const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = (() => { const g = new THREE.CylinderGeometry(1, 1, 1, 14); g.rotateX(Math.PI / 2); return g; })(); // along z
const SPHERE = new THREE.SphereGeometry(1, 12, 8);
const ORDER = 1_000_000;

function Part({ geo, size, at, rot, mat }: PartProps) {
  const g = geo === "box" ? BOX : geo === "cyl" ? CYL : SPHERE;
  // cylinders: size = [radius, radius, length]
  return <mesh geometry={g} material={mat} position={at} rotation={rot} scale={size} renderOrder={ORDER} frustumCulled={false} />;
}

function useMats(c: Colors) {
  return useMemo(() => {
    const m = (color: string, metal: number, rough: number, emissive?: string, ei = 0) => new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: rough, emissive: emissive ?? "#000000", emissiveIntensity: ei, transparent: true, opacity: 1, depthWrite: true });
    return {
      metal: m("#2a2e34", 0.85, 0.38),
      dark: m("#15171b", 0.6, 0.55),
      polymer: m("#1d2024", 0.1, 0.8),
      armor: m(c.armor, 0.55, 0.42),
      accent: m(c.accent, 0.3, 0.3, c.accent, 1.6),
      glove: m("#202226", 0.1, 0.9),
      sleeve: m(c.cloth, 0.05, 0.9),
      blade: m("#cfd8e2", 0.95, 0.15, c.accent, 0.35),
      edge: m(c.accent, 0.2, 0.2, c.accent, 3),
      brass: m("#b9853a", 0.9, 0.3),
    };
  }, [c.armor, c.cloth, c.accent]);
}

type Mats = ReturnType<typeof useMats>;
type Rig = { mag?: THREE.Group | null; action?: THREE.Group | null; support?: THREE.Group | null };

/* ---------- models (origin = firing hand grip, barrel along -z) ---------- */
function Rifle({ m, rig }: { m: Mats; rig: Rig }) {
  return <group>
    <Part geo="box" size={[0.06, 0.085, 0.36]} at={[0, 0.07, -0.12]} mat={m.metal} />
    <Part geo="box" size={[0.064, 0.07, 0.26]} at={[0, 0.06, -0.42]} mat={m.dark} />
    {[0, 1, 2, 3].map((i) => <Part key={i} geo="box" size={[0.066, 0.012, 0.03]} at={[0, 0.09, -0.34 - i * 0.05]} mat={m.metal} />)}
    <Part geo="cyl" size={[0.012, 0.012, 0.2]} at={[0, 0.07, -0.64]} mat={m.metal} />
    <Part geo="cyl" size={[0.02, 0.02, 0.06]} at={[0, 0.07, -0.76]} mat={m.dark} />
    <Part geo="box" size={[0.02, 0.012, 0.3]} at={[0.034, 0.075, -0.3]} mat={m.accent} />
    {/* optic */}
    <Part geo="box" size={[0.04, 0.04, 0.11]} at={[0, 0.135, -0.14]} mat={m.dark} />
    <Part geo="box" size={[0.03, 0.026, 0.004]} at={[0, 0.14, -0.083]} mat={m.accent} />
    {/* stock */}
    <Part geo="box" size={[0.045, 0.06, 0.2]} at={[0, 0.05, 0.14]} mat={m.polymer} />
    <Part geo="box" size={[0.05, 0.11, 0.03]} at={[0, 0.03, 0.25]} mat={m.dark} />
    {/* pistol grip and foregrip */}
    <Part geo="box" size={[0.04, 0.11, 0.045]} at={[0, -0.02, 0]} rot={[-0.3, 0, 0]} mat={m.polymer} />
    <Part geo="box" size={[0.035, 0.09, 0.035]} at={[0, -0.01, -0.4]} mat={m.polymer} />
    <group ref={(g) => { rig.mag = g; if (g && g.userData["y0"] === undefined) g.userData["y0"] = g.position.y; }} position={[0, 0.02, -0.18]}>
      <Part geo="box" size={[0.04, 0.16, 0.07]} at={[0, -0.07, 0]} rot={[0.18, 0, 0]} mat={m.dark} />
    </group>
    <group ref={(g) => { rig.action = g; }}>
      <Part geo="box" size={[0.022, 0.016, 0.04]} at={[0.04, 0.09, -0.06]} mat={m.metal} />
    </group>
  </group>;
}

function Pistol({ m, rig }: { m: Mats; rig: Rig }) {
  return <group>
    <group ref={(g) => { rig.action = g; }}>
      <Part geo="box" size={[0.04, 0.045, 0.22]} at={[0, 0.075, -0.08]} mat={m.metal} />
      <Part geo="box" size={[0.042, 0.008, 0.18]} at={[0, 0.1, -0.08]} mat={m.dark} />
      {[0, 1, 2, 3].map((i) => <Part key={i} geo="box" size={[0.043, 0.03, 0.005]} at={[0, 0.075, -0.005 - i * 0.012]} mat={m.dark} />)}
    </group>
    <Part geo="box" size={[0.038, 0.03, 0.18]} at={[0, 0.04, -0.09]} mat={m.polymer} />
    <Part geo="cyl" size={[0.012, 0.012, 0.03]} at={[0, 0.075, -0.2]} mat={m.dark} />
    <Part geo="box" size={[0.008, 0.008, 0.16]} at={[0.022, 0.06, -0.08]} mat={m.accent} />
    <Part geo="box" size={[0.036, 0.11, 0.05]} at={[0, -0.02, 0]} rot={[-0.28, 0, 0]} mat={m.polymer} />
    <group ref={(g) => { rig.mag = g; if (g && g.userData["y0"] === undefined) g.userData["y0"] = g.position.y; }} position={[0, -0.01, 0.005]}>
      <Part geo="box" size={[0.03, 0.09, 0.04]} at={[0, -0.04, 0]} rot={[-0.28, 0, 0]} mat={m.dark} />
    </group>
  </group>;
}

function Shotgun({ m, rig }: { m: Mats; rig: Rig }) {
  return <group>
    <Part geo="box" size={[0.065, 0.09, 0.3]} at={[0, 0.07, -0.1]} mat={m.metal} />
    <Part geo="cyl" size={[0.02, 0.02, 0.5]} at={[0, 0.095, -0.48]} mat={m.dark} />
    <Part geo="cyl" size={[0.018, 0.018, 0.4]} at={[0, 0.055, -0.44]} mat={m.metal} />
    <Part geo="box" size={[0.02, 0.01, 0.24]} at={[0.034, 0.1, -0.12]} mat={m.accent} />
    <Part geo="box" size={[0.05, 0.07, 0.24]} at={[0, 0.045, 0.16]} mat={m.polymer} />
    <Part geo="box" size={[0.052, 0.12, 0.035]} at={[0, 0.02, 0.29]} mat={m.dark} />
    <Part geo="box" size={[0.042, 0.11, 0.05]} at={[0, -0.02, 0]} rot={[-0.3, 0, 0]} mat={m.polymer} />
    {/* loading port: shells pass here on reload */}
    <group ref={(g) => { rig.mag = g; if (g && g.userData["y0"] === undefined) g.userData["y0"] = g.position.y; }} position={[0, 0.02, -0.12]}>
      <Part geo="cyl" size={[0.012, 0.012, 0.05]} at={[0, -0.02, 0]} mat={m.brass} />
    </group>
    <group ref={(g) => { rig.action = g; }}>
      <Part geo="box" size={[0.06, 0.05, 0.14]} at={[0, 0.05, -0.38]} mat={m.polymer} />
      {[0, 1, 2].map((i) => <Part key={i} geo="box" size={[0.062, 0.052, 0.008]} at={[0, 0.05, -0.33 - i * 0.04]} mat={m.dark} />)}
    </group>
  </group>;
}

function Heavy({ m, rig }: { m: Mats; rig: Rig }) {
  return <group>
    <Part geo="box" size={[0.11, 0.13, 0.48]} at={[0, 0.08, -0.16]} mat={m.metal} />
    <Part geo="cyl" size={[0.045, 0.045, 0.32]} at={[0, 0.08, -0.56]} mat={m.dark} />
    {[0, 1, 2].map((i) => <Part key={i} geo="cyl" size={[0.05, 0.05, 0.02]} at={[0, 0.08, -0.5 - i * 0.08]} mat={m.accent} />)}
    <Part geo="box" size={[0.09, 0.06, 0.12]} at={[0, 0.17, -0.1]} mat={m.armor} />
    <Part geo="box" size={[0.045, 0.12, 0.05]} at={[0, -0.03, 0]} rot={[-0.25, 0, 0]} mat={m.polymer} />
    <Part geo="box" size={[0.04, 0.1, 0.04]} at={[0, -0.01, -0.36]} mat={m.polymer} />
    <group ref={(g) => { rig.mag = g; if (g && g.userData["y0"] === undefined) g.userData["y0"] = g.position.y; }} position={[0, 0, -0.2]}>
      <Part geo="cyl" size={[0.06, 0.06, 0.07]} at={[0, -0.06, 0]} rot={[0, Math.PI / 2, 0]} mat={m.dark} />
    </group>
    <group ref={(g) => { rig.action = g; }}>
      <Part geo="box" size={[0.03, 0.03, 0.06]} at={[0.07, 0.1, -0.05]} mat={m.metal} />
    </group>
  </group>;
}

function Launcher({ m, rig }: { m: Mats; rig: Rig }) {
  return <group>
    <Part geo="cyl" size={[0.075, 0.075, 0.8]} at={[0, 0.12, -0.2]} mat={m.armor} />
    <Part geo="cyl" size={[0.085, 0.085, 0.06]} at={[0, 0.12, -0.6]} mat={m.dark} />
    <Part geo="cyl" size={[0.09, 0.09, 0.08]} at={[0, 0.12, 0.2]} mat={m.dark} />
    <Part geo="box" size={[0.05, 0.06, 0.12]} at={[0.08, 0.17, -0.15]} mat={m.dark} />
    <Part geo="box" size={[0.03, 0.03, 0.004]} at={[0.08, 0.17, -0.088]} mat={m.accent} />
    <Part geo="box" size={[0.045, 0.12, 0.05]} at={[0, -0.01, 0]} rot={[-0.25, 0, 0]} mat={m.polymer} />
    <group ref={(g) => { rig.mag = g; if (g && g.userData["y0"] === undefined) g.userData["y0"] = g.position.y; }} position={[0, 0.12, 0.25]}>
      <Part geo="cyl" size={[0.06, 0.06, 0.12]} mat={m.accent} />
    </group>
  </group>;
}

function Sword({ m }: { m: Mats; rig: Rig }) {
  // held upright-forward; the edge glows in the operator's accent
  return <group rotation={[-1.1, 0, 0]}>
    <Part geo="box" size={[0.03, 0.03, 0.16]} at={[0, 0, 0.04]} mat={m.glove} />
    <Part geo="box" size={[0.14, 0.03, 0.035]} at={[0, 0, -0.05]} mat={m.metal} />
    <Part geo="box" size={[0.045, 0.008, 0.85]} at={[0, 0, -0.5]} mat={m.blade} />
    <Part geo="box" size={[0.006, 0.01, 0.82]} at={[0.024, 0, -0.5]} mat={m.edge} />
  </group>;
}

const MODELS: Record<HandlingClass, (p: { m: Mats; rig: Rig }) => ReactElement> = { rifle: Rifle, pistol: Pistol, shotgun: Shotgun, heavy: Heavy, launcher: Launcher, sword: Sword };
/** support hand rest positions per class: foregrip, and magazine well while reloading (null = one-handed) */
const SUPPORT: Record<HandlingClass, { grip: [number, number, number]; well: [number, number, number] } | null> = {
  rifle: { grip: [0, -0.04, -0.4], well: [0, -0.06, -0.18] },
  pistol: { grip: [-0.01, -0.035, 0.01], well: [0, -0.09, 0.02] },
  shotgun: { grip: [0, 0.01, -0.38], well: [0, -0.01, -0.12] },
  heavy: { grip: [0, -0.04, -0.36], well: [0, -0.08, -0.2] },
  launcher: { grip: [0, 0.03, -0.3], well: [0, 0.1, 0.25] },
  sword: null,
};
const MUZZLE: Record<HandlingClass, [number, number, number] | null> = { rifle: [0, 0.07, -0.8], pistol: [0, 0.075, -0.22], shotgun: [0, 0.095, -0.75], heavy: [0, 0.08, -0.74], launcher: [0, 0.12, -0.65], sword: null };

/** Gloved hand + armored forearm reaching back toward the camera's lower edge. */
function Arm({ m, side }: { m: Mats; side: 1 | -1 }) {
  return <group>
    <Part geo="box" size={[0.06, 0.05, 0.09]} at={[0, 0, 0]} mat={m.glove} />
    <Part geo="box" size={[0.065, 0.06, 0.04]} at={[0, 0.012, 0.06]} mat={m.armor} />
    <group rotation={[0.55, side * -0.25, 0]}>
      <Part geo="cyl" size={[0.035, 0.035, 0.32]} at={[0, -0.02, 0.22]} mat={m.sleeve} />
      <Part geo="box" size={[0.075, 0.065, 0.17]} at={[0, 0.005, 0.18]} mat={m.armor} />
      <Part geo="box" size={[0.012, 0.012, 0.12]} at={[side * 0.04, 0.02, 0.18]} mat={m.accent} />
    </group>
  </group>;
}

const FLASH_TEX = (() => {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, "rgba(255,250,230,1)"); r.addColorStop(0.25, "rgba(255,190,90,0.9)"); r.addColorStop(1, "rgba(255,120,30,0)");
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();

export function ViewWeapon({ pose, colors }: { pose: { current: ViewPose | null }; colors: Colors }) {
  const m = useMats(colors);
  const root = useRef<THREE.Group>(null!);
  const groups = useRef<Partial<Record<HandlingClass, THREE.Group | null>>>({});
  const rigs = useRef<Record<HandlingClass, Rig>>({ rifle: {}, pistol: {}, shotgun: {}, heavy: {}, launcher: {}, sword: {} });
  const support = useRef<THREE.Group>(null!);
  const flash = useRef<THREE.Sprite>(null!);
  const light = useRef<THREE.PointLight>(null!);
  const flashMat = useMemo(() => new THREE.SpriteMaterial({ map: FLASH_TEX, color: "#ffd9a0", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), []);
  const clearer = useMemo(() => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.0001, 0.0001), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    mesh.renderOrder = ORDER - 1; mesh.frustumCulled = false;
    mesh.onBeforeRender = (renderer) => renderer.clearDepth();
    return mesh;
  }, []);

  useFrame(() => {
    const p = pose.current;
    if (!p || !root.current) return;
    const cls = handlingClass(p.weapon);
    root.current.position.set(p.pos[0], p.pos[1], p.pos[2]);
    root.current.rotation.set(p.rot[0], p.rot[1], p.rot[2]);
    for (const k of Object.keys(groups.current) as HandlingClass[]) { const g = groups.current[k]; if (g) g.visible = k === cls; }
    const rig = rigs.current[cls];
    if (rig.mag) { rig.mag.visible = p.magVisible; rig.mag.position.y = (rig.mag.userData["y0"] as number ?? 0) - p.magDrop; }
    if (rig.action) rig.action.position.z = p.action * (cls === "shotgun" ? 0.08 : cls === "pistol" ? 0.035 : 0.05);
    const sup = SUPPORT[cls];
    if (support.current) {
      support.current.visible = Boolean(sup);
      if (sup) {
        const r = p.supportReach;
        support.current.position.set(sup.grip[0] + (sup.well[0] - sup.grip[0]) * r - 0.01, sup.grip[1] + (sup.well[1] - sup.grip[1]) * r - p.magDrop * r, sup.grip[2] + (sup.well[2] - sup.grip[2]) * r + (cls === "shotgun" ? p.action * 0.08 * (1 - r) : 0));
      }
    }
    const muzzle = MUZZLE[cls];
    const on = muzzle && p.flash > 0;
    if (flash.current) { flash.current.visible = Boolean(on); if (on) { flash.current.position.set(muzzle[0], muzzle[1], muzzle[2] - 0.05); const s = (cls === "shotgun" || cls === "heavy" ? 0.45 : 0.3) * (0.7 + p.flash * 0.6); flash.current.scale.set(s, s, s); flash.current.material.rotation = Math.random() * Math.PI; } }
    if (light.current) { light.current.intensity = on ? 6 * p.flash : 0; if (muzzle) light.current.position.set(muzzle[0], muzzle[1], muzzle[2]); }
  });

  return <group>
    <primitive object={clearer} />
    <group ref={root}>
      {(Object.keys(MODELS) as HandlingClass[]).map((k) => {
        const Model = MODELS[k];
        return <group key={k} ref={(g) => { groups.current[k] = g; }} visible={false}><Model m={m} rig={rigs.current[k]} /></group>;
      })}
      {/* firing hand on the grip, support hand on the foregrip (or at the magazine well while reloading) */}
      <group position={[0, -0.02, 0.01]}><Arm m={m} side={1} /></group>
      <group ref={support}><group rotation={[0, 0.5, 0]}><Arm m={m} side={-1} /></group></group>
      <sprite ref={flash} material={flashMat} visible={false} renderOrder={ORDER + 1} />
      <pointLight ref={light} color="#ffb060" intensity={0} distance={6} decay={2} />
    </group>
  </group>;
}
