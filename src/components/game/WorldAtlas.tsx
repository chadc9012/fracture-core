import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ArrowLeft, Crosshair, Focus, Globe2, Navigation, Shield, Skull, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { REGIONS, ZONE_LABEL, WORLD_SCALE } from "@/game/world";
import { MAP_EXTENT, MAP_OCEAN_EDGE } from "@/game/terrain-map";
import { ENCOUNTERS } from "@/game/encounters";
import { MARKER_COLOR, type Marker, type TrackedMarker } from "@/game/waypoints";
import { getPin, pinAt, pinFromMarker, setPin, subscribePin } from "@/game/map-pin";
import { REGIONAL_SHOPS, SHOP_KIND_LABEL, shopLock } from "@/game/regional-shops";
import { CITY_DESTINATIONS, dropPoint } from "@/game/destinations";
import { DESTINATIONS, FILTER_LABEL, cityDistricts, destinationActivities, destinationById, destinationFleet, destinationGarages, destinationHomes, destinationResidences, destinationShops, destinationSummary, discoveredSites, matchesFilter, type CityDistrict, type Destination, type DestinationSummary, type DirectorFilter } from "@/game/destination-director";
import { GARAGES, buyFleetVehicle, buyGarage } from "@/game/fleet";
import { buyHome, ownsHome } from "@/game/housing";
import { nexBalance } from "@/game/nex";
import { MATERIALS, type MaterialId } from "@/game/inventory";
import type { Landmark } from "@/game/landmarks";
import type { PlayerProgression } from "@/game/progression";
import { NextActivityCard } from "./NextActivityCard";
import { ActivityPanel, KIND_GLYPH } from "./ActivityPanel";
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
      {!dest ? <DestinationOverview progression={progression} here={here} px={px} pz={pz} onPick={setDestId} onTravel={onTravel ? (a) => onTravel(a) : undefined} />
        : <DestinationView key={dest.id} dest={dest} progression={progression} phase={phase} markers={markers} px={px} pz={pz} onProgression={onProgression} onTravel={onTravel} onClose={onClose} />}
    </div>
  </div>;
}

const CITY_R = MAP_EXTENT * 0.016;
/** recommended level for a destination: its parent region's risk on the level curve (risk 1 = level 1, risk 5 = level 12) */
const recommendedLevel = (d: Destination) => { const risk = d.difficulty ?? REGIONS.find((r) => r.id === d.regionId)?.difficulty ?? 1; return Math.max(1, Math.round(1 + (risk - 1) * 2.75)); };
/** a travel request to a destination's own drop point, through the same transit as an activity launch */
const dropActivity = (d: Destination): Activity => {
  const city = CITY_DESTINATIONS.find((c) => c.id === d.id);
  return { id: `drop-${d.id}`, kind: "SAFE_ZONE", name: d.name, detail: d.sub, regionId: d.regionId, x: d.x, z: d.z, status: "AVAILABLE", drop: dropPoint(city ?? d) };
};
const COUNT_ROWS: { key: keyof DestinationSummary; label: string; glyph: string; color: string; filter?: DirectorFilter }[] = [
  { key: "story", label: "Story missions", glyph: "★", color: ACTIVITY_COLOR.STORY, filter: "STORY" },
  { key: "patrols", label: "Patrols", glyph: "⟲", color: ACTIVITY_COLOR.PATROL, filter: "PATROL" },
  { key: "safeZones", label: "Safe zones", glyph: "⛨", color: ACTIVITY_COLOR.SAFE_ZONE, filter: "SAFE_ZONE" },
  { key: "bosses", label: "Bosses", glyph: "☠", color: ACTIVITY_COLOR.BOSS, filter: "BOSS" },
  { key: "other", label: "Contracts & sites", glyph: "◎", color: ACTIVITY_COLOR.ACTIVITY, filter: "OTHER" },
  { key: "shops", label: "Shops", glyph: "¤", color: "#c79bff" },
  { key: "homes", label: "Homes", glyph: "⌂", color: "#e8c39e" },
  { key: "vehicles", label: "Vehicles", glyph: "⛟", color: "#66e0ff" },
];

/** stage 1: every destination on the live terrain map (exact world positions) and as a list; picking one shows its card */
function DestinationOverview({ progression, here, px, pz, onPick, onTravel }: { progression: PlayerProgression; here: string | undefined; px: number; pz: number; onPick: (id: string) => void; onTravel?: ((a: Activity) => void) | undefined }) {
  const map = useTerrainMap();
  const [sel, setSel] = useState<string>(here ?? "nexus");
  const chosen = destinationById(sel) ?? DESTINATIONS[0]!;
  const summary = useMemo(() => destinationSummary(progression, chosen), [progression, chosen]);
  const cities = DESTINATIONS.filter((d) => d.city);
  const choose = (id: string) => { if (id === sel) onPick(id); else setSel(id); }; // second click opens it
  return <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(18rem,0.7fr)] wf-director-in">
    <section className="min-w-0">
      {!map.full && <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground" role="status">Surveying terrain… {Math.round(map.progress * 100)}%</p>}
      <svg viewBox={MAP_VIEWBOX} className="w-full border border-border" style={{ background: MAP_OCEAN_EDGE }} role="group" aria-label="Destinations map: choose a region or city">
        <MapLayers art={map.url} preview={!map.full} selected={chosen.city ? chosen.regionId : chosen.id} onSelect={choose}>
          {cities.map((c) => { const on = c.id === sel; return <g key={c.id} className="cursor-pointer outline-none" tabIndex={0} role="button" aria-pressed={on} aria-label={`${c.name}${on ? ", selected — press again to open" : ""}`} onClick={() => choose(c.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(c.id); } }}>
            <title>{`${c.name} · ${c.sub}`}</title>
            <circle cx={c.x} cy={c.z} r={CITY_R * (on ? 2.8 : 2.2)} fill="none" stroke={on ? "#ffffff" : "#66e0ff"} strokeOpacity={on ? 0.95 : 0.7} strokeWidth={CITY_R * 0.18} className={on ? "wf-pulse" : undefined} />
            <rect x={c.x - CITY_R} y={c.z - CITY_R} width={CITY_R * 2} height={CITY_R * 2} transform={`rotate(45 ${c.x} ${c.z})`} fill={c.id === "thalassia" ? "#3ad7ff" : "#d36bff"} stroke="#06101f" strokeWidth={CITY_R * 0.25} />
            <text x={c.x} y={c.z + CITY_R * 4.4} textAnchor="middle" fontSize={MAP_FONT * 0.8} fontWeight={700} fill="#f4e8ff" stroke="#06101f" strokeWidth={MAP_FONT * 0.18} paintOrder="stroke" className="font-mono">{c.name.toUpperCase()}</text>
          </g>; })}
          <circle cx={px} cy={pz} r={MAP_EXTENT * 0.009} fill="#ffffff" stroke="#000000" strokeWidth={MAP_EXTENT * 0.003} />
        </MapLayers>
      </svg>
      <p className="mt-2 text-xs text-muted-foreground">Pick a region (circle) or city (diamond) to see its card; pick it again, or Open, to go in. White dot: you.</p>
    </section>
    <aside className="min-w-0 space-y-4">
      <DestinationCard dest={chosen} summary={summary} here={chosen.id === here} onOpen={() => onPick(chosen.id)} onTravel={onTravel ? () => onTravel(dropActivity(chosen)) : undefined} />
      <NextActivityCard progression={progression} />
      <div><p className="font-mono text-xs uppercase text-primary">All destinations</p>
        <ul className="mt-2 space-y-1">{DESTINATIONS.map((d) => <li key={d.id}><button type="button" onClick={() => choose(d.id)} aria-pressed={d.id === sel} className={`ui-focus flex w-full items-center justify-between gap-2 border px-3 py-2 text-left hover:border-primary ${d.id === sel ? "border-primary bg-primary/10" : d.city ? "border-cyan-700/60 bg-background/60" : "border-foreground/15 bg-background/60"}`}>
          <span className="min-w-0"><strong className="block truncate text-sm">{d.city ? "◆ " : ""}{d.name}{d.id === here ? " · you are here" : ""}</strong><small className="block truncate text-muted-foreground">{d.sub}</small></span>
          <span className="shrink-0 font-mono text-[10px] uppercase" style={{ color: d.accent ?? "#66e0ff" }}>Lv {recommendedLevel(d)}</span>
        </button></li>)}</ul></div>
    </aside>
  </div>;
}

/** the destination's headline card (reference: Destiny's destination summary): identity band, counts, open / travel */
function DestinationCard({ dest, summary, here, onOpen, onTravel }: { dest: Destination; summary: DestinationSummary; here: boolean; onOpen: () => void; onTravel?: (() => void) | undefined }) {
  const tint = dest.id === "neon-city" ? "#d36bff" : dest.id === "thalassia" ? "#3ad7ff" : dest.accent ?? "#66e0ff";
  return <div className="overflow-hidden border border-foreground/20" style={{ boxShadow: `0 0 34px ${tint}26` }} aria-live="polite">
    <div className="relative px-4 pb-3 pt-4" style={{ background: `linear-gradient(135deg, ${tint}66, #06101f 75%)` }}>
      <p className="ui-kicker" style={{ color: tint }}>{dest.city ? "City" : "Region"} · {ZONE_LABEL[dest.kind]}</p>
      <h3 className="font-mono text-2xl uppercase">{dest.name}</h3>
      <p className="text-xs text-foreground/80">{dest.sub}{dest.city ? ` · ${REGIONS.find((r) => r.id === dest.regionId)?.name}` : ""}</p>
      <p className="mt-1 font-mono text-[11px]">Recommended level <b style={{ color: tint }}>{recommendedLevel(dest)}</b></p>
    </div>
    <ul className="grid grid-cols-2 gap-px bg-foreground/10 text-xs">
      {COUNT_ROWS.filter((r) => summary[r.key] > 0).map((r) => <li key={r.key} className="flex items-center justify-between bg-background/80 px-3 py-1.5"><span><span style={{ color: r.color }}>{r.glyph}</span> {r.label}</span><b>{summary[r.key]}</b></li>)}
      {summary.dungeonsTotal > 0 && <li className="flex items-center justify-between bg-background/80 px-3 py-1.5"><span><span className="text-violet-300">◈</span> Dungeons</span><b>{summary.dungeonsFound}/{summary.dungeonsTotal}</b></li>}
    </ul>
    <div className="flex gap-px bg-foreground/10">
      <Button className="flex-1 rounded-none" onClick={onOpen}>Open {dest.city ? "city map" : "destination"}</Button>
      {onTravel && !here && <Button variant="outline" className="flex-1 rounded-none" onClick={onTravel}>Fast travel</Button>}
    </div>
  </div>;
}

type ViewTab = "ACTIVITIES" | "SHOPS" | "HOMES" | "VEHICLES";
const fmtCost = (cost: Partial<Record<MaterialId, number>>) => Object.entries(cost).map(([k, v]) => `${v} ${MATERIALS[k as MaterialId]?.name ?? k}`).join(" · ");

/** stage 2: one destination */
function DestinationView({ dest, progression, phase, markers, px, pz, onProgression, onTravel, onClose }: { dest: Destination; progression: PlayerProgression; phase: string; markers: TrackedMarker[]; px: number; pz: number; onProgression?: ((next: PlayerProgression) => void) | undefined; onTravel?: ((a: Activity) => void) | undefined; onClose: () => void }) {
  const region = REGIONS.find((r) => r.id === dest.regionId)!;
  const encounter = ENCOUNTERS.find((e) => e.regionId === dest.regionId);
  const [filter, setFilter] = useState<DirectorFilter>("ALL");
  const [tab, setTab] = useState<ViewTab>("ACTIVITIES");
  const [pick, setPick] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const acts = useMemo(() => destinationActivities(progression, dest), [progression, dest]);
  const shown = acts.filter((a) => matchesFilter(a, filter));
  const sites = useMemo(() => discoveredSites(progression, dest), [progression, dest]);
  const summary = useMemo(() => destinationSummary(progression, dest), [progression, dest]);
  const districts = useMemo(() => cityDistricts(dest), [dest]);
  const shops = useMemo(() => destinationShops(dest), [dest]);
  const homes = useMemo(() => destinationHomes(dest), [dest]);
  const walkIns = useMemo(() => destinationResidences(dest), [dest]);
  const garages = useMemo(() => destinationGarages(dest), [dest]);
  const fleet = useMemo(() => destinationFleet(dest), [dest]);
  const focus = { x: dest.x, z: dest.z, radius: dest.reach ?? region.radius };
  const tabs: ViewTab[] = ["ACTIVITIES", ...(shops.length ? ["SHOPS" as const] : []), ...(homes.length || walkIns.length ? ["HOMES" as const] : []), ...(garages.length ? ["VEHICLES" as const] : [])];
  const waypoint = (id: string, label: string, x: number, z: number) => { setPin({ id, label, x, z, source: "MAP" }); setNotice(`Waypoint set: ${label}`); };
  const travelTo = (id: string, name: string, x: number, z: number) => onTravel?.({ id, kind: "SAFE_ZONE", name, detail: "", regionId: dest.regionId, x, z, status: "AVAILABLE", drop: { x, z: z + 4 } });
  const act = <P,>(r: { progression: P; message: string } | { error: string }) => { if ("error" in r) setNotice(r.error); else { onProgression?.(r.progression as PlayerProgression); setNotice(r.message); } };
  const nex = nexBalance(progression.nexLedger);
  const fleetState = progression.fleet ?? { owned: [], garages: [], active: null };
  return <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(18rem,0.7fr)] wf-director-in">
    <section className="min-w-0">
      <TacticalMap markers={markers} px={px} pz={pz} selected={region.id} onSelect={() => {}} progression={progression} focus={focus} activities={tab === "ACTIVITIES" ? shown : []} sites={sites} districts={districts} pickedActivity={pick} onActivity={(id) => { setTab("ACTIVITIES"); setPick(id); }} />
      {/* folded here: on a narrow screen the full legend pushed the destination's tabs far below the map */}
      <details className="mt-2"><summary className="ui-focus cursor-pointer font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Map legend</summary><MapLegend phase={phase} /></details>
    </section>
    <aside className="min-w-0">
      <ul className="grid grid-cols-2 gap-px border border-foreground/15 bg-foreground/10 text-xs" aria-label="What's here">
        {COUNT_ROWS.filter((r) => summary[r.key] > 0).map((r) => { const on = r.filter ? filter === r.filter && tab === "ACTIVITIES" : tab === (r.key === "shops" ? "SHOPS" : r.key === "homes" ? "HOMES" : "VEHICLES");
          return <li key={r.key}><button type="button" aria-pressed={on} onClick={() => { setPick(null); setNotice(""); if (r.filter) { setTab("ACTIVITIES"); setFilter(on ? "ALL" : r.filter); } else setTab(on ? "ACTIVITIES" : r.key === "shops" ? "SHOPS" : r.key === "homes" ? "HOMES" : "VEHICLES"); }}
            className={`ui-focus flex w-full items-center justify-between px-3 py-1.5 text-left ${on ? "bg-primary/20" : "bg-background/80 hover:bg-background/60"}`}><span><span style={{ color: r.color }}>{r.glyph}</span> {r.label}</span><b>{summary[r.key]}</b></button></li>; })}
        {summary.dungeonsTotal > 0 && <li className="flex items-center justify-between bg-background/80 px-3 py-1.5"><span><span className="text-violet-300">◈</span> Dungeons</span><b>{summary.dungeonsFound}/{summary.dungeonsTotal}</b></li>}
      </ul>
      {tabs.length > 1 && <div className="mt-3 flex flex-wrap gap-1" role="tablist" aria-label="Destination sections">{tabs.map((t) => <Button key={t} size="sm" role="tab" aria-selected={tab === t} variant={tab === t ? "default" : "outline"} className="rounded-none font-mono text-[10px] uppercase" onClick={() => { setTab(t); setPick(null); setNotice(""); }}>{t === "ACTIVITIES" ? "Activities" : t === "SHOPS" ? "Shops" : t === "HOMES" ? "Real estate" : "Vehicles"}</Button>)}</div>}
      {notice && <p className="mt-2 text-xs text-primary" role="status">{notice}</p>}
      {tab === "ACTIVITIES" && <>
        {filter !== "ALL" && <button type="button" className="ui-focus mt-2 font-mono text-[10px] uppercase text-muted-foreground" onClick={() => setFilter("ALL")}>Showing {FILTER_LABEL[filter]} · show all ×</button>}
        {onProgression && onTravel && <div className="mt-3 border border-border p-3"><ActivityPanel progression={progression} regionId={dest.regionId} activities={shown} pickId={pick} onPick={setPick} onProgression={onProgression} onLaunch={onTravel} launchLabel="Travel" recommendedLevel={recommendedLevel(dest)} onWaypoint={(a) => waypoint(`act-${a.id}`, a.name, a.x, a.z)} /></div>}
        {sites.length > 0 && <div className="mt-4"><p className="ui-kicker text-violet-300">Discovered dungeons & sites</p><ul className="mt-1 space-y-1.5">{sites.map((l) => <li key={l.id} className="border-l-2 border-violet-400 pl-2 text-xs"><b>{LANDMARK_GLYPH[l.type]} {l.name}</b><span className="block text-muted-foreground">{l.history}</span><button type="button" className="ui-focus mt-0.5 text-[10px] uppercase text-violet-300" onClick={() => waypoint(`lm-${l.id}`, l.name, l.x, l.z)}>Add waypoint</button></li>)}</ul></div>}
      </>}
      {tab === "SHOPS" && <ul className="mt-3 space-y-2">{shops.map((sh) => { const lock = shopLock(sh, progression); return <li key={sh.id} className="border border-foreground/15 bg-background/60 p-3">
        <p className="ui-kicker text-violet-300">{SHOP_KIND_LABEL[sh.kind]}{districtOf(districts, sh.x, sh.z) ? ` · ${districtOf(districts, sh.x, sh.z)}` : ""}</p>
        <strong className="block text-sm">{sh.name}</strong><p className="text-xs text-muted-foreground">{sh.blurb} · pays in {MATERIALS[sh.currency]?.name ?? sh.currency}</p>
        {lock && <p className="mt-1 text-xs text-amber-400">{lock}</p>}
        <div className="mt-2 flex gap-1"><Button size="sm" variant="outline" className="rounded-none" onClick={() => waypoint(`shop-${sh.id}`, sh.name, sh.x, sh.z)}>Add waypoint</Button>{onTravel && <Button size="sm" className="rounded-none" onClick={() => travelTo(`shop-${sh.id}`, sh.name, sh.x, sh.z)}>Fast travel</Button>}</div>
      </li>; })}</ul>}
      {tab === "HOMES" && <div className="mt-3 space-y-2">
        <p className="text-xs text-muted-foreground">Bought with Nex at the property agent's rates · you have <b className="text-foreground">{nex.toLocaleString()} Nex</b>. Decorate an owned home from inside it.</p>
        <ul className="space-y-2">{homes.map((h) => { const owned = ownsHome(progression, h.id); return <li key={h.id} className="border border-foreground/15 bg-background/60 p-3">
          <p className="ui-kicker" style={{ color: "#e8c39e" }}>{h.kind.replace("_", " ").toLowerCase()} · {h.district}</p>
          <strong className="block text-sm">{h.name}</strong><p className="text-xs text-muted-foreground">{h.blurb} · {h.rooms.length} rooms</p>
          <div className="mt-2 flex items-center justify-between gap-2"><span className="font-mono text-xs text-amber-300">{h.price.toLocaleString()} Nex</span>
            {owned ? <span className="font-mono text-[10px] uppercase text-primary">Owned{progression.housing?.home === h.id ? " · home" : ""}</span>
              : <Button size="sm" className="rounded-none" disabled={!onProgression || nex < h.price} onClick={() => act(buyHome(progression, h.id))}>{nex < h.price ? "Not enough Nex" : "Buy"}</Button>}</div>
        </li>; })}</ul>
        {walkIns.length > 0 && <><p className="ui-kicker mt-3">Walk-in homes on the street · {walkIns.length}</p><ul className="space-y-1">{walkIns.map((r) => <li key={r.id} className="flex items-center justify-between gap-2 border border-foreground/10 bg-background/60 px-3 py-1.5 text-xs"><span>{r.style.replace(/^./, (c) => c.toUpperCase())}{districtOf(districts, r.x, r.z) ? ` · ${districtOf(districts, r.x, r.z)}` : ""}</span><button type="button" className="ui-focus font-mono text-[10px] uppercase text-primary" onClick={() => waypoint(r.id, `${r.style} home`, r.x, r.z)}>Visit</button></li>)}</ul><p className="text-[11px] text-muted-foreground">These are open to walk in; buying them comes with the property update.</p></>}
      </div>}
      {tab === "VEHICLES" && <div className="mt-3 space-y-2">
        {garages.map((gid) => { const g = GARAGES[gid], ownedBase = fleetState.garages.includes(gid); return <div key={gid}>
          <div className="border border-cyan-700/50 bg-background/60 p-3"><p className="ui-kicker text-cyan-300">Base · garage</p><strong className="block text-sm">{g.name}</strong><p className="text-xs text-muted-foreground">{g.blurb}</p>
            <div className="mt-2 flex items-center justify-between gap-2"><span className="font-mono text-[11px] text-amber-300">{fmtCost(g.cost)}</span>{ownedBase ? <span className="font-mono text-[10px] uppercase text-primary">Owned</span> : <Button size="sm" className="rounded-none" disabled={!onProgression} onClick={() => act(buyGarage(progression, gid))}>Buy base</Button>}</div></div>
          <ul className="mt-1 space-y-1">{fleet.filter((f) => f.garage === gid).map((f) => { const owned = fleetState.owned.includes(f.id); return <li key={f.id} className="border border-foreground/15 bg-background/60 p-3">
            <p className="ui-kicker">{f.category.toLowerCase()} · {f.ability}</p><strong className="block text-sm">{f.name}</strong><p className="text-xs text-muted-foreground">{f.hardpoints.join(" · ")}</p>
            <div className="mt-2 flex items-center justify-between gap-2"><span className="font-mono text-[11px] text-amber-300">{fmtCost(f.cost)}</span>
              {owned ? <span className="font-mono text-[10px] uppercase text-primary">{fleetState.active === f.id ? "Active" : "Owned"}</span> : <Button size="sm" className="rounded-none" disabled={!onProgression || !ownedBase} title={ownedBase ? undefined : `Needs the ${g.name}`} onClick={() => act(buyFleetVehicle(progression, f.id))}>{ownedBase ? "Buy" : "Needs base"}</Button>}</div>
          </li>; })}</ul>
        </div>; })}
      </div>}
      <div className="mt-5 border-t border-border pt-5">
        <p className="font-mono text-xs uppercase text-primary">{ZONE_LABEL[dest.kind]}{dest.difficulty ? ` · Risk ${dest.difficulty}` : ""} · Recommended level {recommendedLevel(dest)}</p>
        {dest.city ? <ul className="mt-2 space-y-1 text-xs text-muted-foreground">{CITY_DESTINATIONS.find((c) => c.id === dest.id)?.rules.map((r) => <li key={r}>· {r}</li>)}</ul>
          : <p className="mt-2 border-l-2 border-primary/60 pl-3 text-xs">{regionHistory(region.id)}</p>}
        {districts.length > 0 && <div className="mt-3"><p className="ui-kicker">Districts</p><ul className="mt-1 space-y-1">{districts.map((k) => <li key={k.id} className="flex items-center justify-between gap-2 text-xs"><span><span style={{ color: k.color }}>●</span> <b>{k.name}</b> <span className="text-muted-foreground">· {k.tagline}</span></span><button type="button" className="ui-focus shrink-0 font-mono text-[10px] uppercase text-primary" onClick={() => waypoint(`district-${k.id}`, k.name, k.x, k.z)}>Waypoint</button></li>)}</ul></div>}
        {!dest.city && <div className="mt-3"><p className="ui-kicker">Landmarks · {discoveredCount(progression)}/{LANDMARKS.length} found</p><ul className="mt-1 space-y-1.5">{regionStory(progression, region.id).map(({ landmark, known }) => <li key={landmark.id} className={`text-xs ${known ? "" : "opacity-50"}`}><span className="text-primary">{known ? LANDMARK_GLYPH[landmark.type] : "?"}</span> <b>{known ? landmark.name : "Undiscovered landmark"}</b>{known && <span className="block text-muted-foreground">{landmark.history}</span>}</li>)}</ul></div>}
        <Button className="mt-3 w-full justify-between rounded-none" onClick={onClose}><Navigation />Track destination<Crosshair /></Button>
        {!dest.city && <><div className="mt-5 flex items-center gap-2 text-xs uppercase text-primary"><Shield className="size-4" /> Field units</div><ul className="mt-2 divide-y divide-border">{encounter?.troops.map((troop) => <li key={troop.name} className="py-2"><strong className="block text-sm">{troop.name}</strong><span className="text-xs text-muted-foreground">{troop.role} · {troop.kind.toLowerCase()}</span></li>)}</ul>
        {encounter?.boss && <div className="mt-5 border-l-2 border-destructive pl-4"><p className="flex items-center gap-2 font-mono text-xs uppercase text-destructive"><Skull className="size-4" /> Dungeon boss</p><h4 className="mt-1 text-lg font-semibold">{encounter.boss.name}</h4><p className="text-xs text-muted-foreground">{encounter.boss.lair} · {encounter.boss.tell}</p><p className="mt-2 text-xs text-primary">Enter this region and press B to challenge the boss.</p></div>}</>}
      </div>
    </aside>
  </div>;
}
const districtOf = (ds: CityDistrict[], x: number, z: number) => ds.find((k) => Math.hypot(x - k.x, z - k.z) <= k.r)?.name;

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
function TacticalMap({ markers, px, pz, selected, onSelect, progression, focus, activities = [], sites = [], pickedActivity, onActivity, districts = [] }: { markers: TrackedMarker[]; px: number; pz: number; selected: string; onSelect: (id: string) => void; progression: PlayerProgression;
  /** open centred on this area (a destination), fitted to its radius */
  focus?: { x: number; z: number; radius: number };
  /** the destination's activities, drawn as rings in their kind's colour; clicking one picks it in the side panel */
  activities?: Activity[]; sites?: Landmark[]; pickedActivity?: string | null; onActivity?: (id: string) => void;
  /** a city's named districts, drawn as soft areas under the markers */
  districts?: CityDistrict[] }) {
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
        {districts.map((k) => <g key={`dist-${k.id}`} pointerEvents="none"><circle cx={k.x} cy={k.z} r={k.r} fill={k.color} fillOpacity={0.1} stroke={k.color} strokeOpacity={0.6} strokeWidth={u(0.35)} strokeDasharray={`${u(1.4)} ${u(1)}`} />
          <text x={k.x} y={k.z - k.r - u(1)} textAnchor="middle" fontSize={u(2.6) / Math.sqrt(view.zoom) * 1.6} fontWeight={700} fill={k.color} stroke="#06101f" strokeWidth={u(0.5) / Math.sqrt(view.zoom)} paintOrder="stroke" className="font-mono">{k.name.toUpperCase()}</text></g>)}
        {sites.map((l) => <g key={`site-${l.id}`} transform={`translate(${l.x} ${l.z}) scale(${scaleK})`} pointerEvents="none"><title>{`Discovered site: ${l.name}`}</title><circle r={3.6} fill="#21112f" fillOpacity={0.85} stroke="#b98cff" strokeWidth={0.7} /><text y={1.7} textAnchor="middle" fontSize={4.4} fill="#d8c2ff">{LANDMARK_GLYPH[l.type]}</text>{view.zoom >= 2 && <text y={6.6} textAnchor="middle" fontSize={3} fill="#e6dcff" stroke="#000" strokeWidth={0.6} paintOrder="stroke">{l.name}</text>}</g>)}
        {activities.map((a) => { const on = pickedActivity === a.id; return <g key={`act-${a.id}`} transform={`translate(${a.x} ${a.z}) scale(${scaleK})`} className="cursor-pointer outline-none" tabIndex={0} role="button" aria-pressed={on} aria-label={`${ACTIVITY_LABEL[a.kind]}: ${a.name}${a.status === "LOCKED" ? ", locked" : ""}`}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); pickActivity(a); } }}
          onPointerUp={(e) => { if (drag.current?.moved) return; e.stopPropagation(); drag.current = null; pickActivity(a); }}>
          <title>{`${ACTIVITY_LABEL[a.kind]} · ${a.name}${a.status === "LOCKED" ? ` (${a.lockReason ?? "locked"})` : ""}`}</title>
          <circle r={on ? 5.2 : 4.2} fill="#061422" fillOpacity={0.8} stroke={ACTIVITY_COLOR[a.kind]} strokeOpacity={a.status === "LOCKED" ? 0.45 : 1} strokeWidth={on ? 1.4 : 0.9} />
          {on && <circle r={7} fill="none" stroke="#ffffff" strokeWidth={0.5} strokeDasharray="1.4 1" />}
          <text y={1.6} textAnchor="middle" fontSize={4.2} fill={ACTIVITY_COLOR[a.kind]} fillOpacity={a.status === "LOCKED" ? 0.5 : 1}>{a.status === "LOCKED" ? "🔒" : a.status === "DONE" ? "✓" : KIND_GLYPH[a.kind]}</text>
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
