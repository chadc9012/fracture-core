import { Environment, Lightformer } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Component, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import type * as THREE from "three";
import { regionAt } from "@/game/world";
import { isSafari } from "@/game/webgl-support";
import forest from "@/assets/hdri/forest_slope.hdr.asset.json";
import puresky from "@/assets/hdri/kloofendal_48d_partly_cloudy_puresky.hdr.asset.json";
import city from "@/assets/hdri/potsdamer_platz.hdr.asset.json";
import dusk from "@/assets/hdri/qwantani_dusk_2.hdr.asset.json";
import plains from "@/assets/hdri/rosendal_plains_2.hdr.asset.json";

/** Poly Haven (CC0) image-based lighting per region, matching the gallery's natural sky-light look. */
const REGION_HDRI: Record<string, string> = {
  nexus: city.url, veridan: forest.url, frostspire: puresky.url, ember: dusk.url,
  wastelands: plains.url, solara: puresky.url, swamps: forest.url,
};

const Fallback = () => (
  <Environment>
    <Lightformer intensity={1.3} position={[0, 60, 0]} scale={[80, 80, 1]} />
    <Lightformer intensity={0.6} color="#7fb6d9" position={[-80, 20, -30]} rotation-y={Math.PI / 2} scale={[90, 10, 1]} />
  </Environment>
);

class Guard extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  override render() { return this.state.failed ? <Fallback /> : this.props.children; }
}

const verified = new Map<string, boolean>();

export function RegionLighting({ playerRef, tier }: { playerRef: React.RefObject<THREE.Object3D>; tier: string }) {
  const [region, setRegion] = useState("veridan");
  const [url, setUrl] = useState<string | null>(null);
  const tick = useRef(0);
  const simple = tier === "LOW" || (typeof navigator !== "undefined" && isSafari());
  useFrame((_, dt) => {
    tick.current += dt;
    if (tick.current < 1 || !playerRef.current) return;
    tick.current = 0;
    const id = regionAt(playerRef.current.position.x, playerRef.current.position.z)?.id;
    if (id && id !== region) setRegion(id);
  });
  useEffect(() => {
    if (simple) return;
    const next = REGION_HDRI[region];
    if (!next) return;
    if (verified.get(next)) { setUrl(next); return; }
    let live = true;
    // verify the file resolves before mounting it, so a dead link can never suspend the scene
    fetch(next, { method: "HEAD" }).then((r) => { verified.set(next, r.ok); if (live && r.ok) setUrl(next); }).catch(() => verified.set(next, false));
    return () => { live = false; };
  }, [region, simple]);
  if (simple || !url) return <Fallback />;
  return <Guard key={url}><Suspense fallback={<Fallback />}><Environment files={url} environmentIntensity={0.85} /></Suspense></Guard>;
}
