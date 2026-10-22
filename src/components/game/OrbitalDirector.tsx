import { ThalassiaMapCity } from "./ThalassiaMapCity";
import { useState } from "react";
import { ArrowDownToLine, ArrowLeft, Compass, LockKeyhole, MapPin, Navigation, ZoomIn, Building2, Mountain } from "lucide-react";
import { REGIONS, ZONE_COLOR, ZONE_LABEL } from "@/game/world";
import { CITY_DESTINATIONS, dropPoint } from "@/game/destinations";
import { LANDMARKS, isLandmarkKnown } from "@/game/landmarks";
import { MAP_EXTENT } from "@/game/terrain-map";
import { MapLayers, MAP_VIEWBOX } from "./MapLayers";
import { useTerrainMap, useDetailMap } from "./useTerrainMap";
import type { PlayerProgression } from "@/game/progression";
import type { DeployTarget } from "./StarMap";

/** Planetary Director: geographical positions come exclusively from the live world and landmark data.
 * This intentionally retains the old exported component name for compatibility with StarMap. */
const destinations = [...REGIONS, ...CITY_DESTINATIONS];
const E = MAP_EXTENT;

export function OrbitalDirector({ progression, onDeploy, onAtlas }: {
  progression: PlayerProgression;
  onDeploy: (target: DeployTarget) => void;
  onAtlas: () => void;
}) {
  const terrain = useTerrainMap();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [landingId, setLandingId] = useState("primary");
  const [launching, setLaunching] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [showIndex, setShowIndex] = useState(true);
  const selected = destinations.find((d) => d.id === selectedId);
  const selectedRegion = selected && "regionId" in selected ? REGIONS.find((r) => r.id === selected.regionId) : selected;
  const landmarks = selectedRegion ? LANDMARKS.filter((l) =>
    isLandmarkKnown(progression, l.id) && Math.hypot(l.x - selectedRegion.x, l.z - selectedRegion.z) <= selectedRegion.radius * 1.65
  ).slice(0, 8) : [];
  const landings = selected ? [
    { id: "primary", name: "Primary landing zone", ...dropPoint(selected) },
    ...landmarks.filter((l) => l.id !== selected.id).map((l) => ({ id: l.id, name: l.name, x: l.x, z: l.z + 6 })),
  ] : [];
  const landing = landings.find((l) => l.id === landingId) ?? landings[0];
  const blocked = selected && "deployable" in selected && !selected.deployable;
  const focusSpan = selected ? Math.max(selectedRegion?.radius ?? E * 0.1, E * 0.13) * 4 : E * 2;
  const viewBox = zoomed && selected ? `${selected.x - focusSpan / 2} ${selected.z - focusSpan / 2} ${focusSpan} ${focusSpan}` : MAP_VIEWBOX;
  const detail = useDetailMap(zoomed && selected ? selected.id : null, zoomed && selected ? { x0: selected.x - focusSpan / 2, z0: selected.z - focusSpan / 2, span: focusSpan } : null);
  const select = (id: string) => { setSelectedId(id); setLandingId("primary"); setLaunching(false); setZoomed(false); };
  const launch = () => {
    if (!selected || !landing || blocked || launching) return;
    setLaunching(true);
    onDeploy({ id: selected.id, name: selected.name, sub: selected.sub, color: ZONE_COLOR[selected.kind], x: landing.x, z: landing.z, ...("y" in landing && landing.y !== undefined ? { y: landing.y } : {}) });
  };
  return <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto bg-[#06131d] text-white" aria-label="Planetary Destination Director">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/15 px-5 py-4">
      <div><p className="font-mono text-[10px] uppercase tracking-[0.4em] text-cyan-300">World Fracture / Veyra</p><h1 className="font-mono text-2xl uppercase tracking-[0.22em]">World Destinations</h1></div>
      <button type="button" onClick={onAtlas} className="ui-focus flex items-center gap-2 border border-white/30 px-4 py-2 font-mono text-xs uppercase tracking-widest hover:bg-white/10"><Compass className="size-4"/> Full terrain atlas</button>
    </header>
    <div className="grid min-h-[620px] flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="relative flex min-h-[520px] flex-col items-center justify-center overflow-hidden bg-[#0a2b55] p-3" aria-label="Geographical world map">
        <div className="absolute left-5 top-4 z-10 flex flex-wrap gap-2">
          <button type="button" onClick={() => setZoomed(false)} className="ui-focus border border-white/30 bg-[#06131d]/90 px-3 py-2 font-mono text-xs hover:bg-[#16354a]">Entire planet</button>
          <button type="button" aria-pressed={showIndex} onClick={() => setShowIndex((value) => !value)} className="ui-focus border border-white/30 bg-[#06131d]/90 px-3 py-2 font-mono text-xs hover:bg-[#16354a]">{showIndex ? "Hide" : "Show"} destination index</button>
          <button type="button" disabled={!selected} onClick={() => setZoomed(true)} className="ui-focus flex items-center gap-2 border border-white/30 bg-[#06131d]/90 px-3 py-2 font-mono text-xs hover:bg-[#16354a] disabled:opacity-40"><ZoomIn className="size-4"/> Region detail</button>
        </div>
        {showIndex && !zoomed && <nav aria-label="All planetary destinations" className="absolute bottom-14 left-4 z-10 max-h-[42%] w-[min(280px,70%)] overflow-y-auto border border-cyan-200/30 bg-[#06131d]/95 p-2 shadow-xl">
          <p className="px-2 py-2 font-mono text-[10px] uppercase tracking-widest text-cyan-200">Regions & cities · {destinations.length}</p>
          {destinations.map((d) => <button key={d.id} type="button" onClick={() => select(d.id)} aria-current={selectedId === d.id ? "location" : undefined} className={`ui-focus flex w-full items-center gap-2 px-2 py-2 text-left text-xs hover:bg-white/10 ${selectedId === d.id ? "bg-cyan-200/20 text-cyan-100" : "text-slate-200"}`}>
            {"regionId" in d ? <Building2 className="size-3.5 shrink-0"/> : <Mountain className="size-3.5 shrink-0"/>}
            <span>{d.name}</span><span className="ml-auto size-2 shrink-0 rounded-full" style={{ backgroundColor: ZONE_COLOR[d.kind] }}/>
          </button>)}
        </nav>}
        <svg viewBox={viewBox} className="aspect-square w-full max-w-[min(76vh,100%)] border border-cyan-100/20 bg-[#0a2b55]" role="group" aria-label="One planet: regions and cities at their actual world coordinates">
          <MapLayers art={terrain.url} preview={!terrain.full} selected={selectedId ?? ""} onSelect={select} detail={detail} labelScale={zoomed ? 0.65 : 1}>
            <ThalassiaMapCity detail={zoomed} />
            <g aria-label="City destinations">
              {CITY_DESTINATIONS.map((city) => {
                const active = city.id === selectedId, r = E * 0.014;
                return <g key={city.id} role="button" tabIndex={0} aria-label={`Select ${city.name}`} onClick={() => select(city.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(city.id); } }} className="cursor-pointer" transform={`translate(${city.x} ${city.z})`}>
                  <circle r={r * 2.7} fill="#06131d" fillOpacity={0.75}/>
                  <path d={`M 0 ${-r} L ${r} 0 L 0 ${r} L ${-r} 0 Z`} fill={ZONE_COLOR[city.kind]} stroke={active ? "#ffffff" : "#06131d"} strokeWidth={E * 0.004}/>
                  <text x={0} y={-r * 2.4} textAnchor="middle" fontSize={E * 0.027} fill="white" stroke="#06131d" strokeWidth={E * 0.006} paintOrder="stroke" fontWeight="bold">{city.name.toUpperCase()}</text>
                </g>;
              })}
            </g>
            {zoomed && selected && <g aria-label="Landing zones">{landings.map((l) => <g key={l.id} role="button" tabIndex={0} aria-label={`Select landing zone ${l.name}`} onClick={() => setLandingId(l.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setLandingId(l.id); } }} className="cursor-pointer" transform={`translate(${l.x} ${l.z})`}><circle r={E * 0.018} fill={landingId === l.id ? "#a5f3fc" : "#06131d"} stroke="white" strokeWidth={E * 0.003}/><path d={`M ${-E * 0.009} ${-E * 0.005} L ${E * 0.009} ${-E * 0.005} L 0 ${E * 0.01} Z`} fill={landingId === l.id ? "#06131d" : "#a5f3fc"}/></g>)}</g>}
          </MapLayers>
        </svg>
        <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-widest text-cyan-100/80">One connected planet · Select a region or city · Zoom to choose landing zones</p>
      </section>
      <aside className="flex flex-col border-t border-white/15 bg-[#071323]/95 p-5 lg:border-l lg:border-t-0">
        {selected ? <>
          <button type="button" className="ui-focus mb-5 flex items-center gap-2 self-start font-mono text-xs uppercase tracking-widest text-cyan-200 hover:text-white" onClick={() => { setSelectedId(null); setZoomed(false); setLandingId("primary"); }}><ArrowLeft className="size-4"/> All destinations</button>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em]" style={{color: ZONE_COLOR[selected.kind]}}>{ZONE_LABEL[selected.kind]}</p>
          <h2 className="mt-2 font-mono text-3xl uppercase tracking-wide">{selected.name}</h2>
          <p className="mt-2 text-sm text-slate-300">{selected.sub}</p>
          <button type="button" onClick={() => setZoomed(true)} className="ui-focus mt-4 flex items-center gap-2 self-start border border-cyan-300/40 px-3 py-2 font-mono text-xs text-cyan-200"><MapPin className="size-4"/> View local map</button>
          <div className="mt-6 border-t border-white/15 pt-4"><h3 className="mb-3 font-mono text-xs uppercase tracking-widest text-cyan-200">Landing zones</h3>
            <div className="max-h-[260px] space-y-2 overflow-y-auto">{landings.map((l) => <button key={l.id} type="button" onClick={() => { setLandingId(l.id); setZoomed(true); }} aria-pressed={landingId === l.id} className={`ui-focus flex w-full items-center gap-3 border p-3 text-left font-mono text-xs ${landingId === l.id ? "border-cyan-300 bg-cyan-300/10 text-white" : "border-white/15 text-slate-300 hover:border-white/50"}`}><ArrowDownToLine className="size-5 shrink-0"/><span>{l.name}</span>{landingId === l.id && <span className="ml-auto text-cyan-300">Selected</span>}</button>)}</div>
          </div>
          <div className="mt-auto pt-6">{blocked && <p className="mb-3 flex items-center gap-2 text-sm text-amber-300"><LockKeyhole className="size-4"/>{"blockedReason" in selected ? selected.blockedReason : "Landing unavailable"}</p>}
            <button type="button" disabled={Boolean(blocked) || launching} onClick={launch} className="ui-focus flex w-full items-center justify-between bg-cyan-200 px-5 py-4 font-mono text-sm font-bold uppercase tracking-[0.25em] text-slate-950 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"><span>{launching ? "Deploying…" : "Launch"}</span><Navigation className="size-5"/></button>
            <p className="mt-3 font-mono text-[10px] text-slate-400">Deployment uses the live world coordinates.</p>
          </div>
        </> : <div className="flex h-full flex-col justify-center gap-4"><Compass className="size-10 text-cyan-200"/><p className="font-mono text-xs uppercase tracking-[0.3em] text-cyan-300">Planetary navigation ready</p><h2 className="font-mono text-2xl uppercase">Explore Veyra</h2><p className="text-sm leading-6 text-slate-300">Every region and city appears in its actual geographical position. Select a location to inspect its local map, choose a landing zone, and launch.</p><p className="font-mono text-xs text-slate-400">Thalassia is offshore from Verdant Forest. Neon City and Nexus City are separate destinations.</p></div>}
      </aside>
    </div>
  </div>;
}
