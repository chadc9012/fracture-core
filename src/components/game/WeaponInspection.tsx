import { Component, Suspense, useMemo, useRef, type ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { WEAPONS, type WeaponId } from "@/game/weapons";
import { handlingClass, type HandlingClass } from "@/game/weapon-handling";
import { RIFLE_URL } from "./ViewWeapon";

/**
 * Arsenal weapon inspection: the weapon's own in-game model (the same GLB the first-person view holds,
 * public/models/weapons) on a slow turntable you can orbit and zoom, beside its real combat numbers from weapons.ts.
 */
const URL: Record<HandlingClass, string> = { rifle: RIFLE_URL, pistol: "/models/weapons/pistol.glb", shotgun: "/models/weapons/shotgun.glb", heavy: "/models/weapons/heavy.glb", launcher: "/models/weapons/launcher.glb", sword: "/models/weapons/sword.glb" };

class Quiet extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  override render() { return this.state.failed ? null : this.props.children; }
}

function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const obj = useMemo(() => {
    const root = scene.clone(true);
    // centre it and fit a 2 m stage
    const box = new THREE.Box3().setFromObject(root), size = box.getSize(new THREE.Vector3()), mid = box.getCenter(new THREE.Vector3());
    const k = 2 / Math.max(size.x, size.y, size.z, 0.001);
    const g = new THREE.Group();
    root.position.sub(mid);
    g.add(root);
    g.scale.setScalar(k);
    // the barrel runs along z: turn it side-on to the camera
    if (size.z >= size.x) g.rotation.y = Math.PI / 2;
    return g;
  }, [scene]);
  const spin = useRef<THREE.Group>(null);
  useFrame((_, dt) => { if (spin.current) spin.current.rotation.y += Math.min(dt, 0.05) * 0.3; });
  return <group ref={spin}><primitive object={obj} /></group>;
}

/** stat bars scaled 0-100 from the weapon's real numbers */
export function weaponMetrics(id: WeaponId) {
  const w = WEAPONS[id];
  const clamp = (v: number) => Math.max(4, Math.min(100, Math.round(v)));
  const perShot = w.damage * (w.pellets ?? 1) * (w.burst || 1);
  return [
    ["Impact", clamp((perShot / 6) * 100)],
    ["Rate of fire", w.kind === "sword" ? 60 : clamp((1 / w.fireRate / 10) * 100)],
    ["Stability", clamp(100 - w.recoil * 1400)],
    ["Accuracy", clamp(100 - w.spread * 1400)],
    ["Magazine", w.kind === "sword" ? 0 : clamp((w.mag / 40) * 100)],
  ] as const;
}

export function WeaponInspection({ id, onClose }: { id: WeaponId; onClose: () => void }) {
  const w = WEAPONS[id];
  return <section className="wf-panel mt-6 p-4 sm:p-5" aria-label={`Inspect ${w.name}`}>
    <div className="flex items-start justify-between gap-3">
      <div><p className="ui-kicker text-[var(--wf-ice)]">Weapon inspection · {handlingClass(id)}</p><h2 className="mt-1 text-2xl font-light uppercase tracking-[0.14em]">{w.name}</h2>
        <p className="text-xs text-muted-foreground">{(w.element ?? "KINETIC").toLowerCase()} · {w.kind === "sword" ? "melee" : `${w.mag}-round magazine · ${w.reserve} reserve`}</p></div>
      <button type="button" className="ui-focus border border-[var(--wf-line)] px-3 py-1.5 text-[11px] uppercase tracking-widest hover:border-[var(--wf-ice)]" onClick={onClose}>Close</button>
    </div>
    <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(14rem,1fr)]">
      <div className="relative h-72 overflow-hidden border border-[var(--wf-line)]" style={{ background: "radial-gradient(ellipse at 50% 70%, #17384d, #050b14 70%)" }}>
        <Canvas camera={{ position: [0, 0.6, 3.2], fov: 38 }} dpr={[1, 1.75]}>
          {/* a studio rig: the weapons' authored materials are dark gunmetal, so key + rim + a cool fill */}
          <hemisphereLight args={["#dff4ff", "#1a2430", 1.4]} />
          <directionalLight position={[3, 4, 5]} intensity={3.4} />
          <directionalLight position={[-4, 1.5, -3]} intensity={2.2} color="#7fd6ff" />
          <pointLight position={[0, -1.5, 2]} intensity={6} distance={8} color="#9fe6ff" />
          <Quiet><Suspense fallback={null}><Model url={URL[handlingClass(id)]} /></Suspense></Quiet>
          <OrbitControls enablePan={false} minDistance={1.8} maxDistance={6} />
        </Canvas>
        <p className="pointer-events-none absolute inset-x-0 bottom-2 text-center font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--wf-ice)]/60">Drag to rotate · scroll to zoom</p>
      </div>
      <div className="space-y-2.5">
        {weaponMetrics(id).filter(([, v]) => v > 0).map(([k, v]) => <div key={k}><div className="flex justify-between text-xs"><span>{k}</span><span className="font-mono text-[var(--wf-ice)]">{v}</span></div><div className="wf-stat"><i style={{ width: `${v}%` }} /></div></div>)}
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 border-t border-[var(--wf-line)] pt-3 text-xs">
          <dt className="text-muted-foreground">Damage</dt><dd>×{w.damage}{w.pellets ? ` × ${w.pellets} pellets` : ""}</dd>
          {w.kind !== "sword" && <><dt className="text-muted-foreground">Fire rate</dt><dd>{(1 / w.fireRate).toFixed(1)} / s{w.burst > 1 ? ` · ${w.burst}-round burst` : ""}</dd><dt className="text-muted-foreground">Reload</dt><dd>{w.reload.toFixed(1)} s</dd></>}
          <dt className="text-muted-foreground">Element</dt><dd>{(w.element ?? "KINETIC").toLowerCase()}</dd>
        </dl>
      </div>
    </div>
  </section>;
}
