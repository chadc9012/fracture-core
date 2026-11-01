import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Anchor, Landmark, LockKeyhole, MapPin, Minus, Plane, Plus, Star, TrainFront, Waves } from "lucide-react";
import type { PlayerProgression } from "@/game/progression";
import { AIR_ROUTES, BOARD, CONTINENTS, GLOBE, LEGEND_RECT, OCEANS, PLANET, continentOfRegion, continentsOfWorld, type Continent, type ContinentId, type PlaceKind, type WorldId } from "@/game/planet";
import { TERMINALS, arrivalPoint, hasVisited, START_WORLD } from "@/game/travel";
import boardArt from "@/assets/planet/planet-canon-board.jpg";
import type { DeployTarget } from "./StarMap";

/**
 * The planetary map (Stages 150 and 153), built on the canon board (owner, Nov 1 2026: "12 Continents, 7 Oceans"): the
 * painted globe is the map, and the live game is drawn over it — air routes between the continents with airports, planes
 * on them, the sea lane from the Verdant shore out to Thalassia, a frame on every continent's painted icon and name (lit when
 * you can fly there, locked until you have made landfall, dim while it is only on the map), the selected continent's row lit
 * in the board's list, and where you are. Under the board: its districts (with the live airports and ports), travel and the
 * planet's figures. A, B, X and Y on a pad (Enter, Escape, L and O on a keyboard) fly, back, toggle the legend and list the
 * oceans; RT / LT (+ / −) zoom and the map pans by dragging. Raids launch from the Raid tab.
 */
const byId = (id: ContinentId) => CONTINENTS.find((c) => c.id === id)!;
/** where routes meet a continent: its painted icon, just above the name */
const hub = (c: Continent) => ({ x: c.pin.x, y: c.pin.y - 28 });
/** the frame round a continent's painted icon and name */
const frameW = (c: Continent) => Math.max(104, c.name.replace(/^The /, "").length * 8.6 + 24); // the painted label drops "The"
/** a gentle arc between two board points, bulging away from the globe's centre like the board's own routes */
function arcPath(a: { x: number; y: number }, b: { x: number; y: number }) {
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
  let nx = -dy / len, ny = dx / len;
  if ((mx - GLOBE.x) * nx + (my - GLOBE.y) * ny < 0) { nx = -nx; ny = -ny; }
  const k = len * 0.16, cx = mx + nx * k, cy = my + ny * k;
  return { d: `M${a.x} ${a.y} Q${cx} ${cy} ${b.x} ${b.y}`, mid: { x: 0.25 * a.x + 0.5 * cx + 0.25 * b.x, y: 0.25 * a.y + 0.5 * cy + 0.25 * b.y }, angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI };
}
const pct = (v: number, of: number) => `${(v / of) * 100}%`;
const PLACE_ICON: Record<PlaceKind, typeof Star> = { CAPITAL: Star, CITY: MapPin, POI: MapPin, AIRPORT: Plane, PORT: Anchor, BRIDGE: Landmark, HUB: TrainFront };

export function PlanetMap({ progression, onDeploy, currentWorld = null, currentRegion = null }: { progression: PlayerProgression; onDeploy: (target: DeployTarget) => void; currentWorld?: WorldId | null; currentRegion?: string | null }) {
  // the continent you stand on: your region's, else the first of your world's
  const here: ContinentId | null = continentOfRegion(currentRegion)?.id ?? (currentWorld ? continentsOfWorld(currentWorld)[0]?.id ?? null : null);
  const [selectedId, setSelectedId] = useState<ContinentId>(here ?? "nexus-city");
  const [legend, setLegend] = useState(true);
  const [oceansOpen, setOceansOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const selected = byId(selectedId);
  // landfall is per walkable world: the Nexus world (Nexus City, Neon City, Verdant Forest) is open from the start
  const visitedC = (c: Continent) => !!c.world && (c.world === START_WORLD || hasVisited(progression, c.world));
  const visited = (id: ContinentId) => visitedC(byId(id));
  const liveTerminals = (c: Continent, kind: "AIRPORT" | "SEAPORT") => TERMINALS.filter((t) => t.kind === kind && c.places.some((p) => p.live === t.id));
  const terminal = liveTerminals(selected, "AIRPORT")[0];
  const canFly = !!terminal && selected.tier === "CORE" && visited(selected.id) && selected.id !== here;
  const fly = () => {
    if (!terminal || !canFly) return;
    const a = arrivalPoint(terminal);
    onDeploy({ id: terminal.id, name: terminal.name, sub: `${selected.name} · flight`, color: selected.color, x: a.x, z: a.z });
  };
  const seaports = liveTerminals(selected, "SEAPORT");
  const setZ = (z: number) => { const nz = Math.min(2.5, Math.max(1, z)); setZoom(nz); if (nz === 1) setPan({ x: 0, y: 0 }); };

  // pad / keyboard: X legend, Y oceans, RT/LT zoom, A fly, arrows cycle continents (Q/E stay the director's tab keys)
  useEffect(() => {
    const order = CONTINENTS.map((c) => c.id);
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest("input, textarea")) return;
      if (e.code === "KeyL") setLegend((v) => !v);
      else if (e.code === "KeyO") setOceansOpen((v) => !v);
      else if (e.code === "Equal" || e.code === "NumpadAdd") setZ(zoom + 0.5);
      else if (e.code === "Minus" || e.code === "NumpadSubtract") setZ(zoom - 0.5);
      else if (e.code === "ArrowRight" || e.code === "ArrowDown") setSelectedId((id) => order[(order.indexOf(id) + 1) % order.length]!);
      else if (e.code === "ArrowLeft" || e.code === "ArrowUp") setSelectedId((id) => order[(order.indexOf(id) + order.length - 1) % order.length]!);
      else if (e.code === "Enter") fly();
    };
    window.addEventListener("keydown", onKey);
    let raf = 0, prev: boolean[] = [];
    const poll = () => {
      raf = requestAnimationFrame(poll);
      const gp = typeof navigator !== "undefined" && navigator.getGamepads ? Array.from(navigator.getGamepads()).find((p): p is Gamepad => !!p && p.connected) : undefined;
      const now = gp ? gp.buttons.map((b) => b.pressed) : [];
      const hit = (i: number) => now[i] && !prev[i];
      if (hit(0)) fly();
      if (hit(2)) setLegend((v) => !v);
      if (hit(3)) setOceansOpen((v) => !v);
      if (hit(7)) setZ(zoom + 0.5);
      if (hit(6)) setZ(zoom - 0.5);
      if (hit(15) || hit(13)) setSelectedId((id) => order[(order.indexOf(id) + 1) % order.length]!);
      if (hit(14) || hit(12)) setSelectedId((id) => order[(order.indexOf(id) + order.length - 1) % order.length]!);
      prev = now;
    };
    raf = requestAnimationFrame(poll);
    return () => { window.removeEventListener("keydown", onKey); cancelAnimationFrame(raf); };
  });

  const onDown = (e: ReactPointerEvent) => { if (zoom > 1) drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }; };
  const onMove = (e: ReactPointerEvent) => { const d = drag.current; if (!d) return; setPan({ x: d.px + (e.clientX - d.x) / zoom, y: d.py + (e.clientY - d.y) / zoom }); };
  const ring = (c: Continent) => (c.tier === "BACKDROP" ? "#8a97a3" : visited(c.id) ? "#7ee8ff" : "#ffc860");
  const status = (c: Continent) => (c.id === here ? "You are here" : c.tier === "BACKDROP" ? "Not yet explorable" : c.tier === "EXPANSION" ? "Reached by air drop" : !liveTerminals(c, "AIRPORT").length ? "Elevator off the Verdant shore" : visited(c.id) ? "Open to flights" : "Make landfall first");
  const verdant = selected.id === "verdant-forest" || selected.id === "thalassia";

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="relative overflow-hidden border border-cyan-200/20 bg-[#050b14]" style={{ aspectRatio: `${BOARD.w} / ${BOARD.h}` }}>
        <div className="absolute inset-0 origin-center transition-transform duration-200" style={{ transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)` }}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={() => { drag.current = null; }} onPointerLeave={() => { drag.current = null; }}>
          <img src={boardArt} alt="World Fracture: 12 continents, 7 oceans" draggable={false} className="absolute inset-0 size-full select-none object-cover" />
          <svg viewBox={`0 0 ${BOARD.w} ${BOARD.h}`} className="absolute inset-0 size-full" role="group" aria-label="Planetary map: continents, air and sea routes">
            <defs>
              <filter id="pm-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            </defs>
            {/* air routes, dashed white with a plane on each */}
            {AIR_ROUTES.map(([a, b]) => {
              const r = arcPath(hub(byId(a)), hub(byId(b)));
              const open = visited(a) && visited(b);
              return (
                <g key={`${a}-${b}`} opacity={open ? 0.95 : 0.7} pointerEvents="none">
                  <path d={r.d} fill="none" stroke={open ? "#ffffff" : "#ffc860"} strokeWidth={2.4} strokeDasharray="8 6" filter="url(#pm-glow)" />
                  <g transform={`translate(${r.mid.x} ${r.mid.y}) rotate(${r.angle}) scale(1.4)`}><path d="M-9 0 L6 -1.6 L9 0 L6 1.6 Z M-1 0 L-5 -7 L-2 -7 L4 0 L-2 7 L-5 7 Z M-8 0 L-10 -3.5 L-8.5 -3.5 L-6 0 L-8.5 3.5 L-10 3.5 Z" fill={open ? "#ffffff" : "#ffc860"} stroke="#03121c" strokeWidth={0.6} /></g>
                </g>
              );
            })}
            {/* the sea lane: the Verdant shore's elevator platform out to Thalassia */}
            {(() => { const r = arcPath(hub(byId("verdant-forest")), hub(byId("thalassia"))); return <path d={r.d} fill="none" stroke="#5ee7ff" strokeWidth={2} strokeDasharray="3 6" filter="url(#pm-glow)" pointerEvents="none" />; })()}
            {/* a frame on every continent's painted icon and name and on its row in the list; the selected one lit; a pulse where you are */}
            {CONTINENTS.map((c) => {
              const p = c.pin, sel = c.id === selected.id, col = ring(c), P = c.panel;
              return (
                <g key={c.id} className="cursor-pointer" onClick={() => setSelectedId(c.id)}>
                  <rect x={P.x} y={P.y} width={P.w} height={P.h} rx={4} fill={sel ? "#7ee8ff" : "transparent"} fillOpacity={sel ? 0.1 : 0} stroke={sel ? col : "transparent"} strokeWidth={2} filter={sel ? "url(#pm-glow)" : undefined} />
                  <g transform={`translate(${p.x} ${p.y})`}>
                    <rect x={-frameW(c) / 2} y={-52} width={frameW(c)} height={66} rx={8} fill={sel ? "#7ee8ff" : "transparent"} fillOpacity={sel ? 0.08 : 0} stroke={col} strokeWidth={sel ? 2.6 : 1.2} opacity={sel ? 1 : 0.55} filter="url(#pm-glow)" />
                    {c.tier === "CORE" && !visited(c.id) && <g transform={`translate(${frameW(c) / 2} -52)`}><circle r={8} fill="#1a1205" stroke="#ffc860" /><path d="M-3 0 v3.5 h6 V0 Z M-2 0 v-2 a2 2 0 0 1 4 0 V0" stroke="#ffc860" fill="none" strokeWidth={1.2} /></g>}
                    {here === c.id && <g transform={`translate(${-frameW(c) / 2} -52)`}><circle r={10} fill="none" stroke="#ffe066" strokeWidth={2}><animate attributeName="r" values="7;15;7" dur="2.4s" repeatCount="indefinite" /><animate attributeName="opacity" values="1;0.2;1" dur="2.4s" repeatCount="indefinite" /></circle><circle r={5} fill="#ffe066" stroke="#3a2a00" /></g>}
                  </g>
                  <title>{`${c.name} · ${status(c)}`}</title>
                </g>
              );
            })}
          </svg>
        </div>

        {/* the live legend, drawn over the board's own legend box */}
        {legend && (
          <div className="absolute overflow-hidden whitespace-nowrap border border-cyan-200/30 bg-[#06101b] px-[0.6%] py-[0.4%] font-mono text-[clamp(6px,0.6vw,10px)] leading-[1.75] text-slate-200" aria-label="Map legend"
            style={{ left: pct(LEGEND_RECT.x, BOARD.w), top: pct(LEGEND_RECT.y, BOARD.h), width: pct(LEGEND_RECT.w, BOARD.w), height: pct(LEGEND_RECT.h, BOARD.h) }}>
            <p className="uppercase tracking-[0.18em] text-cyan-300">Live map</p>
            <p><span className="mr-1.5 inline-block size-[0.8em] rounded-full bg-[#ffe066]" />You are here</p>
            <p><span className="mr-1.5 inline-block size-[0.8em] rounded-sm border-2 border-[#7ee8ff]" />Flights open</p>
            <p><span className="mr-1.5 inline-block size-[0.8em] rounded-sm border-2 border-[#ffc860]" />Landfall first</p>
            <p><span className="mr-1.5 inline-block size-[0.8em] rounded-sm border-2 border-[#8a97a3]" />Map only</p>
            <p><Plane className="mr-1 inline size-[1em]" />Air route</p>
            <p><span className="mr-1.5 inline-block w-[1.2em] border-t-2 border-dashed border-[#5ee7ff] align-middle" />Sea lane</p>
          </div>
        )}

        {oceansOpen && (
          <div className="absolute left-[2%] top-[14%] max-h-[70%] w-[30%] min-w-[200px] overflow-y-auto border border-cyan-200/30 bg-[#06101b]/95 p-2.5 font-mono text-[11px] text-slate-100" aria-label="The seven oceans">
            <p className="text-[9px] uppercase tracking-[0.2em] text-cyan-300">The seven oceans</p>
            <ul className="mt-1 space-y-0.5">{OCEANS.map((o) => <li key={o.id}>{o.n}. {o.name}<span className="text-slate-400"> · {o.character}</span></li>)}</ul>
            <p className="mt-2 leading-snug text-slate-300">{selected.look}</p>
          </div>
        )}

        <div className="absolute left-[73.5%] top-[3%] flex flex-col gap-1">
          <button type="button" onClick={() => setZ(zoom + 0.5)} aria-label="Zoom in" className="ui-focus border border-cyan-200/30 bg-[#06101b]/90 p-1.5 text-cyan-100"><Plus className="size-3.5" /></button>
          <button type="button" onClick={() => setZ(zoom - 0.5)} aria-label="Zoom out" className="ui-focus border border-cyan-200/30 bg-[#06101b]/90 p-1.5 text-cyan-100"><Minus className="size-3.5" /></button>
        </div>
      </div>

      {/* the selected land: its board panel's places (live airports and ports), travel and the planet's figures */}
      <div className="mt-2 grid gap-2 border border-cyan-200/25 bg-[#06101b] p-3 text-slate-100 md:grid-cols-[1.2fr_1fr_auto]" aria-label={`${selected.name} details`}>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-cyan-300">Continent {selected.n} · {selected.tagline}</p>
          <h3 className="mt-0.5 text-lg font-semibold tracking-wide" style={{ color: selected.color }}>{selected.name}</h3>
          <p className="text-xs text-slate-300">{selected.epithet}</p>
          <p className="mt-1 font-mono text-[11px] text-slate-400">{status(selected)} · {selected.capital} · {selected.climate}</p>
          {verdant && <p className="mt-1.5 flex gap-1.5 text-xs text-cyan-100"><Waves className="size-3.5 shrink-0" /> Thalassia lies offshore from the Verdant Forest: take the elevator platform off the Verdant shore, or an underwater vehicle.</p>}
        </div>
        <ul className="grid grid-cols-2 gap-x-3 gap-y-0.5 self-center font-mono text-[11px]">
          {selected.places.map((p) => {
            const Icon = PLACE_ICON[p.kind], live = !!p.live && (p.live.includes(":") ? TERMINALS.some((t) => t.id === p.live) : true);
            return <li key={p.name} className={`flex items-center gap-1.5 ${live ? "text-cyan-100" : "text-slate-400"}`} title={live ? "In the game now" : "On the map"}><Icon className={`size-3 shrink-0 ${p.kind === "CAPITAL" ? "text-amber-300" : ""}`} />{p.name}</li>;
          })}
        </ul>
        <div className="flex flex-col items-stretch justify-center gap-1.5">
          <button type="button" onClick={fly} disabled={!canFly} className="ui-focus flex items-center justify-center gap-1.5 border border-cyan-300/40 px-3 py-1.5 font-mono text-xs uppercase tracking-[0.15em] enabled:bg-cyan-400/15 enabled:text-cyan-100 enabled:hover:bg-cyan-400/25 disabled:text-slate-500">
            <Plane className="size-4" />{canFly ? `Fly · ${terminal!.name}` : status(selected)}
          </button>
          <p className="flex items-center gap-1.5 font-mono text-[10px] text-slate-400"><Anchor className="size-3.5" />{seaports.length ? `Ferries · ${seaports.map((s) => s.name).join(", ")}` : "No ferry service yet"}</p>
        </div>
        <dl className="grid grid-cols-4 gap-x-3 gap-y-0.5 border-t border-cyan-200/15 pt-1.5 font-mono text-[10px] text-slate-400 sm:grid-cols-8 md:col-span-3">
          {([["Planet", PLANET.name], ["Diameter", `${PLANET.diameterKm.toLocaleString("en-US")} km`], ["Surface", `${(PLANET.surfaceKm2 / 1e6).toFixed(1)} M km²`], ["Continents", PLANET.majorContinents], ["Oceans", PLANET.majorOceans], ["Playable", CONTINENTS.filter((c) => c.tier === "CORE").length], ["Airports", TERMINALS.filter((t) => t.kind === "AIRPORT").length], ["Ports", TERMINALS.filter((t) => t.kind === "SEAPORT").length]] as const).map(([k, v]) => (
            <div key={k}><dt>{k}</dt><dd className="text-slate-100">{v}</dd></div>
          ))}
        </dl>
      </div>

      {/* the board's control strip */}
      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-300">
        {([["A", "#3ec46d", "Fly"], ["B", "#e5484d", "Back"], ["X", "#3b82f6", "Legend"], ["Y", "#e9b949", "Oceans"]] as const).map(([k, c, label]) => (
          <span key={k} className="flex items-center gap-1.5"><span className="flex size-5 items-center justify-center rounded-full border-2 text-[9px] font-bold" style={{ borderColor: c, color: c }}>{k}</span>{label}</span>
        ))}
        <span>RT / LT · zoom</span>
        <span className="text-slate-500">Keyboard: arrows · Enter · L · O · + / −</span>
      </div>
      {selected.tier === "CORE" && !visited(selected.id) && <p className="mt-1 flex items-center justify-center gap-1.5 font-mono text-[11px] text-amber-200"><LockKeyhole className="size-3.5" /> {selected.name}: fly there from a transit terminal once to open map flights.</p>}
    </div>
  );
}
