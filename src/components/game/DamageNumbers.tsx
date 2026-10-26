import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { WorldSim } from "@/game/sim";
import { damageFrame, damageText, MAX_LIVE } from "@/game/damage-numbers";

/** Floating damage numbers (damage-numbers.ts): a pooled layer of DOM labels over the canvas, placed each frame by projecting
 * the hit point through the camera. No React state per frame; hidden behind the camera or past `MAX_DISTANCE`. */
const MAX_DISTANCE = 160;

export function DamageNumbers({ sim }: { sim: WorldSim }) {
  const { gl, camera, size } = useThree();
  const layer = useMemo(() => {
    if (typeof document === "undefined") return null;
    const root = document.createElement("div");
    root.setAttribute("aria-hidden", "true");
    Object.assign(root.style, { position: "absolute", inset: "0", pointerEvents: "none", overflow: "hidden", zIndex: "5" });
    const spans = Array.from({ length: MAX_LIVE }, () => {
      const el = document.createElement("span");
      Object.assign(el.style, {
        position: "absolute", left: "0", top: "0", display: "none", whiteSpace: "nowrap", willChange: "transform, opacity",
        font: "700 15px/1 var(--font-display, 'Rajdhani', system-ui, sans-serif)", letterSpacing: "0.04em",
        textShadow: "0 1px 2px rgba(0,0,0,0.85), 0 0 6px rgba(0,0,0,0.5)",
      } as Partial<CSSStyleDeclaration>);
      root.appendChild(el);
      return el;
    });
    return { root, spans };
  }, []);
  useEffect(() => {
    const host = gl.domElement.parentElement;
    if (!layer || !host) return;
    if (getComputedStyle(host).position === "static") host.style.position = "relative";
    host.appendChild(layer.root);
    return () => { layer.root.remove(); };
  }, [gl, layer]);
  const v = useRef(new THREE.Vector3());
  const shown = useRef<string[]>([]);
  useFrame(() => {
    if (!layer) return;
    const now = performance.now() / 1000, list = sim.damageNumbers.list;
    for (let i = 0; i < layer.spans.length; i++) {
      const el = layer.spans[i]!, n = list[list.length - 1 - i];
      const f = n ? damageFrame(n, now - n.at) : null;
      if (!n || !f || camera.position.distanceTo(v.current.set(n.x, n.y, n.z)) > MAX_DISTANCE) { if (el.style.display !== "none") el.style.display = "none"; continue; }
      v.current.set(n.x, n.y + f.rise, n.z).project(camera);
      if (v.current.z > 1 || v.current.z < -1) { el.style.display = "none"; continue; }
      const x = (v.current.x * 0.5 + 0.5) * size.width, y = (-v.current.y * 0.5 + 0.5) * size.height;
      const text = damageText(n.amount), key = `${text}|${n.crit}`;
      if (shown.current[i] !== key) { el.textContent = text; el.style.color = n.crit ? "#ffcf3f" : "#f4f6f8"; shown.current[i] = key; }
      el.style.display = "block";
      el.style.opacity = f.opacity.toFixed(2);
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%) scale(${f.scale.toFixed(2)})`;
    }
  });
  return null;
}
