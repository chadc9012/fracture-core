import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { PlayerProgression } from "@/game/progression";
import { EMPTY_FLEET, FLEET, GARAGES, buyFleetVehicle, buyGarage, setActiveFleet, setPaint, tuneNode, tunedVehicle, type FleetEntry, type GarageId } from "@/game/fleet";
import { vehicleById } from "@/game/vehicles";
import { MATERIALS, type MaterialId } from "@/game/inventory";
import { ownedDeeds, parkVehicle, parkedAt, parkedIn } from "@/game/residence-deeds";
import { VehicleArt } from "./StoreArt";

const costText = (c: Partial<Record<MaterialId, number>>) => Object.entries(c).map(([k, v]) => `${v} ${MATERIALS[k as MaterialId]?.name ?? k}`).join(" · ");
const CAT_LABEL: Record<FleetEntry["category"], string> = { LAND: "Cars & bikes", AIR: "Air", HEAVY: "Heavy armour", AQUATIC: "Aquatic" };
type Tab = "ALL" | FleetEntry["category"];

/** the stats a buyer compares (reference: the vehicle catalogue's speed / handling / armour), scaled 0-100 from the
 * vehicle's real driving numbers with the build's tuning applied */
export function vehicleStats(f: FleetEntry, fleet: PlayerProgression["fleet"]) {
  const v = tunedVehicle(vehicleById(f.base), fleet?.active === f.id ? fleet : undefined);
  const pct = (x: number, top: number) => Math.max(4, Math.min(100, Math.round((x / top) * 100)));
  return [["Speed", pct(v.speed, 2)], ["Handling", pct(v.handling, 1.6)], ["Armour", pct(v.hull, 2.5)], ["Ram", pct(v.ram, 2.4)]] as const;
}

/**
 * A garage base is the dealership (fleet.ts): buy the base, then the vehicles sold there by category tab, each with
 * its real stats; buying one unlocks it to drive and makes it active. Owned vehicles are tuned and painted here, and
 * can be delivered to a free bay in any home garage you own (residence-deeds.ts).
 */
export function GaragePanel({ garageId, progression, onProgression, onSelectVehicle, onClose }: { garageId: GarageId; progression: PlayerProgression; onProgression: (p: PlayerProgression) => void; onSelectVehicle: (id: PlayerProgression["selectedVehicle"]) => void; onClose: () => void }) {
  const g = GARAGES[garageId];
  const fleet = progression.fleet ?? EMPTY_FLEET;
  const owned = fleet.garages.includes(garageId);
  const here = FLEET.filter((f) => f.garage === garageId);
  const cats = [...new Set(here.map((f) => f.category))];
  const [tab, setTab] = useState<Tab>("ALL");
  const [pick, setPick] = useState<string>(here[0]?.id ?? "");
  const [confirm, setConfirm] = useState(false);
  const [notice, setNotice] = useState("");
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.code === "Escape") close.current(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, []);
  const run = (r: { progression: PlayerProgression; message: string } | { error: string }, select = false) => {
    if ("error" in r) { setNotice(r.error); return; }
    onProgression(r.progression); setNotice(r.message);
    if (select) onSelectVehicle(r.progression.selectedVehicle);
  };
  const shown = here.filter((f) => tab === "ALL" || f.category === tab);
  const sel = here.find((f) => f.id === pick) ?? shown[0];

  return (
    <div className="wf-shell absolute inset-0 z-40 flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={g.name}>
      <div className="wf-panel max-h-[92vh] w-full max-w-6xl overflow-y-auto p-4 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--wf-line)] pb-3">
          <div>
            <p className="ui-kicker">Vehicle dealership · {g.region}</p>
            <h2 className="mt-1 text-2xl font-light uppercase tracking-[0.12em]">{g.name}</h2>
            <p className="text-xs text-muted-foreground">{g.blurb}</p>
          </div>
          <Button size="sm" variant="outline" className="rounded-none" onClick={onClose}>Leave [Esc]</Button>
        </div>
        {!owned && <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border border-amber-400/40 bg-amber-400/5 p-3">
          <p className="text-sm">Buy this base to buy and store its vehicles. <span className="text-muted-foreground">Payment in materials · {costText(g.cost)}</span></p>
          <Button className="wf-cta rounded-none" onClick={() => run(buyGarage(progression, garageId))}>Buy base</Button>
        </div>}
        <div className="wf-tabs mt-3" role="tablist" aria-label="Vehicle class">
          {(["ALL", ...cats] as Tab[]).map((t) => <button key={t} type="button" role="tab" aria-selected={tab === t} className="wf-tab" onClick={() => { setTab(t); setConfirm(false); setNotice(""); }}>{t === "ALL" ? "All" : CAT_LABEL[t]}</button>)}
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(19rem,1fr)]">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {shown.map((f) => { const has = fleet.owned.includes(f.id), on = sel?.id === f.id; return <li key={f.id}>
              <button type="button" aria-pressed={on} onClick={() => { setPick(f.id); setConfirm(false); setNotice(""); }} className={`wf-card w-full text-left ${on ? "wf-card-on" : ""}`}>
                <VehicleArt category={f.category} hover={f.base === "aether-hoverbike"} className="block aspect-[5/3] w-full" />
                <span className="block px-2 pt-1.5 text-[13px] font-medium leading-tight">{f.name}</span>
                <span className="block px-2 text-[10px] uppercase tracking-wider text-muted-foreground">{CAT_LABEL[f.category]}</span>
                <span className="flex items-center justify-between gap-1 px-2 pb-2 pt-1"><span className="truncate font-mono text-[10px] text-amber-300">{costText(f.cost)}</span><span className={`wf-chip shrink-0 ${has ? "wf-chip-owned" : ""}`}>{fleet.active === f.id ? "Active" : has ? "Owned" : "Buy"}</span></span>
              </button>
            </li>; })}
          </ul>
          {sel && <VehicleDetail f={sel} progression={progression} baseOwned={owned} confirm={confirm} setConfirm={setConfirm} run={run} />}
        </div>
        {notice && <p className="mt-3 font-mono text-xs text-primary" role="status">{notice}</p>}
        <p className="mt-3 text-[11px] text-muted-foreground">Tuning changes the vehicle's real speed, hull, handling and ram. Paint is saved for later model work: the current models don't show it yet.</p>
      </div>
    </div>
  );
}

function VehicleDetail({ f, progression, baseOwned, confirm, setConfirm, run }: { f: FleetEntry; progression: PlayerProgression; baseOwned: boolean; confirm: boolean; setConfirm: (v: boolean) => void; run: (r: { progression: PlayerProgression; message: string } | { error: string }, select?: boolean) => void }) {
  const fleet = progression.fleet ?? EMPTY_FLEET;
  const has = fleet.owned.includes(f.id), active = fleet.active === f.id, base = vehicleById(f.base);
  const homes = ownedDeeds(progression).filter((d) => d.bays > 0);
  const at = parkedAt(progression)[f.id];
  return <section className="wf-detail" aria-label={f.name}>
    <VehicleArt category={f.category} hover={f.base === "aether-hoverbike"} className="block aspect-[16/9] w-full" />
    <div className="p-4">
      <p className="ui-kicker">{CAT_LABEL[f.category]} · drives as {base.name}</p>
      <h3 className="mt-1 text-xl font-light uppercase tracking-[0.08em]">{f.name}</h3>
      <p className="mt-1 font-mono text-sm text-amber-300">{costText(f.cost)}</p>
      <div className="mt-3 space-y-1.5">{vehicleStats(f, progression.fleet).map(([k, v]) => <div key={k}><div className="flex justify-between text-[11px]"><span>{k}</span><span className="font-mono text-[var(--wf-ice)]">{v}</span></div><div className="wf-stat"><i style={{ width: `${v}%` }} /></div></div>)}</div>
      <p className="mt-3 text-xs text-foreground/85">{f.hardpoints.join(" · ")}</p>
      <p className="text-xs text-muted-foreground">Ability: {f.ability}</p>
      <div className="mt-4">
        {!has ? (!baseOwned ? <p className="text-xs text-amber-400">Buy the base first.</p>
          : confirm ? <div className="flex gap-2"><Button className="wf-cta flex-1 rounded-none" onClick={() => { run(buyFleetVehicle(progression, f.id), true); setConfirm(false); }}>Confirm purchase</Button><Button variant="outline" className="rounded-none" onClick={() => setConfirm(false)}>Cancel</Button></div>
          : <Button className="wf-cta w-full rounded-none" onClick={() => setConfirm(true)}>Buy vehicle</Button>)
          : <div className="space-y-3">
            {active ? <p className="font-mono text-[11px] uppercase tracking-widest text-emerald-300">Active · summon with V</p> : <Button size="sm" className="rounded-none" onClick={() => run(setActiveFleet(progression, f.id), true)}>Make active</Button>}
            <div>
              <p className="ui-kicker">Tuning</p>
              <div className="mt-1 grid gap-1">{f.nodes.map((n) => { const lvl = fleet.tuning[f.id]?.[n.id] ?? 0; return (
                <div key={n.id} className="flex items-center justify-between gap-2 border border-[var(--wf-line)] px-2 py-1.5">
                  <span className="text-xs">{n.name} <span className="text-muted-foreground">{lvl}/{n.maxLevel} · {n.text}</span></span>
                  <Button size="sm" variant="outline" className="h-7 rounded-none px-2 text-[10px]" disabled={lvl >= n.maxLevel} onClick={() => run(tuneNode(progression, f.id, n.id))}>{lvl >= n.maxLevel ? "Max" : costText(n.cost)}</Button>
                </div>); })}</div>
            </div>
            <div><p className="ui-kicker">Paint</p><div className="mt-1 flex flex-wrap gap-1">{f.paints.map((pt) => <button key={pt} type="button" onClick={() => run(setPaint(progression, f.id, pt))} className={`border px-2 py-0.5 text-[11px] ${fleet.paint[f.id] === pt ? "border-[var(--wf-ice)] text-[var(--wf-ice)]" : "border-[var(--wf-line)]"}`}>{pt}</button>)}</div></div>
            <div>
              <p className="ui-kicker">Home garage</p>
              {homes.length ? <div className="mt-1 flex flex-wrap gap-1">{homes.map((d) => { const full = parkedIn(progression, d.id).length >= d.bays && at !== d.id; return <Button key={d.id} size="sm" variant="outline" className="h-7 rounded-none px-2 text-[11px]" disabled={at === d.id || full} onClick={() => run(parkVehicle(progression, f.id, d.id))}>{at === d.id ? `Parked at ${d.address}` : full ? `${d.address} · full` : `Deliver to ${d.address}`}</Button>; })}</div>
                : <p className="mt-1 text-[11px] text-muted-foreground">Own a walk-in home with a garage and this vehicle can be delivered there.</p>}
            </div>
          </div>}
      </div>
    </div>
  </section>;
}
