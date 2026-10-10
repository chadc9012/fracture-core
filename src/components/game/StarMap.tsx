import { REGION_HAZARD } from "@/game/region-hazards";
import { useState } from "react";
import { ArrowLeft, ChevronRight, Skull } from "lucide-react";
import { Button } from "@/components/ui/button";
import { REGIONS, ZONE_COLOR, ZONE_LABEL } from "@/game/world";
import { ENCOUNTERS } from "@/game/encounters";
import { CHRONICLE, nextActivity } from "@/game/retention";
import type { PlayerProgression } from "@/game/progression";
import { NextActivityCard } from "./NextActivityCard";
import { MAP_ART_ASPECT, MAP_ART_SPOTS } from "@/game/map-art";
import mapArt from "@/assets/fractured-earth-map-v2.jpg";

const THREAT = ["MINIMAL", "LOW", "MODERATE", "HIGH", "SEVERE", "EXTREME"];

/** Destination-first star map rebuilt from the uploaded StarMapDeployment layout, driven by the real REGIONS/ENCOUNTERS data. */

export function StarMap({ progression, onBack, onDeploy }: { progression: PlayerProgression; onBack: () => void; onDeploy: (regionId: string) => void }) {
  const next = nextActivity(progression);
  const recommended = REGIONS.find((r) => r.name === next.region)?.id ?? progression.currentWorld;
  const [selected, setSelected] = useState(REGIONS.find((r) => r.id === recommended)?.id ?? "veridan");
  const [launching, setLaunching] = useState(false);
  const region = REGIONS.find((r) => r.id === selected)!;
  const encounter = ENCOUNTERS.find((e) => e.regionId === selected);
  const chapters = CHRONICLE.filter((c) => c.region === region.name);
  const deploy = () => { setLaunching(true); window.setTimeout(() => onDeploy(region.id), 900); };

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
        <section className="relative flex items-center justify-center border border-foreground/15 bg-[#050d1c] p-2 lg:col-span-3">
          {/* the illustrated Fractured Earth (title, region names, legend and compass are part of the picture); hotspots sit on each region */}
          <div className="relative w-full" style={{ aspectRatio: String(MAP_ART_ASPECT), maxHeight: "78vh", maxWidth: `calc(78vh * ${MAP_ART_ASPECT})` }}>
            <img src={mapArt} alt="The Fractured Earth: seven regions, terrain and zone types" className="absolute inset-0 size-full select-none object-contain" draggable={false} />
            {REGIONS.map((r) => {
              const spot = MAP_ART_SPOTS[r.id];
              if (!spot) return null;
              const on = r.id === selected, rec = r.id === recommended, color = ZONE_COLOR[r.kind];
              return (
                <button key={r.id} type="button" onClick={() => setSelected(r.id)} aria-pressed={on} aria-label={`${r.name}, ${ZONE_LABEL[r.kind]}${rec ? ", recommended" : ""}`}
                  className="ui-focus group absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
                  style={{ left: `${spot.x}%`, top: `${spot.y}%`, width: "11%", aspectRatio: "1", ...(on ? { boxShadow: `0 0 0 2px ${color}, 0 0 28px 6px ${color}66`, background: `${color}22` } : {}) }}>
                  <span className={`absolute inset-0 rounded-full border transition-opacity ${on ? "opacity-0" : "border-white/0 group-hover:border-white/70"}`} />
                  {rec && <span className="absolute -inset-1.5 animate-pulse rounded-full border-2 border-dashed border-white/80" />}
                  {rec && <span className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap bg-black/70 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-white">◆ Recommended</span>}
                </button>
              );
            })}
          </div>
        </section>

        <aside className="flex flex-col justify-between gap-4 border border-foreground/15 bg-background/70 p-5">
          <div>
            <p className="ui-kicker">Sector intel / {ZONE_LABEL[region.kind]}</p>
            <h2 className="mt-2 font-mono text-2xl uppercase" style={{ color: ZONE_COLOR[region.kind] }}>{region.name}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{region.sub}</p>
            {REGION_HAZARD[region.id] && REGION_HAZARD[region.id]!.id !== "none" && <p className="mt-2 text-xs text-destructive">Hazard · {REGION_HAZARD[region.id]!.name} — {REGION_HAZARD[region.id]!.hint}</p>}
            <ul className="mt-3 space-y-1 text-xs text-muted-foreground">{region.rules.map((r) => <li key={r}>· {r}</li>)}</ul>
            <div className="mt-4 grid grid-cols-2 gap-px bg-foreground/10">
              <span className="bg-background/80 p-3"><small className="ui-kicker block">Threat</small><b className="text-xs">{THREAT[Math.min(5, region.difficulty)]}</b></span>
              <span className="bg-background/80 p-3"><small className="ui-kicker block">Story</small><b className="text-xs">{chapters.length ? `${chapters.filter((c) => progression.completedMissions.includes(c.id)).length}/${chapters.length} chapters` : "Free roam"}</b></span>
            </div>
            {encounter?.boss && <p className="mt-3 flex items-center gap-2 text-xs text-destructive"><Skull className="size-3" /> {encounter.boss.name} · {encounter.boss.lair}</p>}
            <div className="mt-4"><NextActivityCard progression={progression} /></div>
          </div>
          <Button size="lg" className="ui-focus justify-between rounded-none" disabled={launching} onClick={deploy}>{launching ? "Dropping in…" : `Deploy to ${region.name}`}<ChevronRight /></Button>
        </aside>
      </div>
    </div>
  );
}
