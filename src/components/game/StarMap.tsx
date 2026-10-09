import { REGION_HAZARD } from "@/game/region-hazards";
import { useMemo, useState } from "react";
import { ArrowLeft, ChevronRight, Skull } from "lucide-react";
import { Button } from "@/components/ui/button";
import { REGIONS, ZONE_COLOR, ZONE_LABEL } from "@/game/world";
import { ENCOUNTERS } from "@/game/encounters";
import { CHRONICLE, nextActivity } from "@/game/retention";
import type { PlayerProgression } from "@/game/progression";
import { NextActivityCard } from "./NextActivityCard";

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
  const box = useMemo(() => {
    const xs = REGIONS.flatMap((r) => [r.x - r.radius, r.x + r.radius]), zs = REGIONS.flatMap((r) => [r.z - r.radius, r.z + r.radius]);
    const minX = Math.min(...xs) - 20, minZ = Math.min(...zs) - 20;
    return `${minX} ${minZ} ${Math.max(...xs) + 20 - minX} ${Math.max(...zs) + 20 - minZ}`;
  }, []);
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
          <svg viewBox={box} className="h-full max-h-[70vh] w-full" role="img" aria-label="Destination map">
            {REGIONS.map((r) => {
              const on = r.id === selected, rec = r.id === recommended;
              return (
                <g key={r.id} onClick={() => setSelected(r.id)} className="cursor-pointer">
                  <circle cx={r.x} cy={r.z} r={r.radius} fill={ZONE_COLOR[r.kind]} fillOpacity={on ? 0.3 : 0.1} stroke={ZONE_COLOR[r.kind]} strokeWidth={on ? 1.6 : 0.6} />
                  {rec && <circle cx={r.x} cy={r.z} r={r.radius + 4} fill="none" stroke="currentColor" strokeDasharray="3 3" strokeWidth={0.8} className="text-primary" />}
                  <circle cx={r.x} cy={r.z} r={2.2} className="fill-foreground" />
                  <text x={r.x} y={r.z - r.radius - 3} textAnchor="middle" fontSize={6} className="fill-foreground font-mono uppercase">{r.name}{rec ? " ◆" : ""}</text>
                </g>
              );
            })}
          </svg>
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
