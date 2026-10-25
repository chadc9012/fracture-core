import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Anchor, LockKeyhole, Minus, Plane, Plus, TrainFront, Waves } from "lucide-react";
import type { PlayerProgression } from "@/game/progression";
import { AIR_ROUTES, BOARD, CONTINENTS, NATIONS, THALASSIA_PIN, type Continent, type ContinentId, type WorldId } from "@/game/planet";
import { REGIONS } from "@/game/world";
import { TERMINALS, arrivalPoint, hasVisited, START_WORLD } from "@/game/travel";
import boardArt from "@/assets/planet/planet-board.jpg";
import type { DeployTarget } from "./StarMap";

/**
 * The planetary map (Stage 150), built on the owner's planetary map board: the painted globe is the map, and the live game is
 * drawn over it — air routes between the playable continents with planes on them, the sea lane from Veyloria to Thalassia,
 * an emblem ring on every continent (lit when you can fly there, locked until you have made landfall, dim while the land is
 * only on the map), your location, and the board's own legend and info panel (nations, major cities, size, climate, travel
 * options) filled from planet.ts. A, B, X and Y on a pad (Enter, Escape, L and N on a keyboard) select, back, toggle the legend
 * and list the nations; RT / LT (+ / −) zoom and the map pans by dragging. Raids are never on this map: they launch from the
 * Raid tab.
 */
const CARDS = import.meta.glob("../../assets/planet/card-*.jpg", { eager: true, import: "default" }) as Record<string, string>;
const card = (id: string) => CARDS[`../../assets/planet/card-${id}.jpg`] ?? "";
const byId = (id: ContinentId) => CONTINENTS.find((c) => c.id === id)!;
/** a gentle arc between two board points, bulging away from the board's centre like the board's own routes */
function arcPath(a: { x: number; y: number }, b: { x: number; y: number }) {
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
  let nx = -dy / len, ny = dx / len;
  if ((mx - BOARD.w / 2) * nx + (my - BOARD.h / 2) * ny < 0) { nx = -nx; ny = -ny; }
  const k = len * 0.16, cx = mx + nx * k, cy = my + ny * k;
  return { d: `M${a.x} ${a.y} Q${cx} ${cy} ${b.x} ${b.y}`, mid: { x: 0.25 * a.x + 0.5 * cx + 0.25 * b.x, y: 0.25 * a.y + 0.5 * cy + 0.25 * b.y }, angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI };
}

export function PlanetMap({ progression, onDeploy, currentWorld = null }: { progression: PlayerProgression; onDeploy: (target: DeployTarget) => void; currentWorld?: WorldId | null }) {
  const here = currentWorld === "thalassia" ? "veyloria" : currentWorld;
  const [selectedId, setSelectedId] = useState<ContinentId>((here as ContinentId | null) ?? START_WORLD);
  const [legend, setLegend] = useState(true);
  const [nationsOpen, setNationsOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const selected = byId(selectedId);
  const visited = (id: ContinentId) => id === START_WORLD || hasVisited(progression, id);
  const terminal = TERMINALS.find((t) => t.world === selected.id);
  const canFly = !!terminal && selected.tier === "CORE" && visited(selected.id) && selected.id !== here;
  const fly = () => {
    if (!terminal || !canFly) return;
    const a = arrivalPoint(terminal);
    onDeploy({ id: terminal.id, name: terminal.name, sub: `${selected.name} · flight`, color: selected.color, x: a.x, z: a.z });
  };
  const nations = NATIONS.filter((n) => n.continent === selected.id);
  const regionNames = selected.regions.map((id) => (id === "neon" ? "Neon City" : id === "storm-islands" ? "The Storm Islands" : REGIONS.find((r) => r.id === id)?.name ?? id));
  const setZ = (z: number) => { const nz = Math.min(2.5, Math.max(1, z)); setZoom(nz); if (nz === 1) setPan({ x: 0, y: 0 }); };

  // pad / keyboard: X legend, Y nations, RT/LT zoom, A fly, arrows cycle continents (Q/E stay the director's tab keys)
  useEffect(() => {
    const order = CONTINENTS.map((c) => c.id);
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest("input, textarea")) return;
      if (e.code === "KeyL") setLegend((v) => !v);
      else if (e.code === "KeyN") setNationsOpen((v) => !v);
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
      if (hit(3)) setNationsOpen((v) => !v);
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
  const pinOf = (c: Continent) => c.pin;
  const ring = (c: Continent) => (c.tier === "BACKDROP" ? "#8a97a3" : visited(c.id) ? "#7ee8ff" : "#ffc860");

  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="relative overflow-hidden border border-cyan-200/20 bg-[#050b14]" style={{ aspectRatio: `${BOARD.w} / ${BOARD.h}` }}>
        <div className="absolute inset-0 origin-center transition-transform duration-200" style={{ transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)` }}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={() => { drag.current = null; }} onPointerLeave={() => { drag.current = null; }}>
          <img src={boardArt} alt="" draggable={false} className="absolute inset-0 size-full select-none object-cover" />
          <svg viewBox={`0 0 ${BOARD.w} ${BOARD.h}`} className="absolute inset-0 size-full" role="group" aria-label="Planetary map: continents, air and sea routes">
            <defs>
              <filter id="pm-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            </defs>
            {/* air routes, dashed white with a plane on each, as on the worldbuild board */}
            {AIR_ROUTES.map(([a, b]) => {
              const r = arcPath(pinOf(byId(a)), pinOf(byId(b)));
              const open = visited(a) && visited(b);
              return (
                <g key={`${a}-${b}`} opacity={open ? 0.95 : 0.45}>
                  <path d={r.d} fill="none" stroke="#ffffff" strokeWidth={1.6} strokeDasharray="6 6" filter="url(#pm-glow)" />
                  <g transform={`translate(${r.mid.x} ${r.mid.y}) rotate(${r.angle})`}><path d="M-9 0 L6 -1.6 L9 0 L6 1.6 Z M-1 0 L-5 -7 L-2 -7 L4 0 L-2 7 L-5 7 Z M-8 0 L-10 -3.5 L-8.5 -3.5 L-6 0 L-8.5 3.5 L-10 3.5 Z" fill="#ffffff" /></g>
                </g>
              );
            })}
            {/* the sea lane: Veyloria's elevator platform out to Thalassia */}
            {(() => { const r = arcPath(byId("veyloria").pin, THALASSIA_PIN); return <path d={r.d} fill="none" stroke="#5ee7ff" strokeWidth={1.6} strokeDasharray="3 5" filter="url(#pm-glow)" />; })()}
            <g transform={`translate(${THALASSIA_PIN.x} ${THALASSIA_PIN.y})`} filter="url(#pm-glow)">
              <circle r={10} fill="#04202e" fillOpacity={0.85} stroke="#5ee7ff" strokeWidth={2} />
              <path d="M-5 2 Q-2.5 -1 0 2 Q2.5 5 5 2 M-5 -2 Q-2.5 -5 0 -2 Q2.5 1 5 -2" stroke="#9ff3ff" strokeWidth={1.4} fill="none" />
              <text x={14} y={4} fontSize={13} fontWeight={600} fill="#bff4ff" stroke="#03121c" strokeWidth={3} paintOrder="stroke">Thalassia</text>
              <text x={14} y={17} fontSize={9.5} fill="#8fd8ee" stroke="#03121c" strokeWidth={2.5} paintOrder="stroke">(Underwater City)</text>
            </g>
            {/* an emblem ring on every continent; the selected one is highlighted; a pulse where you are */}
            {CONTINENTS.map((c) => {
              const p = c.pin, sel = c.id === selected.id;
              return (
                <g key={c.id} transform={`translate(${p.x} ${p.y})`} className="cursor-pointer" onClick={() => setSelectedId(c.id)}>
                  <circle r={46} fill="transparent" />
                  <circle r={sel ? 25 : 21} fill="none" stroke={ring(c)} strokeWidth={sel ? 3 : 1.6} opacity={sel ? 1 : 0.75} filter="url(#pm-glow)" />
                  {c.tier === "CORE" && !visited(c.id) && <g transform="translate(17 -19)"><circle r={8} fill="#1a1205" stroke="#ffc860" /><path d="M-3 0 v3.5 h6 V0 Z M-2 0 v-2 a2 2 0 0 1 4 0 V0" stroke="#ffc860" fill="none" strokeWidth={1.2} /></g>}
                  {here === c.id && <><circle r={30} fill="none" stroke="#ffe066" strokeWidth={2}><animate attributeName="r" values="26;36;26" dur="2.4s" repeatCount="indefinite" /><animate attributeName="opacity" values="1;0.2;1" dur="2.4s" repeatCount="indefinite" /></circle><circle cx={-24} cy={-22} r={5} fill="#ffe066" stroke="#3a2a00" /></>}
                  <title>{c.name}</title>
                </g>
              );
            })}
          </svg>
        </div>

        {/* legend: drawn where the board has its own */}
        {legend && (
          <div className="absolute bottom-0 left-0 top-[74.2%] w-[15.4%] min-w-[150px] border border-cyan-200/25 bg-[#06101b] p-2 font-mono text-[10px] leading-5 text-slate-200" aria-label="Map legend">
            <p className="text-[9px] uppercase tracking-[0.2em] text-cyan-300">Legend</p>
            <p><span className="mr-1.5 inline-block size-2.5 rounded-full bg-[#ffe066]" />Your location</p>
            <p><span className="mr-1.5 inline-block size-2.5 rounded-full border-2 border-[#7ee8ff]" />Open to flights</p>
            <p><span className="mr-1.5 inline-block size-2.5 rounded-full border-2 border-[#ffc860]" />Make landfall first</p>
            <p><span className="mr-1.5 inline-block size-2.5 rounded-full border-2 border-[#8a97a3]" />Not yet explorable</p>
            <p><Plane className="mr-1 inline size-3" />Air route</p>
            <p><span className="mr-1.5 inline-block w-3 border-t-2 border-dashed border-[#5ee7ff] align-middle" />Sea lane · elevator</p>
          </div>
        )}

        {/* info panel: where the board has its own */}
        <div className="absolute bottom-0 right-0 top-[77.4%] flex w-[22.8%] min-w-[200px] flex-col border border-cyan-200/30 bg-[#06101b] text-slate-100" aria-label={`${selected.name} details`}>
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <img src={card(selected.id)} alt="" className="size-full object-cover" draggable={false} />
            <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#06101b] to-transparent px-2 pt-4 text-center font-mono text-xs font-semibold uppercase tracking-[0.25em]">{selected.name}</p>
          </div>
          <dl className="grid grid-cols-[1fr_auto] gap-x-2 px-2.5 py-1 font-mono text-[10.5px] leading-[18px]">
            <dt className="text-slate-400">Nations</dt><dd>{nations.length}</dd>
            <dt className="text-slate-400">Major Cities</dt><dd>{selected.majorCities}</dd>
            <dt className="text-slate-400">Region Size</dt><dd>{selected.scale}</dd>
            <dt className="text-slate-400">Climate</dt><dd>{selected.climate}</dd>
          </dl>
          <div className="flex items-center justify-between border-t border-cyan-200/15 px-2.5 py-0.5">
            <span className="font-mono text-[10px] text-slate-400">Travel Options</span>
            <span className="flex items-center gap-1.5">
              <button type="button" onClick={fly} disabled={!canFly} title={canFly ? `Fly to ${terminal?.name}` : selected.id === here ? "You are here" : selected.tier !== "CORE" ? "No scheduled service" : "Make landfall first"} className="ui-focus rounded-sm p-1 enabled:text-cyan-200 enabled:hover:bg-cyan-400/20 disabled:text-slate-600"><Plane className="size-4" /></button>
              <span title={selected.id === "veyloria" ? "Sea lane and elevator to Thalassia" : "No ferry service yet"} className={selected.id === "veyloria" ? "p-1 text-cyan-200" : "p-1 text-slate-600"}><Anchor className="size-4" /></span>
              <span title="No rail service yet" className="p-1 text-slate-600"><TrainFront className="size-4" /></span>
            </span>
          </div>
        </div>

        {nationsOpen && (
          <div className="absolute right-[1%] top-[2%] max-h-[70%] w-[21.5%] min-w-[200px] overflow-y-auto border border-cyan-200/30 bg-[#06101b]/95 p-2.5 font-mono text-[11px] text-slate-100" aria-label={`Nations of ${selected.name}`}>
            <p className="text-[9px] uppercase tracking-[0.2em] text-cyan-300">Nations · {selected.name}</p>
            <ul className="mt-1 space-y-0.5">{nations.map((n) => <li key={n.id}>{n.name}{n.playable ? <span className="text-cyan-300"> · explorable</span> : null}</li>)}</ul>
            {regionNames.length > 0 && <p className="mt-2 text-slate-400">Regions · {regionNames.join(", ")}</p>}
            <p className="mt-2 leading-snug text-slate-300">{selected.look}</p>
            {selected.id === "veyloria" && <p className="mt-2 flex gap-1.5 text-cyan-100"><Waves className="size-3.5 shrink-0" /> Thalassia lies off this east coast, on no continent: take the elevator platform out past the shore, or an underwater vehicle.</p>}
          </div>
        )}

        <div className="absolute right-[1%] top-[44%] flex flex-col gap-1">
          <button type="button" onClick={() => setZ(zoom + 0.5)} aria-label="Zoom in" className="ui-focus border border-cyan-200/30 bg-[#06101b]/90 p-1.5 text-cyan-100"><Plus className="size-3.5" /></button>
          <button type="button" onClick={() => setZ(zoom - 0.5)} aria-label="Zoom out" className="ui-focus border border-cyan-200/30 bg-[#06101b]/90 p-1.5 text-cyan-100"><Minus className="size-3.5" /></button>
        </div>
      </div>

      {/* the board's control strip */}
      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-300">
        {([["A", "#3ec46d", "Select · fly"], ["B", "#e5484d", "Back"], ["X", "#3b82f6", "Legend"], ["Y", "#e9b949", "Nations"]] as const).map(([k, c, label]) => (
          <span key={k} className="flex items-center gap-1.5"><span className="flex size-5 items-center justify-center rounded-full border-2 text-[9px] font-bold" style={{ borderColor: c, color: c }}>{k}</span>{label}</span>
        ))}
        <span>RT / LT · zoom</span>
        <span className="text-slate-500">Keyboard: arrows · Enter · L · N · + / −</span>
      </div>
      {selected.tier === "CORE" && !visited(selected.id) && <p className="mt-1 flex items-center justify-center gap-1.5 font-mono text-[11px] text-amber-200"><LockKeyhole className="size-3.5" /> {selected.name}: fly there from a transit terminal once to open map flights.</p>}
    </div>
  );
}
