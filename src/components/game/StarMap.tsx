import { REGION_HAZARD } from "@/game/region-hazards";
import { useMemo, useState } from "react";
import { ArrowLeft, ChevronRight, Skull } from "lucide-react";
import { Button } from "@/components/ui/button";
import { REGIONS, ZONE_COLOR, ZONE_LABEL, WORLD_SCALE } from "@/game/world";
import { ENCOUNTERS } from "@/game/encounters";
import { CHRONICLE, nextActivity } from "@/game/retention";
import type { PlayerProgression } from "@/game/progression";
import { NextActivityCard } from "./NextActivityCard";
import { MAP_EXTENT, terrainMapDataUrl } from "@/game/terrain-map";
import { LANES, laneSamples } from "@/game/lanes";
import { LANDMARKS, isLandmarkKnown } from "@/game/landmarks";
import { MapLegend, LANDMARK_GLYPH } from "./MapLegend";

const THREAT = ["MINIMAL", "LOW", "MODERATE", "HIGH", "SEVERE", "EXTREME"];

/** Destination-first star map rebuilt from the uploaded StarMapDeployment layout, driven by the real REGIONS/ENCOUNTERS data. */
/** map sizes are authored in original-world units; positions are world units, so sizes grow with the map */
const u = (n: number) => n * WORLD_SCALE;

export function StarMap({ progression, onBack, onDeploy }: { progression: PlayerProgression; onBack: () => void; onDeploy: (regionId: string) => void }) {
  const next = nextActivity(progression);
  const recommended = REGIONS.find((r) => r.name === next.region)?.id ?? progression.currentWorld;
  const [selected, setSelected] = useState(REGIONS.find((r) => r.id === recommended)?.id ?? "veridan");
  const [launching, setLaunching] = useState(false);
  const region = REGIONS.find((r) => r.id === selected)!;
  const encounter = ENCOUNTERS.find((e) => e.regionId === selected);
  const chapters = CHRONICLE.filter((c) => c.region === region.name);
  const art = useMemo(() => terrainMapDataUrl(), []);
  const E = MAP_EXTENT;
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
        <section className="relative border border-foreground/15 bg-background/50 p-3 lg:col-span-3">
          <svg viewBox={`${-E} ${-E} ${E * 2} ${E * 2}`} className="mx-auto aspect-square max-h-[70vh] w-full border border-foreground/15" role="img" aria-label="Destination map">
            {art && <image href={art} x={-E} y={-E} width={E * 2} height={E * 2} preserveAspectRatio="none" />}
            {LANES.map((l) => <polyline key={l.name} points={laneSamples(l, 24).map((p) => `${p.x},${p.z}`).join(" ")} fill="none" stroke="#f3e2b0" strokeOpacity={0.8} strokeWidth={u(0.9)} strokeDasharray={`${u(2.4)} ${u(1.6)}`} />)}
            {REGIONS.map((r) => {
              const on = r.id === selected, rec = r.id === recommended;
              return (
                <g key={r.id} onClick={() => setSelected(r.id)} className="cursor-pointer">
                  <circle cx={r.x} cy={r.z} r={r.radius} fill={ZONE_COLOR[r.kind]} fillOpacity={on ? 0.24 : 0.04} stroke={ZONE_COLOR[r.kind]} strokeOpacity={on ? 1 : 0.7} strokeWidth={u(on ? 1.4 : 0.7)} />
                  {rec && <circle cx={r.x} cy={r.z} r={r.radius + u(3)} fill="none" stroke="#ffffff" strokeDasharray={`${u(3)} ${u(3)}`} strokeWidth={u(0.8)} />}
                  <g transform={`translate(${r.x} ${r.z}) scale(${WORLD_SCALE})`}><text y={1.5} textAnchor="middle" fontSize={5.4} fill="#fff" stroke="#000" strokeWidth={1.1} paintOrder="stroke" className="font-mono uppercase">{r.name}{rec ? " ◆" : ""}</text></g>
                </g>
              );
            })}
            {LANDMARKS.filter((l) => isLandmarkKnown(progression, l.id)).map((l) => <g key={l.id} transform={`translate(${l.x} ${l.z}) scale(${WORLD_SCALE})`}><text y={1.6} textAnchor="middle" fontSize={4.6} fill="#9fd4ff" stroke="#000" strokeWidth={0.8} paintOrder="stroke"><title>{l.name}</title>{LANDMARK_GLYPH[l.type]}</text></g>)}
            <g transform={`translate(${E - u(22)} ${-E + u(24)}) scale(${WORLD_SCALE})`} aria-label="Compass rose"><circle r={15} fill="#000" fillOpacity={0.45} stroke="#fff" strokeOpacity={0.6} strokeWidth={0.5} /><polygon points="0,-14 3,0 0,3 -3,0" fill="#ff5a5a" /><polygon points="0,14 3,0 0,-3 -3,0" fill="#e8e8e8" /><text y={-17} textAnchor="middle" fontSize={6} fill="#fff" fontWeight="700">N</text></g>
          </svg>
          <MapLegend phase="" />
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
