import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ArrowLeft, Crosshair, Focus, Globe2, Navigation, Shield, Skull, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { REGIONS, ZONE_LABEL, WORLD_SCALE } from "@/game/world";
import { MAP_EXTENT, MAP_OCEAN_EDGE } from "@/game/terrain-map";
import { ENCOUNTERS } from "@/game/encounters";
import { MARKER_COLOR, type Marker, type TrackedMarker } from "@/game/waypoints";
import { getPin, pinAt, pinFromMarker, setPin, subscribePin } from "@/game/map-pin";
import { REGIONAL_SHOPS, SHOP_KIND_LABEL } from "@/game/regional-shops";
import { CITY_DESTINATIONS, dropPoint } from "@/game/destinations";
import { DESTINATIONS, DIRECTOR_FILTERS, FILTER_LABEL, destinationActivities, destinationById, discoveredSites, matchesFilter, type Destination, type DirectorFilter } from "@/game/destination-director";
import type { Landmark } from "@/game/landmarks";
import type { PlayerProgression } from "@/game/progression";
import { NextActivityCard } from "./NextActivityCard";
import { ActivityPanel } from "./ActivityPanel";
import { ACTIVITY_COLOR, ACTIVITY_LABEL, type Activity } from "@/game/map-activities";
import { MAP_FONT, MAP_VIEWBOX, MapLayers } from "./MapLayers";
import { useTerrainMap } from "./useTerrainMap";
import { MapLegend } from "./MapLegend";
import { LANDMARK_GLYPH, MARKER_GLYPH } from "@/game/map-symbols";
import { LANDMARKS, landmarkRoutes, isLandmarkKnown } from "@/game/landmarks";
import { HAZARD_ZONES, zoneCenter } from "@/game/hazard-zones";
import { regionHistory, regionStory, discoveredCount } from "@/game/world-story";

/**
 * The world map is a Destination Director in two stages (destination-director.ts):
 *  1. Destinations — the live terrain map with a node for every region and for the cities that sit inside or beside
 *     them (Neon City beside Nexus, Thalassia offshore), plus the same list down the side.
 *  2. One destination — the tactical map focused on it (waypoints, layers, zoom and pan as before) with its activities
 *     drawn on the map, filter chips, and the pre-launch panel (challenge level, Launch/Travel through the normal
 *     transit). Discovered ruins and hazards show; undiscovered ones show nothing at all. Region intel stays below.
 * Back (or Escape) steps out one stage; close leaves the map.
 */
export function WorldAtlas({ progression, currentRegion, phase, onClose, markers = [], px = 0, pz = 0, onProgression, onTravel }: { progression: PlayerProgression; currentRegion: string; phase: string; onClose: () => void; markers?: TrackedMarker[]; px?: number; pz?: number ; onProgression?: (next: PlayerProgression) => void; onTravel?: (a: Activity) => void }) {
  const [destId, setDestId] = useState<string | null>(null);
  const dest = destId ? destinationById(destId) ?? null : null;
  const here = REGIONS.find((r) => r.name === currentRegion)?.id;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && destId) { e.preventDefault(); e.stopPropagation(); setDestId(null); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [destId]);
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-background/95 text-foreground" role="dialog" aria-modal="true" aria-label="Destination director">
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-7">
      <header className="flex items-start justify-between gap-4 border-b border-foreground/15 pb-5">
        <div><p className="ui-kicker">Director / The Fractured Earth / {phase}</p><h2 className="mt-1 font-mono text-3xl font-light uppercase sm:text-4xl">{dest ? dest.name : "Destinations"}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{dest ? `${dest.sub}${dest.difficulty ? ` · Risk ${dest.difficulty}` : ""}${dest.city ? ` · part of ${REGIONS.find((r) => r.id === dest.regionId)?.name}` : ""}` : "Pick a destination to see its missions, patrols, bosses and safe zones"}</p></div>
        <div className="flex gap-1">{dest && <Button variant="outline" className="rounded-none" onClick={() => setDestId(null)} aria-label="Back to destinations"><ArrowLeft />Destinations</Button>}<Button size="icon" variant="ghost" onClick={onClose} aria-label="Close world map"><X /></Button></div>
      </header>
      {!dest ? <DestinationOverview progression={progression} here={here} px={px} pz={pz} onPick={setDestId} />
        : <DestinationView key={dest.id} dest={dest} progression={progression} phase={phase} markers={markers} px={px} pz={pz} onProgression={onProgression} onTravel={onTravel} onClose={onClose} />}
    </div>
  </div>;
}

const CITY_R = MAP_EXTENT * 0.016;

/** stage 1: every destination on the live terrain map (exact world positions) and as a list */
function DestinationOverview({ progression, here, px, pz, onPick }: { progression: PlayerProgression; here: string | undefined; px: number; pz: number; onPick: (id: string) => void }) {
  const map = useTerrainMap();
  const counts = useMemo(() => Object.fromEntries(DESTINATIONS.map((d) => [d.id, destinationActivities(progression, d).filter((a) => a.status !== "DONE" && a.status !== "LOCKED").length])), [progression]);
  const cities = DESTINATIONS.filter((d) => d.city);
  return <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(18rem,0.7fr)]">
    <section className="min-w-0">
      {!map.full && <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground" role="status">Surveying terrain… {Math.round(map.progress * 100)}%</p>}
      <svg viewBox={MAP_VIEWBOX} className="w-full border border-border" style={{ background: MAP_OCEAN_EDGE }} role="group" aria-label="Destinations map: choose a region or city">
        <MapLayers art={map.url} preview={!map.full} selected={here ?? ""} onSelect={onPick}>
          {cities.map((c) => <g key={c.id} className="cursor-pointer outline-none" tabIndex={0} role="button" aria-label={`Open ${c.name}`} onClick={() => onPick(c.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(c.id); } }}>
            <title>{`${c.name} · ${c.sub}`}</title>
            <circle cx={c.x} cy={c.z} r={CITY_R * 2.2} fill="none" stroke="#66e0ff" strokeOpacity={0.7} strokeWidth={CITY_R * 0.18} />
            <rect x={c.x - CITY_R} y={c.z - CITY_R} width={CITY_R * 2} height={CITY_R * 2} transform={`rotate(45 ${c.x} ${c.z})`} fill="#66e0ff" stroke="#06101f" strokeWidth={CITY_R * 0.25} />
            <text x={c.x} y={c.z + CITY_R * 4.4} textAnchor="middle" fontSize={MAP_FONT * 0.8} fontWeight={700} fill="#cdf6ff" stroke="#06101f" strokeWidth={MAP_FONT * 0.18} paintOrder="stroke" className="font-mono">{c.name.toUpperCase()}</text>
          </g>)}
          <circle cx={px} cy={pz} r={MAP_EXTENT * 0.009} fill="#ffffff" stroke="#000000" strokeWidth={MAP_EXTENT * 0.003} />
        </MapLayers>
      </svg>
      <p className="mt-2 text-xs text-muted-foreground">Regions are circles, cities diamonds. Your position is the white dot.</p>
    </section>
    <aside className="min-w-0">
      <div className="mb-4"><NextActivityCard progression={progression} /></div>
      <p className="font-mono text-xs uppercase text-primary">Choose your destination</p>
      <ul className="mt-2 space-y-1">{DESTINATIONS.map((d) => <li key={d.id}><button type="button" onClick={() => onPick(d.id)} className={`ui-focus flex w-full items-center justify-between gap-2 border bg-background/60 px-3 py-2 text-left hover:border-primary ${d.city ? "border-cyan-700/60" : "border-foreground/15"}`}>
        <span className="min-w-0"><strong className="block truncate text-sm">{d.city ? "◆ " : ""}{d.name}{d.id === here ? " · you are here" : ""}</strong><small className="block truncate text-muted-foreground">{d.sub}</small></span>
        <span className="shrink-0 font-mono text-[10px] uppercase" style={{ color: d.accent ?? "#66e0ff" }}>{d.difficulty ? `Risk ${d.difficulty} · ` : ""}{counts[d.id]} open →</span>
      </button></li>)}</ul>
    </aside>
  </div>;
}

/** stage 2: one destination */
function DestinationView({ dest, progression, phase, markers, px, pz, onProgression, onTravel, onClose }: { dest: Destination; progression: PlayerProgression; phase: string; markers: TrackedMarker[]; px: number; pz: number; onProgression?: ((next: PlayerProgression) => void) | undefined; onTravel?: ((a: Activity) => void) | undefined; onClose: () => void }) {
  const region = REGIONS.find((r) => r.id === dest.regionId)!;
  const encounter = ENCOUNTERS.find((e) => e.regionId === dest.regionId);
  const [filter, setFilter] = useState<DirectorFilter>("ALL");
  const [pick, setPick] = useState<string | null>(null);
  const acts = useMemo(() => destinationActivities(progression, dest), [progression, dest]);
  const shown = acts.filter((a) => matchesFilter(a, filter));
  const sites = useMemo(() => discoveredSites(progression, dest), [progression, dest]);
  const present = DIRECTOR_FILTERS.filter((f) => f === "ALL" || acts.some((a) => matchesFilter(a, f)));
  const focus = { x: dest.x, z: dest.z, radius: dest.reach ?? region.radius };
  return <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(18rem,0.7fr)]">
    <section className="min-w-0">
      <TacticalMap markers={markers} px={px} pz={pz} selected={region.id} onSelect={() => {}} progression={progression} focus={focus} activities={shown} sites={sites} pickedActivity={pick} onActivity={(id) => { setPick(id); }} />
      <MapLegend phase={phase} />
    </section>
    <aside className="min-w-0">
      <p className="ui-kicker">Show</p>
      <div className="mt-1 flex flex-wrap gap-1" role="group" aria-label="Activity filter">{present.map((f) => <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} aria-pressed={filter === f} className="rounded-none font-mono text-[10px] uppercase" onClick={() => { setFilter(f); setPick(null); }}>{FILTER_LABEL[f]}</Button>)}</div>
      {onProgression && onTravel && <div className="mt-3 border border-border p-3"><ActivityPanel progression={progression} regionId={dest.regionId} activities={shown} pickId={pick} onPick={setPick} onProgression={onProgression} onLaunch={onTravel} launchLabel="Travel" /></div>}
      {sites.length > 0 && <div className="mt-4"><p className="ui-kicker text-violet-300">Discovered sites</p><ul className="mt-1 space-y-1.5">{sites.map((l) => <li key={l.id} className="border-l-2 border-violet-400 pl-2 text-xs"><b>{LANDMARK_GLYPH[l.type]} {l.name}</b><span className="block text-muted-foreground">{l.history}</span></li>)}</ul></div>}
      <div className="mt-5 border-t border-border pt-5">
        <p className="font-mono text-xs uppercase text-primary">{ZONE_LABEL[dest.kind]}{dest.difficulty ? ` · Risk ${dest.difficulty}` : ""}</p>
        {dest.city ? <ul className="mt-2 space-y-1 text-xs text-muted-foreground">{CITY_DESTINATIONS.find((c) => c.id === dest.id)?.rules.map((r) => <li key={r}>· {r}</li>)}</ul>
          : <p className="mt-2 border-l-2 border-primary/60 pl-3 text-xs">{regionHistory(region.id)}</p>}
        {!dest.city && <div className="mt-3"><p className="ui-kicker">Landmarks · {discoveredCount(progression)}/{LANDMARKS.length} found</p><ul className="mt-1 space-y-1.5">{regionStory(progression, region.id).map(({ landmark, known }) => <li key={landmark.id} className={`text-xs ${known ? "" : "opacity-50"}`}><span className="text-primary">{known ? LANDMARK_GLYPH[landmark.type] : "?"}</span> <b>{known ? landmark.name : "Undiscovered landmark"}</b>{known && <span className="block text-muted-foreground">{landmark.history}</span>}</li>)}</ul></div>}
        <Button className="mt-3 w-full justify-between rounded-none" onClick={onClose}><Navigation />Track destination<Crosshair /></Button>
        {!dest.city && <><div className="mt-5 flex items-center gap-2 text-xs uppercase text-primary"><Shield className="size-4" /> Field units</div><ul className="mt-2 divide-y divide-border">{encounter?.troops.map((troop) => <li key={troop.name} className="py-2"><strong className="block text-sm">{troop.name}</strong><span className="text-xs text-muted-foreground">{troop.role} · {troop.kind.toLowerCase()}</span></li>)}</ul>
        {encounter?.boss && <div className="mt-5 border-l-2 border-destructive pl-4"><p className="flex items-center gap-2 font-mono text-xs uppercase text-destructive"><Skull className="size-4" /> Dungeon boss</p><h4 className="mt-1 text-lg font-semibold">{encounter.boss.name}</h4><p className="text-xs text-muted-foreground">{encounter.boss.lair} · {encounter.boss.tell}</p><p className="mt-2 text-xs text-primary">Enter this region and press B to challenge the boss.</p></div>}</>}
      </div>
    </aside>
  </div>;
}
/** map sizes are authored in original-world units; positions are world units, so sizes grow with the map */
const u = (n: number) => n * WORLD_SCALE;
const fmt = (d: number) => (d >= 1000 ? `${(d / 1000).toFixed(1)}km` : `${Math.round(d)}m`);

/** atlas-only layers: every vendor and every fast-travel drop point (regions + cities), in world coordinates */
const VENDOR_MARKERS: Marker[] = REGIONAL_SHOPS.map((sh) => ({ id: `shop-${sh.id}`, kind: "VENDOR", label: `${sh.name} · ${SHOP_KIND_LABEL[sh.kind]}`, x: sh.x, z: sh.z, regionId: "" }));
const TRAVEL_MARKERS: Marker[] = [...REGIONS.filter((r) => r.kind !== "core").map((r) => ({ id: `drop-${r.id}`, name: r.name, ...dropPoint(r) })), ...CITY_DESTINATIONS.filter((c) => c.deployable).map((c) => ({ id: `drop-${c.id}`, name: c.name, ...dropPoint(c) }))]
  .map((d) => ({ id: d.id, kind: "TRAVEL" as const, label: `${d.name} drop point`, x: d.x, z: d.z, regionId: "" }));
/** one glyph per activity kind on the destination map (colour comes from ACTIVITY_COLOR) */
const ACTIVITY_GLYPH: Record<Activity["kind"], string> = { STORY: "★", SAFE_ZONE: "⛨", BOSS: "☠", NEMESIS: "☠", RESOURCE: "◆", CONTRACT: "✉", STASH: "▣", PATROL: "⟲", ACTIVITY: "◎" };
const LAYERS = ["WAYPOINT", "MISSION", "BOSS", "RUIN", "LANDMARK", "VENDOR", "TRAVEL", "RESOURCE"] as const;
const LAYER_NAME: Record<(typeof LAYERS)[number], string> = { WAYPOINT: "Waypoint", MISSION: "Missions", BOSS: "Bosses", RUIN: "Ruins", LANDMARK: "Landmarks", VENDOR: "Vendors", TRAVEL: "Fast travel", RESOURCE: "Resources" };
const [VB_X, VB_Y, VB_W] = MAP_VIEWBOX.split(" ").map(Number) as [number, number, number, number];

/** Live tactical map: zoom (wheel / buttons), drag to pan, layer filters, and click any marker or point to set a
 * waypoint that the HUD compass and tracker follow (map-pin.ts). */
function TacticalMap({ markers, px, pz, selected, onSelect, progression, focus, activities = [], sites = [], pickedActivity, onActivity }: { markers: TrackedMarker[]; px: number; pz: number; selected: string; onSelect: (id: string) => void; progression: PlayerProgression;
  /** open centred on this area (a destination), fitted to its radius */
  focus?: { x: number; z: number; radius: number };
  /** the destination's activities, drawn as rings in their kind's colour; clicking one picks it in the side panel */
  activities?: Activity[]; sites?: Landmark[]; pickedActivity?: string | null; onActivity?: (id: string) => void }) {
  // the map shows the whole painted continent (terrain-map.ts), not just the region circles
  const map = useTerrainMap();
  // a destination view draws its own activity rings, so the HUD's mission and boss markers would sit on top of them twice
  const [legend, setLegend] = useState<Record<(typeof LAYERS)[number], boolean>>({ WAYPOINT: true, MISSION: !focus, RESOURCE: false, BOSS: !focus, RUIN: true, LANDMARK: true, VENDOR: true, TRAVEL: true });
  const [hazards, setHazards] = useState(true);
  const pin = useSyncExternalStore(subscribePin, getPin, () => null);
  // view: centre + zoom in world units (zoom 1 = whole map)
  const clampView = (v: { cx: number; cz: number; zoom: number }) => { const z = Math.min(12, Math.max(1, v.zoom)); const half = VB_W / z / 2; const lo = VB_X + half, hi = VB_X + VB_W - half; return { zoom: z, cx: Math.min(hi, Math.max(lo, v.cx)), cz: Math.min(hi, Math.max(lo, v.cz)) }; };
  const fit = (f: { x: number; z: number; radius: number }) => clampView({ cx: f.x, cz: f.z, zoom: VB_W / (Math.max(40, f.radius) * 2.6) });
  const [view, setView] = useState(() => (focus ? fit(focus) : { cx: VB_X + VB_W / 2, cz: VB_Y + VB_W / 2, zoom: 1 }));
  const span = VB_W / view.zoom;
  const vb = `${view.cx - span / 2} ${view.cz - span / 2} ${span} ${span}`;
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number; cx: number; cz: number; moved: boolean } | null>(null);
  const toWorld = (clientX: number, clientY: number) => { const r = svgRef.current!.getBoundingClientRect(); return { x: view.cx - span / 2 + ((clientX - r.left) / r.width) * span, z: view.cz - span / 2 + ((clientY - r.top) / r.height) * span }; };
  const zoomBy = (k: number, at?: { x: number; z: number }) => setView((v) => { const z = Math.min(12, Math.max(1, v.zoom * k)); const f = at ? 1 - v.zoom / z : 0; return clampView({ zoom: z, cx: v.cx + (at ? (at.x - v.cx) * f : 0), cz: v.cz + (at ? (at.z - v.cz) * f : 0) }); });
  // wheel zoom toward the cursor; a native non-passive listener so the page itself doesn't scroll
  const zoomRef = useRef(zoomBy); zoomRef.current = zoomBy;
  const worldRef = useRef(toWorld); worldRef.current = toWorld;
  useEffect(() => {
    const el = svgRef.current; if (!el) return;
    const onWheel = (e: WheelEvent) => { e.preventDefault(); zoomRef.current(e.deltaY < 0 ? 1.25 : 0.8, worldRef.current(e.clientX, e.clientY)); };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);
  const known = (id: string) => isLandmarkKnown(progression, id);
  const hz = useMemo(() => HAZARD_ZONES.map((z) => ({ z, c: zoneCenter(z, performance.now() / 1000) })).filter(({ z }) => known(z.landmarkId)), [progression.earnedRewards]);
  const live: TrackedMarker[] = useMemo(() => {
    const extra = [...VENDOR_MARKERS, ...TRAVEL_MARKERS].map((m) => ({ ...m, dist: Math.hypot(m.x - px, m.z - pz), bearing: 0 }));
    return [...markers.filter((m) => m.kind !== "WAYPOINT"), ...extra];
  }, [markers, px, pz]);
  const scaleK = WORLD_SCALE / Math.sqrt(view.zoom);
  // marker names only past this zoom: a focused destination opens already zoomed in (a city at ~5x), where every
  // shop, drop point and activity name at once piled into one unreadable stack
  const labelZoom = focus ? Math.max(3, fit(focus).zoom * 1.8) : 3; // markers shrink a little as you zoom so they don't cover the detail
  const pickPin = (m: Marker) => setPin(getPin()?.id === m.id ? null : pinFromMarker(m));
  const pickActivity = (a: Activity) => { onActivity?.(a.id); setPin({ id: `act-${a.id}`, label: a.name, x: a.x, z: a.z, source: "MISSION" }); };
  // inspect panel: the marker last clicked or focused from the keyboard (Tab through markers, Enter toggles the waypoint)
  const [inspectId, setInspectId] = useState<string | null>(null);
  const inspected = inspectId ? live.find((m) => m.id === inspectId) ?? null : null;
  const fullWorld = () => setView({ cx: VB_X + VB_W / 2, cz: VB_Y + VB_W / 2, zoom: 1 });
  const focusRegion = () => { if (focus) { setView(fit(focus)); return; } const r = REGIONS.find((e) => e.id === selected); if (r) setView(clampView({ cx: r.x, cz: r.z, zoom: VB_W / (r.radius * 2.6) })); };
  const centreOn = (x: number, z: number) => setView((v) => clampView({ ...v, cx: x, cz: z, zoom: Math.max(v.zoom, 3) }));
  // keyboard on the map itself: arrows pan, +/- zoom, 0 resets to the full world
  const onMapKey = (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) return;
    const step = span * 0.12;
    const pan = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (pan) { e.preventDefault(); setView((v) => clampView({ ...v, cx: v.cx + pan[0]!, cz: v.cz + pan[1]! })); }
    else if (e.key === "+" || e.key === "=") { e.preventDefault(); zoomBy(1.5); }
    else if (e.key === "-") { e.preventDefault(); zoomBy(1 / 1.5); }
    else if (e.key === "0") { e.preventDefault(); fullWorld(); }
  };
  return <div>
    {!map.full && <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground" role="status">Surveying terrain… {Math.round(map.progress * 100)}%</p>}
    <div className="mb-2 flex flex-wrap gap-2 text-xs">{LAYERS.map((k) => <Button key={k} size="sm" variant="ghost" aria-pressed={legend[k]} onClick={() => setLegend((l) => ({ ...l, [k]: !l[k] }))} className={`rounded-none border-b px-2 py-1 font-mono uppercase ${legend[k] ? "border-current" : "border-transparent opacity-40"}`} style={{ color: MARKER_COLOR[k] }}>{MARKER_GLYPH[k]} {LAYER_NAME[k]}</Button>)}<Button size="sm" variant="ghost" aria-pressed={hazards} onClick={() => setHazards((v) => !v)} className={`rounded-none border-b px-2 py-1 font-mono uppercase text-destructive ${hazards ? "border-current" : "border-transparent opacity-40"}`}>⚠ Hazards</Button></div>
    <div className="relative">
      <svg ref={svgRef} viewBox={vb} className="w-full touch-none border border-border" style={{ background: MAP_OCEAN_EDGE, cursor: drag.current ? "grabbing" : "crosshair" }} role="group" tabIndex={0} onKeyDown={onMapKey} aria-label="Tactical map: drag or arrow keys to pan, scroll or plus/minus to zoom, Tab to the markers and press Enter to set a waypoint, double-click to drop a custom waypoint"
        onPointerDown={(e) => { drag.current = { x: e.clientX, y: e.clientY, cx: view.cx, cz: view.cz, moved: false }; (e.target as Element).setPointerCapture?.(e.pointerId); }}
        onPointerMove={(e) => { const d = drag.current; if (!d) return; const r = svgRef.current!.getBoundingClientRect(); const dx = ((e.clientX - d.x) / r.width) * span, dz = ((e.clientY - d.y) / r.height) * span; if (Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) > 4) d.moved = true; setView((v) => clampView({ ...v, cx: d.cx - dx, cz: d.cz - dz })); }}
        onPointerUp={() => { drag.current = null; }}
        onDoubleClick={(e) => { const w = toWorld(e.clientX, e.clientY); setPin(pinAt(w.x, w.z)); }}>
        <MapLayers art={map.url} preview={!map.full} selected={selected} onSelect={onSelect} labelScale={1 / Math.sqrt(view.zoom)}>
        {legend.LANDMARK && landmarkRoutes().filter((r) => known(r.a.id) && known(r.b.id)).map((r) => <line key={`${r.a.id}-${r.b.id}`} x1={r.a.x} y1={r.a.z} x2={r.b.x} y2={r.b.z} stroke="#9fd4ff" strokeOpacity={0.7} strokeWidth={u(0.6)} strokeDasharray={`${u(0.8)} ${u(1.4)}`} strokeLinecap="round" />)}
        {hazards && hz.map(({ z, c }) => <g key={z.id}><title>{`${z.name} · ${z.hint}`}</title><circle cx={c.x} cy={c.z} r={z.radius} fill="#ff4d4d" fillOpacity={0.14} stroke="#ff4d4d" strokeWidth={u(0.6)} strokeDasharray={`${u(1.6)} ${u(1.2)}`} /><g transform={`translate(${c.x} ${c.z}) scale(${WORLD_SCALE})`}><text y={1.6} textAnchor="middle" fontSize={5} fill="#ff8a8a" stroke="#000" strokeWidth={0.8} paintOrder="stroke">⚠</text></g></g>)}
        {live.filter((m) => legend[m.kind as (typeof LAYERS)[number]]).map((m) => <g key={m.id} transform={`translate(${m.x} ${m.z}) scale(${scaleK})`} className="cursor-pointer outline-none" tabIndex={0} role="button" aria-label={`${LAYER_NAME[m.kind as (typeof LAYERS)[number]] ?? m.kind}: ${m.label}, ${fmt(m.dist)}${pin?.id === m.id ? ", current waypoint" : ""}`} aria-pressed={pin?.id === m.id}
          onFocus={() => setInspectId(m.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); pickPin(m); } }}
          onPointerUp={(e) => { if (drag.current?.moved) return; e.stopPropagation(); drag.current = null; setInspectId(m.id); pickPin(m); }}><title>{`${m.label} · ${fmt(m.dist)} — click to ${pin?.id === m.id ? "clear" : "set"} waypoint`}</title><g>{inspectId === m.id && <circle r={5} fill="none" stroke="#ffffff" strokeWidth={0.6} strokeDasharray="1.4 1" />}<circle r={4} fill="transparent" /><text y={m.kind === "LANDMARK" ? 1.8 : 1.9} textAnchor="middle" fontSize={m.kind === "LANDMARK" ? 5.5 : 5} fill={MARKER_COLOR[m.kind]} fillOpacity={m.ready === false ? 0.4 : 1} stroke={pin?.id === m.id ? "#ffffff" : "#000"} strokeWidth={pin?.id === m.id ? 1.4 : 0.9} paintOrder="stroke">{m.kind === "LANDMARK" ? LANDMARK_GLYPH[LANDMARKS.find((l) => `lm-${l.id}` === m.id)?.type ?? "outpost"] : MARKER_GLYPH[m.kind]}</text>{(m.kind === "LANDMARK" ? !focus || view.zoom >= labelZoom : view.zoom >= labelZoom) && <text y={6.4} textAnchor="middle" fontSize={3.2} fill="#ffffff" stroke="#000" strokeWidth={0.7} paintOrder="stroke">{m.label}</text>}</g></g>)}
        {sites.map((l) => <g key={`site-${l.id}`} transform={`translate(${l.x} ${l.z}) scale(${scaleK})`} pointerEvents="none"><title>{`Discovered site: ${l.name}`}</title><circle r={3.6} fill="#21112f" fillOpacity={0.85} stroke="#b98cff" strokeWidth={0.7} /><text y={1.7} textAnchor="middle" fontSize={4.4} fill="#d8c2ff">{LANDMARK_GLYPH[l.type]}</text>{view.zoom >= 2 && <text y={6.6} textAnchor="middle" fontSize={3} fill="#e6dcff" stroke="#000" strokeWidth={0.6} paintOrder="stroke">{l.name}</text>}</g>)}
        {activities.map((a) => { const on = pickedActivity === a.id; return <g key={`act-${a.id}`} transform={`translate(${a.x} ${a.z}) scale(${scaleK})`} className="cursor-pointer outline-none" tabIndex={0} role="button" aria-pressed={on} aria-label={`${ACTIVITY_LABEL[a.kind]}: ${a.name}${a.status === "LOCKED" ? ", locked" : ""}`}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); pickActivity(a); } }}
          onPointerUp={(e) => { if (drag.current?.moved) return; e.stopPropagation(); drag.current = null; pickActivity(a); }}>
          <title>{`${ACTIVITY_LABEL[a.kind]} · ${a.name}${a.status === "LOCKED" ? ` (${a.lockReason ?? "locked"})` : ""}`}</title>
          <circle r={on ? 5.2 : 4.2} fill="#061422" fillOpacity={0.8} stroke={ACTIVITY_COLOR[a.kind]} strokeOpacity={a.status === "LOCKED" ? 0.45 : 1} strokeWidth={on ? 1.4 : 0.9} />
          {on && <circle r={7} fill="none" stroke="#ffffff" strokeWidth={0.5} strokeDasharray="1.4 1" />}
          <text y={1.6} textAnchor="middle" fontSize={4.2} fill={ACTIVITY_COLOR[a.kind]} fillOpacity={a.status === "LOCKED" ? 0.5 : 1}>{a.status === "LOCKED" ? "🔒" : a.status === "DONE" ? "✓" : ACTIVITY_GLYPH[a.kind]}</text>
          {(on || view.zoom >= labelZoom * 0.8) && <text y={8} textAnchor="middle" fontSize={3.1} fill="#ffffff" stroke="#000" strokeWidth={0.6} paintOrder="stroke">{a.name}</text>}
        </g>; })}
        {pin && legend.WAYPOINT && <g transform={`translate(${pin.x} ${pin.z}) scale(${scaleK})`} pointerEvents="none"><line x1={(px - pin.x) / scaleK} y1={(pz - pin.z) / scaleK} x2={0} y2={0} stroke="#ffffff" strokeOpacity={0.55} strokeWidth={0.5} strokeDasharray="2 2" /><circle r={3.2} fill="none" stroke="#ffffff" strokeWidth={0.8} /><text y={1.8} textAnchor="middle" fontSize={5} fill="#ffffff" stroke="#000" strokeWidth={0.9} paintOrder="stroke">{MARKER_GLYPH.WAYPOINT}</text></g>}
        <circle cx={px} cy={pz} r={u(2.6) / Math.sqrt(view.zoom)} fill="#ffffff" stroke="#000000" strokeWidth={u(0.6) / Math.sqrt(view.zoom)} />
        </MapLayers>
      </svg>
      <div className="absolute right-2 top-2 flex flex-col gap-1">
        <Button size="icon" variant="outline" aria-label="Zoom in" onClick={() => zoomBy(1.5)}>+</Button>
        <Button size="icon" variant="outline" aria-label="Zoom out" onClick={() => zoomBy(1 / 1.5)}>−</Button>
        <Button size="icon" variant="outline" aria-label="Centre on you" title="Centre on you" onClick={() => centreOn(px, pz)}><Crosshair /></Button>
        <Button size="icon" variant="outline" aria-label="Focus selected region" title="Focus selected region" onClick={focusRegion}><Focus /></Button>
        <Button size="icon" variant="outline" aria-label="Full world" title="Full world" onClick={fullWorld}><Globe2 /></Button>
      </div>
      <p className="absolute bottom-2 left-2 font-mono text-[10px] uppercase tracking-widest text-foreground/80" style={{ textShadow: "0 0 4px #000" }}>{Math.round(view.zoom * 100)}% · drag to pan · click a marker or double-click the map for a waypoint</p>
    </div>
    {inspected && <div className="mt-2 border-l-2 bg-card/40 px-2 py-2 text-xs" style={{ borderColor: MARKER_COLOR[inspected.kind] }} aria-live="polite">
      <div className="flex items-start justify-between gap-2"><div><span className="ui-kicker" style={{ color: MARKER_COLOR[inspected.kind] }}>{MARKER_GLYPH[inspected.kind]} {LAYER_NAME[inspected.kind as (typeof LAYERS)[number]] ?? inspected.kind}</span><p className="mt-0.5 text-sm font-semibold">{inspected.label}</p><p className="text-muted-foreground">{fmt(inspected.dist)} from you{inspected.ready === false ? " · not available yet" : ""}</p></div>
        <Button size="icon" variant="ghost" aria-label="Close marker details" onClick={() => setInspectId(null)}><X /></Button></div>
      <div className="mt-2 flex flex-wrap gap-1"><Button size="sm" variant={pin?.id === inspected.id ? "outline" : "default"} onClick={() => pickPin(inspected)}>{pin?.id === inspected.id ? "Clear waypoint" : "Set waypoint"}</Button><Button size="sm" variant="outline" onClick={() => centreOn(inspected.x, inspected.z)}>Centre on map</Button></div>
    </div>}
    {pin && <div className="mt-2 flex items-center justify-between border-l-2 border-white bg-card/40 px-2 py-1 text-xs"><span><span className="ui-kicker">Waypoint</span> {pin.label} · {fmt(Math.hypot(pin.x - px, pin.z - pz))}</span><Button size="sm" variant="ghost" onClick={() => setPin(null)}>Clear</Button></div>}
    {!focus && <ul className="mt-3 grid gap-1 text-xs sm:grid-cols-2">{live.filter((m) => legend[m.kind as (typeof LAYERS)[number]] && m.kind !== "RESOURCE" && m.kind !== "LANDMARK" && m.kind !== "TRAVEL").sort((a, b) => a.dist - b.dist).slice(0, 8).map((m) => <li key={m.id}><button type="button" onClick={() => { setInspectId(m.id); pickPin(m); }} className="ui-focus flex w-full justify-between border-l-2 bg-card/40 px-2 py-1 text-left hover:bg-card/70" style={{ borderColor: MARKER_COLOR[m.kind] }}><span>{pin?.id === m.id ? "⌖ " : ""}{m.label}</span><span className="text-muted-foreground">{fmt(m.dist)}</span></button></li>)}</ul>}
  </div>;
}
