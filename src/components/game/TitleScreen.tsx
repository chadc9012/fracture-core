import { Stars } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Crosshair, LogOut, Settings, SlidersHorizontal } from "lucide-react";
import { useRef, useState } from "react";
import * as THREE from "three";

import { Button } from "@/components/ui/button";

function FractureField() {
  const root = useRef<THREE.Group>(null);

  useFrame(({ clock, camera }, delta) => {
    const time = clock.elapsedTime;
    camera.position.x = Math.sin(time * 0.12) * 1.4;
    camera.position.y = Math.cos(time * 0.09) * 0.5;
    camera.lookAt(0, 0, 0);
    if (root.current) {
      root.current.rotation.y += delta * 0.025;
      root.current.rotation.z = Math.sin(time * 0.1) * 0.04;
    }
  });

  return (
    <>
      <color attach="background" args={["#05080d"]} />
      <fog attach="fog" args={["#09111b", 8, 38]} />
      <ambientLight intensity={0.18} />
      <directionalLight position={[-6, 9, 5]} color="#91dfff" intensity={2.2} />
      <pointLight position={[7, 1, 2]} color="#ff9d57" intensity={35} distance={24} />
      <Stars radius={55} depth={22} count={1600} factor={3} fade speed={0.25} />
      <group ref={root} position={[4.8, -0.6, -3]}>
        <mesh rotation={[0.1, 0.4, -0.2]} castShadow>
          <icosahedronGeometry args={[4.6, 2]} />
          <meshStandardMaterial color="#182632" roughness={0.82} metalness={0.25} flatShading />
        </mesh>
        {[0, 1, 2, 3].map((index) => (
          <mesh key={index} position={[Math.sin(index * 1.7) * 5.8, Math.cos(index * 1.2) * 3.8, index - 2]} rotation={[index, index * 0.5, index * 0.2]}>
            <tetrahedronGeometry args={[0.65 + index * 0.15]} />
            <meshStandardMaterial color={index % 2 ? "#65dfff" : "#d6804c"} emissive={index % 2 ? "#2f9db8" : "#8b4327"} emissiveIntensity={1.1} roughness={0.5} />
          </mesh>
        ))}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[5.3, 0.045, 8, 96]} />
          <meshBasicMaterial color="#66d9f2" transparent opacity={0.48} />
        </mesh>
      </group>
    </>
  );
}

export function TitleScreen({
  canContinue,
  onContinue,
  onNewGame,
  onLoadout,
  onSettings,
}: {
  canContinue: boolean;
  onContinue: () => void;
  onNewGame: () => void;
  onLoadout: () => void;
  onSettings: () => void;
}) {
  const [notice, setNotice] = useState("");

  return (
    <div className="fixed inset-0 overflow-hidden bg-background">
      <div className="absolute inset-0">
        <Canvas dpr={[1, 1.4]} camera={{ position: [0, 0, 15], fov: 48 }}>
          <FractureField />
        </Canvas>
      </div>
      <div className="pointer-events-none absolute inset-0 title-vignette" />
      <main className="pointer-events-none relative z-10 flex h-full flex-col justify-between overflow-y-auto px-6 py-7 sm:px-12 sm:py-10">
        <header>
          <p className="font-mono text-[9px] uppercase tracking-[0.42em] text-primary">Signal recovered · Nexus orbit</p>
          <div className="mt-4 h-px w-24 bg-primary/70" />
        </header>

        <section className="max-w-2xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.5em] text-muted-foreground">The first collapse</p>
          <h1 className="title-glow mt-3 font-mono text-5xl font-bold tracking-[0.12em] text-foreground sm:text-7xl lg:text-8xl">WORLD<br />FRACTURE</h1>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-muted-foreground">Reality is unstable. Territory remembers every battle. Enter as a Resonant and choose who controls what remains.</p>

          <div className="pointer-events-auto mt-8 flex w-full max-w-sm flex-col items-stretch gap-1" aria-label="Main menu">
            <Button className="h-11 justify-start rounded-none border-l-2 pl-4 font-mono uppercase tracking-[0.2em]" onClick={onNewGame}><Crosshair /> New Game</Button>
            <Button variant="ghost" disabled={!canContinue} className="h-10 justify-start rounded-none pl-4 font-mono uppercase tracking-[0.2em]" onClick={onContinue}>Continue</Button>
            <Button variant="ghost" className="h-10 justify-start rounded-none pl-4 font-mono uppercase tracking-[0.2em]" onClick={onLoadout}><SlidersHorizontal /> Loadout / Customize</Button>
            <Button variant="ghost" className="h-10 justify-start rounded-none pl-4 font-mono uppercase tracking-[0.2em]" onClick={onSettings}><Settings /> Settings</Button>
            <Button variant="ghost" className="h-10 justify-start rounded-none pl-4 font-mono uppercase tracking-[0.2em]" onClick={() => setNotice("Exit is available in the installed game build.")}><LogOut /> Exit</Button>
          </div>
          {notice && <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">{notice}</p>}
        </section>

        <footer className="flex flex-wrap items-end justify-between gap-4 font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
          <span>Build WF-01 · Online world simulation</span>
          <span>Core signal: unstable</span>
        </footer>
      </main>
    </div>
  );
}