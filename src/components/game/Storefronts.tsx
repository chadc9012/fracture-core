import { useEffect, useMemo } from "react";
import { REGIONAL_SHOPS, type RegionalShop, type ShopKind } from "@/game/regional-shops";
import { shopAccessKind } from "@/game/shop-access";
import { STOREFRONT, WINDOW_FRONT, shopWalls } from "@/game/storefronts";
import { walkHeight } from "@/game/terrain";
import { setWalls, clearWalls } from "@/game/walls";
import { DistrictLight } from "./DistrictLight";
import { ShopSign, LightBar } from "./DistrictStreet";

export const KIND_COLOR: Record<ShopKind, string> = {
  weapons: "#ff7a3c", armor: "#66e0ff", supplies: "#8fe08a", mods: "#c86bff", gunsmith: "#ffd27a", vehicles: "#e8f4ff", blackmarket: "#ff3aa0",
};

/** A walk-in shop's street building: solid walls with a real door gap (the glowing door marker from
 * Interiors.tsx stands just in front of it), a lit sign and a soft glow behind the doorway. */
function Storefront({ shop, y }: { shop: RegionalShop; y: number }) {
  const { w, d, h, doorW, frontZ, backZ } = STOREFRONT;
  const color = KIND_COLOR[shop.kind];
  const cz = (frontZ + backZ) / 2; // building centre between front and back walls
  const wall = { color: "#242b34", roughness: 0.6, metalness: 0.45 } as const;
  return (
    <group position={[shop.x, y, shop.z]}>
      <mesh position={[0, h / 2, backZ]} castShadow receiveShadow><boxGeometry args={[w, h, 0.3]} /><meshStandardMaterial {...wall} /></mesh>
      <mesh position={[-w / 2, h / 2, cz]} castShadow receiveShadow><boxGeometry args={[0.3, h, d]} /><meshStandardMaterial {...wall} /></mesh>
      <mesh position={[w / 2, h / 2, cz]} castShadow receiveShadow><boxGeometry args={[0.3, h, d]} /><meshStandardMaterial {...wall} /></mesh>
      {/* front wall in two pieces + lintel: the gap between them is the door */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (doorW / 2 + (w - doorW) / 4), h / 2, frontZ]} castShadow receiveShadow>
          <boxGeometry args={[(w - doorW) / 2, h, 0.3]} /><meshStandardMaterial {...wall} />
        </mesh>
      ))}
      <mesh position={[0, 2.6 + (h - 2.6) / 2, frontZ]} castShadow><boxGeometry args={[doorW, h - 2.6, 0.3]} /><meshStandardMaterial {...wall} /></mesh>
      <mesh position={[0, h + 0.15, cz]} castShadow><boxGeometry args={[w + 0.4, 0.3, d + 0.4]} /><meshStandardMaterial color="#161b22" metalness={0.6} roughness={0.4} /></mesh>
      {/* the doorway glows faintly with the shop's kind colour — you can't see the pocket room, but it reads as open */}
      <mesh position={[0, 1.3, frontZ - 0.1]}><planeGeometry args={[doorW - 0.15, 2.5]} /><meshBasicMaterial color={color} transparent opacity={0.14} side={2} depthWrite={false} /></mesh>
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
      {/* facade: two pillars, a header and a sill leave the service window open */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (w / 2 - 0.6), h / 2, 0]} castShadow receiveShadow><boxGeometry args={[1.2, h, 0.3]} /><meshStandardMaterial color="#242b34" metalness={0.45} roughness={0.6} /></mesh>
      ))}
      <mesh position={[0, h - 0.5, 0]} castShadow><boxGeometry args={[w, 1, 0.3]} /><meshStandardMaterial color="#242b34" metalness={0.45} roughness={0.6} /></mesh>
      <mesh position={[0, 1.0, 0]}><boxGeometry args={[w - 2.4, 0.5, 0.35]} /><meshStandardMaterial color="#39424f" metalness={0.6} roughness={0.4} /></mesh>
      <mesh position={[0, 2.05, 0]}><planeGeometry args={[w - 2.4, 1.6]} /><meshBasicMaterial color={color} transparent opacity={0.18} side={2} depthWrite={false} /></mesh>
      {/* counter to browse from, awning over it */}
      <mesh position={[0, 0.55, 1.1]} castShadow receiveShadow><boxGeometry args={[w - 2, 1.1, 0.9]} /><meshStandardMaterial color="#2d3744" metalness={0.5} roughness={0.5} /></mesh>
      <mesh position={[0, 3.0, 0.9]} rotation-x={0.18}><boxGeometry args={[w - 1.2, 0.08, 1.8]} /><meshStandardMaterial color="#39424f" roughness={0.8} /></mesh>
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
