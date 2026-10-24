import type { HudState } from "./Scene";

const STAT_LABEL: Record<string, string> = { speed: "SPEED", handling: "HANDLING", hull: "ARMOR", ram: "RAM" };

export function VehicleHud({ hud }: { hud: HudState }) {
  const v = hud.vehicle;
  if (hud.mode !== "vehicle" || !v) return null;
  const tuning = v.tuning;
  return <section aria-label="Vehicle telemetry" className="vehicle-hud pointer-events-none absolute bottom-36 left-4 w-64 border-l-2 border-primary bg-background/80 px-3 py-2 font-mono">
    <div className="flex items-baseline justify-between gap-2">
      <p className="truncate text-[10px] uppercase text-primary">{v.name}</p>
      {tuning && <p className="shrink-0 truncate text-[9px] uppercase text-muted-foreground">{tuning.ability}</p>}
    </div>
    <div className="mt-1 flex items-baseline justify-between gap-3"><p className="text-3xl tabular-nums">{hud.speed}<span className="ml-1 text-[10px] text-muted-foreground">KM/H</span></p><p className="text-xs tabular-nums">{v.rpm.toLocaleString()} <span className="text-muted-foreground">RPM</span></p></div>
    <div className="mt-1 flex justify-between text-[9px] uppercase text-muted-foreground"><span>{v.reverse ? "Reverse" : "Drive"}</span><span>Hull rating ×{v.hull.toFixed(2)}</span></div>
    <div className="mt-1 h-1 bg-foreground/15"><div className="h-full bg-primary" style={{ width: `${Math.min(100, v.load * 100)}%` }} /></div>
    {tuning && tuning.stats.length > 0 && <div className="mt-2 space-y-1 border-t border-foreground/15 pt-1">
      {tuning.stats.map((s) => <div key={s.stat} className="flex items-center gap-1.5">
        <span className="w-16 shrink-0 text-[8px] uppercase text-muted-foreground">{STAT_LABEL[s.stat] ?? s.stat}</span>
        <div className="flex flex-1 gap-0.5" aria-hidden>
          {Array.from({ length: s.maxLevel }, (_, i) => <div key={i} className={`h-1.5 flex-1 ${i < s.level ? "bg-primary" : "bg-foreground/15"}`} />)}
        </div>
        <span className="w-9 shrink-0 text-right text-[8px] tabular-nums text-muted-foreground">+{Math.round(s.bonus * 100)}%</span>
      </div>)}
    </div>}
  </section>;
}
