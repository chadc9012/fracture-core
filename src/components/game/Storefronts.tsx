import { useEffect, useMemo } from "react";
import { REGIONAL_SHOPS, type RegionalShop, type ShopKind } from "@/game/regional-shops";
import { shopAccessKind } from "@/game/shop-access";
import { STOREFRONT, WINDOW_FRONT, shopWalls } from "@/game/storefronts";
import { walkHeight } from "@/game/terrain";
import { setWalls, clearWalls } from "@/game/walls";
import * as THREE from "three";
import { applyWorldTriplanar, weatheredConcreteTexture } from "@/game/weathered-surface";
import { DistrictLight } from "./DistrictLight";
import { ShopSign, LightBar } from "./DistrictStreet";
import { chippedBlock } from "@/game/organic-geometry";
import { corrugatedSheet, rollerShutter } from "@/game/street-geometry";

/** window-shop facade parts, built once per size (there are only a couple of sizes) */
const wfCache = new Map<string, THREE.BufferGeometry>();
const wfGeo = (key: string, make: () => THREE.BufferGeometry) => { let g = wfCache.get(key); if (!g) { g = make(); wfCache.set(key, g); } return g; };
const WF = {
  wall: (w: number, h: number, d: number) => wfGeo(`w${w}x${h}x${d}`, () => chippedBlock(w, h, d, Math.round(w * 7 + d * 3))),
  pillar: (h: number) => wfGeo(`p${h}`, () => chippedBlock(1.2, h, 0.3, 5)),
  header: (w: number) => wfGeo(`h${w}`, () => chippedBlock(w, 1, 0.3, 8)),
  shutter: (w: number) => wfGeo(`s${w}`, () => rollerShutter(w - 2.4, 0.55)),
  kick: (w: number) => wfGeo(`k${w}`, () => corrugatedSheet(w - 2, 1.05)),
  awning: (w: number) => wfGeo(`a${w}`, () => corrugatedSheet(w - 1.2, 1.8, 0.12, 0.04)),
};

export const KIND_COLOR: Record<ShopKind, string> = {
  weapons: "#ff7a3c", armor: "#66e0ff", supplies: "#8fe08a", mods: "#c86bff", gunsmith: "#ffd27a", vehicles: "#e8f4ff", blackmarket: "#ff3aa0", armorsmith: "#ff8a4a", exotic: "#e8c06a",
};

/** A walk-in shop's street building: solid walls with a real door gap (the glowing door marker from
 * Interiors.tsx stands just in front of it), a lit sign and a soft glow behind the doorway. */
/** weathered rendered-concrete walls (world-space stains, streaks and cracks) shared by every shop shell */
let wallMat: THREE.MeshStandardMaterial | null = null;
const shellMaterial = () => (wallMat ??= applyWorldTriplanar(new THREE.MeshStandardMaterial({ color: "#6b6e72", roughness: 0.88, metalness: 0.08 }), weatheredConcreteTexture(), 3));

function Storefront({ shop, y }: { shop: RegionalShop; y: number }) {
  const { w, d, h, doorW, frontZ, backZ } = STOREFRONT;
  const color = KIND_COLOR[shop.kind];
  const cz = (frontZ + backZ) / 2; // building centre between front and back walls
  return (
    <group position={[shop.x, y, shop.z]}>
      <mesh position={[0, h / 2, backZ]} castShadow receiveShadow material={shellMaterial()} geometry={WF.wall(w, h, 0.3)} />
      <mesh position={[-w / 2, h / 2, cz]} castShadow receiveShadow material={shellMaterial()} geometry={WF.wall(0.3, h, d)} />
      <mesh position={[w / 2, h / 2, cz]} castShadow receiveShadow material={shellMaterial()} geometry={WF.wall(0.3, h, d)} />
      {/* front wall in two pieces + lintel: the gap between them is the door */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (doorW / 2 + (w - doorW) / 4), h / 2, frontZ]} castShadow receiveShadow material={shellMaterial()} geometry={WF.wall((w - doorW) / 2, h, 0.3)} />
      ))}
      <mesh position={[0, 2.6 + (h - 2.6) / 2, frontZ]} castShadow material={shellMaterial()} geometry={WF.wall(doorW, h - 2.6, 0.3)} />
      <mesh position={[0, h + 0.15, cz]} castShadow><boxGeometry args={[w + 0.4, 0.3, d + 0.4]} /><meshStandardMaterial color="#161b22" metalness={0.6} roughness={0.4} /></mesh>
      {/* the doorway glows faintly with the shop's kind colour — you can't see the pocket room, but it reads as open */}
      <mesh position={[0, 1.3, frontZ - 0.1]}><planeGeometry args={[doorW - 0.15, 2.5]} /><meshBasicMaterial color={color} transparent opacity={0.14} side={2} depthWrite={false} /></mesh>
      {/* facade detail: corner pilasters, a cornice band, lit display windows either side of the door, a fabric awning */}
      {[-1, 1].map((sx) => <mesh key={`pl${sx}`} position={[sx * (w / 2 - 0.2), h / 2, frontZ + 0.12]} castShadow material={shellMaterial()}><boxGeometry args={[0.5, h, 0.45]} /></mesh>)}
      <mesh position={[0, h - 0.15, frontZ + 0.2]} castShadow><boxGeometry args={[w + 0.2, 0.3, 0.5]} /><meshStandardMaterial color="#3a3d42" roughness={0.7} metalness={0.3} /></mesh>
      {[-1, 1].map((sx) => (
        <group key={`win${sx}`} position={[sx * (doorW / 2 + (w - doorW) / 4), 1.75, frontZ + 0.16]}>
          <mesh><boxGeometry args={[(w - doorW) / 2 - 1.1, 1.7, 0.06]} /><meshStandardMaterial color="#1a1f25" roughness={0.5} metalness={0.6} /></mesh>
          <mesh position={[0, 0, 0.035]}><planeGeometry args={[(w - doorW) / 2 - 1.3, 1.5]} /><meshStandardMaterial color="#0e1418" roughness={0.08} metalness={0.4} emissive="#ffcf96" emissiveIntensity={0.35} /></mesh>
          <mesh position={[0, 0, 0.04]}><planeGeometry args={[0.04, 1.5]} /><meshStandardMaterial color="#1a1f25" /></mesh>
        </group>
      ))}
      <mesh position={[0, 2.95, frontZ + 0.75]} rotation-x={0.32} castShadow><boxGeometry args={[doorW + 1.4, 0.05, 1.3]} /><meshStandardMaterial color={new THREE.Color(color).lerp(new THREE.Color("#5a5248"), 0.55)} roughness={0.9} /></mesh>
      <LightBar position={[0, 0.06, frontZ + 0.25]} size={[w - 0.6, 0.05, 0.08]} color={color} />
      <ShopSign label={shop.name.toUpperCase()} color={color} position={[0, h - 0.4, frontZ + 0.3]} />
      <DistrictLight range={40} position={[0, 2.8, frontZ + 1.2]} color={color} intensity={4} distance={8} decay={2} />
      <DistrictLight range={40} position={[0, 3.2, cz]} color="#ffd9a8" intensity={5} distance={d + 2} decay={2} />
    </group>
  );
}

/** A window shop: a facade you cannot walk through, with a lit service window and a counter to trade at. */
function WindowFront({ shop, y }: { shop: RegionalShop; y: number }) {
  const { w, h } = WINDOW_FRONT;
  const color = KIND_COLOR[shop.kind];
  return (
    <group position={[shop.x, y, shop.z]}>
      {/* facade: chipped concrete pillars and header around the service window, a half-raised roller shutter, a steel
          counter with a corrugated kick panel and a corrugated tin awning on brackets (street-geometry shopfront kit) */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (w / 2 - 0.6), h / 2, 0]} castShadow receiveShadow material={shellMaterial()} geometry={WF.pillar(h)} />
      ))}
      <mesh position={[0, h - 0.5, 0]} castShadow material={shellMaterial()} geometry={WF.header(w)} />
      <mesh position={[0, h - 1.05, 0.06]} castShadow geometry={WF.shutter(w)}><meshStandardMaterial color="#5d6066" metalness={0.55} roughness={0.6} /></mesh>
      <mesh position={[0, 1.0, 0]}><boxGeometry args={[w - 2.4, 0.5, 0.35]} /><meshStandardMaterial color="#39424f" metalness={0.6} roughness={0.4} /></mesh>
      <mesh position={[0, 2.05, 0]}><planeGeometry args={[w - 2.4, 1.6]} /><meshBasicMaterial color={color} transparent opacity={0.18} side={2} depthWrite={false} /></mesh>
      {/* counter to browse from: steel top with a lip, corrugated front */}
      <mesh position={[0, 1.08, 1.1]} castShadow receiveShadow><boxGeometry args={[w - 1.9, 0.06, 1.0]} /><meshStandardMaterial color="#4a5058" metalness={0.7} roughness={0.38} /></mesh>
      <mesh position={[0, 0.53, 1.58]} rotation-x={Math.PI / 2} castShadow geometry={WF.kick(w)}><meshStandardMaterial color="#2d3744" metalness={0.5} roughness={0.55} side={THREE.DoubleSide} /></mesh>
      <mesh position={[0, 0.53, 0.68]}><boxGeometry args={[w - 2, 1.05, 0.06]} /><meshStandardMaterial color="#232a33" metalness={0.4} roughness={0.7} /></mesh>
      {/* awning: corrugated tin on two angle brackets */}
      <mesh position={[0, 3.0, 0.95]} rotation-x={0.18} castShadow geometry={WF.awning(w)}><meshStandardMaterial color="#6b6a63" metalness={0.5} roughness={0.75} side={THREE.DoubleSide} /></mesh>
      {[-1, 1].map((s) => <mesh key={`br${s}`} position={[s * (w / 2 - 0.9), 2.85, 0.75]} rotation-x={-0.7}><boxGeometry args={[0.05, 0.05, 1.1]} /><meshStandardMaterial color="#2e3238" metalness={0.6} roughness={0.5} /></mesh>)}
      <LightBar position={[0, 2.86, 1.5]} size={[w - 1.6, 0.06, 0.08]} color={color} />
      <ShopSign label={shop.name.toUpperCase()} color={color} position={[0, h + 0.75, 0.2]} />
      <DistrictLight range={40} position={[0, 2.6, 1.4]} color={color} intensity={3.5} distance={7} decay={2} />
    </group>
  );
}

/** Street presence for every regional shop that is not an open-air table: real storefront buildings for
 * walk-in shops and service-window facades for window shops, with matching wall collision. */
export function Storefronts() {
  const shops = useMemo(() => REGIONAL_SHOPS.filter((s) => shopAccessKind(s.id) !== "table").map((s) => ({ shop: s, y: walkHeight(s.x, s.z) })), []);
  useEffect(() => {
    for (const { shop, y } of shops) setWalls(`storefront-${shop.id}`, shopWalls(shop, y));
    return () => { for (const { shop } of shops) clearWalls(`storefront-${shop.id}`); };
  }, [shops]);
  return (
    <group>
      {shops.map(({ shop, y }) => shopAccessKind(shop.id) === "interior"
        ? <Storefront key={shop.id} shop={shop} y={y} />
        : <WindowFront key={shop.id} shop={shop} y={y} />)}
    </group>
  );
}
