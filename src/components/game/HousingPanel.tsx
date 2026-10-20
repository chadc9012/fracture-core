import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { PlayerProgression } from "@/game/progression";
import { DECOR, HOMES, buyDecor, buyHome, decorById, homeById, ownsDecor, ownsHome, placeDecor, type DecorSlot } from "@/game/housing";
import { nexBalance } from "@/game/nex";

const SLOTS: DecorSlot[] = ["paint", "wallpaper", "floor", "furniture", "art", "tv", "bed", "bath", "lighting"];
const ROOM_NAME = { living: "Living room", bedroom: "Bedroom", bathroom: "Bathroom", kitchen: "Kitchen", garage: "Garage" } as const;

/** Veyra Realty: buy homes, then decorate any owned home room by room (housing.ts). */
export function HousingPanel({ progression, onProgression, onClose, startTab = "HOMES", startHome }: { startHome?: string | undefined; progression: PlayerProgression; onProgression: (p: PlayerProgression) => void; onClose: () => void; startTab?: "HOMES" | "DECORATE" }) {
  const [tab, setTab] = useState(startTab);
  const [notice, setNotice] = useState("");
  const owned = HOMES.filter((h) => ownsHome(progression, h.id));
  const [homeId, setHomeId] = useState<string | null>(startHome ?? progression.housing?.home ?? owned[0]?.id ?? null);
  const [room, setRoom] = useState(0);
  const [confirm, setConfirm] = useState<string | null>(null);
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.code === "Escape") close.current(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, []);
  const run = (r: { progression: PlayerProgression; message: string } | { error: string }) => { if ("error" in r) setNotice(r.error); else { onProgression(r.progression); setNotice(r.message); } };
  const home = homeId ? homeById(homeId) : undefined;
  const roomType = home?.rooms[room];
  const placed = (homeId && progression.housing?.placed[homeId]) || {};

  return (
    <div className="wf-shell absolute inset-0 z-40 flex items-center justify-center bg-background/85 p-4" role="dialog" aria-label="Veyra Realty">
      <div className="wf-panel max-h-[88vh] w-full max-w-4xl overflow-y-auto p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-primary">Veyra Realty · {nexBalance(progression.nexLedger).toLocaleString()} Nex</p>
            <h3 className="mt-1 text-2xl font-semibold">{tab === "HOMES" ? "Properties for sale" : "Decorate your home"}</h3>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant={tab === "HOMES" ? "default" : "outline"} onClick={() => setTab("HOMES")}>Homes</Button>
            <Button size="sm" variant={tab === "DECORATE" ? "default" : "outline"} onClick={() => setTab("DECORATE")} disabled={!owned.length}>Decorate</Button>
            <Button size="sm" variant="outline" onClick={onClose}>Leave [Esc]</Button>
          </div>
        </div>

        {tab === "HOMES" ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {HOMES.map((h) => {
              const mine = ownsHome(progression, h.id);
              return (
                <div key={h.id} className={`border p-3 ${mine ? "border-primary" : "border-border"}`}>
                  <p className="font-mono text-[9px] uppercase tracking-widest text-primary">{h.kind.replace("_", " ")} · {h.district}</p>
                  <p className="text-lg">{h.name}</p>
                  <p className="text-[11px] text-muted-foreground">{h.blurb}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{h.rooms.map((r) => ROOM_NAME[r]).join(" · ")}</p>
                  <div className="mt-2">
                    {mine ? <Button size="sm" variant="outline" onClick={() => { setHomeId(h.id); setRoom(0); setTab("DECORATE"); }}>Owned · Decorate</Button>
                      : confirm === h.id ? <div className="flex gap-2"><Button size="sm" onClick={() => { run(buyHome(progression, h.id)); setConfirm(null); }}>Confirm {h.price.toLocaleString()} Nex</Button><Button size="sm" variant="outline" onClick={() => setConfirm(null)}>Cancel</Button></div>
                      : <Button size="sm" onClick={() => setConfirm(h.id)}>Buy · {h.price.toLocaleString()} Nex</Button>}
                  </div>
                </div>
              );
            })}
          </div>
        ) : home && homeId && roomType ? (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-1">{owned.map((h) => <button key={h.id} onClick={() => { setHomeId(h.id); setRoom(0); }} className={`border px-2 py-1 text-xs ${h.id === homeId ? "border-primary text-primary" : "border-border"}`}>{h.name}</button>)}</div>
            <div className="flex flex-wrap gap-1">{home.rooms.map((r, i) => <button key={i} onClick={() => setRoom(i)} className={`border px-2 py-1 text-xs ${i === room ? "border-primary text-primary" : "border-border"}`}>{ROOM_NAME[r]}</button>)}</div>
            {SLOTS.map((slot) => {
              const options = DECOR.filter((d) => d.slot === slot && d.rooms.includes(roomType));
              if (!options.length) return null;
              const current = placed[`${room}:${slot}`];
              return (
                <div key={slot} className="border border-border/60 p-2">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{slot} · {current ? decorById(current)?.name : "empty"}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {options.map((d) => {
                      const has = ownsDecor(progression, d.id), on = current === d.id;
                      return <Button key={d.id} size="sm" variant={on ? "default" : "outline"}
                        onClick={() => on ? run(placeDecor(progression, homeId, room, slot, null)) : has ? run(placeDecor(progression, homeId, room, slot, d.id)) : (() => { const b = buyDecor(progression, d.id); if ("error" in b) { setNotice(b.error); return; } run(placeDecor(b.progression, homeId, room, slot, d.id)); })()}>
                        {d.name}{has ? "" : ` · ${d.price.toLocaleString()} Nex`}
                      </Button>;
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : <p className="mt-4 text-sm text-muted-foreground">Buy a home first.</p>}
        {notice && <p className="mt-3 font-mono text-xs text-primary">{notice}</p>}
        <p className="mt-3 text-[11px] text-muted-foreground">Bought items are yours for every home — moving them is free. Tap a placed item again to remove it.</p>
      </div>
    </div>
  );
}
