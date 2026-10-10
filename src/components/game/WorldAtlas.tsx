import { useMemo, useState } from "react";
import { Crosshair, MapPin, Navigation, Shield, Skull, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { REGIONS, ZONE_LABEL, WORLD_SCALE } from "@/game/world";
import { MAP_OCEAN_EDGE } from "@/game/terrain-map";
import { ENCOUNTERS } from "@/game/encounters";
import { MARKER_COLOR, type TrackedMarker } from "@/game/waypoints";
import type { PlayerProgression } from "@/game/progression";
import { NextActivityCard } from "./NextActivityCard";
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

export function WorldAtlas({ progression, currentRegion, phase, onClose, markers = [], px = 0, pz = 0 }: { progression: PlayerProgression; currentRegion: string; phase: string; onClose: () => void; markers?: TrackedMarker[]; px?: number; pz?: number }) {
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
        <aside className="min-w-0"><div className="mb-4"><NextActivityCard progression={progression} /></div><p className="font-mono text-xs uppercase text-primary">Regional intelligence</p><div className="mt-3 grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-2">{REGIONS.map((entry) => <Button key={entry.id} variant={selected === entry.id ? "default" : "outline"} onClick={() => setSelected(entry.id)} className="h-auto min-h-12 whitespace-normal text-left text-xs"><MapPin className="size-3 shrink-0" />{entry.name}</Button>)}</div>
          {region && <div className="mt-5 border-t border-border pt-5"><p className="font-mono text-xs uppercase text-primary">{ZONE_LABEL[region.kind]} · Risk {region.difficulty}</p><h3 className="mt-2 text-2xl font-semibold">{region.name}</h3><p className="mt-1 text-sm text-muted-foreground">{region.sub}</p><p className="mt-3 border-l-2 border-primary/60 pl-3 text-xs">{regionHistory(region.id)}</p><div className="mt-3"><p className="ui-kicker">Landmarks · {discoveredCount(progression)}/{LANDMARKS.length} found</p><ul className="mt-1 space-y-1.5">{regionStory(progression, region.id).map(({ landmark, known }) => <li key={landmark.id} className={`text-xs ${known ? "" : "opacity-50"}`}><span className="text-primary">{known ? LANDMARK_GLYPH[landmark.type] : "?"}</span> <b>{known ? landmark.name : "Undiscovered landmark"}</b>{known && <span className="block text-muted-foreground">{landmark.history}</span>}</li>)}</ul></div><div className="mt-4 grid grid-cols-2 gap-px bg-foreground/10"><span className="bg-background/70 p-3"><small className="ui-kicker block">Readiness</small><b className="text-sm">{region.difficulty <= 2 ? "READY" : "CAUTION"}</b></span><span className="bg-background/70 p-3"><small className="ui-kicker block">Activities</small><b className="text-sm">{markers.filter((item) => item.kind === "MISSION").length} SIGNALS</b></span></div><Button className="mt-3 w-full justify-between rounded-none" onClick={onClose}><Navigation />Track destination<Crosshair /></Button><div className="mt-5 flex items-center gap-2 text-xs uppercase text-primary"><Shield className="size-4" /> Field units</div><ul className="mt-2 divide-y divide-border">{encounter?.troops.map((troop) => <li key={troop.name} className="py-2"><strong className="block text-sm">{troop.name}</strong><span className="text-xs text-muted-foreground">{troop.role} · {troop.kind.toLowerCase()}</span></li>)}</ul>{encounter?.boss && <div className="mt-5 border-l-2 border-destructive pl-4"><p className="flex items-center gap-2 font-mono text-xs uppercase text-destructive"><Skull className="size-4" /> Dungeon boss</p><h4 className="mt-1 text-lg font-semibold">{encounter.boss.name}</h4><p className="text-xs text-muted-foreground">{encounter.boss.lair} · {encounter.boss.tell}</p><p className="mt-2 text-xs text-primary">Enter this region and press B to challenge the boss.</p></div>}</div>}
        </aside>
      </div>
    </div>
  </div>;
}
/** map sizes are authored in original-world units; positions are world units, so sizes grow with the map */
const u = (n: number) => n * WORLD_SCALE;
const fmt = (d: number) => (d >= 1000 ? `${(d / 1000).toFixed(1)}km` : `${Math.round(d)}m`);

/** Live tactical map: region footprints, player arrow, and every tracked mission, resource site and boss lair. */
function TacticalMap({ markers, px, pz, selected, onSelect, progression }: { markers: TrackedMarker[]; px: number; pz: number; selected: string; onSelect: (id: string) => void; progression: PlayerProgression }) {
  // the map shows the whole painted continent (terrain-map.ts), not just the region circles
  const map = useTerrainMap();
  const [legend, setLegend] = useState({ MISSION: true, RESOURCE: true, BOSS: true, RUIN: true, LANDMARK: true });
  const [hazards, setHazards] = useState(true);
  const known = (id: string) => isLandmarkKnown(progression, id);
  const hz = useMemo(() => HAZARD_ZONES.map((z) => ({ z, c: zoneCenter(z, performance.now() / 1000) })).filter(({ z }) => known(z.landmarkId)), [progression.earnedRewards]);
  return <div>
    {!map.full && <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground" role="status">Surveying terrain… {Math.round(map.progress * 100)}%</p>}
    <div className="mb-2 flex flex-wrap gap-2 text-xs">{(Object.keys(legend) as (keyof typeof legend)[]).map((k) => <Button key={k} size="sm" variant="ghost" onClick={() => setLegend((l) => ({ ...l, [k]: !l[k] }))} className={`rounded-none border-b px-2 py-1 font-mono uppercase ${legend[k] ? "border-current" : "border-transparent opacity-40"}`} style={{ color: MARKER_COLOR[k] }}>{MARKER_GLYPH[k]} {k === "MISSION" ? "Missions" : k === "RESOURCE" ? "Resources" : k === "RUIN" ? "Ruins" : k === "LANDMARK" ? "Landmarks" : "Bosses"}</Button>)}<Button size="sm" variant="ghost" onClick={() => setHazards((v) => !v)} className={`rounded-none border-b px-2 py-1 font-mono uppercase text-destructive ${hazards ? "border-current" : "border-transparent opacity-40"}`}>⚠ Hazards</Button></div>
    <svg viewBox={MAP_VIEWBOX} className="w-full border border-border" style={{ background: MAP_OCEAN_EDGE }} role="img" aria-label="Tactical map with markers">
      <MapLayers art={map.url} preview={!map.full} selected={selected} onSelect={onSelect}>
      {legend.LANDMARK && landmarkRoutes().filter((r) => known(r.a.id) && known(r.b.id)).map((r) => <line key={`${r.a.id}-${r.b.id}`} x1={r.a.x} y1={r.a.z} x2={r.b.x} y2={r.b.z} stroke="#9fd4ff" strokeOpacity={0.7} strokeWidth={u(0.6)} strokeDasharray={`${u(0.8)} ${u(1.4)}`} strokeLinecap="round" />)}
      {hazards && hz.map(({ z, c }) => <g key={z.id}><title>{`${z.name} · ${z.hint}`}</title><circle cx={c.x} cy={c.z} r={z.radius} fill="#ff4d4d" fillOpacity={0.14} stroke="#ff4d4d" strokeWidth={u(0.6)} strokeDasharray={`${u(1.6)} ${u(1.2)}`} /><g transform={`translate(${c.x} ${c.z}) scale(${WORLD_SCALE})`}><text y={1.6} textAnchor="middle" fontSize={5} fill="#ff8a8a" stroke="#000" strokeWidth={0.8} paintOrder="stroke">⚠</text></g></g>)}
      {markers.filter((m) => legend[m.kind]).map((m) => <g key={m.id} transform={`translate(${m.x} ${m.z}) scale(${WORLD_SCALE})`}><title>{`${m.label} · ${fmt(m.dist)}`}</title><g><text y={m.kind === "LANDMARK" ? 1.8 : 1.9} textAnchor="middle" fontSize={m.kind === "LANDMARK" ? 5.5 : 5} fill={MARKER_COLOR[m.kind]} fillOpacity={m.ready === false ? 0.4 : 1} stroke="#000" strokeWidth={0.9} paintOrder="stroke">{m.kind === "LANDMARK" ? LANDMARK_GLYPH[LANDMARKS.find((l) => `lm-${l.id}` === m.id)?.type ?? "outpost"] : MARKER_GLYPH[m.kind]}</text>{m.kind === "LANDMARK" && <text y={6.4} textAnchor="middle" fontSize={3.2} fill="#ffffff" stroke="#000" strokeWidth={0.7} paintOrder="stroke">{m.label}</text>}</g></g>)}
      <circle cx={px} cy={pz} r={u(2.6)} fill="#ffffff" stroke="#000000" strokeWidth={u(0.6)} />
      </MapLayers>
    </svg>
    <ul className="mt-3 grid gap-1 text-xs sm:grid-cols-2">{markers.filter((m) => legend[m.kind] && m.kind !== "RESOURCE" && m.kind !== "LANDMARK").slice(0, 8).map((m) => <li key={m.id} className="flex justify-between border-l-2 bg-card/40 px-2 py-1" style={{ borderColor: MARKER_COLOR[m.kind] }}><span>{m.label}</span><span className="text-muted-foreground">{fmt(m.dist)}</span></li>)}</ul>
  </div>;
}
