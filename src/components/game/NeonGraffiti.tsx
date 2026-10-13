import { useMemo } from "react";
import * as THREE from "three";
import { Text } from "@react-three/drei";
import { walkHeight } from "@/game/terrain";
import { SKATE_SHOP_OFFSET } from "@/game/skate-boots";

/** Jet Set Radio feel for Neon City: bold graffiti tags on walls, painted grind rails and the Kickz skate shop. Presentation only. */
const TAGS = ["FRACTURE", "RUDIES", "GG", "KICKZ", "NOVA", "SKATE OR DIE", "NEON", "BOOST!"];
const COLS = ["#ff4fa3", "#3ee6ff", "#b6ff3e", "#ffb23e", "#ffffff"];

function tagTexture(word: string, i: number) {
  const c = document.createElement("canvas"); c.width = 512; c.height = 256;
  const g = c.getContext("2d")!;
  const a = COLS[i % COLS.length]!, b = COLS[(i + 2) % COLS.length]!;
  g.fillStyle = "rgba(0,0,0,0)"; g.fillRect(0, 0, 512, 256);
  for (let k = 0; k < 14; k++) { g.fillStyle = COLS[(i + k) % COLS.length]! + "55"; g.beginPath(); g.arc(Math.random() * 512, Math.random() * 256, 10 + Math.random() * 30, 0, 7); g.fill(); }
  g.save(); g.translate(256, 128); g.rotate(-0.12);
  g.font = `italic 900 ${word.length > 7 ? 64 : 96}px Impact, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
  g.lineJoin = "round"; g.lineWidth = 22; g.strokeStyle = "#111"; g.strokeText(word, 0, 0);
  g.lineWidth = 10; g.strokeStyle = b; g.strokeText(word, 0, 0);
  const grad = g.createLinearGradient(0, -50, 0, 50); grad.addColorStop(0, "#fff"); grad.addColorStop(1, a);
  g.fillStyle = grad; g.fillText(word, 0, 0); g.restore();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function NeonGraffiti({ c }: { c: { x: number; z: number } }) {
  const tags = useMemo(() => TAGS.map((w, i) => {
    const ang = (i / TAGS.length) * Math.PI * 2, r = 22 + (i % 3) * 6;
    const x = c.x + Math.cos(ang) * r, z = c.z + Math.sin(ang) * r;
    return { x, z, y: walkHeight(x, z) + 2.2, rot: -ang + Math.PI / 2, tex: tagTexture(w, i) };
  }), [c.x, c.z]);
  const shop = { x: c.x + SKATE_SHOP_OFFSET.x, z: c.z + SKATE_SHOP_OFFSET.z };
  const sy = walkHeight(shop.x, shop.z);
  const rails = useMemo(() => [0, 1, 2].map((k) => {
    const x = c.x - 20 + k * 20, z = c.z - 6 + k * 5;
    return { x, z, y: walkHeight(x, z) + 0.9, col: COLS[k]! };
  }), [c.x, c.z]);
  return (
    <group>
      {tags.map((t, i) => (
        <mesh key={i} position={[t.x, t.y, t.z]} rotation-y={t.rot}>
          <planeGeometry args={[7, 3.5]} />
          <meshBasicMaterial map={t.tex} transparent side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
      ))}
      {rails.map((r, i) => (
        <group key={i} position={[r.x, r.y, r.z]} rotation-y={i * 0.4}>
          <mesh rotation-z={Math.PI / 2}><cylinderGeometry args={[0.08, 0.08, 10, 8]} /><meshStandardMaterial color={r.col} emissive={r.col} emissiveIntensity={0.8} metalness={0.6} roughness={0.3} /></mesh>
          {[-4.5, 0, 4.5].map((px) => <mesh key={px} position={[px, -0.45, 0]}><boxGeometry args={[0.12, 0.9, 0.12]} /><meshStandardMaterial color="#222" /></mesh>)}
        </group>
      ))}
      <group position={[shop.x, sy, shop.z]}>
        <mesh position={[0, 1.6, 0]}><boxGeometry args={[5, 3.2, 3]} /><meshStandardMaterial color="#1a1a24" /></mesh>
        <mesh position={[0, 3.6, 1.55]}><planeGeometry args={[5.4, 1.1]} /><meshBasicMaterial color="#ff4fa3" toneMapped={false} /></mesh>
        <Text position={[0, 3.6, 1.6]} fontSize={0.6} color="#111" anchorX="center" anchorY="middle">KICKZ · SKATE SHOP [Y]</Text>
        <mesh position={[0, 0.02, 3]} rotation-x={-Math.PI / 2}><ringGeometry args={[1.6, 2, 32]} /><meshBasicMaterial color="#b6ff3e" toneMapped={false} /></mesh>
        <pointLight position={[0, 3, 3]} color="#ff4fa3" intensity={6} distance={14} />
      </group>
    </group>
  );
}
