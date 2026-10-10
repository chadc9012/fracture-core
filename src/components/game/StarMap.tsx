import { REGION_HAZARD } from "@/game/region-hazards";
import { useState } from "react";
import { ArrowLeft, ChevronRight, Skull } from "lucide-react";
import { Button } from "@/components/ui/button";
import { REGIONS, ZONE_COLOR, ZONE_LABEL } from "@/game/world";
import { ENCOUNTERS } from "@/game/encounters";
import { CHRONICLE, nextActivity } from "@/game/retention";
import type { PlayerProgression } from "@/game/progression";
import { NextActivityCard } from "./NextActivityCard";
import { MAP_ART_ASPECT, MAP_ART_SPOTS, artSpotForWorld } from "@/game/map-art";
import { LANDMARKS, isLandmarkKnown } from "@/game/landmarks";
import { CITY_DESTINATIONS, dropPoint } from "@/game/destinations";
import { MAP_EXTENT } from "@/game/terrain-map";
import mapArt from "@/assets/fractured-earth-map-v2.jpg";
import { MAP_VIEWBOX, MapLayers } from "./MapLayers";
import { LANDMARK_GLYPH } from "./MapLegend";
import { useTerrainMap } from "./useTerrainMap";
import { useMapArt } from "./useMapArt";

const THREAT = ["MINIMAL", "LOW", "MODERATE", "HIGH", "SEVERE", "EXTREME"];

/** Destination-first star map rebuilt from the uploaded StarMapDeployment layout, driven by the real REGIONS/ENCOUNTERS data. */

/** What the star map hands to the game when the player drops in: a destination name for the transit card and the world position to land on. */
export interface DeployTarget { id: string; name: string; sub: string; color: string; x: number; z: number }

export function StarMap({ progression, onBack, onDeploy }: { progression: PlayerProgression; onBack: () => void; onDeploy: (target: DeployTarget) => void }) {
  const next = nextActivity(progression);
  const recommended = REGIONS.find((r) => r.name === next.region)?.id ?? progression.currentWorld;
  const [selected, setSelected] = useState(REGIONS.find((r) => r.id === recommended)?.id ?? "veridan");
  const [launching, setLaunching] = useState(false);
  const [view, setView] = useState<"painted" | "terrain">("painted");
  const art = useMapArt(mapArt);
  const terrain = useTerrainMap();
  const known = LANDMARKS.filter((l) => isLandmarkKnown(progression, l.id));
  const [cityId, setCityId] = useState<string | null>(null);
  const city = CITY_DESTINATIONS.find((c) => c.id === cityId) ?? null;
  const pickRegion = (id: string) => { setCityId(null); setSelected(id); };
  const region = REGIONS.find((r) => r.id === (city ? city.regionId : selected))!;
  const encounter = ENCOUNTERS.find((e) => e.regionId === selected);
  const chapters = CHRONICLE.filter((c) => c.region === region.name);
  const deploy = () => {
    if (city && !city.deployable) return;
    setLaunching(true);
    const at = dropPoint(city ?? region);
    onDeploy({ id: city?.id ?? region.id, name: city?.name ?? region.name, sub: city?.sub ?? region.sub, color: ZONE_COLOR[(city ?? region).kind], x: at.x, z: at.z });
  };

  return (
    <div className="deployment-field fixed inset-0 z-50 flex flex-col overflow-y-auto p-4 text-foreground lg:p-6" role="dialog" aria-modal="true" aria-label="Star map">
      <div className="fracture-grid pointer-events-none absolute inset-0 opacity-30" />
      <header className="relative flex flex-wrap items-center justify-between gap-3 border-b border-foreground/15 pb-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="ui-focus font-mono"><ArrowLeft /> Hub</Button>
          <h1 className="font-mono text-xl uppercase tracking-[0.25em] lg:text-2xl">The Fractured Earth</h1>
        </div>
        <p className="ui-kicker">{REGIONS.length} destinations · {progression.completedMissions.length}/{CHRONICLE.length} chapters</p>
      </header>

      <div className="relative my-3 grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-4">
        <section className="relative flex flex-col gap-2 border border-foreground/15 bg-[#050d1c] p-2 lg:col-span-3">
          <div className="flex items-center justify-between gap-2" role="group" aria-label="Map view">
            <div className="flex font-mono text-[10px] uppercase tracking-widest">
              {(["painted", "terrain"] as const).map((v) => <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={`ui-focus border border-foreground/25 px-3 py-1 ${view === v ? "bg-primary text-primary-foreground" : "bg-background/60 text-muted-foreground hover:text-foreground"}`}>{v === "painted" ? "Painted" : "Terrain"}</button>)}
            </div>
            <p className="ui-kicker">{view === "terrain" ? `${known.length}/${LANDMARKS.length} landmarks charted` : art.hires ? "High-res art" : "Illustrated"}</p>
          </div>
          <div className="flex w-full min-w-0 items-center justify-center">
            {view === "painted" ? (
              /* the illustrated Fractured Earth (title, region names, legend and compass are part of the picture); hotspots sit on each region */
              <div className="relative w-full max-w-[calc(72vh*var(--ar))]" style={{ aspectRatio: String(MAP_ART_ASPECT), ["--ar" as string]: String(MAP_ART_ASPECT) }}>
                <img src={art.src} alt="The Fractured Earth: seven regions, terrain and zone types" className="absolute inset-0 size-full select-none object-contain" draggable={false} decoding="async" />
                {CITY_DESTINATIONS.map((c) => {
                  const at = artSpotForWorld(c.x, c.z), on = c.id === cityId, col = ZONE_COLOR[c.kind];
                  return (
                    <button key={c.id} type="button" onClick={() => setCityId(c.id)} aria-pressed={on} aria-label={`${c.name}, ${c.deployable ? "city" : "no landing site"}${at.clamped ? ", off the painted chart" : ""}`}
                      className="ui-focus group absolute z-10 -translate-x-1/2 -translate-y-1/2" style={{ left: `${at.x}%`, top: `${at.y}%` }}>
                      <span className="block size-3.5 rotate-45 border border-[#06101f]" style={{ background: col, opacity: c.deployable ? 1 : 0.6, boxShadow: on ? `0 0 0 2px #fff, 0 0 14px 4px ${col}99` : `0 0 8px 1px ${col}88` }} />
                      <span className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap bg-black/75 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-white">{at.clamped ? "▲ " : ""}{c.name}{at.clamped ? " · off chart" : ""}</span>
                    </button>
                  );
                })}
                {REGIONS.map((r) => {
                  const spot = MAP_ART_SPOTS[r.id];
                  if (!spot) return null;
                  const on = r.id === selected && !city, rec = r.id === recommended, color = ZONE_COLOR[r.kind];
                  return (
                    <button key={r.id} type="button" onClick={() => pickRegion(r.id)} aria-pressed={on && !city} aria-label={`${r.name}, ${ZONE_LABEL[r.kind]}${rec ? ", recommended" : ""}`}
                      className="ui-focus group absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
                      style={{ left: `${spot.x}%`, top: `${spot.y}%`, width: "11%", aspectRatio: "1", ...(on ? { boxShadow: `0 0 0 2px ${color}, 0 0 28px 6px ${color}66`, background: `${color}22` } : {}) }}>
                      <span className={`absolute inset-0 rounded-full border transition-opacity ${on ? "opacity-0" : "border-white/0 group-hover:border-white/70"}`} />
                      {rec && <span className="absolute -inset-1.5 animate-pulse rounded-full border-2 border-dashed border-white/80" />}
                      {rec && <span className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap bg-black/70 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-white">◆ Recommended</span>}
                    </button>
                  );
                })}
              </div>
            ) : (
              /* the real-terrain view: same world coordinates as the in-game atlas; discovered landmarks are drawn from LANDMARKS through the one
                 world->viewBox transform (undiscovered ones are not rendered at all) */
              <div className="relative w-full max-w-[72vh]" style={{ aspectRatio: "1" }}>
                <svg viewBox={MAP_VIEWBOX} className="absolute inset-0 size-full" role="img" aria-label="Terrain map with discovered landmarks">
                  <MapLayers art={terrain.url} preview={!terrain.full} selected={city ? "" : selected} recommended={recommended} onSelect={pickRegion}>
                    <g aria-label="Discovered landmarks">
                      {known.filter((l) => !CITY_DESTINATIONS.some((c) => c.id === l.id)).map((l) => <g key={l.id} transform={`translate(${l.x} ${l.z})`}>
                        <title>{l.name}</title>
                        <text y={MAP_EXTENT * 0.009} textAnchor="middle" fontSize={MAP_EXTENT * 0.026} fill="#ffe9a8" stroke="#06101f" strokeWidth={MAP_EXTENT * 0.005} paintOrder="stroke">{LANDMARK_GLYPH[l.type]}</text>
                      </g>)}
                    </g>
                    <g aria-label="Cities">
                      {CITY_DESTINATIONS.map((c) => { const on = c.id === cityId, col = ZONE_COLOR[c.kind], r = MAP_EXTENT * 0.014; return (
                        <g key={c.id} transform={`translate(${c.x} ${c.z})`} className="cursor-pointer" onClick={() => setCityId(c.id)} role="button" aria-label={`${c.name}, ${c.deployable ? "city" : "no landing site"}`}>
                          <circle r={r * 2.4} fill="transparent" />
                          <rect x={-r} y={-r} width={r * 2} height={r * 2} transform="rotate(45)" fill={col} stroke="#06101f" strokeWidth={MAP_EXTENT * 0.003} fillOpacity={c.deployable ? 1 : 0.55} />
                          {on && <circle r={r * 2} fill="none" stroke="#ffffff" strokeWidth={MAP_EXTENT * 0.003} />}
                          <text y={-r * 1.9} textAnchor="middle" fontSize={MAP_EXTENT * 0.028} fill="#ffffff" stroke="#06101f" strokeWidth={MAP_EXTENT * 0.0055} paintOrder="stroke" className="font-mono">{c.name.toUpperCase()}</text>
                        </g>); })}
                    </g>
                  </MapLayers>
                </svg>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-widest" role="group" aria-label="Cities">
            <span className="ui-kicker">Cities</span>
            {CITY_DESTINATIONS.map((c) => <button key={c.id} type="button" aria-pressed={c.id === cityId} onClick={() => setCityId(c.id)} className={`ui-focus border px-3 py-1 ${c.id === cityId ? "border-white bg-white/15 text-white" : "border-foreground/25 bg-background/60 text-muted-foreground hover:text-foreground"}`} style={{ borderLeft: `3px solid ${ZONE_COLOR[c.kind]}` }}>{c.name}{c.deployable ? "" : " · no landing"}</button>)}
          </div>
        </section>

        <aside className="flex flex-col justify-between gap-4 border border-foreground/15 bg-background/70 p-5">
          <div>
            <p className="ui-kicker">Sector intel / {ZONE_LABEL[(city ?? region).kind]}</p>
            <h2 className="mt-2 font-mono text-2xl uppercase" style={{ color: ZONE_COLOR[(city ?? region).kind] }}>{(city ?? region).name}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{(city ?? region).sub}</p>
            {REGION_HAZARD[region.id] && REGION_HAZARD[region.id]!.id !== "none" && <p className="mt-2 text-xs text-destructive">Hazard · {REGION_HAZARD[region.id]!.name} — {REGION_HAZARD[region.id]!.hint}</p>}
            <ul className="mt-3 space-y-1 text-xs text-muted-foreground">{(city ?? region).rules.map((r) => <li key={r}>· {r}</li>)}</ul>
            <div className="mt-4 grid grid-cols-2 gap-px bg-foreground/10">
              <span className="bg-background/80 p-3"><small className="ui-kicker block">Threat</small><b className="text-xs">{THREAT[Math.min(5, region.difficulty)]}</b></span>
              <span className="bg-background/80 p-3"><small className="ui-kicker block">Story</small><b className="text-xs">{chapters.length ? `${chapters.filter((c) => progression.completedMissions.includes(c.id)).length}/${chapters.length} chapters` : "Free roam"}</b></span>
            </div>
            {encounter?.boss && <p className="mt-3 flex items-center gap-2 text-xs text-destructive"><Skull className="size-3" /> {encounter.boss.name} · {encounter.boss.lair}</p>}
            <div className="mt-4"><NextActivityCard progression={progression} /></div>
          </div>
          <div>
            {city && !city.deployable && <p className="mb-2 text-xs text-destructive">{city.blockedReason}</p>}
            <Button size="lg" className="ui-focus w-full justify-between rounded-none" disabled={launching || Boolean(city && !city.deployable)} onClick={deploy}>{launching ? "Dropping in…" : `Deploy to ${(city ?? region).name}`}<ChevronRight /></Button>
          </div>
        </aside>
      </div>
    </div>
  );
}
