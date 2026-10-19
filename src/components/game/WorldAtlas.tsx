import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Crosshair, Focus, Globe2, MapPin, Navigation, Shield, Skull, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { REGIONS, ZONE_LABEL, WORLD_SCALE } from "@/game/world";
import { MAP_OCEAN_EDGE } from "@/game/terrain-map";
import { ENCOUNTERS } from "@/game/encounters";
import { MARKER_COLOR, type Marker, type TrackedMarker } from "@/game/waypoints";
import { getPin, pinAt, pinFromMarker, setPin, subscribePin } from "@/game/map-pin";
import { REGIONAL_SHOPS, SHOP_KIND_LABEL } from "@/game/regional-shops";
import { CITY_DESTINATIONS, dropPoint } from "@/game/destinations";
import type { PlayerProgression } from "@/game/progression";
import { NextActivityCard } from "./NextActivityCard";
import { ActivityPanel } from "./ActivityPanel";
import type { Activity } from "@/game/map-activities";
import { MAP_VIEWBOX, MapLayers } from "./MapLayers";
import { useTerrainMap } from "./useTerrainMap";
import { MapLegend } from "./MapLegend";
import { LANDMARK_GLYPH, MARKER_GLYPH } from "@/game/map-symbols";
import { LANDMARKS, landmarkRoutes, isLandmarkKnown } from "@/game/landmarks";
import { HAZARD_ZONES, zoneCenter } from "@/game/hazard-zones";
import { regionHistory, regionStory, discoveredCount } from "@/game/world-story";
import troopArt from "@/assets/regional-troops.jpg.asset.json";
import bossArt from "@/assets/regional-bosses.jpg.asset.json";
import factionArt from "@/assets/enemy-roster.jpg.asset.json";
// Cleaned-up cut of the concept map: same illustrated continent + legend, with the location-photo
// strips (top/bottom/left thumbnail rows) removed. Imported directly as a static asset rather than
// through the Lovable .asset.json indirection the other reference images use, since this file lives
// in the repo rather than Lovable's remote asset store.
import cleanMapArt from "@/assets/fractured-earth-map-v2.jpg";

export function WorldAtlas({ progression, currentRegion, phase, onClose, markers = [], px = 0, pz = 0, onProgression, onTravel }: { progression: PlayerProgression; currentRegion: string; phase: string; onClose: () => void; markers?: TrackedMarker[]; px?: number; pz?: number ; onProgression?: (next: PlayerProgression) => void; onTravel?: (a: Activity) => void }) {
  const [selected, setSelected] = useState(REGIONS.find((region) => region.name === currentRegion)?.id ?? "veridan");
  const region = REGIONS.find((entry) => entry.id === selected) ?? REGIONS[0];
  const encounter = ENCOUNTERS.find((entry) => entry.regionId === selected);
  const [gallery, setGallery] = useState<"TACTICAL" | "MAP" | "TROOPS" | "BOSSES" | "FACTIONS">("TACTICAL");
  const art = gallery === "TROOPS" ? troopArt : gallery === "BOSSES" ? bossArt : gallery === "FACTIONS" ? factionArt : null;
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-background/95 text-foreground" role="dialog" aria-modal="true" aria-label="World map">
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-7">
      <header className="flex items-start justify-between gap-4 border-b border-foreground/15 pb-5"><div><p className="ui-kicker">Director / The Fractured Earth / {phase}</p><h2 className="mt-1 font-mono text-3xl font-light sm:text-4xl">DESTINATIONS</h2></div><Button size="icon" variant="ghost" onClick={onClose} aria-label="Close world map"><X /></Button></header>
      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(18rem,0.7fr)]">
        <section className="min-w-0"><nav className="mb-3 flex flex-wrap gap-1" aria-label="Atlas artwork">{(["TACTICAL", "MAP", "TROOPS", "BOSSES", "FACTIONS"] as const).map((tab) => <Button key={tab} size="sm" variant={gallery === tab ? "default" : "outline"} onClick={() => setGallery(tab)}>{tab}</Button>)}</nav>{gallery === "TACTICAL" ? <TacticalMap markers={markers} px={px} pz={pz} selected={selected} onSelect={setSelected} progression={progression} /> : gallery === "MAP" ? <img src={cleanMapArt} alt="The Fractured Earth map showing seven regions, terrain and zone types" className="w-full border border-border object-contain" /> : <img src={art!.url} alt={`${gallery.toLowerCase()} concept reference`} className="w-full border border-border object-contain" />}{gallery === "TACTICAL" && <MapLegend phase={phase} />}<p className="mt-2 text-xs text-muted-foreground">{gallery === "MAP" ? "Regional routes and safe, war, fracture, and core zones" : "Field identification reference"}</p></section>
        <aside className="min-w-0"><div className="mb-4"><NextActivityCard progression={progression} /></div>{onProgression && onTravel && region && <div className="mb-5 border border-border p-3"><ActivityPanel key={region.id} progression={progression} regionId={region.id} onProgression={onProgression} onLaunch={onTravel} launchLabel="Fast travel" /></div>}<p className="font-mono text-xs uppercase text-primary">Regional intelligence</p><div className="mt-3 grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-2">{REGIONS.map((entry) => <Button key={entry.id} variant={selected === entry.id ? "default" : "outline"} onClick={() => setSelected(entry.id)} className="h-auto min-h-12 whitespace-normal text-left text-xs"><MapPin className="size-3 shrink-0" />{entry.name}</Button>)}</div>
          {region && <div className="mt-5 border-t border-border pt-5"><p className="font-mono text-xs uppercase text-primary">{ZONE_LABEL[region.kind]} · Risk {region.difficulty}</p><h3 className="mt-2 text-2xl font-semibold">{region.name}</h3><p className="mt-1 text-sm text-muted-foreground">{region.sub}</p><p className="mt-3 border-l-2 border-primary/60 pl-3 text-xs">{regionHistory(region.id)}</p><div className="mt-3"><p className="ui-kicker">Landmarks · {discoveredCount(progression)}/{LANDMARKS.length} found</p><ul className="mt-1 space-y-1.5">{regionStory(progression, region.id).map(({ landmark, known }) => <li key={landmark.id} className={`text-xs ${known ? "" : "opacity-50"}`}><span className="text-primary">{known ? LANDMARK_GLYPH[landmark.type] : "?"}</span> <b>{known ? landmark.name : "Undiscovered landmark"}</b>{known && <span className="block text-muted-foreground">{landmark.history}</span>}</li>)}</ul></div><div className="mt-4 grid grid-cols-2 gap-px bg-foreground/10"><span className="bg-background/70 p-3"><small className="ui-kicker block">Readiness</small><b className="text-sm">{region.difficulty <= 2 ? "READY" : "CAUTION"}</b></span><span className="bg-background/70 p-3"><small className="ui-kicker block">Activities</small><b className="text-sm">{markers.filter((item) => item.kind === "MISSION").length} SIGNALS</b></span></div><Button className="mt-3 w-full justify-between rounded-none" onClick={onClose}><Navigation />Track destination<Crosshair /></Button><div className="mt-5 flex items-center gap-2 text-xs uppercase text-primary"><Shield className="size-4" /> Field units</div><ul className="mt-2 divide-y divide-border">{encounter?.troops.map((troop) => <li key={troop.name} className="py-2"><strong className="block text-sm">{troop.name}</strong><span className="text-xs text-muted-foreground">{troop.role} · {troop.kind.toLowerCase()}</span></li>)}</ul>{encounter?.boss && <div className="mt-5 border-l-2 border-destructive pl-4"><p className="flex items-center gap-2 font-mono text-xs uppercase text-destructive"><Skull className="size-4" /> Dungeon boss</p><h4 className="mt-1 text-lg font-semibold">{encounter.boss.name}</h4><p className="text-xs text-muted-foreground">{encounter.boss.lair} · {encounter.boss.tell}</p><p className="mt-2 text-xs text-primary">Enter this region and press B to challenge the boss.</p></div>}</div>}
        </aside>
      </div>
    </div>
  </div>;
}
/** map sizes are authored in original-world units; positions are world units, so sizes grow with the map */
const u = (n: number) => n * WORLD_SCALE;
const fmt = (d: number) => (d >= 1000 ? `${(d / 1000).toFixed(1)}km` : `${Math.round(d)}m`);

/** atlas-only layers: every vendor and every fast-travel drop point (regions + cities), in world coordinates */
const VENDOR_MARKERS: Marker[] = REGIONAL_SHOPS.map((sh) => ({ id: `shop-${sh.id}`, kind: "VENDOR", label: `${sh.name} · ${SHOP_KIND_LABEL[sh.kind]}`, x: sh.x, z: sh.z, regionId: "" }));
const TRAVEL_MARKERS: Marker[] = [...REGIONS.filter((r) => r.kind !== "core").map((r) => ({ id: `drop-${r.id}`, name: r.name, ...dropPoint(r) })), ...CITY_DESTINATIONS.filter((c) => c.deployable).map((c) => ({ id: `drop-${c.id}`, name: c.name, ...dropPoint(c) }))]
  .map((d) => ({ id: d.id, kind: "TRAVEL" as const, label: `${d.name} drop point`, x: d.x, z: d.z, regionId: "" }));
const LAYERS = ["WAYPOINT", "MISSION", "BOSS", "RUIN", "LANDMARK", "VENDOR", "TRAVEL", "RESOURCE"] as const;
const LAYER_NAME: Record<(typeof LAYERS)[number], string> = { WAYPOINT: "Waypoint", MISSION: "Missions", BOSS: "Bosses", RUIN: "Ruins", LANDMARK: "Landmarks", VENDOR: "Vendors", TRAVEL: "Fast travel", RESOURCE: "Resources" };
const [VB_X, VB_Y, VB_W] = MAP_VIEWBOX.split(" ").map(Number) as [number, number, number, number];

/** Live tactical map: zoom (wheel / buttons), drag to pan, layer filters, and click any marker or point to set a
 * waypoint that the HUD compass and tracker follow (map-pin.ts). */
function TacticalMap({ markers, px, pz, selected, onSelect, progression }: { markers: TrackedMarker[]; px: number; pz: number; selected: string; onSelect: (id: string) => void; progression: PlayerProgression }) {
  // the map shows the whole painted continent (terrain-map.ts), not just the region circles
  const map = useTerrainMap();
  const [legend, setLegend] = useState<Record<(typeof LAYERS)[number], boolean>>({ WAYPOINT: true, MISSION: true, RESOURCE: false, BOSS: true, RUIN: true, LANDMARK: true, VENDOR: true, TRAVEL: true });
  const [hazards, setHazards] = useState(true);
  const pin = useSyncExternalStore(subscribePin, getPin, () => null);
  // view: centre + zoom in world units (zoom 1 = whole map)
  const [view, setView] = useState({ cx: VB_X + VB_W / 2, cz: VB_Y + VB_W / 2, zoom: 1 });
  const span = VB_W / view.zoom;
  const vb = `${view.cx - span / 2} ${view.cz - span / 2} ${span} ${span}`;
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number; cx: number; cz: number; moved: boolean } | null>(null);
  const clampView = (v: { cx: number; cz: number; zoom: number }) => { const z = Math.min(12, Math.max(1, v.zoom)); const half = VB_W / z / 2; const lo = VB_X + half, hi = VB_X + VB_W - half; return { zoom: z, cx: Math.min(hi, Math.max(lo, v.cx)), cz: Math.min(hi, Math.max(lo, v.cz)) }; };
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
  const scaleK = WORLD_SCALE / Math.sqrt(view.zoom); // markers shrink a little as you zoom so they don't cover the detail
  const pickPin = (m: Marker) => setPin(getPin()?.id === m.id ? null : pinFromMarker(m));
  // inspect panel: the marker last clicked or focused from the keyboard (Tab through markers, Enter toggles the waypoint)
  const [inspectId, setInspectId] = useState<string | null>(null);
  const inspected = inspectId ? live.find((m) => m.id === inspectId) ?? null : null;
  const fullWorld = () => setView({ cx: VB_X + VB_W / 2, cz: VB_Y + VB_W / 2, zoom: 1 });
  const focusRegion = () => { const r = REGIONS.find((e) => e.id === selected); if (r) setView(clampView({ cx: r.x, cz: r.z, zoom: VB_W / (r.radius * 2.6) })); };
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
        <MapLayers art={map.url} preview={!map.full} selected={selected} onSelect={onSelect}>
        {legend.LANDMARK && landmarkRoutes().filter((r) => known(r.a.id) && known(r.b.id)).map((r) => <line key={`${r.a.id}-${r.b.id}`} x1={r.a.x} y1={r.a.z} x2={r.b.x} y2={r.b.z} stroke="#9fd4ff" strokeOpacity={0.7} strokeWidth={u(0.6)} strokeDasharray={`${u(0.8)} ${u(1.4)}`} strokeLinecap="round" />)}
        {hazards && hz.map(({ z, c }) => <g key={z.id}><title>{`${z.name} · ${z.hint}`}</title><circle cx={c.x} cy={c.z} r={z.radius} fill="#ff4d4d" fillOpacity={0.14} stroke="#ff4d4d" strokeWidth={u(0.6)} strokeDasharray={`${u(1.6)} ${u(1.2)}`} /><g transform={`translate(${c.x} ${c.z}) scale(${WORLD_SCALE})`}><text y={1.6} textAnchor="middle" fontSize={5} fill="#ff8a8a" stroke="#000" strokeWidth={0.8} paintOrder="stroke">⚠</text></g></g>)}
        {live.filter((m) => legend[m.kind as (typeof LAYERS)[number]]).map((m) => <g key={m.id} transform={`translate(${m.x} ${m.z}) scale(${scaleK})`} className="cursor-pointer outline-none" tabIndex={0} role="button" aria-label={`${LAYER_NAME[m.kind as (typeof LAYERS)[number]] ?? m.kind}: ${m.label}, ${fmt(m.dist)}${pin?.id === m.id ? ", current waypoint" : ""}`} aria-pressed={pin?.id === m.id}
          onFocus={() => setInspectId(m.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); pickPin(m); } }}
          onPointerUp={(e) => { if (drag.current?.moved) return; e.stopPropagation(); drag.current = null; setInspectId(m.id); pickPin(m); }}><title>{`${m.label} · ${fmt(m.dist)} — click to ${pin?.id === m.id ? "clear" : "set"} waypoint`}</title><g>{inspectId === m.id && <circle r={5} fill="none" stroke="#ffffff" strokeWidth={0.6} strokeDasharray="1.4 1" />}<circle r={4} fill="transparent" /><text y={m.kind === "LANDMARK" ? 1.8 : 1.9} textAnchor="middle" fontSize={m.kind === "LANDMARK" ? 5.5 : 5} fill={MARKER_COLOR[m.kind]} fillOpacity={m.ready === false ? 0.4 : 1} stroke={pin?.id === m.id ? "#ffffff" : "#000"} strokeWidth={pin?.id === m.id ? 1.4 : 0.9} paintOrder="stroke">{m.kind === "LANDMARK" ? LANDMARK_GLYPH[LANDMARKS.find((l) => `lm-${l.id}` === m.id)?.type ?? "outpost"] : MARKER_GLYPH[m.kind]}</text>{(m.kind === "LANDMARK" || view.zoom >= 3) && <text y={6.4} textAnchor="middle" fontSize={3.2} fill="#ffffff" stroke="#000" strokeWidth={0.7} paintOrder="stroke">{m.label}</text>}</g></g>)}
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
    <ul className="mt-3 grid gap-1 text-xs sm:grid-cols-2">{live.filter((m) => legend[m.kind as (typeof LAYERS)[number]] && m.kind !== "RESOURCE" && m.kind !== "LANDMARK" && m.kind !== "TRAVEL").sort((a, b) => a.dist - b.dist).slice(0, 8).map((m) => <li key={m.id}><button type="button" onClick={() => { setInspectId(m.id); pickPin(m); }} className="ui-focus flex w-full justify-between border-l-2 bg-card/40 px-2 py-1 text-left hover:bg-card/70" style={{ borderColor: MARKER_COLOR[m.kind] }}><span>{pin?.id === m.id ? "⌖ " : ""}{m.label}</span><span className="text-muted-foreground">{fmt(m.dist)}</span></button></li>)}</ul>
  </div>;
}
