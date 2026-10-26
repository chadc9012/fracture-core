import { useState } from "react";
import { Plane, PlaneTakeoff, Ship, Warehouse, X, Waves } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PlayerProgression } from "@/game/progression";
import { TERMINALS, arrivalPoint, flightsFrom, type Terminal } from "@/game/travel";
import { continentById } from "@/game/planet";
import { formatNex } from "@/game/nex";
import { nexBalance } from "@/game/nex";
import type { JourneyKind } from "@/game/flight-journey";
import { SEAT_THEMES, availableStyles, type SeatStyle } from "@/game/passenger-cabin";
import { PHANTOM_NEX_PRICE, airworthy, hangarLabel, isHangar, ownsPhantom, phantomCondition, phantomFlightBlock, phantomOf, recallPhantom } from "@/game/phantom-jet";
import type { DeployTarget } from "./StarMap";

/** what the board books: a scheduled flight / ferry in a seat class, or your own Phantom */
export type TripBooking = { kind: JourneyKind; seatStyle: SeatStyle; fromId: string; toId: string; fromName: string; toName: string; from: { x: number; z: number }; to: { x: number; z: number } };

/** A terminal's departures board (travel.ts): from an airport, flights to every other playable continent; from a seaport,
 * ferries along the sea lanes. Continents are separate
 * worlds, so this (or deploying from the planet map) is the way across. Thalassia is not on the board: its elevator stands
 * off Aetheria's Verdant shore, or take an underwater vehicle. Airports with a private hangar (Nexus, Neon) and any airport where your
 * Phantom is parked also show Private aviation (phantom-jet.ts): buy, open the hangar, recall the jet, or fly it anywhere. */
export function TransitPanel({ terminalId, progression, onFly, onClose, onOpenHangar, onProgression }: {
  terminalId: string; progression: PlayerProgression; onFly: (target: DeployTarget, trip: TripBooking) => void; onClose: () => void;
  onOpenHangar?: (terminalId: string) => void; onProgression?: (p: PlayerProgression) => void;
}) {
  const from = TERMINALS.find((t) => t.id === terminalId);
  const [seatStyle, setSeatStyle] = useState<SeatStyle>("economy");
  const [msg, setMsg] = useState("");
  if (!from) return null;
  const sea = from.kind === "SEAPORT";
  const flights = flightsFrom(from, progression);
  const fly = (t: Terminal, kind: JourneyKind) => {
    const c = continentById(t.world);
    const a = arrivalPoint(t);
    const sub = kind === "phantom" ? `${c?.name ?? ""} · Phantom Stealth Jet` : `${c?.name ?? ""} · ${sea ? "ferry" : "flight"}`;
    onFly({ id: t.id, name: t.name, sub, color: kind === "phantom" ? "#7fd0ff" : c?.color ?? "#5ee7ff", x: a.x, z: a.z }, { kind, seatStyle, fromId: from.id, toId: t.id, fromName: from.name, toName: t.name, from: { x: from.x, z: from.z }, to: { x: t.x, z: t.z } });
  };
  // private aviation
  const owned = ownsPhantom(progression), jet = phantomOf(progression), hangar = isHangar(from.id);
  const parkedHere = owned && jet.parkedAt === from.id;
  const privateAviation = !sea && (hangar || parkedHere);
  const parkedName = TERMINALS.find((t) => t.id === jet.parkedAt)?.name ?? jet.parkedAt;
  const cond = phantomCondition(progression);
  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-background/60 p-4 backdrop-blur-sm" role="dialog" aria-label="Transit terminal departures">
      <div className="flex max-h-full w-full max-w-lg flex-col border border-border bg-background/95 p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-primary">{sea ? "Seaport · ferry departures" : "Airport · departures"}</p>
            <h3 className="mt-1 text-lg font-semibold uppercase tracking-wider">{from.name}</h3>
            <p className="mt-1 text-[11px] text-muted-foreground">{sea ? "Scheduled ferries along the sea lanes; or take your own boat across. Tickets are free for now." : "Scheduled flights to every continent's airports; or fly your own aircraft. Tickets are free for now."}</p>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close"><X /></Button>
        </div>
        <label className="mt-3 flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
          Cabin class
          <select aria-label="Cabin class" value={seatStyle} onChange={(e) => setSeatStyle(e.target.value as SeatStyle)} className="border border-border bg-background px-2 py-1 text-xs normal-case tracking-normal text-foreground">
            {availableStyles(sea ? "sea" : "air").map((s) => <option key={s} value={s}>{SEAT_THEMES[s].label}</option>)}
          </select>
        </label>
        <ul className="mt-3 min-h-0 divide-y divide-border overflow-y-auto border-y border-border">
          {flights.map((f) => {
            const phantomWhy = parkedHere ? phantomFlightBlock(progression, from.id, f.terminal.id) : null;
            return (
              <li key={f.terminal.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{f.terminal.name}</p>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{f.continent}{f.visited ? "" : " · not yet visited"}</p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  {parkedHere && <Button size="sm" variant="outline" disabled={!!phantomWhy} title={phantomWhy ?? "Fly the Phantom"} onClick={() => fly(f.terminal, "phantom")}><PlaneTakeoff className="size-3.5" /> Phantom</Button>}
                  <Button size="sm" disabled={!f.open} onClick={() => fly(f.terminal, sea ? "ferry" : "scheduled")}>{sea ? <Ship className="size-3.5" /> : <Plane className="size-3.5" />} {f.open ? (sea ? "Sail" : "Fly") : f.reason}</Button>
                </div>
              </li>
            );
          })}
        </ul>
        {privateAviation && (
          <section aria-label="Private aviation" className="mt-3 border border-border p-3">
            <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-primary">Private aviation{hangar ? ` · ${hangarLabel(from.id)}` : " · apron"}</p>
            {!owned && <p className="mt-1 text-[12px]">Phantom Stealth Jet · executive sofa cabin, office, bar, cinema, gaming lounge, bedroom · <span className="font-mono">{formatNex(PHANTOM_NEX_PRICE)}</span> <span className="text-muted-foreground">(you have {formatNex(nexBalance(progression.nexLedger))})</span></p>}
            {owned && <p className="mt-1 text-[12px]">Your Phantom is {parkedHere ? (hangar ? "in this hangar" : "on the apron here") : `parked at ${parkedName}`}{parkedHere ? (airworthy(cond) ? " · ready: pick a destination above (Phantom)" : " · grounded: service it in a hangar") : ""}.</p>}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {hangar && onOpenHangar && <Button size="sm" variant="outline" onClick={() => onOpenHangar(from.id)}><Warehouse className="size-3.5" /> {owned ? "Open hangar" : "Hangar showroom"}</Button>}
              {hangar && owned && !parkedHere && onProgression && <Button size="sm" variant="outline" onClick={() => { const r = recallPhantom(progression, from.id); if ("error" in r) setMsg(r.error); else { onProgression(r.progression); setMsg(r.message); } }}>Recall here</Button>}
            </div>
            {msg && <p role="status" className="mt-1 text-[11px] text-primary">{msg}</p>}
          </section>
        )}
        <p className="mt-3 flex items-center gap-2 font-mono text-[10px] text-muted-foreground"><Waves className="size-3.5" /> Thalassia: the elevator platform off Aetheria's Verdant shore, or an underwater vehicle.</p>
      </div>
    </div>
  );
}
