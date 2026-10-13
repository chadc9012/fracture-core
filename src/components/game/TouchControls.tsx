import { useEffect, useRef, useState } from "react";
import { isTouchDevice, touch } from "@/game/client-input";

const key = (code: string, down: boolean) => window.dispatchEvent(new KeyboardEvent(down ? "keydown" : "keyup", { code, bubbles: true }));

/** Phone/tablet play: left stick moves (WASD), drag on the right half looks, buttons press the matching keys. */
export function TouchControls() {
  const [on, setOn] = useState(false);
  useEffect(() => { const t = isTouchDevice(); setOn(t); touch.active = t; return () => { touch.active = false; }; }, []);
  const stick = useRef<{ id: number; x: number; y: number } | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const held = useRef(new Set<string>());
  const look = useRef<{ id: number; x: number; y: number } | null>(null);
  if (!on) return null;

  const setDir = (dx: number, dy: number) => {
    const want = new Set<string>();
    if (dy < -14) want.add("KeyW"); if (dy > 14) want.add("KeyS"); if (dx < -14) want.add("KeyA"); if (dx > 14) want.add("KeyD");
    if (Math.hypot(dx, dy) > 52) want.add("ShiftLeft");
    for (const k of held.current) if (!want.has(k)) key(k, false);
    for (const k of want) if (!held.current.has(k)) key(k, true);
    held.current = want;
  };
  const Btn = ({ label, code, onDown, onUp, className }: { label: string; code?: string; onDown?: () => void; onUp?: () => void; className: string }) => (
    <button
      className={`pointer-events-auto absolute grid h-14 w-14 select-none place-items-center rounded-full border border-primary/60 bg-background/50 font-mono text-[10px] uppercase text-primary active:bg-primary/40 ${className}`}
      onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); if (code) key(code, true); onDown?.(); }}
      onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); if (code) key(code, false); onUp?.(); }}
    >{label}</button>
  );

  return (
    <div className="absolute inset-0 z-30 touch-none select-none" style={{ pointerEvents: "none" }}>
      {/* look pad: right half */}
      <div className="pointer-events-auto absolute bottom-0 right-0 top-1/4 w-1/2"
        onTouchStart={(e) => { const t = e.changedTouches[0]!; look.current = { id: t.identifier, x: t.clientX, y: t.clientY }; }}
        onTouchMove={(e) => { for (const t of Array.from(e.changedTouches)) if (look.current && t.identifier === look.current.id) { touch.lookDX += t.clientX - look.current.x; touch.lookDY += t.clientY - look.current.y; look.current.x = t.clientX; look.current.y = t.clientY; } }}
        onTouchEnd={() => { look.current = null; }} />
      {/* move stick */}
      <div className="pointer-events-auto absolute bottom-8 left-6 h-32 w-32 rounded-full border border-primary/40 bg-background/30"
        onTouchStart={(e) => { const t = e.changedTouches[0]!; const r = e.currentTarget.getBoundingClientRect(); stick.current = { id: t.identifier, x: r.left + r.width / 2, y: r.top + r.height / 2 }; }}
        onTouchMove={(e) => { for (const t of Array.from(e.changedTouches)) if (stick.current && t.identifier === stick.current.id) { const dx = t.clientX - stick.current.x, dy = t.clientY - stick.current.y; const m = Math.min(1, 56 / Math.max(1, Math.hypot(dx, dy))); setKnob({ x: dx * m, y: dy * m }); setDir(dx, dy); } }}
        onTouchEnd={() => { stick.current = null; setKnob({ x: 0, y: 0 }); setDir(0, 0); }}>
        <div className="absolute left-1/2 top-1/2 h-12 w-12 rounded-full bg-primary/60" style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }} />
      </div>
      <Btn label="Fire" className="bottom-28 right-6 h-20 w-20" onDown={() => { touch.fire = true; }} onUp={() => { touch.fire = false; }} />
      <Btn label="Aim" className="bottom-52 right-8" onDown={() => { touch.aim = true; }} onUp={() => { touch.aim = false; }} />
      <Btn label="Jump" code="KeyC" className="bottom-8 right-28" />
      <Btn label="Dash" code="ShiftRight" className="bottom-28 right-32" />
      <Btn label="Reload" code="KeyG" className="bottom-8 right-6" />
      <Btn label="Q" code="KeyQ" className="bottom-48 left-6 h-11 w-11" />
      <Btn label="E" code="KeyE" className="bottom-48 left-20 h-11 w-11" />
      <Btn label="R" code="KeyR" className="bottom-48 left-[8.5rem] h-11 w-11" />
      <Btn label="Use" code="KeyY" className="right-6 top-1/3 h-11 w-11" />
      <Btn label="Map" code="KeyM" className="right-20 top-1/3 h-11 w-11" />
    </div>
  );
}
