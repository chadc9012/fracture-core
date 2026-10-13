import { useEffect, useRef, useState } from "react";
import { isTouchDevice, touch } from "@/game/client-input";
import { Button } from "@/components/ui/button";
import type { Bindings } from "@/game/bindings";
import { stickCodes, touchCodes } from "@/game/touch-controls";
import { Crosshair, MoveUp, RotateCw, ArrowRightLeft, Navigation, Car, Hand, ChevronsDown, Zap } from "lucide-react";

const key = (code: string, down: boolean) => window.dispatchEvent(new KeyboardEvent(down ? "keydown" : "keyup", { code, bubbles: true }));

/** Phone/tablet play: left stick moves (WASD), drag on the right half looks, buttons press the matching keys. */
export function TouchControls({ disabled = false, bindings }: { disabled?: boolean; bindings?: Bindings | undefined }) {
  const [on, setOn] = useState(false);
  const stick = useRef<{ id: number; x: number; y: number } | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const held = useRef(new Set<string>());
  const look = useRef<{ id: number; x: number; y: number } | null>(null);
  const actions = useRef(new Set<string>());
  const reset = () => {
    for (const code of [...held.current, ...actions.current]) key(code, false);
    held.current.clear(); actions.current.clear(); stick.current = null; look.current = null;
    touch.fire = false; touch.aim = false; touch.lookDX = 0; touch.lookDY = 0;
    setKnob({ x: 0, y: 0 });
  };
  useEffect(() => { const t = isTouchDevice(); setOn(t); touch.active = t; const release = () => reset(); window.addEventListener("blur", release); return () => { reset(); touch.active = false; window.removeEventListener("blur", release); }; }, []);
  useEffect(() => { if (disabled) reset(); }, [disabled]);
  const codes = touchCodes(bindings);
  if (!on || disabled) return null;

  const setDir = (dx: number, dy: number) => {
    const want = new Set(stickCodes(dx, dy));
    for (const k of held.current) if (!want.has(k)) key(k, false);
    for (const k of want) if (!held.current.has(k)) key(k, true);
    held.current = want;
  };
  const btn = (label: string, code: string | null, icon: React.ReactNode, className: string, down?: () => void, up?: () => void) => {
    const release = () => { if (code) { key(code, false); actions.current.delete(code); } up?.(); };
    return <Button key={label} aria-label={label} title={label} variant="outline" size="icon" className={`pointer-events-auto absolute touch-none rounded-full border-primary/60 bg-background/70 text-primary ${className}`}
      onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); if (code) { actions.current.add(code); key(code, true); } down?.(); }}
      onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}>{icon}</Button>;
  };

  return (
    <div className="touch-controls pointer-events-none absolute inset-0 z-30 touch-none select-none">
      {/* look pad: right half */}
      <div aria-label="Look around" className="touch-look pointer-events-auto absolute bottom-0 right-0 top-1/4 w-1/2"
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); look.current = { id: e.pointerId, x: e.clientX, y: e.clientY }; }}
        onPointerMove={(e) => { const l = look.current; if (l && l.id === e.pointerId) { touch.lookDX += e.clientX - l.x; touch.lookDY += e.clientY - l.y; l.x = e.clientX; l.y = e.clientY; } }}
        onPointerUp={() => { look.current = null; }} onPointerCancel={() => { look.current = null; }} />
      {/* move stick */}
      <div aria-label="Movement stick" className="touch-stick pointer-events-auto absolute bottom-8 left-6 h-32 w-32 rounded-full border border-primary/40 bg-background/30"
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); const r = e.currentTarget.getBoundingClientRect(); stick.current = { id: e.pointerId, x: r.left + r.width / 2, y: r.top + r.height / 2 }; }}
        onPointerMove={(e) => { const s = stick.current; if (s && s.id === e.pointerId) { const dx = e.clientX - s.x, dy = e.clientY - s.y; const m = Math.min(1, 56 / Math.max(1, Math.hypot(dx, dy))); setKnob({ x: dx * m, y: dy * m }); setDir(dx, dy); } }}
        onPointerUp={() => { stick.current = null; setKnob({ x: 0, y: 0 }); setDir(0, 0); }} onPointerCancel={reset}>
        <div className="absolute left-1/2 top-1/2 h-12 w-12 rounded-full bg-primary/60" style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }} />
      </div>
      {btn("Fire", null, <Crosshair />, "touch-fire size-16", () => { touch.fire = true; }, () => { touch.fire = false; })}
      {btn("Aim", null, <Crosshair className="size-4" />, "touch-aim size-11", () => { touch.aim = true; }, () => { touch.aim = false; })}
      {btn("Jump", codes.jump, <MoveUp />, "touch-jump size-11")}
      {btn("Dash", codes.dash, <Zap />, "touch-dash size-11")}
      {btn("Reload", codes.reload, <RotateCw />, "touch-reload size-11")}
      {btn("Next weapon", codes.next, <ArrowRightLeft />, "touch-next size-11")}
      {btn("Crouch", codes.crouch, <ChevronsDown />, "touch-crouch size-11")}
      {btn("Ability Q", codes.primary, "Q", "touch-q size-11")}
      {btn("Ability E", codes.tactical, "E", "touch-e size-11")}
      {btn("Ability R", codes.ultimate, "R", "touch-r size-11")}
      {btn("Interact", codes.use, <Hand />, "touch-use size-11")}
      {btn("Enter or exit vehicle", codes.vehicle, <Car />, "touch-vehicle size-11")}
      {btn("Map", codes.map, <Navigation />, "touch-map size-11")}
    </div>
  );
}
