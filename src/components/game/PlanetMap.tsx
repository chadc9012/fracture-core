import { useEffect, useRef, useState } from "react";
import { Anchor, Landmark, LockKeyhole, Map as MapIcon, MapPin, Minus, Plane, Plus, Star, TrainFront, Waves } from "lucide-react";
import type { PlayerProgression } from "@/game/progression";
import { AIR_ROUTES, CONTINENTS, OCEANS, PLANET, continentOfRegion, continentsOfWorld, type Continent, type ContinentId, type PlaceKind, type WorldId } from "@/game/planet";
import { CONTINENT_MAPS } from "@/game/globe";
import { cartoMap, cartoMapAt, type CartoMap } from "@/game/carto-maps";
import type { CartoPoi } from "@/game/carto-features";
import { STORM_ISLAND_SITES, stormSiteWorld } from "@/game/storm-islands";
import { islandTop, islandsFound } from "@/game/storm-quests";
import { TERMINALS, arrivalPoint, hasVisited, START_WORLD } from "@/game/travel";
import { GlobeView, type GlobePinState } from "./GlobeView";
import { CartoMapView } from "./CartoMapView";
import type { DeployTarget } from "./StarMap";

/**
 * The planetary map, a globe (owner, Nov 1 2026: "give the map the globe look and make it interactive, where you click on a
 * region and it shows you the full map of that region"): the canon "12 Continents, 7 Oceans" board wrapped on a sphere you
 * spin, zoom and tap (GlobeView), with the air routes, a pin on every continent (lit when you can fly there, amber until you
 * have made landfall, grey while it is only on the map) and where you are. Tapping a continent turns the globe to it; tapping
 * it again, or "Open map", opens its street maps (CartoMapView: every building, road, river, lake, forest and terrain of that
 * region). Under the globe: its districts (with the live airports and ports), travel and the planet's figures. A, B, X and Y
 * on a pad (Enter, Escape, M and O on a keyboard) fly, back, open the map and list the oceans; RT / LT (+ / −) zoom.
 */
const byId = (id: ContinentId) => CONTINENTS.find((c) => c.id === id)!;
const PLACE_ICON: Record<PlaceKind, typeof Star> = { CAPITAL: Star, CITY: MapPin, POI: MapPin, AIRPORT: Plane, PORT: Anchor, BRIDGE: Landmark, HUB: TrainFront };

export function PlanetMap({ progression, onDeploy, currentWorld = null, currentRegion = null, playerPos }: { progression: PlayerProgression; onDeploy: (target: DeployTarget) => void; currentWorld?: WorldId | null; currentRegion?: string | null; playerPos?: { x: number; z: number } | undefined }) {
  // the continent you stand on: your region's, else the first of your world's
  const here: ContinentId | null = continentOfRegion(currentRegion)?.id ?? (currentWorld ? continentsOfWorld(currentWorld)[0]?.id ?? null : null);
  const [selectedId, setSelectedId] = useState<ContinentId>(here ?? "nexus-city");
  const [legend, setLegend] = useState(() => typeof window === "undefined" || window.innerWidth >= 640);
  const [oceansOpen, setOceansOpen] = useState(false);
  const [streetMap, setStreetMap] = useState<string | null>(null);
  const zoomRef = useRef<((f: number) => void) | null>(null);
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
  const zoomBy = (f: number) => zoomRef.current?.(f);
  /** the street maps of a continent: the one you stand in first when it is yours */
  const mapsOf = (id: ContinentId) => CONTINENT_MAPS[id];
  const openMap = (id: ContinentId = selectedId) => {
    const ids = mapsOf(id); if (!ids.length) return;
    const mine = playerPos ? cartoMapAt(playerPos.x, playerPos.z)?.id : undefined;
    setStreetMap(mine && ids.includes(mine) ? mine : ids[0]!);
  };

  // pad / keyboard: X open map, Y oceans, RT/LT zoom, A fly, arrows cycle continents (Q/E stay the director's tab keys)
  useEffect(() => {
    const order = CONTINENTS.map((c) => c.id);
    const onKey = (e: KeyboardEvent) => {
      if (streetMap) return;
      if ((e.target as HTMLElement | null)?.closest("input, textarea")) return;
      if (e.code === "KeyM") { openMap(); return; }
      if (e.code === "KeyL") setLegend((v) => !v);
      else if (e.code === "KeyO") setOceansOpen((v) => !v);
      else if (e.code === "Equal" || e.code === "NumpadAdd") zoomBy(0.8);
      else if (e.code === "Minus" || e.code === "NumpadSubtract") zoomBy(1.25);
      else if (e.code === "ArrowRight" || e.code === "ArrowDown") setSelectedId((id) => order[(order.indexOf(id) + 1) % order.length]!);
      else if (e.code === "ArrowLeft" || e.code === "ArrowUp") setSelectedId((id) => order[(order.indexOf(id) + order.length - 1) % order.length]!);
      else if (e.code === "Enter") fly();
    };
    window.addEventListener("keydown", onKey);
    let raf = 0, prev: boolean[] = [];
    const poll = () => {
      raf = requestAnimationFrame(poll);
      if (streetMap) return;
      const gp = typeof navigator !== "undefined" && navigator.getGamepads ? Array.from(navigator.getGamepads()).find((p): p is Gamepad => !!p && p.connected) : undefined;
      const now = gp ? gp.buttons.map((b) => b.pressed) : [];
      const hit = (i: number) => now[i] && !prev[i];
      if (hit(0)) fly();
      if (hit(2)) openMap();
      if (hit(3)) setOceansOpen((v) => !v);
      if (now[7]) zoomBy(0.985);
      if (now[6]) zoomBy(1.015);
      if (hit(15) || hit(13)) setSelectedId((id) => order[(order.indexOf(id) + 1) % order.length]!);
      if (hit(14) || hit(12)) setSelectedId((id) => order[(order.indexOf(id) + order.length - 1) % order.length]!);
      prev = now;
    };
    raf = requestAnimationFrame(poll);
    return () => { window.removeEventListener("keydown", onKey); cancelAnimationFrame(raf); };
  });

  /** fast travel from a street map: into lands you have made landfall in; the Storm Islands once found (onto the island's top) */
  const continentOfMap = (m: CartoMap) => CONTINENTS.find((c) => CONTINENT_MAPS[c.id].includes(m.id));
  const travelOk = (m: CartoMap): string | null => {
    if (m.id === "thalassia") return "Take the Verdant elevator";
    if (m.id === "storm") return islandsFound(progression) ? null : "Find the islands first";
    const c = continentOfMap(m);
    return !c ? "Not reachable" : visitedC(c) ? null : "Make landfall first";
  };
  const travelTo = (poi: CartoPoi, m: CartoMap) => {
    const c = continentOfMap(m);
    const site = m.id === "storm" ? STORM_ISLAND_SITES.find((x) => poi.id === `storm-${x.id}`) : undefined;
    if (site) { const w = stormSiteWorld(site); onDeploy({ id: `map:${poi.id}`, name: site.name, sub: `${m.name} · fast travel`, color: c?.color ?? "#7fb2ff", x: w.x - 4, z: w.z + 4, y: islandTop(site) + 1.6 }); }
    else onDeploy({ id: `map:${poi.id}`, name: poi.name.split(" · ")[0]!, sub: `${m.name} · fast travel`, color: c?.color ?? "#7ee8ff", x: poi.x, z: poi.z + 6 });
    setStreetMap(null);
  };
  const pinState = (id: ContinentId): GlobePinState => { const c = byId(id); return c.tier === "BACKDROP" ? "map" : visited(c.id) ? "open" : "landfall"; };
  const routes = AIR_ROUTES.map(([a, b]) => ({ a, b, open: visited(a) && visited(b) }));
  const status = (c: Continent) => (c.id === here ? "You are here" : c.tier === "BACKDROP" ? "Not yet explorable" : c.tier === "EXPANSION" ? "Reached by air drop" : !liveTerminals(c, "AIRPORT").length ? "Elevator off the Verdant shore" : visited(c.id) ? "Open to flights" : "Make landfall first");
  const verdant = selected.id === "verdant-forest" || selected.id === "thalassia";

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="relative h-[min(72vh,620px)] min-h-[360px] overflow-hidden border border-cyan-200/20 bg-[#03070f]">
        <GlobeView selected={selectedId} here={here} pinState={pinState} routes={routes} onSelect={setSelectedId} onOpen={(id) => openMap(id)} zoomRef={zoomRef} />
        {/* the board's continent list, clickable (wide screens) */}
        <ul className="absolute right-2 top-2 hidden w-52 border border-cyan-200/20 bg-[#06101b]/85 py-1 font-mono text-[11px] md:block" aria-label="Continents">
          <li className="px-2 pb-0.5 text-[9px] uppercase tracking-[0.22em] text-cyan-300">Continents</li>
          {CONTINENTS.map((c) => (
            <li key={c.id}><button type="button" onClick={() => setSelectedId(c.id)} className={`ui-focus flex w-full items-center gap-2 px-2 py-0.5 text-left ${c.id === selectedId ? "bg-cyan-300/15 text-white" : "text-slate-300 hover:bg-white/5"}`}>
              <span className="w-4 text-right text-slate-500">{c.n}</span><span className="size-2 rounded-full" style={{ background: c.color }} /><span className="truncate">{c.name}</span>
              {here === c.id && <span className="ml-auto size-2 rounded-full bg-[#ffe066]" title="You are here" />}
            </button></li>
          ))}
        </ul>
        {/* the live legend, drawn over the board's own legend box */}
        {legend && (
          <div className="pointer-events-none absolute bottom-2 left-2 whitespace-nowrap border border-cyan-200/30 bg-[#06101b]/85 px-2 py-1 font-mono text-[10px] leading-[1.7] text-slate-200" aria-label="Map legend">
            <p className="uppercase tracking-[0.18em] text-cyan-300">Live map</p>
            <p><span className="mr-1.5 inline-block size-[0.8em] rounded-full bg-[#ffe066]" />You are here</p>
            <p><span className="mr-1.5 inline-block size-[0.8em] rounded-full border-2 border-[#7ee8ff]" />Flights open</p>
            <p><span className="mr-1.5 inline-block size-[0.8em] rounded-full border-2 border-[#ffc860]" />Landfall first</p>
            <p><span className="mr-1.5 inline-block size-[0.8em] rounded-full border-2 border-[#8a97a3]" />Map only</p>
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

        <div className="absolute left-2 top-2 flex flex-col gap-1">
          <button type="button" onClick={() => zoomBy(0.75)} aria-label="Zoom in" className="ui-focus border border-cyan-200/30 bg-[#06101b]/90 p-1.5 text-cyan-100"><Plus className="size-3.5" /></button>
          <button type="button" onClick={() => zoomBy(1.33)} aria-label="Zoom out" className="ui-focus border border-cyan-200/30 bg-[#06101b]/90 p-1.5 text-cyan-100"><Minus className="size-3.5" /></button>
          <button type="button" onClick={() => setLegend((v) => !v)} aria-label="Legend" className="ui-focus border border-cyan-200/30 bg-[#06101b]/90 px-1.5 py-1 font-mono text-[10px] text-cyan-100">L</button>
        </div>
        <p className="pointer-events-none absolute bottom-2 right-2 font-mono text-[10px] text-slate-400">Drag to spin · pinch to zoom · tap a continent</p>
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
          <button type="button" onClick={() => openMap()} disabled={!mapsOf(selected.id).length} className="ui-focus flex items-center justify-center gap-1.5 border border-cyan-300/40 px-3 py-1.5 font-mono text-xs uppercase tracking-[0.15em] enabled:bg-cyan-400/15 enabled:text-cyan-100 enabled:hover:bg-cyan-400/25 disabled:text-slate-500">
            <MapIcon className="size-4" />{mapsOf(selected.id).length ? `Open map · ${mapsOf(selected.id).map((id) => cartoMap(id)?.name ?? id).join(" · ")}` : "Not in the game yet"}
          </button>
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
        {([["A", "#3ec46d", "Fly"], ["B", "#e5484d", "Back"], ["X", "#3b82f6", "Open map"], ["Y", "#e9b949", "Oceans"]] as const).map(([k, c, label]) => (
          <span key={k} className="flex items-center gap-1.5"><span className="flex size-5 items-center justify-center rounded-full border-2 text-[9px] font-bold" style={{ borderColor: c, color: c }}>{k}</span>{label}</span>
        ))}
        <span>RT / LT · zoom</span>
        <span className="text-slate-500">Keyboard: arrows · Enter · M · L · O · + / −</span>
      </div>
      {streetMap && <CartoMapView initial={streetMap} px={playerPos?.x ?? NaN} pz={playerPos?.z ?? NaN} onClose={() => setStreetMap(null)} travelOk={travelOk} onTravel={travelTo} />}
      {selected.tier === "CORE" && !visited(selected.id) && <p className="mt-1 flex items-center justify-center gap-1.5 font-mono text-[11px] text-amber-200"><LockKeyhole className="size-3.5" /> {selected.name}: fly there from a transit terminal once to open map flights.</p>}
    </div>
  );
}
