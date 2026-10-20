import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { PlayerProgression } from "@/game/progression";
import { LISTING_TABS, TAB_LABEL, buyListing, listings, ownsListing, parkedHere, styleLabel, type Listing, type ListingTab } from "@/game/property-listings";
import { parkVehicle, unparkVehicle, parkedAt, deedById } from "@/game/residence-deeds";
import { fleetById } from "@/game/fleet";
import { GARAGES } from "@/game/fleet";
import { nexBalance } from "@/game/nex";
import { HomeArt } from "./StoreArt";

type Result = { progression: PlayerProgression; message: string } | { error: string };

/**
 * The property agent's store (reference: the real-estate screen): Homes / Apartments / Condos / Garage quarters tabs,
 * a card per listing with its price, and a detail panel with the big picture and "Purchase property". Everything
 * listed is a real place in the world (property-listings.ts) and buying spends Nex through the same ledger as the
 * rest of the game. An owned home's panel also manages its garage: park any fleet vehicle you own in a free bay,
 * take one out, or — standing at the house — drive it straight out of the bay.
 */
export function RealEstateStore({ progression, onProgression, onClose, startId, only, embedded = false, nearId, onTravel, onDecorate, onDriveOut }: {
  progression: PlayerProgression; onProgression: (p: PlayerProgression) => void; onClose?: () => void;
  startId?: string | null | undefined; only?: readonly string[] | undefined; embedded?: boolean;
  /** the walk-in home you're standing at (Drive out only works there) */
  nearId?: string | null | undefined;
  onTravel?: ((name: string, x: number, z: number) => void) | undefined; onDecorate?: ((homeId: string) => void) | undefined;
  onDriveOut?: ((deedId: string, vehicleId: string, bay: number) => void) | undefined;
}) {
  const all = useMemo(() => listings().filter((l) => !only || only.includes(l.id)), [only]);
  const start = all.find((l) => l.id === startId);
  const tabs = LISTING_TABS.filter((t) => all.some((l) => l.tab === t));
  const [tab, setTab] = useState<ListingTab>(start?.tab ?? tabs[0] ?? "HOMES");
  const [pick, setPick] = useState<string | null>(start?.id ?? null);
  const [confirm, setConfirm] = useState(false);
  const [notice, setNotice] = useState("");
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    if (embedded) return;
    const k = (e: KeyboardEvent) => { if (e.code === "Escape") close.current?.(); };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [embedded]);
  const shown = all.filter((l) => l.tab === tab);
  const sel = all.find((l) => l.id === pick) ?? shown[0] ?? null;
  const nex = nexBalance(progression.nexLedger);
  const run = (r: Result) => { if ("error" in r) setNotice(r.error); else { onProgression(r.progression); setNotice(r.message); } };

  const body = <>
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--wf-line)] pb-3">
      <div>
        <p className="ui-kicker">Veyra Realty · Real estate</p>
        <h2 className="mt-1 text-2xl font-light uppercase tracking-[0.12em]">Properties for sale</h2>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-mono text-sm text-amber-300" aria-label="Your Nex">NΞ {nex.toLocaleString()}</span>
        {onClose && !embedded && <Button size="sm" variant="outline" className="rounded-none" onClick={onClose}>Leave [Esc]</Button>}
      </div>
    </div>
    {tabs.length > 1 && <div className="wf-tabs mt-3" role="tablist" aria-label="Property type">{tabs.map((t) => <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => { setTab(t); setPick(null); setConfirm(false); setNotice(""); }} className="wf-tab">{TAB_LABEL[t]} <span className="opacity-60">{all.filter((l) => l.tab === t).length}</span></button>)}</div>}
    <div className={`mt-4 grid gap-4 ${embedded ? "" : "lg:grid-cols-[minmax(0,1.25fr)_minmax(19rem,1fr)]"}`}>
      <ul className={`grid gap-3 ${embedded ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`} aria-label={TAB_LABEL[tab]}>
        {shown.map((l) => { const mine = ownsListing(progression, l.id), on = sel?.id === l.id; return <li key={l.id}>
          <button type="button" aria-pressed={on} onClick={() => { setPick(l.id); setConfirm(false); setNotice(""); }} className={`wf-card w-full text-left ${on ? "wf-card-on" : ""}`}>
            <HomeArt style={l.style} kind={l.kind} city={l.art} className="block aspect-[5/3] w-full" />
            <span className="block px-2 pt-1.5 text-[13px] font-medium leading-tight">{l.name}</span>
            <span className="block px-2 text-[10px] uppercase tracking-wider text-muted-foreground">{l.place}</span>
            <span className="flex items-center justify-between px-2 pb-2 pt-1"><span className="font-mono text-xs text-amber-300">NΞ {l.price.toLocaleString()}</span><span className={`wf-chip ${mine ? "wf-chip-owned" : ""}`}>{mine ? "Owned" : "Buy"}</span></span>
          </button>
        </li>; })}
      </ul>
      {sel && <ListingDetail l={sel} progression={progression} nex={nex} confirm={confirm} setConfirm={setConfirm} run={run} near={nearId === sel.id} onTravel={onTravel} onDecorate={onDecorate} onDriveOut={onDriveOut} />}
    </div>
    {notice && <p className="mt-3 font-mono text-xs text-primary" role="status">{notice}</p>}
  </>;
  if (embedded) return <div className="wf-panel p-3">{body}</div>;
  return <div className="wf-shell absolute inset-0 z-40 flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Veyra Realty">
    <div className="wf-panel max-h-[92vh] w-full max-w-6xl overflow-y-auto p-4 sm:p-6">{body}</div>
  </div>;
}

function ListingDetail({ l, progression, nex, confirm, setConfirm, run, near, onTravel, onDecorate, onDriveOut }: {
  l: Listing; progression: PlayerProgression; nex: number; confirm: boolean; setConfirm: (v: boolean) => void; run: (r: Result) => void; near: boolean;
  onTravel?: ((name: string, x: number, z: number) => void) | undefined; onDecorate?: ((homeId: string) => void) | undefined; onDriveOut?: ((deedId: string, vehicleId: string, bay: number) => void) | undefined;
}) {
  const mine = ownsListing(progression, l.id);
  const baseMissing = l.needsBase && !(progression.fleet?.garages ?? []).includes(l.needsBase);
  const parked = parkedHere(progression, l.id), at = parkedAt(progression);
  const fleet = (progression.fleet?.owned ?? []).map(fleetById).filter((f): f is NonNullable<typeof f> => !!f);
  return <section className="wf-detail" aria-label={l.name}>
    <HomeArt style={l.style} kind={l.kind} city={l.art} className="block aspect-[16/9] w-full" />
    <div className="p-4">
      <p className="ui-kicker">{styleLabel(l)} · {l.place}</p>
      <h3 className="mt-1 text-xl font-light uppercase tracking-[0.08em]">{l.name}</h3>
      <p className="mt-1 font-mono text-lg text-amber-300">NΞ {l.price.toLocaleString()}</p>
      <p className="mt-2 text-sm text-foreground/85">{l.blurb}</p>
      <ul className="mt-3 grid grid-cols-3 gap-px bg-[var(--wf-line)] text-center text-[11px]">
        <li className="bg-background/70 py-1.5"><b className="block text-sm">{l.rooms}</b>rooms</li>
        <li className="bg-background/70 py-1.5"><b className="block text-sm">{l.bays || "—"}</b>parking</li>
        <li className="bg-background/70 py-1.5"><b className="block text-sm">{l.decor ? "Yes" : "Built-in"}</b>decor</li>
      </ul>
      {!mine ? <div className="mt-4">
        {baseMissing ? <p className="text-xs text-amber-400">Buy the {GARAGES[l.needsBase!].name} first: these quarters are built into it.</p>
          : confirm ? <div className="flex gap-2"><Button className="wf-cta flex-1 rounded-none" onClick={() => { run(buyListing(progression, l.id)); setConfirm(false); }}>Confirm · NΞ {l.price.toLocaleString()}</Button><Button variant="outline" className="rounded-none" onClick={() => setConfirm(false)}>Cancel</Button></div>
          : <Button className="wf-cta w-full rounded-none" disabled={nex < l.price} onClick={() => setConfirm(true)}>{nex < l.price ? `Needs NΞ ${(l.price - nex).toLocaleString()} more` : "Purchase property"}</Button>}
      </div> : <div className="mt-4 space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-widest text-emerald-300">Owned · yours</p>
        <div className="flex flex-wrap gap-2">
          {onTravel && l.door && <Button size="sm" className="rounded-none" onClick={() => onTravel(l.name, l.door!.x, l.door!.z)}>Go home</Button>}
          {onDecorate && l.decor && <Button size="sm" variant="outline" className="rounded-none" onClick={() => onDecorate(l.id)}>Decorate</Button>}
        </div>
        {l.bays > 0 && <div>
          <p className="ui-kicker">Garage · {parked.length}/{l.bays} bays</p>
          <ul className="mt-1 space-y-1">
            {Array.from({ length: l.bays }, (_, i) => { const v = parked[i] ? fleetById(parked[i]!) : null; return <li key={i} className="flex items-center justify-between gap-2 border border-[var(--wf-line)] bg-background/60 px-2 py-1.5 text-xs">
              <span><span className="text-muted-foreground">Bay {i + 1} · </span>{v ? v.name : "empty"}</span>
              {v && <span className="flex gap-1">
                {near && onDriveOut && <Button size="sm" className="h-7 rounded-none px-2 text-[11px]" onClick={() => onDriveOut(l.id, v.id, i)}>Drive out</Button>}
                <Button size="sm" variant="outline" className="h-7 rounded-none px-2 text-[11px]" onClick={() => run(unparkVehicle(progression, v.id))}>Take out</Button>
              </span>}
            </li>; })}
          </ul>
          {parked.length < l.bays && fleet.filter((f) => at[f.id] !== l.id).length > 0 && <div className="mt-2">
            <p className="text-[11px] text-muted-foreground">Have a vehicle delivered here:</p>
            <div className="mt-1 flex flex-wrap gap-1">{fleet.filter((f) => at[f.id] !== l.id).map((f) => <Button key={f.id} size="sm" variant="outline" className="h-7 rounded-none px-2 text-[11px]" onClick={() => run(parkVehicle(progression, f.id, l.id))}>{f.name}{at[f.id] ? ` · from ${deedById(at[f.id]!)?.address ?? "elsewhere"}` : ""}</Button>)}</div>
          </div>}
          {!fleet.length && <p className="mt-1 text-[11px] text-muted-foreground">Buy a vehicle at a garage base and it can be delivered here. You can also drive one in and step out.</p>}
        </div>}
      </div>}
    </div>
  </section>;
}
