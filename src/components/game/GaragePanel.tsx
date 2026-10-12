import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { PlayerProgression } from "@/game/progression";
import { EMPTY_FLEET, FLEET, GARAGES, buyFleetVehicle, buyGarage, setActiveFleet, setPaint, tuneNode, type GarageId } from "@/game/fleet";
import { vehicleById } from "@/game/vehicles";

const costText = (c: Record<string, number | undefined>) => Object.entries(c).map(([k, v]) => `${v} ${k}`).join(", ");

/** Garage base (fleet.ts): buy the property, buy the vehicles stored here, tune, paint and set the active vehicle. */
export function GaragePanel({ garageId, progression, onProgression, onSelectVehicle, onClose }: { garageId: GarageId; progression: PlayerProgression; onProgression: (p: PlayerProgression) => void; onSelectVehicle: (id: PlayerProgression["selectedVehicle"]) => void; onClose: () => void }) {
  const g = GARAGES[garageId];
  const fleet = progression.fleet ?? EMPTY_FLEET;
  const owned = fleet.garages.includes(garageId);
  const [notice, setNotice] = useState("");
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.code === "Escape") close.current(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, []);
  const run = (r: { progression: PlayerProgression; message: string } | { error: string }, select = false) => {
    if ("error" in r) { setNotice(r.error); return; }
    onProgression(r.progression); setNotice(r.message);
    if (select) onSelectVehicle(r.progression.selectedVehicle);
  };
  const here = FLEET.filter((f) => f.garage === garageId);

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/85 p-4" role="dialog" aria-label={g.name}>
      <div className="max-h-[88vh] w-full max-w-3xl overflow-y-auto border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-primary">Garage base · {g.region}</p>
            <h3 className="mt-1 text-2xl font-semibold">{g.name}</h3>
            <p className="text-xs text-muted-foreground">{g.blurb}</p>
          </div>
          <Button size="sm" variant="outline" onClick={onClose}>Leave [Esc]</Button>
        </div>
        {!owned ? (
          <div className="mt-4 border border-border p-3">
            <p className="text-sm">Buy this base to store and buy {here.map((f) => f.name).join(", ")}.</p>
            <Button className="mt-2" onClick={() => run(buyGarage(progression, garageId))}>Buy base · {costText(g.cost)}</Button>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {here.map((f) => {
              const has = fleet.owned.includes(f.id), active = fleet.active === f.id, base = vehicleById(f.base);
              return (
                <div key={f.id} className={`border p-3 ${active ? "border-primary" : "border-border"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-[9px] uppercase tracking-widest text-primary">{f.category} · drives as {base.name}</p>
                      <p className="text-lg">{f.name}</p>
                      <p className="text-[11px] text-muted-foreground">{f.hardpoints.join(" · ")} · {f.ability}</p>
                    </div>
                    {!has ? <Button size="sm" onClick={() => run(buyFleetVehicle(progression, f.id), true)}>Buy · {costText(f.cost)}</Button>
                      : active ? <span className="font-mono text-[10px] uppercase tracking-widest text-primary">Active</span>
                      : <Button size="sm" variant="outline" onClick={() => run(setActiveFleet(progression, f.id), true)}>Set active</Button>}
                  </div>
                  {has && (
                    <>
                      <div className="mt-2 grid gap-1 sm:grid-cols-2">
                        {f.nodes.map((n) => { const lvl = fleet.tuning[f.id]?.[n.id] ?? 0; return (
                          <div key={n.id} className="flex items-center justify-between gap-2 border border-border/60 px-2 py-1.5">
                            <span className="text-xs">{n.name} <span className="text-muted-foreground">{lvl}/{n.maxLevel} · {n.text}</span></span>
                            <Button size="sm" variant="outline" disabled={lvl >= n.maxLevel} onClick={() => run(tuneNode(progression, f.id, n.id))}>{lvl >= n.maxLevel ? "Max" : costText(n.cost)}</Button>
                          </div>
                        ); })}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">{f.paints.map((pt) => <button key={pt} onClick={() => run(setPaint(progression, f.id, pt))} className={`border px-2 py-0.5 text-[11px] ${fleet.paint[f.id] === pt ? "border-primary text-primary" : "border-border"}`}>{pt}</button>)}</div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {notice && <p className="mt-3 font-mono text-xs text-primary">{notice}</p>}
        <p className="mt-3 text-[11px] text-muted-foreground">Tuning changes your active vehicle's real speed, hull, handling and ram. Paint is saved for later model work: the current vehicle models don't show it yet.</p>
      </div>
    </div>
  );
}
