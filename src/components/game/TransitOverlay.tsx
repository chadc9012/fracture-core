import { useEffect, useLayoutEffect, useRef } from "react";
import { transitFrame, type TransitPlan } from "@/game/transit";

/** Destiny-style drop-in cover: a full-screen canvas that gathers light, streaks stars past the camera while the world is swapped
 * underneath, then lifts onto a destination card. Time comes from `startedAt` (not from mounting), so it stays continuous when the hub
 * screen unmounts and the world mounts mid-transit. Presentation only: the swap itself is scheduled by GameCanvas. */
const STARS = Array.from({ length: 160 }, (_, i) => { // deterministic field, no per-frame allocation
  const a = (i * 2.399963) % (Math.PI * 2), r = ((i * 7919) % 1000) / 1000;
  return { a, r: 0.04 + r * 0.9, w: 0.5 + ((i * 31) % 10) / 10 };
});

export function TransitOverlay({ startedAt, plan, reduced, name, sub, color }: { startedAt: number; plan: TransitPlan; reduced: boolean; name: string; sub: string; color: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);

  const draw = () => {
    const cv = canvas.current, el = root.current;
    if (!cv || !el) return false;
    const elapsed = (performance.now() - startedAt) / 1000;
    const f = transitFrame(elapsed, plan, reduced);
    el.style.background = `rgba(3,8,20,${f.cover})`; // solid even before the first canvas paint
    if (card.current) card.current.style.opacity = String(f.card);
    const ctx = cv.getContext("2d");
    if (ctx) {
      const w = cv.width, h = cv.height, cx = w / 2, cy = h / 2, R = Math.hypot(cx, cy);
      ctx.clearRect(0, 0, w, h);
      if (f.streak > 0) {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.9);
        g.addColorStop(0, `${color}${Math.round(f.streak * 90).toString(16).padStart(2, "0")}`); g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        ctx.lineCap = "round";
        for (const s of STARS) {
          const near = s.r * R * (1 + f.streak * 0.6), len = f.streak * R * 0.35 * (0.3 + s.r);
          ctx.strokeStyle = `rgba(255,255,255,${0.15 + 0.7 * f.streak * s.w * 0.6})`; ctx.lineWidth = Math.max(1, s.w * 1.6 * (w / 1200));
          ctx.beginPath(); ctx.moveTo(cx + Math.cos(s.a) * (near - len), cy + Math.sin(s.a) * (near - len)); ctx.lineTo(cx + Math.cos(s.a) * near, cy + Math.sin(s.a) * near); ctx.stroke();
        }
      }
      if (f.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${f.flash * 0.85})`; ctx.fillRect(0, 0, w, h); }
    }
    return f.phase !== "done";
  };

  useLayoutEffect(() => { // size to the window and paint the correct frame synchronously, so the world never shows for a frame at the swap
    const cv = canvas.current; if (!cv) return;
    const fit = () => { cv.width = Math.max(320, Math.round(window.innerWidth / 2)); cv.height = Math.max(180, Math.round(window.innerHeight / 2)); };
    fit(); draw();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    let raf = 0;
    const tick = () => { if (draw()) raf = window.requestAnimationFrame(tick); };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={root} className="fixed inset-0 z-[90] cursor-wait select-none" role="status" aria-live="polite" aria-label={`Dropping in to ${name}`}>
      <canvas ref={canvas} className="absolute inset-0 size-full" aria-hidden="true" />
      <div ref={card} className="absolute inset-x-0 top-[58%] text-center opacity-0">
        <p className="font-mono text-[11px] uppercase tracking-[0.5em] text-white/70">Dropping in</p>
        <h2 className="mt-2 font-mono text-3xl uppercase tracking-[0.3em] text-white lg:text-5xl" style={{ textShadow: `0 0 28px ${color}` }}>{name}</h2>
        <p className="mt-2 font-mono text-xs uppercase tracking-[0.3em]" style={{ color }}>{sub}</p>
      </div>
    </div>
  );
}
