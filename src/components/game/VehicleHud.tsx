import type { HudState } from "./Scene";
export function VehicleHud({ hud }: { hud: HudState }) {
  const v = hud.vehicle;
  if (hud.mode !== "vehicle" || !v) return null;
  return <section aria-label="Vehicle telemetry" className="vehicle-hud pointer-events-none absolute bottom-36 left-4 w-64 border-l-2 border-primary bg-background/80 px-3 py-2 font-mono">
    <p className="truncate text-[10px] uppercase text-primary">{v.name}</p>
    <div className="mt-1 flex items-baseline justify-between gap-3"><p className="text-3xl tabular-nums">{hud.speed}<span className="ml-1 text-[10px] text-muted-foreground">KM/H</span></p><p className="text-xs tabular-nums">{v.rpm.toLocaleString()} <span className="text-muted-foreground">RPM</span></p></div>
    <div className="mt-1 flex justify-between text-[9px] uppercase text-muted-foreground"><span>{v.reverse ? "Reverse" : "Drive"}</span><span>Hull rating ×{v.hull.toFixed(2)}</span></div>
    <div className="mt-1 h-1 bg-foreground/15"><div className="h-full bg-primary" style={{ width: `${Math.min(100, v.load * 100)}%` }} /></div>
  </section>;
}