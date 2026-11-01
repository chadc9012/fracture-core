import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useLoader, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { CONTINENTS, OCEANS, type ContinentId } from "@/game/planet";
import { CONTINENT_GLOBE, GLOBE_TEXTURE, OCEAN_GLOBE, continentAt, latLonToVec, vecToLatLon } from "@/game/globe";

/** The planet as a globe you can spin (drag), zoom (pinch, wheel, the buttons) and tap: the canon board's painting wrapped on
 * a sphere (scripts/bake-globe.py), an atmosphere rim, stars, a pin on every continent and the seven oceans' names. Tapping a
 * continent (its pin or its land) selects it and turns the globe to face it; the planet map opens its street maps. */
export type GlobePinState = "open" | "landfall" | "map";
const PIN_COLOR: Record<GlobePinState, string> = { open: "#7ee8ff", landfall: "#ffc860", map: "#8a97a3" };
const R = 1;

function Atmosphere() {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { c: { value: new THREE.Color("#5fc8ff") } },
    vertexShader: "varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }",
    fragmentShader: "uniform vec3 c; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.6); gl_FragColor = vec4(c * 1.4, f * 0.9); }",
    side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }), []);
  return <mesh scale={1.09} material={mat}><sphereGeometry args={[R, 48, 32]} /></mesh>;
}

function Stars() {
  const geo = useMemo(() => {
    const n = 1400, pos = new Float32Array(n * 3);
    let s = 1234567;
    const r = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
    for (let i = 0; i < n; i++) { const u = r() * 2 - 1, t = r() * Math.PI * 2, d = 30 + r() * 20, q = Math.sqrt(1 - u * u); pos.set([q * Math.cos(t) * d, u * d, q * Math.sin(t) * d], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); return g;
  }, []);
  return <points geometry={geo}><pointsMaterial color="#cfe6ff" size={0.09} sizeAttenuation transparent opacity={0.8} /></points>;
}

function Planet({ onPick }: { onPick: (id: ContinentId | null) => void }) {
  const tex = useLoader(THREE.TextureLoader, GLOBE_TEXTURE);
  const gl = useThree((s) => s.gl);
  useEffect(() => { tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy()); tex.needsUpdate = true; }, [tex, gl]);
  const click = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6) return; // a drag that spun the globe, not a tap
    e.stopPropagation();
    const p = e.point;
    onPick(continentAt(vecToLatLon(p.x, p.y, p.z)));
  };
  return <mesh onClick={click}><sphereGeometry args={[R, 96, 64]} /><meshBasicMaterial map={tex} toneMapped={false} /></mesh>;
}

/** the air routes: great-circle arcs lifted off the surface, white when both ends are open, amber otherwise */
function Routes({ routes }: { routes: { a: ContinentId; b: ContinentId; open: boolean }[] }) {
  const lines = useMemo(() => routes.map((r) => {
    const A = new THREE.Vector3(...latLonToVec(CONTINENT_GLOBE[r.a].lat, CONTINENT_GLOBE[r.a].lon)), B = new THREE.Vector3(...latLonToVec(CONTINENT_GLOBE[r.b].lat, CONTINENT_GLOBE[r.b].lon));
    const ang = A.angleTo(B), pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 48; i++) { const t = i / 48; const p = new THREE.Vector3().copy(A).lerp(B, t).normalize(); pts.push(p.multiplyScalar(R * (1.01 + Math.sin(Math.PI * t) * ang * 0.09))); }
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    const m = new THREE.LineDashedMaterial({ color: r.open ? "#ffffff" : "#ffc860", dashSize: 0.025, gapSize: 0.018, transparent: true, opacity: 0.85, depthWrite: false });
    const l = new THREE.Line(g, m); l.computeLineDistances();
    return { key: `${r.a}-${r.b}`, l };
  }), [routes]);
  useEffect(() => () => lines.forEach(({ l }) => { l.geometry.dispose(); (l.material as THREE.Material).dispose(); }), [lines]);
  return <>{lines.map(({ key, l }) => <primitive key={key} object={l} />)}</>;
}

/** turn the camera to face the selected continent (until the player spins the globe themselves) */
function Facing({ target, controls }: { target: [number, number, number] | null; controls: React.RefObject<OrbitControlsImpl | null> }) {
  const camera = useThree((s) => s.camera);
  const goal = useRef<THREE.Vector3 | null>(null);
  useEffect(() => { goal.current = target ? new THREE.Vector3(...target).normalize() : null; }, [target]);
  useEffect(() => {
    const c = controls.current; if (!c) return;
    const stop = () => { goal.current = null; };
    c.addEventListener("start", stop);
    return () => c.removeEventListener("start", stop);
  }, [controls]);
  useFrame((_, dt) => {
    const g = goal.current; if (!g) return;
    const d = camera.position.length(), cur = camera.position.clone().normalize();
    const angle = cur.angleTo(g);
    if (angle < 0.002) { goal.current = null; return; }
    // slerp the direction, keep the distance
    const k = Math.min(1, dt * 3.2);
    const q = new THREE.Quaternion().setFromUnitVectors(cur, g);
    const step = new THREE.Quaternion().slerp(q, k);
    camera.position.copy(cur.applyQuaternion(step).multiplyScalar(d));
    camera.lookAt(0, 0, 0);
    controls.current?.update();
  });
  return null;
}

/** keep the whole globe in a portrait frame: widen the vertical field of view when the view is narrower than it is tall */
function FitFov() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera, aspect = useThree((s) => s.size.width / Math.max(1, s.size.height));
  useEffect(() => {
    const base = 38, fov = aspect < 1 ? (2 * Math.atan(Math.tan(((base / 2) * Math.PI) / 180) / aspect) * 180) / Math.PI : base;
    camera.fov = Math.min(80, fov); camera.updateProjectionMatrix();
  }, [camera, aspect]);
  return null;
}

/** HTML labels pinned to the sphere, hidden when they turn to the far side (one projected layer, cheap on a phone) */
function Labels({ labels, layer }: { labels: { key: string; pos: THREE.Vector3 }[]; layer: React.RefObject<HTMLDivElement | null> }) {
  const camera = useThree((s) => s.camera), size = useThree((s) => s.size);
  const v = useMemo(() => new THREE.Vector3(), []), n = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const root = layer.current; if (!root) return;
    const camDir = n.copy(camera.position).normalize();
    for (const l of labels) {
      const el = root.querySelector<HTMLElement>(`[data-k="${l.key}"]`); if (!el) continue;
      const facing = l.pos.clone().normalize().dot(camDir);
      if (facing < 0.12) { el.style.opacity = "0"; el.style.pointerEvents = "none"; continue; }
      v.copy(l.pos).project(camera);
      el.style.transform = `translate(-50%, -50%) translate(${((v.x + 1) / 2) * size.width}px, ${((1 - v.y) / 2) * size.height}px)`;
      el.style.opacity = String(Math.min(1, (facing - 0.12) / 0.25));
      el.style.pointerEvents = facing > 0.3 ? "auto" : "none";
    }
  });
  return null;
}

export function GlobeView({ selected, here, pinState, routes = [], onSelect, onOpen, zoomRef }: {
  selected: ContinentId; here: ContinentId | null; pinState: (id: ContinentId) => GlobePinState;
  routes?: { a: ContinentId; b: ContinentId; open: boolean }[];
  onSelect: (id: ContinentId) => void; onOpen: (id: ContinentId) => void;
  /** the planet map's zoom buttons call this (a factor: < 1 closer) */
  zoomRef?: React.MutableRefObject<((f: number) => void) | null>;
}) {
  const controls = useRef<OrbitControlsImpl | null>(null);
  const layer = useRef<HTMLDivElement | null>(null);
  const pins = useMemo(() => CONTINENTS.map((c) => { const p = CONTINENT_GLOBE[c.id]; return { key: c.id, pos: new THREE.Vector3(...latLonToVec(p.lat, p.lon)).multiplyScalar(R * 1.012) }; }), []);
  const oceans = useMemo(() => OCEANS.map((o) => { const p = OCEAN_GLOBE[o.id]!; return { key: `ocean-${o.id}`, pos: new THREE.Vector3(...latLonToVec(p.lat, p.lon)).multiplyScalar(R * 1.005) }; }), []);
  const labels = useMemo(() => [...pins, ...oceans], [pins, oceans]);
  const target = useMemo(() => { const p = CONTINENT_GLOBE[selected]; return latLonToVec(p.lat, p.lon); }, [selected]);
  const start = useMemo(() => { const p = CONTINENT_GLOBE[here ?? selected]; return new THREE.Vector3(...latLonToVec(p.lat, p.lon)).multiplyScalar(3.7); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!zoomRef) return;
    zoomRef.current = (f: number) => {
      const c = controls.current; if (!c) return;
      const cam = c.object, d = THREE.MathUtils.clamp(cam.position.length() * f, c.minDistance, c.maxDistance);
      cam.position.setLength(d); c.update();
    };
    return () => { zoomRef.current = null; };
  }, [zoomRef]);

  return (
    <div className="absolute inset-0 select-none">
      <Canvas dpr={[1, 1.75]} camera={{ position: start.toArray(), fov: 38, near: 0.05, far: 200 }} gl={{ antialias: true, powerPreference: "high-performance" }} style={{ touchAction: "none" }}>
        <color attach="background" args={["#03070f"]} />
        <Stars />
        <Suspense fallback={<mesh><sphereGeometry args={[R, 48, 32]} /><meshBasicMaterial color="#123a66" /></mesh>}>
          <Planet onPick={(id) => { if (id) onSelect(id); }} />
        </Suspense>
        <Routes routes={routes} />
        <Atmosphere />
        <OrbitControls ref={controls} enablePan={false} enableDamping dampingFactor={0.08} rotateSpeed={0.55} zoomSpeed={0.7} minDistance={1.3} maxDistance={5} />
        <Facing target={target} controls={controls} />
        <FitFov />
        <Labels labels={labels} layer={layer} />
      </Canvas>
      <div ref={layer} className="pointer-events-none absolute inset-0 overflow-hidden">
        {CONTINENTS.map((c) => {
          const st = pinState(c.id), sel = c.id === selected, col = PIN_COLOR[st];
          return (
            <button key={c.id} data-k={c.id} type="button" onClick={() => (sel ? onOpen(c.id) : onSelect(c.id))} title={sel ? `Open the ${c.name} map` : c.name}
              className="ui-focus group absolute left-0 top-0 flex flex-col items-center opacity-0 will-change-transform" style={{ transition: "opacity 120ms" }}>
              <span className="relative flex size-4 items-center justify-center">
                {here === c.id && <span className="absolute size-6 animate-ping rounded-full bg-[#ffe066]/40" />}
                <span className="size-3 rounded-full border-2" style={{ borderColor: col, background: here === c.id ? "#ffe066" : sel ? col : "#06101b", boxShadow: `0 0 8px ${col}` }} />
              </span>
              {/* the painting names every continent already: the chip shows for the selected one, and on hover */}
              <span className={`mt-0.5 whitespace-nowrap rounded-sm border px-1.5 py-px font-mono text-[10px] uppercase tracking-[0.12em] ${sel ? "bg-[#06101b]/95 text-white" : "hidden bg-[#06101b]/80 text-slate-200 group-hover:block group-focus-visible:block"}`} style={{ borderColor: sel ? col : "transparent" }}>
                {c.name}{sel && <span className="ml-1 text-cyan-300">· open map ›</span>}
              </span>
            </button>
          );
        })}
        {OCEANS.map((o) => (
          <span key={o.id} data-k={`ocean-${o.id}`} className="absolute left-0 top-0 whitespace-nowrap font-serif text-[11px] italic tracking-[0.2em] text-sky-200/80 opacity-0" style={{ textShadow: "0 0 6px #021c3a" }}>{o.name}</span>
        ))}
      </div>
    </div>
  );
}
