import { useState } from "react";
import { Crosshair, MapPin, Navigation, Shield, Skull, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { REGIONS, ZONE_COLOR, ZONE_LABEL } from "@/game/world";
import { ENCOUNTERS } from "@/game/encounters";
import { MARKER_COLOR, type TrackedMarker } from "@/game/waypoints";
import type { PlayerProgression } from "@/game/progression";
import { NextActivityCard } from "./NextActivityCard";
import troopArt from "@/assets/regional-troops.jpg.asset.json";
import bossArt from "@/assets/regional-bosses.jpg.asset.json";
import factionArt from "@/assets/enemy-roster.jpg.asset.json";
// Cleaned-up cut of the concept map: same illustrated continent + legend, with the location-photo
// strips (top/bottom/left thumbnail rows) removed. Imported directly as a static asset rather than
// through the Lovable .asset.json indirection the other reference images use, since this file lives
// in the repo rather than Lovable's remote asset store.
import cleanMapArt from "@/assets/fractured-earth-map-clean.png";

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
        <section className="min-w-0"><nav className="mb-3 flex flex-wrap gap-1" aria-label="Atlas artwork">{(["TACTICAL", "MAP", "TROOPS", "BOSSES", "FACTIONS"] as const).map((tab) => <Button key={tab} size="sm" variant={gallery === tab ? "default" : "outline"} onClick={() => setGallery(tab)}>{tab}</Button>)}</nav>{gallery === "TACTICAL" ? <TacticalMap markers={markers} px={px} pz={pz} selected={selected} onSelect={setSelected} /> : gallery === "MAP" ? <img src={cleanMapArt} alt="The Fractured Earth map showing seven regions, terrain and zone types" className="w-full border border-border object-contain" /> : <img src={art!.url} alt={`${gallery.toLowerCase()} concept reference`} className="w-full border border-border object-contain" />}<p className="mt-2 text-xs text-muted-foreground">{gallery === "MAP" ? "Regional routes and safe, war, fracture, and core zones" : "Field identification reference"}</p></section>
        <aside className="min-w-0"><div className="mb-4"><NextActivityCard progression={progression} /></div><p className="font-mono text-xs uppercase text-primary">Regional intelligence</p><div className="mt-3 grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-2">{REGIONS.map((entry) => <Button key={entry.id} variant={selected === entry.id ? "default" : "outline"} onClick={() => setSelected(entry.id)} className="h-auto min-h-12 whitespace-normal text-left text-xs"><MapPin className="size-3 shrink-0" />{entry.name}</Button>)}</div>
          {region && <div className="mt-5 border-t border-border pt-5"><p className="font-mono text-xs uppercase text-primary">{ZONE_LABEL[region.kind]} · Risk {region.difficulty}</p><h3 className="mt-2 text-2xl font-semibold">{region.name}</h3><p className="mt-1 text-sm text-muted-foreground">{region.sub}</p><div className="mt-4 grid grid-cols-2 gap-px bg-foreground/10"><span className="bg-background/70 p-3"><small className="ui-kicker block">Readiness</small><b className="text-sm">{region.difficulty <= 2 ? "READY" : "CAUTION"}</b></span><span className="bg-background/70 p-3"><small className="ui-kicker block">Activities</small><b className="text-sm">{markers.filter((item) => item.kind === "MISSION").length} SIGNALS</b></span></div><Button className="mt-3 w-full justify-between rounded-none" onClick={onClose}><Navigation />Track destination<Crosshair /></Button><div className="mt-5 flex items-center gap-2 text-xs uppercase text-primary"><Shield className="size-4" /> Field units</div><ul className="mt-2 divide-y divide-border">{encounter?.troops.map((troop) => <li key={troop.name} className="py-2"><strong className="block text-sm">{troop.name}</strong><span className="text-xs text-muted-foreground">{troop.role} · {troop.kind.toLowerCase()}</span></li>)}</ul>{encounter?.boss && <div className="mt-5 border-l-2 border-destructive pl-4"><p className="flex items-center gap-2 font-mono text-xs uppercase text-destructive"><Skull className="size-4" /> Dungeon boss</p><h4 className="mt-1 text-lg font-semibold">{encounter.boss.name}</h4><p className="text-xs text-muted-foreground">{encounter.boss.lair} · {encounter.boss.tell}</p><p className="mt-2 text-xs text-primary">Enter this region and press B to challenge the boss.</p></div>}</div>}
        </aside>
      </div>
    </div>
  </div>;
}
const fmt = (d: number) => (d >= 1000 ? `${(d / 1000).toFixed(1)}km` : `${Math.round(d)}m`);

/** Live tactical map: region footprints, player arrow, and every tracked mission, resource site and boss lair. */
function TacticalMap({ markers, px, pz, selected, onSelect }: { markers: TrackedMarker[]; px: number; pz: number; selected: string; onSelect: (id: string) => void }) {
  const xs = REGIONS.flatMap((r) => [r.x - r.radius, r.x + r.radius]), zs = REGIONS.flatMap((r) => [r.z - r.radius, r.z + r.radius]);
  const pad = 20, minX = Math.min(...xs) - pad, maxX = Math.max(...xs) + pad, minZ = Math.min(...zs) - pad, maxZ = Math.max(...zs) + pad;
  const [legend, setLegend] = useState({ MISSION: true, RESOURCE: true, BOSS: true });
  return <div>
    <div className="mb-2 flex flex-wrap gap-2 text-xs">{(Object.keys(legend) as (keyof typeof legend)[]).map((k) => <Button key={k} size="sm" variant="ghost" onClick={() => setLegend((l) => ({ ...l, [k]: !l[k] }))} className={`rounded-none border-b px-2 py-1 font-mono uppercase ${legend[k] ? "border-current" : "border-transparent opacity-40"}`} style={{ color: MARKER_COLOR[k] }}>{k === "MISSION" ? "◆ Missions" : k === "RESOURCE" ? "⬢ Resources" : "☠ Bosses"}</Button>)}</div>
    <svg viewBox={`${minX} ${minZ} ${maxX - minX} ${maxZ - minZ}`} className="w-full border border-border bg-card/40" role="img" aria-label="Tactical map with markers">
      {REGIONS.map((r) => <g key={r.id} onClick={() => onSelect(r.id)} className="cursor-pointer"><circle cx={r.x} cy={r.z} r={r.radius} fill={ZONE_COLOR[r.kind]} fillOpacity={selected === r.id ? 0.28 : 0.12} stroke={ZONE_COLOR[r.kind]} strokeOpacity={0.7} strokeWidth={0.8} /><text x={r.x} y={r.z - r.radius - 2} textAnchor="middle" fontSize={5} fill="currentColor" className="fill-foreground font-mono">{r.name}</text></g>)}
      {markers.filter((m) => legend[m.kind]).map((m) => <g key={m.id}><title>{`${m.label} · ${fmt(m.dist)}`}</title>{m.kind === "RESOURCE" ? <polygon points={`${m.x},${m.z - 2.4} ${m.x + 2},${m.z - 1.2} ${m.x + 2},${m.z + 1.2} ${m.x},${m.z + 2.4} ${m.x - 2},${m.z + 1.2} ${m.x - 2},${m.z - 1.2}`} fill={MARKER_COLOR.RESOURCE} fillOpacity={m.ready === false ? 0.3 : 1} /> : m.kind === "BOSS" ? <g><circle cx={m.x} cy={m.z} r={3.2} fill="none" stroke={MARKER_COLOR.BOSS} strokeWidth={1} /><circle cx={m.x} cy={m.z} r={1.4} fill={MARKER_COLOR.BOSS} /></g> : <rect x={m.x - 2} y={m.z - 2} width={4} height={4} transform={`rotate(45 ${m.x} ${m.z})`} fill={MARKER_COLOR.MISSION} />}</g>)}
      <circle cx={px} cy={pz} r={2.6} fill="#ffffff" stroke="#000000" strokeWidth={0.6} />
    </svg>
    <ul className="mt-3 grid gap-1 text-xs sm:grid-cols-2">{markers.filter((m) => legend[m.kind] && m.kind !== "RESOURCE").slice(0, 8).map((m) => <li key={m.id} className="flex justify-between border-l-2 bg-card/40 px-2 py-1" style={{ borderColor: MARKER_COLOR[m.kind] }}><span>{m.label}</span><span className="text-muted-foreground">{fmt(m.dist)}</span></li>)}</ul>
  </div>;
}
