import type { HudState } from "./Scene";

/** Diving readout (presentation only; numbers come from Scene's HUD snapshot): depth, rebreather oxygen, the Thalassia
 * sector, hull stress past crush depth, the Abyssal Ring coolant warning, and a short breach flash on entering the city. */
export function DiveHud({ hud }: { hud: HudState }) {
  if (!hud.diving) return null;
  const o2 = Math.max(0, Math.min(100, hud.oxygen ?? 100));
  const lowO2 = o2 < 25;
  const stress = hud.hullStress ?? 0;
  const breach = (hud.breachAge ?? 1e9) < 2.6;
  return (
    <div className="pointer-events-none absolute inset-0 z-20 select-none font-mono">
      {breach && <div className="dive-breach absolute inset-0 flex items-center justify-center" aria-hidden>
        <div className="border border-cyan-300/60 bg-slate-950/55 px-6 py-3 text-center">
          <p className="text-[10px] tracking-[0.3em] text-cyan-300">AIRLOCK BREACH</p>
          <p className="text-sm font-bold tracking-[0.2em] text-slate-100">PRESSURIZED ZONE · {hud.sector || "THALASSIA"}</p>
        </div>
      </div>}
      <div className="dive-gauges absolute bottom-36 right-4 w-56 space-y-2">{/* live playtest: at top-24 this sat on top of the mission tracker */}
        <div className="border border-cyan-400/40 bg-slate-950/70 px-3 py-2">
          <p className="text-[9px] tracking-[0.25em] text-cyan-300">{hud.sector ? `// ${hud.sector.toUpperCase()}` : "// SUBMERGED"}</p>
          <p className="text-lg font-black text-slate-100">DEPTH <span className="text-cyan-300">{hud.depth}m</span></p>
        </div>
        <div className="border border-slate-700 bg-slate-950/70 px-3 py-2">
          <div className="mb-1 flex justify-between text-[10px]"><span className="text-slate-400">REBREATHER O₂</span><span className={lowO2 ? "animate-pulse font-bold text-red-400" : "font-bold text-cyan-300"}>{Math.round(o2)}%</span></div>
          <div className="h-1.5 w-full overflow-hidden border border-slate-800 bg-slate-900"><div className={`h-full transition-[width] duration-300 ${lowO2 ? "bg-red-500" : "bg-cyan-400"}`} style={{ width: `${o2}%` }} /></div>
        </div>
        {stress > 0.01 && <div className={`border px-3 py-2 ${stress >= 1 ? "animate-pulse border-red-500 bg-red-950/85" : "border-amber-500/70 bg-amber-950/70"}`}>
          <p className={`text-[10px] font-bold tracking-[0.2em] ${stress >= 1 ? "text-red-300" : "text-amber-300"}`}>⚠ {stress >= 1 ? "CRUSH DEPTH · HULL FAILING" : "HULL STRESS"}</p>
          <div className="mt-1 h-1 w-full bg-black/40"><div className={`h-full ${stress >= 1 ? "bg-red-500" : "bg-amber-400"}`} style={{ width: `${Math.round(stress * 100)}%` }} /></div>
          <p className="mt-1 text-[9px] text-slate-300">Ascend to relieve pressure</p>
        </div>}
        {hud.coolant && hud.coolant !== "CALM" && <div className={`border px-3 py-2 ${hud.coolant === "ARC" ? "border-cyan-200 bg-cyan-900/80" : "animate-pulse border-cyan-400/70 bg-slate-950/80"}`}>
          <p className="text-[10px] font-bold tracking-[0.2em] text-cyan-200">{hud.coolant === "ARC" ? "⚡ COOLANT DISCHARGE" : "⚡ COOLANT CHARGING · RISE OFF THE FLOOR"}</p>
        </div>}
      </div>
    </div>
  );
}
