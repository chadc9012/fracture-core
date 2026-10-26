import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Gauge, Paintbrush, Sofa, Wrench, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

import { Button } from "@/components/ui/button";
import { lathe, merge, rbox } from "@/game/cabin-geometry";
import { corrugatedSheet } from "@/game/street-geometry";
import { formatNex } from "@/game/nex";
import { nexBalance } from "@/game/nex";
import { phantomExterior } from "@/game/phantom-geometry";
import {
  JET_LIGHTS, PARKED_READOUT, PHANTOM_EXTERIOR_LIGHTS, PHANTOM_JET, PHANTOM_NEX_PRICE, PHANTOM_PAINTS, PHANTOM_SYSTEMS, PHANTOM_WINGS, airworthy, buyPhantom,
  clampJetPosition, customizePhantom, hangarLabel, inspectPhantom, ownsPhantom, phantomCondition, phantomOf, serviceCost, servicePhantom, systemHealth, updateExterior,
  valetCost, valetPhantom, type JetLighting, type PhantomExterior, type PhantomExteriorLight, type PhantomPaint, type PhantomWing,
} from "@/game/phantom-jet";
import type { PlayerProgression } from "@/game/progression";
import { CabinWalker, PhantomCabin, newCabinInput, phantomRoomLabel, type CabinInput } from "./CabinScenes";

/* ---------------- the aircraft ---------------- */

/** the Phantom in its chosen paint, wing and exterior light (phantom-geometry.ts) */
export function PhantomModel({ exterior }: { exterior: PhantomExterior }) {
  const geo = useMemo(() => phantomExterior(exterior.wing), [exterior.wing]);
  useEffect(() => () => { for (const g of Object.values(geo)) if (g instanceof THREE.BufferGeometry) g.dispose(); }, [geo]);
  const p = PHANTOM_PAINTS[exterior.paint], lightColor = PHANTOM_EXTERIOR_LIGHTS[exterior.light].color;
  const mats = useMemo(() => ({
    paint: new THREE.MeshPhysicalMaterial({ color: p.color, metalness: p.metalness, roughness: p.roughness, clearcoat: 1, clearcoatRoughness: 0.08 }),
    trim: new THREE.MeshStandardMaterial({ color: "#1b1d21", roughness: 0.7, metalness: 0.2 }),
    glass: new THREE.MeshPhysicalMaterial({ color: "#0b1016", roughness: 0.04, metalness: 0.6, clearcoat: 1 }),
    windows: new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffd9a8").multiplyScalar(0.9), toneMapped: false }),
    metal: new THREE.MeshStandardMaterial({ color: "#b9bec4", roughness: 0.25, metalness: 0.95 }),
    tyres: new THREE.MeshStandardMaterial({ color: "#161616", roughness: 0.92 }),
    strip: new THREE.MeshBasicMaterial({ color: new THREE.Color(lightColor).multiplyScalar(2), toneMapped: false }),
    exhaust: new THREE.MeshStandardMaterial({ color: "#151515", roughness: 0.5, metalness: 0.7, emissive: new THREE.Color(lightColor), emissiveIntensity: 0.25 }),
    red: new THREE.MeshBasicMaterial({ color: new THREE.Color("#ff3b30").multiplyScalar(2), toneMapped: false }),
    green: new THREE.MeshBasicMaterial({ color: new THREE.Color("#34e27a").multiplyScalar(2), toneMapped: false }),
    white: new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffffff").multiplyScalar(2), toneMapped: false }),
  }), [p, lightColor]);
  useEffect(() => () => { for (const m of Object.values(mats)) m.dispose(); }, [mats]);
  const bulb = useMemo(() => new THREE.SphereGeometry(0.09, 12, 8), []);
  const strobe = useRef<THREE.Mesh>(null);
  useFrame((st) => { if (strobe.current) strobe.current.visible = st.clock.elapsedTime % 1.4 < 0.08; });
  return (
    <group>
      <mesh geometry={geo.paint} material={mats.paint} />
      <mesh geometry={geo.trim} material={mats.trim} />
      <mesh geometry={geo.glass} material={mats.glass} />
      <mesh geometry={geo.windows} material={mats.windows} />
      <mesh geometry={geo.metal} material={mats.metal} />
      <mesh geometry={geo.tyres} material={mats.tyres} />
      <mesh geometry={geo.strip} material={mats.strip} />
      <mesh geometry={geo.exhaust} material={mats.exhaust} />
      <mesh geometry={bulb} material={mats.red} position={geo.navLeft} />
      <mesh geometry={bulb} material={mats.green} position={geo.navRight} />
      <mesh ref={strobe} geometry={bulb} material={mats.white} position={geo.tail} />
      <pointLight color={lightColor} intensity={6} distance={9} position={[0, 0.6, 0]} />
    </group>
  );
}

/** the private hangar: epoxy floor with bay markings, corrugated walls, roof trusses and high-bay lamps */
function HangarBay() {
  const geo = useMemo(() => {
    const lines: THREE.BufferGeometry[] = [];
    for (const s of [-1, 1]) lines.push(rbox(0.18, 0.01, 52, 0.004).translate(s * 16, 0.005, 0));
    lines.push(rbox(32, 0.01, 0.18, 0.004).translate(0, 0.005, -26), rbox(0.18, 0.01, 34, 0.004).translate(0, 0.005, -6));
    const truss: THREE.BufferGeometry[] = [];
    for (let i = -4; i <= 4; i++) { truss.push(rbox(70, 0.5, 0.35, 0.05).translate(0, 17, i * 8)); truss.push(rbox(0.25, 0.25, 70, 0.04).translate(i * 8, 16.6, 0)); }
    const shades: THREE.BufferGeometry[] = [];
    for (let i = -2; i <= 2; i++) for (const x of [-9, 0, 9]) shades.push(lathe([[0.05, 0], [0.55, -0.5], [0.6, -0.55], [0.05, -0.1]], 24).translate(x, 15.8, i * 9));
    const chest: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 4; i++) { chest.push(rbox(1.6, 1.1, 0.7, 0.04).translate(-24 + i * 2, 0.55, -33)); for (let d = 0; d < 5; d++) chest.push(rbox(1.5, 0.02, 0.02, 0.005).translate(-24 + i * 2, 0.2 + d * 0.2, -32.64)); }
    return {
      floor: new THREE.PlaneGeometry(76, 76).rotateX(-Math.PI / 2), lines: merge(lines), truss: merge(truss), shades: merge(shades), chest: merge(chest),
      back: corrugatedSheet(72, 18).rotateX(Math.PI / 2).translate(0, 9, -35), side: corrugatedSheet(72, 18).rotateX(Math.PI / 2).rotateY(Math.PI / 2).translate(-35, 9, 0),
      sideR: corrugatedSheet(72, 18).rotateX(Math.PI / 2).rotateY(-Math.PI / 2).translate(35, 9, 0), lamp: new THREE.CircleGeometry(0.5, 24).rotateX(Math.PI / 2),
    };
  }, []);
  useEffect(() => () => { for (const g of Object.values(geo)) g.dispose(); }, [geo]);
  const mats = useMemo(() => ({
    floor: new THREE.MeshStandardMaterial({ color: "#5d6166", roughness: 0.35, metalness: 0.1 }),
    lines: new THREE.MeshStandardMaterial({ color: "#c9a23a", roughness: 0.6 }),
    wall: new THREE.MeshStandardMaterial({ color: "#7d848a", roughness: 0.6, metalness: 0.5, side: THREE.DoubleSide }),
    truss: new THREE.MeshStandardMaterial({ color: "#3a3f45", roughness: 0.6, metalness: 0.5 }),
    chest: new THREE.MeshStandardMaterial({ color: "#8a1f1f", roughness: 0.45, metalness: 0.4 }),
    lamp: new THREE.MeshBasicMaterial({ color: new THREE.Color("#fff4e0").multiplyScalar(2.2), toneMapped: false }),
  }), []);
  useEffect(() => () => { for (const m of Object.values(mats)) m.dispose(); }, [mats]);
  const lamps = useMemo(() => { const out: [number, number, number][] = []; for (let i = -2; i <= 2; i++) for (const x of [-9, 0, 9]) out.push([x, 15.25, i * 9]); return out; }, []);
  return (
    <group>
      <mesh geometry={geo.floor} material={mats.floor} />
      <mesh geometry={geo.lines} material={mats.lines} />
      <mesh geometry={geo.back} material={mats.wall} /><mesh geometry={geo.side} material={mats.wall} /><mesh geometry={geo.sideR} material={mats.wall} />
      <mesh geometry={geo.truss} material={mats.truss} /><mesh geometry={geo.shades} material={mats.truss} /><mesh geometry={geo.chest} material={mats.chest} />
      {lamps.map((p, i) => <mesh key={i} geometry={geo.lamp} material={mats.lamp} position={p} />)}
    </group>
  );
}
function HangarEnvironment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pm = new THREE.PMREMGenerator(gl), env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env; scene.environmentIntensity = 0.45;
    return () => { scene.environment = null; env.dispose(); pm.dispose(); };
  }, [gl, scene]);
  return null;
}
/** a slow orbit round the jet that the player can drag */
function OrbitCam({ drag }: { drag: React.MutableRefObject<{ yaw: number; pitch: number; dist: number }> }) {
  const camera = useThree((s) => s.camera);
  useFrame((_, dt) => {
    const d = drag.current;
    d.yaw += dt * 0.08;
    const r = d.dist, y = 3 + Math.sin(d.pitch) * r * 0.6;
    camera.position.set(Math.sin(d.yaw) * r, y, Math.cos(d.yaw) * r);
    camera.lookAt(0, 2.6, 0);
  });
  return null;
}

/* ---------------- the hangar panel ---------------- */

type Tab = "exterior" | "cabin" | "service" | "cockpit";
/**
 * The private hangar at Nexus or Neon (opened from the departures board's Private aviation section). Exterior (paint, wing,
 * exterior lights) and Cabin (walk-through, mood lighting) save to progression when the jet is yours and parked here; before
 * buying they are a showroom preview. Service is the maintenance bay (Nex per system, the vehicle-repair rate); Cockpit is the
 * parked flight-deck readout.
 */
export function PhantomHangar({ terminalId, progression, onProgression, onClose }: { terminalId: string; progression: PlayerProgression; onProgression: (p: PlayerProgression) => void; onClose: () => void }) {
  const owned = ownsPhantom(progression), jet = phantomOf(progression), here = owned && jet.parkedAt === terminalId;
  const [tab, setTab] = useState<Tab>("exterior");
  const [preview, setPreview] = useState<PhantomExterior>(jet.exterior);
  const [previewLight, setPreviewLight] = useState<JetLighting>(jet.cabin);
  const [msg, setMsg] = useState("");
  const look = here ? jet.exterior : preview, cabinLight = here ? jet.cabin : previewLight;
  const run = (r: { progression: PlayerProgression; message: string } | { error: string }) => { if ("error" in r) setMsg(r.error); else { onProgression(r.progression); setMsg(r.message); } };
  const setLook = (change: Partial<PhantomExterior>) => (here ? run(customizePhantom(progression, terminalId, { exterior: change })) : setPreview((p) => updateExterior(p, change)));
  const setCabin = (l: JetLighting) => (here ? run(customizePhantom(progression, terminalId, { cabin: l })) : setPreviewLight(l));
  const cond = phantomCondition(progression), balance = nexBalance(progression.nexLedger);
  const orbit = useRef({ yaw: 0.9, pitch: 0.35, dist: 27 });
  const drag = useRef<{ x: number; y: number } | null>(null);
  const input = useRef<CabinInput>(newCabinInput());
  const [tourZ, setTourZ] = useState(PHANTOM_JET.zones[0]!.centerZ + 1.5);
  const [room, setRoom] = useState(phantomRoomLabel(tourZ));
  useEffect(() => { // the cabin tour walks with WASD: keep those keys from the world while it is open
    if (tab !== "cabin") return;
    const inp = input.current, keys = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "ShiftLeft"]);
    const down = (e: KeyboardEvent) => { if (!keys.has(e.code)) return; e.preventDefault(); e.stopImmediatePropagation(); inp.keys.add(e.code); };
    const up = (e: KeyboardEvent) => inp.keys.delete(e.code);
    window.addEventListener("keydown", down, true); window.addEventListener("keyup", up, true);
    return () => { window.removeEventListener("keydown", down, true); window.removeEventListener("keyup", up, true); inp.keys.clear(); };
  }, [tab]);
  const pointer = {
    onPointerDown: (e: React.PointerEvent) => { drag.current = { x: e.clientX, y: e.clientY }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); },
    onPointerMove: (e: React.PointerEvent) => {
      if (!drag.current) return;
      const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y;
      if (tab === "cabin") { input.current.yaw += dx * 0.005; input.current.pitch = Math.max(-1.1, Math.min(0.9, input.current.pitch - dy * 0.004)); }
      else { orbit.current.yaw -= dx * 0.006; orbit.current.pitch = Math.max(0.05, Math.min(1.1, orbit.current.pitch + dy * 0.004)); }
      drag.current = { x: e.clientX, y: e.clientY };
    },
    onPointerUp: () => { drag.current = null; },
    onWheel: (e: React.WheelEvent) => { if (tab !== "cabin") orbit.current.dist = Math.max(16, Math.min(31, orbit.current.dist + e.deltaY * 0.02)); },
  };
  const opt = (active: boolean) => `border px-2 py-1 text-[11px] uppercase tracking-wider ${active ? "border-primary text-primary" : "border-border text-muted-foreground hover:text-foreground"}`;
  const TABS: { id: Tab; label: string; Icon: typeof Paintbrush }[] = [{ id: "exterior", label: "Exterior", Icon: Paintbrush }, { id: "cabin", label: "Cabin", Icon: Sofa }, { id: "service", label: "Service", Icon: Wrench }, { id: "cockpit", label: "Cockpit", Icon: Gauge }];
  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-background/70 p-3 backdrop-blur-sm" role="dialog" aria-label="Phantom private hangar">
      <div className="flex max-h-full w-full max-w-4xl flex-col border border-border bg-background/95 shadow-2xl">
        <div className="flex items-start justify-between gap-3 p-4 pb-2">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-primary">Private aviation · {hangarLabel(terminalId) ?? "Hangar"}</p>
            <h3 className="mt-1 text-lg font-semibold uppercase tracking-wider">Phantom Stealth Jet</h3>
            <p className="mt-1 text-[11px] text-muted-foreground">{here ? `Yours · ${jet.flights} trips flown · ${airworthy(cond) ? "airworthy" : "grounded"}` : owned ? "Yours, parked elsewhere: recall it from the departures board to customise or service it here." : `Showroom preview · ${formatNex(PHANTOM_NEX_PRICE)} (you have ${formatNex(balance)})`}</p>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close"><X /></Button>
        </div>
        <div className="flex gap-1 px-4" role="tablist">
          {TABS.map(({ id, label, Icon }) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={opt(tab === id)}><Icon className="mr-1 inline size-3" />{label}</button>)}
        </div>
        {(tab === "exterior" || tab === "cabin") && (
          <div className="relative mx-4 mt-3 aspect-[16/9] max-h-[52vh] cursor-grab touch-none overflow-hidden border border-border bg-black active:cursor-grabbing" {...pointer}>
            {tab === "exterior" ? (
              <Canvas dpr={[1, 1.5]} gl={{ antialias: true }} camera={{ fov: 40, near: 0.5, far: 200 }}>
                <color attach="background" args={["#0d0f12"]} />
                <HangarEnvironment />
                <hemisphereLight args={["#e8eef5", "#2a2d31", 0.6]} />
                <directionalLight position={[8, 14, 6]} intensity={1.6} />
                <pointLight position={[0, 12, 10]} intensity={60} distance={40} color="#fff4e0" />
                <HangarBay />
                <group position={[0, 0, 2]}><PhantomModel exterior={look} /></group>
                <OrbitCam drag={orbit} />
              </Canvas>
            ) : (
              <Canvas dpr={[1, 1.5]} gl={{ antialias: true }} camera={{ fov: 72, near: 0.04, far: 60 }}>
                <PhantomCabin lighting={cabinLight} sky="apron" moving={false} clutter={here ? Math.max(0, (60 - jet.cleanliness) / 60) : 0} />
                <CabinWalker input={input} start={{ x: 0, z: tourZ }} clamp={(p) => clampJetPosition(p.x, p.z)} seated={null} onMove={(p) => { const r = phantomRoomLabel(p.z); setRoom((c) => (c === r ? c : r)); }} />
              </Canvas>
            )}
            <p className="pointer-events-none absolute bottom-2 left-2 bg-black/70 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-white/80">{tab === "cabin" ? `${room} · WASD walk · drag to look` : "Drag to orbit · wheel to zoom"}</p>
          </div>
        )}
        <div className="overflow-y-auto p-4 pt-3 text-sm">
          {tab === "exterior" && (
            <div className="space-y-2">
              <Row label="Paint">{(Object.keys(PHANTOM_PAINTS) as PhantomPaint[]).map((k) => <button key={k} type="button" className={opt(look.paint === k)} onClick={() => setLook({ paint: k })}><span className="mr-1 inline-block size-2.5 align-middle" style={{ background: PHANTOM_PAINTS[k].color }} />{PHANTOM_PAINTS[k].label}</button>)}</Row>
              <Row label="Wing">{(Object.keys(PHANTOM_WINGS) as PhantomWing[]).map((k) => <button key={k} type="button" className={opt(look.wing === k)} onClick={() => setLook({ wing: k })}>{PHANTOM_WINGS[k].label}</button>)}</Row>
              <Row label="Exterior light">{(Object.keys(PHANTOM_EXTERIOR_LIGHTS) as PhantomExteriorLight[]).map((k) => <button key={k} type="button" className={opt(look.light === k)} onClick={() => setLook({ light: k })}>{PHANTOM_EXTERIOR_LIGHTS[k].label}</button>)}</Row>
            </div>
          )}
          {tab === "cabin" && (
            <div className="space-y-2">
              <Row label="Mood lighting">{(Object.keys(JET_LIGHTS) as JetLighting[]).map((k) => <button key={k} type="button" className={opt(cabinLight === k)} onClick={() => setCabin(k)}>{JET_LIGHTS[k].label}</button>)}</Row>
              <Row label="Go to">{PHANTOM_JET.zones.map((z) => <button key={z.id} type="button" className={opt(room === z.label)} onClick={() => { setTourZ(z.centerZ + (tourZ === z.centerZ ? 0.01 : 0)); setRoom(z.label); }}>{z.label}</button>)}</Row>
            </div>
          )}
          {tab === "service" && (
            here ? (
              <div className="space-y-2">
                {PHANTOM_SYSTEMS.map((s) => {
                  const h = systemHealth(cond, s.id), cost = serviceCost(cond, s.id);
                  return (
                    <div key={s.id} className="flex items-center gap-3">
                      <span className="w-32 text-xs uppercase tracking-wider text-muted-foreground">{s.label}</span>
                      <div className="h-1.5 flex-1 bg-muted"><div className={`h-full ${h < 75 ? "bg-amber-500" : "bg-primary"}`} style={{ width: `${h}%` }} /></div>
                      <span className="w-10 text-right font-mono text-xs">{h}%</span>
                      <Button size="sm" variant="outline" disabled={cost <= 0 || balance < cost} onClick={() => run(servicePhantom(progression, terminalId, s.id, Date.now()))}>{cost > 0 ? `Service · ${formatNex(cost)}` : "OK"}</Button>
                    </div>
                  );
                })}
                <div className="flex items-center gap-3">
                  <span className="w-32 text-xs uppercase tracking-wider text-muted-foreground">Cabin</span>
                  <div className="h-1.5 flex-1 bg-muted"><div className="h-full bg-primary" style={{ width: `${jet.cleanliness}%` }} /></div>
                  <span className="w-10 text-right font-mono text-xs">{Math.round(jet.cleanliness)}%</span>
                  <Button size="sm" variant="outline" disabled={valetCost(jet) <= 0 || balance < valetCost(jet)} onClick={() => run(valetPhantom(progression, terminalId, Date.now()))}>{valetCost(jet) > 0 ? `Valet · ${formatNex(valetCost(jet))}` : "Spotless"}</Button>
                </div>
                <p className="text-[11px] text-muted-foreground">{inspectPhantom(cond).length ? `Needs attention: ${inspectPhantom(cond).map((s) => PHANTOM_SYSTEMS.find((x) => x.id === s)!.label.toLowerCase()).join(", ")}.` : "All systems nominal."} Every trip wears the engines and gear; a worn-out jet is grounded until serviced.</p>
              </div>
            ) : <p className="text-[12px] text-muted-foreground">The maintenance bay services your own Phantom when it is parked in this hangar.</p>
          )}
          {tab === "cockpit" && (
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-xs sm:grid-cols-3">
              <p>Status <span className="float-right">{here ? (airworthy(cond) ? "Ready" : "Grounded") : owned ? "Away" : "Showroom"}</span></p>
              <p>Speed <span className="float-right">{PARKED_READOUT.speedKph} km/h</span></p>
              <p>Altitude <span className="float-right">{PARKED_READOUT.altitudeM} m</span></p>
              <p>Autopilot <span className="float-right">{PARKED_READOUT.autopilot ? "ON" : "OFF"}</span></p>
              <p>Engines <span className="float-right">{systemHealth(cond, "engines")}%</span></p>
              <p>Trips <span className="float-right">{jet.flights}</span></p>
              <p className="col-span-full mt-2 font-sans text-[11px] text-muted-foreground">Parked instruments. The live readout runs on the flight deck display during a trip; there are no manual flight controls.</p>
            </div>
          )}
          {!owned && (
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
              <p className="text-[11px] text-muted-foreground">Sofa-seated executive cabin with office, bar, cinema, gaming lounge and bedroom. Bought once; flies you to any airport.</p>
              <Button size="sm" disabled={balance < PHANTOM_NEX_PRICE} onClick={() => run(buyPhantom(progression, terminalId))}>Buy · {formatNex(PHANTOM_NEX_PRICE)}</Button>
            </div>
          )}
          {msg && <p role="status" className="mt-2 text-[11px] text-primary">{msg}</p>}
        </div>
      </div>
    </div>
  );
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-1.5"><span className="w-28 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</span>{children}</div>;
}
