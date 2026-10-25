import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { BANNER_DESIGNS, nexusSigns, type Banner, type Strip } from "@/game/nexus-signs";
import { lampLevel, worldLight } from "@/game/world-light";

const WORDS = ["NEXUS", "AEGIS", "KAIROS", "VANTA", "ORBIT", "HALCYON"];
const LINES = ["A BRIGHTER TOMORROW", "STABILITY IS FREEDOM", "UPGRADE YOURSELF", "THE SYSTEM PROVIDES", "RESONATE", "SLEEP. WORK. ASCEND."];

/** a glowing figure: head, shoulders and a tapering body drawn as light lines with a soft inner fill (the trailer's holo ads) */
function figure(g: CanvasRenderingContext2D, cx: number, top: number, h: number) {
  const s = h / 10;
  g.save();
  g.shadowColor = "rgba(255,255,255,0.9)"; g.shadowBlur = s * 1.2;
  g.strokeStyle = "rgba(255,255,255,0.95)"; g.lineWidth = Math.max(1.5, s * 0.18); g.fillStyle = "rgba(255,255,255,0.18)";
  g.beginPath(); g.ellipse(cx, top + s * 1.1, s * 0.75, s * 0.95, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  g.beginPath();
  g.moveTo(cx - s * 0.35, top + s * 2.1); g.lineTo(cx - s * 2.0, top + s * 3.0); g.lineTo(cx - s * 2.3, top + s * 6.2); g.lineTo(cx - s * 1.3, top + s * 6.0);
  g.lineTo(cx - s * 1.0, top + s * 10); g.lineTo(cx + s * 1.0, top + s * 10); g.lineTo(cx + s * 1.3, top + s * 6.0); g.lineTo(cx + s * 2.3, top + s * 6.2);
  g.lineTo(cx + s * 2.0, top + s * 3.0); g.lineTo(cx + s * 0.35, top + s * 2.1); g.closePath(); g.fill(); g.stroke();
  // circuit lines across the body
  g.lineWidth = Math.max(1, s * 0.08); g.globalAlpha = 0.6;
  for (let k = 0; k < 5; k++) { const y = top + s * (3.2 + k * 1.3); g.beginPath(); g.moveTo(cx - s * 1.2, y); g.lineTo(cx + s * 1.2, y + s * 0.3); g.stroke(); }
  g.restore();
}

/** banner design `i`: a tall dark panel with a bright border, the brand written down it and a holo figure (white, tinted per instance) */
function bannerTexture(i: number): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const W = 128, H = 640, c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, 0, H); grad.addColorStop(0, "rgba(40,30,70,0.92)"); grad.addColorStop(1, "rgba(14,10,30,0.92)");
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  g.strokeStyle = "rgba(255,255,255,0.95)"; g.lineWidth = 4; g.strokeRect(5, 5, W - 10, H - 10);
  g.lineWidth = 1.5; g.strokeRect(13, 13, W - 26, H - 26);
  if (i % 2 === 0) figure(g, W / 2, 40, 300);
  g.save(); g.translate(W / 2 + 6, i % 2 === 0 ? 400 : 60); g.rotate(Math.PI / 2);
  g.font = "bold 50px sans-serif"; g.fillStyle = "white"; g.shadowColor = "white"; g.shadowBlur = 14; g.textBaseline = "middle";
  g.fillText(WORDS[i % WORDS.length]!, 0, 0); g.restore();
  if (i % 2 === 1) figure(g, W / 2, 330, 280);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
/** holo screen design `i`: a wide ad with a figure on one side, a brand and a slogan, faint scanlines */
function screenTexture(i: number): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const W = 512, H = 288, c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, W, H); grad.addColorStop(0, "rgba(20,40,90,0.9)"); grad.addColorStop(1, "rgba(10,14,40,0.9)");
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  figure(g, i % 2 ? W - 110 : 110, 24, 250);
  g.fillStyle = "white"; g.shadowColor = "white"; g.shadowBlur = 16; g.textAlign = i % 2 ? "left" : "right";
  const tx = i % 2 ? 36 : W - 36;
  g.font = "bold 74px sans-serif"; g.fillText(WORDS[i % WORDS.length]!, tx, 130);
  g.shadowBlur = 6; g.font = "26px sans-serif"; g.fillText(LINES[i % LINES.length]!, tx, 180);
  g.shadowBlur = 0; g.globalAlpha = 0.12; for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 1);
  g.globalAlpha = 1; g.strokeStyle = "white"; g.lineWidth = 3; g.strokeRect(3, 3, W - 6, H - 6);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

function SignSet({ list, tex, level }: { list: Banner[]; tex: THREE.Texture | null; level: { current: number } }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, side: THREE.DoubleSide, depthWrite: false }), [tex]);
  const geo = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  useEffect(() => () => { mat.dispose(); geo.dispose(); }, [mat, geo]);
  const tint = useMemo(() => list.map((b) => new THREE.Color(b.color)), [list]);
  useEffect(() => {
    const m = ref.current; if (!m) return;
    const o = new THREE.Object3D();
    list.forEach((b, i) => { o.position.set(b.x, b.y, b.z); o.rotation.set(0, b.yaw, 0); o.scale.set(b.w, b.h, 1); o.updateMatrix(); m.setMatrixAt(i, o.matrix); });
    m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere();
  }, [list]);
  const seen = useRef(-1);
  useFrame(() => {
    const m = ref.current; if (!m || seen.current === level.current) return;
    seen.current = level.current;
    const c = new THREE.Color();
    tint.forEach((t, i) => m.setColorAt(i, c.copy(t).multiplyScalar(0.9 + level.current * 1.9))); // overdriven at night so the bloom catches it
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });
  if (!list.length) return null;
  return <instancedMesh ref={ref} args={[geo, mat, list.length]} renderOrder={2} />;
}

function Strips({ list, level }: { list: Strip[]; level: { current: number } }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false }), []);
  useEffect(() => {
    const m = ref.current; if (!m) return;
    const o = new THREE.Object3D();
    list.forEach((s, i) => { o.position.set(s.x, (s.y0 + s.y1) / 2, s.z); o.scale.set(0.12, s.y1 - s.y0, 0.12); o.updateMatrix(); m.setMatrixAt(i, o.matrix); });
    m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere();
  }, [list]);
  const seen = useRef(-1);
  useFrame(() => {
    const m = ref.current; if (!m || seen.current === level.current) return;
    seen.current = level.current;
    const c = new THREE.Color();
    list.forEach((s, i) => m.setColorAt(i, c.set(s.color).multiplyScalar(0.5 + level.current * 2.5)));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });
  if (!list.length) return null;
  return <instancedMesh ref={ref} args={[undefined, mat, list.length]}><boxGeometry args={[1, 1, 1]} /></instancedMesh>;
}

/** Nexus City's banners, holo screens and tower light strips (nexus-signs.ts). Lit a little by day, blazing at night. */
export function NexusSigns() {
  const signs = useMemo(() => nexusSigns(), []);
  const banners = useMemo(() => Array.from({ length: BANNER_DESIGNS }, (_, i) => ({ tex: bannerTexture(i), list: signs.banners.filter((b) => b.design === i) })), [signs]);
  const screens = useMemo(() => Array.from({ length: BANNER_DESIGNS }, (_, i) => ({ tex: screenTexture(i), list: signs.screens.filter((b) => b.design === i) })), [signs]);
  useEffect(() => () => { for (const s of [...banners, ...screens]) s.tex?.dispose(); }, [banners, screens]);
  const level = useRef(0);
  useFrame(() => { level.current = Math.round(lampLevel(worldLight.night) * 20) / 20; });
  return (
    <group name="nexus-signs">
      {banners.map((b, i) => <SignSet key={`b${i}`} list={b.list} tex={b.tex} level={level} />)}
      {screens.map((b, i) => <SignSet key={`s${i}`} list={b.list} tex={b.tex} level={level} />)}
      <Strips list={signs.strips} level={level} />
    </group>
  );
}
