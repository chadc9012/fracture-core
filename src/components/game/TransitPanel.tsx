import { Plane, X, Waves } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PlayerProgression } from "@/game/progression";
import { TERMINALS, arrivalPoint, flightsFrom, type Terminal } from "@/game/travel";
import { continentById } from "@/game/planet";
import type { DeployTarget } from "./StarMap";

/** A transit terminal's departures board (travel.ts): flights to every other playable continent. Continents are separate
 * worlds, so this (or deploying from the planet map) is the way across. Thalassia is not on the board: its elevator stands
 * off Veyloria's coast, or take an underwater vehicle. */
export function TransitPanel({ terminalId, progression, onFly, onClose }: { terminalId: string; progression: PlayerProgression; onFly: (target: DeployTarget) => void; onClose: () => void }) {
  const from = TERMINALS.find((t) => t.id === terminalId);
  if (!from) return null;
  const flights = flightsFrom(from, progression);
  const fly = (t: Terminal) => {
    const c = continentById(t.world);
    const a = arrivalPoint(t);
    onFly({ id: t.id, name: t.name, sub: `${c?.name ?? ""} · flight`, color: c?.color ?? "#5ee7ff", x: a.x, z: a.z });
  };
  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-background/60 p-4 backdrop-blur-sm" role="dialog" aria-label="Transit terminal departures">
      <div className="w-full max-w-lg border border-border bg-background/95 p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-primary">Transit terminal · departures</p>
            <h3 className="mt-1 text-lg font-semibold uppercase tracking-wider">{from.name}</h3>
            <p className="mt-1 text-[11px] text-muted-foreground">Each continent is its own land. Fly to cross; tickets are free for now.</p>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close"><X /></Button>
        </div>
        <ul className="mt-4 divide-y divide-border border-y border-border">
          {flights.map((f) => (
            <li key={f.terminal.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{f.terminal.name}</p>
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{f.continent}{f.visited ? "" : " · not yet visited"}</p>
              </div>
              <Button size="sm" disabled={!f.open} onClick={() => fly(f.terminal)}><Plane className="size-3.5" /> {f.open ? "Fly" : f.reason}</Button>
            </li>
          ))}
        </ul>
        <p className="mt-3 flex items-center gap-2 font-mono text-[10px] text-muted-foreground"><Waves className="size-3.5" /> Thalassia: the elevator platform off Veyloria's coast, or an underwater vehicle.</p>
      </div>
    </div>
  );
}
