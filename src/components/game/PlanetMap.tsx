import { useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, LockKeyhole, Plane, Waves } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PlayerProgression } from "@/game/progression";
import { CONTINENTS, NATIONS, OCEANS, PLANET, hash32, type Continent } from "@/game/planet";
import { REGIONS } from "@/game/world";
import { TERMINALS, arrivalPoint, hasVisited, START_WORLD } from "@/game/travel";
import type { DeployTarget } from "./StarMap";

/**
 * The planet view (Stage 150): Veyra as a globe you can turn, its 12 continents (lit when playable, dim while they are
 * only on the map), the 7 oceans, the flight routes between playable continents, and Thalassia as a marker off Veyloria's
 * east coast in the Meridian Ocean — not on any continent. Pick a continent to read its nations and look, and fly to it once
 * you have made landfall there (your start continent is always open). Data: planet.ts and travel.ts.
 */
const SIZE = 560, C = SIZE / 2, RAD = SIZE * 0.44;
const toRad = (d: number) => (d * Math.PI) / 180;

/** orthographic projection of (lat, lon) with the globe turned to `lon0`; z < 0 is the far side */
function project(lat: number, lon: number, lon0: number, lat0 = 0) {
  const p = toRad(lat), l = toRad(lon - lon0), p0 = toRad(lat0);
  const x = Math.cos(p) * Math.sin(l);
  const y = Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(l);
  const z = Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(l);
  return { x: C + x * RAD, y: C - y * RAD, z };
}

/** an irregular coastline around a continent's heart: a seeded outline in degrees */
function outline(c: Continent): { lat: number; lon: number }[] {
  const n = 72, seed = hash32(c.id), pts: { lat: number; lon: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    // broad lobes plus a little coastline grain: reads as a landmass, not a star
    const wob = 0.82 + 0.16 * Math.sin(a * 2 + (seed % 7)) + 0.09 * Math.sin(a * 3 + (seed % 11)) + 0.04 * Math.sin(a * 9 + (seed % 5)) + 0.02 * Math.sin(a * 17 + (seed % 3));
    const r = (c.size / 2) * wob;
    pts.push({ lat: c.lat + Math.sin(a) * r * 0.75, lon: c.lon + (Math.cos(a) * r) / Math.max(0.35, Math.cos(toRad(c.lat))) });
  }
  return pts;
}

/** points along the great circle between two globe positions */
function arc(a: { lat: number; lon: number }, b: { lat: number; lon: number }, steps = 24) {
  const v = (q: { lat: number; lon: number }) => [Math.cos(toRad(q.lat)) * Math.cos(toRad(q.lon)), Math.cos(toRad(q.lat)) * Math.sin(toRad(q.lon)), Math.sin(toRad(q.lat))] as const;
  const A = v(a), B = v(b), out: { lat: number; lon: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, x = A[0] * (1 - t) + B[0] * t, y = A[1] * (1 - t) + B[1] * t, z = A[2] * (1 - t) + B[2] * t, m = Math.hypot(x, y, z);
    out.push({ lat: (Math.asin(z / m) * 180) / Math.PI, lon: (Math.atan2(y, x) * 180) / Math.PI });
  }
  return out;
}

/** Thalassia: off Veyloria's east coast, as on the owner's planetary board */
const THALASSIA_GLOBE = { lat: -6, lon: -12 };

export function PlanetMap({ progression, onDeploy }: { progression: PlayerProgression; onDeploy: (target: DeployTarget) => void }) {
  const [lon0, setLon0] = useState(0);
  const [selectedId, setSelectedId] = useState<string>(START_WORLD);
  const drag = useRef<{ x: number; lon: number } | null>(null);
  const selected = CONTINENTS.find((c) => c.id === selectedId) ?? CONTINENTS[0]!;
  const outlines = useMemo(() => new Map(CONTINENTS.map((c) => [c.id, outline(c)])), []);
  const core = CONTINENTS.filter((c) => c.tier === "CORE");
  const routes = useMemo(() => {
    const hub = CONTINENTS.find((c) => c.id === "aetheria")!;
    return core.filter((c) => c.id !== hub.id).map((c) => ({ id: c.id, pts: arc(hub, c) }));
  }, [core]);
  const visited = (id: string) => id === START_WORLD || hasVisited(progression, id as Parameters<typeof hasVisited>[1]);
  const terminal = TERMINALS.find((t) => t.world === selected.id);
  const path = (pts: { lat: number; lon: number }[], closed: boolean) => {
    const proj = pts.map((p) => project(p.lat, p.lon, lon0));
    if (proj.every((p) => p.z < 0)) return null;
    let d = "", pen = false;
    for (const p of proj) { if (p.z < 0) { pen = false; continue; } d += `${pen ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`; pen = true; }
    return closed && proj.every((p) => p.z >= 0) ? `${d}Z` : d;
  };
  const deploy = () => {
    if (!terminal) return;
    const a = arrivalPoint(terminal);
    onDeploy({ id: terminal.id, name: terminal.name, sub: `${selected.name} · flight`, color: selected.color, x: a.x, z: a.z });
  };
  const nations = NATIONS.filter((n) => n.continent === selected.id);
  const regionNames = selected.regions.map((id) => (id === "neon" ? "Neon City" : id === "storm-islands" ? "The Storm Islands" : REGIONS.find((r) => r.id === id)?.name ?? id));
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="relative select-none">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="mx-auto aspect-square w-full max-w-[min(72vh,100%)] cursor-grab active:cursor-grabbing" role="group" aria-label={`The planet ${PLANET.name}: continents, oceans and flight routes`}
          onPointerDown={(e) => { drag.current = { x: e.clientX, lon: lon0 }; (e.target as Element).setPointerCapture?.(e.pointerId); }}
          onPointerMove={(e) => { if (drag.current) setLon0(drag.current.lon - (e.clientX - drag.current.x) * 0.35); }}
          onPointerUp={() => { drag.current = null; }}>
          <defs>
            <radialGradient id="planet-sea" cx="40%" cy="35%" r="70%"><stop offset="0%" stopColor="#1d5a86" /><stop offset="70%" stopColor="#0b2c4a" /><stop offset="100%" stopColor="#04121f" /></radialGradient>
            <radialGradient id="planet-rim" cx="50%" cy="50%" r="50%"><stop offset="88%" stopColor="#7fd8ff" stopOpacity="0" /><stop offset="100%" stopColor="#7fd8ff" stopOpacity="0.35" /></radialGradient>
          </defs>
          <circle cx={C} cy={C} r={RAD} fill="url(#planet-sea)" />
          {CONTINENTS.map((c) => {
            const d = path(outlines.get(c.id)!, true);
            if (!d) return null;
            const playable = c.tier !== "BACKDROP", sel = c.id === selected.id;
            return <path key={c.id} d={d} fill={c.color} fillOpacity={playable ? 0.85 : 0.35} stroke={sel ? "#ffffff" : "#0a1a26"} strokeWidth={sel ? 2.5 : 1} className="cursor-pointer" onClick={() => setSelectedId(c.id)}><title>{c.name}</title></path>;
          })}
          {routes.map((r) => { const d = path(r.pts, false); return d ? <path key={r.id} d={d} fill="none" stroke="#ffd27a" strokeOpacity={0.55} strokeWidth={1.2} strokeDasharray="4 4" /> : null; })}
          {OCEANS.map((o) => { const p = project(o.lat, o.lon, lon0); return p.z > 0.15 ? <text key={o.id} x={p.x} y={p.y} textAnchor="middle" fontSize={10} fill="#9fd7ff" fillOpacity={0.7} fontStyle="italic">{o.name}</text> : null; })}
          {CONTINENTS.map((c) => { const p = project(c.lat, c.lon, lon0); return p.z > 0.1 ? <text key={c.id} x={p.x} y={p.y + 4} textAnchor="middle" fontSize={11} fontWeight={600} fill="#ffffff" pointerEvents="none" style={{ textTransform: "uppercase", letterSpacing: "0.12em" }}>{c.name}</text> : null; })}
          {(() => { const p = project(THALASSIA_GLOBE.lat, THALASSIA_GLOBE.lon, lon0); return p.z > 0 ? <g pointerEvents="none"><circle cx={p.x} cy={p.y} r={6} fill="none" stroke="#3fd0ff" strokeWidth={2} /><circle cx={p.x} cy={p.y} r={2} fill="#3fd0ff" /><text x={p.x + 9} y={p.y + 4} fontSize={10} fill="#bfefff">Thalassia</text></g> : null; })()}
          <circle cx={C} cy={C} r={RAD} fill="url(#planet-rim)" pointerEvents="none" />
        </svg>
        <div className="mt-2 flex items-center justify-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setLon0((l) => l - 30)} aria-label="Turn west"><ChevronLeft /></Button>
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{PLANET.name} · {PLANET.diameterKm.toLocaleString()} km · drag to turn</span>
          <Button size="sm" variant="outline" onClick={() => setLon0((l) => l + 30)} aria-label="Turn east"><ChevronRight /></Button>
        </div>
      </div>
      <aside className="border border-border bg-card/40 p-4">
        <p className="font-mono text-[9px] uppercase tracking-[0.3em]" style={{ color: selected.color }}>{selected.tier === "CORE" ? "Playable" : selected.tier === "EXPANSION" ? "Partly playable" : "On the map · not yet walkable"}</p>
        <h3 className="mt-1 text-2xl font-semibold uppercase tracking-wider">{selected.name}</h3>
        <p className="text-sm text-muted-foreground">{selected.epithet} · capital {selected.capital}</p>
        <p className="mt-3 text-sm leading-6">{selected.look}</p>
        {regionNames.length > 0 && <p className="mt-3 font-mono text-[11px]">Regions · {regionNames.join(", ")}</p>}
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Nations</p>
        <ul className="mt-1 space-y-0.5 text-[12px]">{nations.map((n) => <li key={n.id}>{n.name}{n.playable ? " · you can walk here" : ""}</li>)}</ul>
        {selected.id === "veyloria" && <p className="mt-3 flex items-start gap-2 border-l-2 border-cyan-300/60 pl-2 text-[12px] text-cyan-100"><Waves className="mt-0.5 size-3.5 shrink-0" /> Thalassia lies off this east coast, on no continent. Take the elevator platform out past the shore, or an underwater vehicle.</p>}
        <div className="mt-4">
          {terminal && selected.tier === "CORE" ? (
            visited(selected.id)
              ? <Button className="w-full" onClick={deploy}><Plane /> Fly to {terminal.name}</Button>
              : <p className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground"><LockKeyhole className="size-3.5" /> Make landfall first: fly there from a transit terminal.</p>
          ) : <p className="font-mono text-[11px] text-muted-foreground">No scheduled service yet.</p>}
        </div>
      </aside>
    </div>
  );
}
