import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { DIRECTORY, FLOOR_SPOTS, residenceFloor, type ResidenceFloorId, type Spot } from "@/game/nexus-residences";
import { EVAC_REWARD, LOBBY, MORNING_FOR, MORNING_REWARD, RESIDENTS, canRide, finishEvac, getEvac, markMorning, morningDone, morningSteps, rescueNeighbour, residentLine, startEvac, subscribeEvac } from "@/game/residence-life";
import { train } from "@/game/attributes";
import { newsHeadline, nextStation, workOut } from "@/game/apartment-actions";
import { activeBuffs, liftRequest, restRequest } from "@/game/client-input";
import { getMusicSource, setMusicSource } from "@/game/radio-stations";
import { unlockAudio } from "@/game/audio";
import { grantXP } from "@/game/xp";
import type { PlayerProgression } from "@/game/progression";
import type { StoryLine } from "@/game/boss-stories";
import { CourtGames } from "./CourtGames";

/** pay a residence reward once: flat xp (as an objective grant) and nex under its own ledger key */
function pay(p: PlayerProgression, key: string, xp: number, nex: number): PlayerProgression {
  let next = xp > 0 ? grantXP(p, "OBJECTIVE", { scale: xp / 150 }).progression : p;
  if (nex > 0 && !(key in next.nexLedger)) next = { ...next, nexLedger: { ...next.nexLedger, [key]: nex } };
  return next;
}
const day = () => Math.floor(Date.now() / 86_400_000);

/** Nexus City Residences in play (residence-life.ts): the spot buttons on every floor, the elevator directory, talking to
 * residents, the first-morning checklist, the fracture evacuation (alarm, stairs, rescue, escape) and the court games. */
export function ResidencePanels({ inside, spotId, liftCall, residentId, progression, setProgression, toast, say, blocked, open }: {
  inside: string | null; spotId: string | null; liftCall: boolean; residentId: string | null; progression: PlayerProgression;
  setProgression: (f: (p: PlayerProgression) => PlayerProgression) => void; toast: (text: string) => void; say: (line: StoryLine) => void;
  /** another panel is open: hide the in-world buttons */ blocked: boolean;
  open: { menu: () => void; stash: () => void; wardrobe: () => void; garage: () => void };
}) {
  const floor = residenceFloor(inside);
  const evac = useSyncExternalStore(subscribeEvac, getEvac, getEvac);
  const [court, setCourt] = useState(false);
  const talks = useRef<Record<string, number>>({});
  const prevInside = useRef<string | null>(null);
  const progRef = useRef(progression); progRef.current = progression;

  // the fracture: once the first morning is done, entering the building (or finishing the routine) sets it off; walking out
  // through the lobby doors while it is on ends it
  useEffect(() => {
    const was = prevInside.current; prevInside.current = inside;
    if (floor && startEvac(progRef.current, Date.now(), floor.id)) { toast("REALITY FRACTURE · Evacuate the building · elevators offline, take the emergency stairs"); say({ speaker: "Building alarm", text: "Reality collision detected. Evacuate immediately by the emergency stairs." }); }
    // only walking out of the lobby's street doors ends it (a skip or a travel from an upper floor does not count as escaping)
    if (!inside && was === LOBBY && getEvac().phase === "alarm") {
      const r = finishEvac(progRef.current);
      if (r) {
        setProgression((cur) => pay({ ...cur, earnedRewards: [...new Set([...cur.earnedRewards, ...r.progression.earnedRewards])] }, "res:evac", r.xp, r.nex));
        say({ speaker: "Nexus City Residences", text: r.rescued ? "You got out, and you brought Mara with you. The city owes you one." : "You got out. Mara made it too, no thanks to luck." });
        toast(`Evacuated · +${r.xp} XP · +${r.nex} Nex${r.rescued ? " · neighbour rescued" : ""}`);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inside]);

  if (!floor) return court ? <CourtGames progression={progression} onProgression={(n) => setProgression(() => n)} onClose={() => setCourt(false)} onToast={toast} /> : null;
  const spot: Spot | null = spotId ? (FLOOR_SPOTS[floor.id] ?? []).find((s) => s.id === spotId) ?? null : null;
  const resident = residentId ? RESIDENTS.find((r) => r.id === residentId) ?? null : null;
  const steps = morningSteps(progression), morning = !morningDone(progression);

  const tick = (key: string | undefined) => {
    const step = key ? MORNING_FOR[key] : undefined;
    if (!step) return;
    setProgression((cur) => {
      const r = markMorning(cur, step);
      if (!r.finished) return r.progression;
      toast(`Morning routine done · +${MORNING_REWARD.xp} XP · +${MORNING_REWARD.nex} Nex`);
      const paid = pay(r.progression, "res:morning", MORNING_REWARD.xp, MORNING_REWARD.nex);
      // the fracture hits as the morning ends
      const here = floor?.id ?? null;
      window.setTimeout(() => {
        if (!startEvac(paid, Date.now(), here)) return;
        if (here === LOBBY) { toast("REALITY FRACTURE · Get out of the building · through the street doors"); say({ speaker: "Mara", text: "That's not the lights. Something's tearing the city open. Doors, now, go!" }); }
        else { toast("REALITY FRACTURE · Evacuate the building · elevators offline, take the emergency stairs"); say({ speaker: "Building alarm", text: "Reality collision detected. All residents evacuate by the emergency stairs. Do not use the elevators." }); }
      }, 1200);
      return paid;
    });
  };
  const trainAt = (id: string, extra?: string) => {
    const r = train(progRef.current, id);
    if ("error" in r) { toast(extra ? `${extra} · ${r.error}` : r.error); return; }
    setProgression(() => r.progression);
    toast(extra ? `${extra} · ${r.message}` : r.message);
  };
  const act = (s: Spot) => {
    tick(s.id);
    switch (s.action) {
      case "rest": restRequest.current = true; return;
      case "pc": open.menu(); return;
      case "stash": open.stash(); return;
      case "wardrobe": open.wardrobe(); return;
      case "garage": open.garage(); return;
      case "court": setCourt(true); return;
      case "tv": { const n = newsHeadline(progRef.current); toast(`Nexus City News · ${n.headline} · ${n.ticker}`); return; }
      case "radio": { const n = nextStation(getMusicSource()); unlockAudio(); setMusicSource(n.source); toast(`World Fracture Radio · ${n.name}`); return; }
      case "workout": {
        const r = workOut(progRef.current, activeBuffs.current);
        if ("error" in r) { toast(r.error); return; }
        activeBuffs.current = r.buffs;
        const t = train(r.progression, "workout");
        setProgression(() => ("error" in t ? r.progression : t.progression));
        toast(`${r.message}${"error" in t ? "" : ` · ${t.message}`}`);
        return;
      }
      case "breakfast": toast("Eggs, toast, coffee. The skyline's quiet. For now."); return;
      case "phone": say({ speaker: "Message · Mara (12-02)", text: "Morning! Lights flickered again last night. Building's been weird. Coffee in the lobby later?" }); return;
      case "mail": {
        const key = `res:mail:${day()}`;
        if (progRef.current.earnedRewards.includes(key)) { toast("Your box is empty. Ivo says try again tomorrow."); return; }
        setProgression((cur) => ({ ...pay(cur, key, 0, 40), earnedRewards: [...cur.earnedRewards, key] }));
        toast("A parcel for 12-04 · +40 Nex");
        return;
      }
      case "shift": {
        const key = `res:shift:${day()}`;
        if (progRef.current.earnedRewards.includes(key)) { toast("You've done your shift today."); return; }
        setProgression((cur) => ({ ...pay(cur, key, 0, 90), earnedRewards: [...cur.earnedRewards, key] }));
        trainAt("shift", "Shift done · +90 Nex");
        return;
      }
      case "gym": trainAt("gym", "Sets on the rack, miles on the treadmill"); return;
      case "pool": trainAt("pool", "Forty laps"); return;
      case "dog": trainAt("dog", "Biscuit steals the ball. Rook brings it back"); return;
      case "laundry": toast("Washer 4 is free. Twenty minutes, then the dryer."); return;
      case "grill": toast("Burgers on the grill. Kito's dogs stare at you, hopeful."); return;
      case "garden": toast("Quiet in the garden. The city hum sounds far away."); return;
      case "coffee": toast("Good coffee. Priya was right."); return;
      case "games": toast("Two games of pool, one win. The arcade high score still isn't yours."); return;
      case "theater": toast("Tonight's film: an old one about the sky falling. Fitting."); return;
      case "spa": toast("Hot water, cold air, the city lights below."); return;
      case "view": toast("Nexus City to the horizon. The Fracture Moon hangs over the gulf."); return;
    }
  };
  const talk = () => {
    if (!resident) return;
    if (resident.id === "mara" && evac.phase === "alarm" && !evac.rescued) {
      rescueNeighbour();
      say({ speaker: "Mara", text: "You came back for me! The lifts are dead. Stairs, now, I'm right behind you." });
      return;
    }
    const n = talks.current[resident.id] ?? 0; talks.current[resident.id] = n + 1;
    say({ speaker: `${resident.name} · ${resident.role}`, text: residentLine(resident, n) });
    tick(`talk:${resident.id}`);
  };

  return <>
    {/* the alarm */}
    {evac.phase === "alarm" && <div className="pointer-events-none absolute left-1/2 top-24 z-[62] w-[min(30rem,92vw)] -translate-x-1/2 border-2 border-red-500 bg-red-950/85 px-3 py-2 text-center shadow-[0_0_30px_rgba(255,40,40,0.5)]" role="alert">
      <p className="font-mono text-xs font-bold uppercase tracking-[0.3em] text-red-300 wf-pulse">Reality fracture · Evacuate</p>
      <p className="text-sm text-white">{floor?.id === LOBBY ? <>Get out through the <b className="text-emerald-300">street doors</b>.</> : <>Elevators offline. Take the <b className="text-emerald-300">emergency stairs</b> (green EXIT) down to the lobby.</>}</p>
      <p className="mt-0.5 text-xs text-red-200">{evac.rescued ? "Mara is with you. Get to the street." : "Mara is trapped in the Floor 11 lounge."}</p>
    </div>}
    {/* the first morning */}
    {morning && !blocked && evac.phase !== "alarm" && <div className="pointer-events-none absolute right-3 top-28 z-[61] w-56 border border-amber-300/40 bg-background/85 p-2 text-xs">
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-amber-300">Morning in 12-04</p>
      <ul className="mt-1 space-y-0.5">{steps.map((s) => <li key={s.id} className={s.done ? "text-muted-foreground line-through" : ""}>{s.done ? "✓" : "○"} {s.label}{!s.done && <span className="block pl-3 text-[10px] text-muted-foreground">{s.hint}</span>}</li>)}</ul>
    </div>}
    {!blocked && !court && <div className="pointer-events-none absolute bottom-48 left-1/2 z-[61] flex -translate-x-1/2 flex-col items-center gap-1.5">
      {spot && <Button className="pointer-events-auto" variant="outline" onClick={() => act(spot)}>{morning && spot.action === "rest" ? "Rest a minute" : spot.label}</Button>}
      {resident && <Button className="pointer-events-auto" variant="outline" onClick={talk}>{resident.id === "mara" && evac.phase === "alarm" && !evac.rescued ? "Help Mara" : `Talk to ${resident.name} · ${resident.role}`}</Button>}
    </div>}
    {/* the elevator directory */}
    {liftCall && !blocked && <div className="absolute left-1/2 top-1/2 z-[62] w-[min(20rem,90vw)] -translate-x-1/2 -translate-y-1/2 border border-cyan-300/50 bg-[#0b1420]/95 p-3 text-white shadow-2xl" role="dialog" aria-label="Elevator">
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan-300">Nexus City Residences · Elevator</p>
      {evac.phase === "alarm" ? <p className="mt-2 border border-red-500 bg-red-950/70 p-2 text-sm text-red-200">OUT OF ORDER · Elevators stopped. Use the emergency stairs.</p>
        : <ul className="mt-2 space-y-1">{DIRECTORY.map((d) => { const why = canRide(floor.id, d.id as ResidenceFloorId); return <li key={d.id}><button type="button" disabled={!!why} onClick={() => { liftRequest.current = d.id; }}
          className={`flex w-full items-center gap-2 border px-2 py-1.5 text-left text-sm ${d.id === floor.id ? "border-cyan-300 bg-cyan-300/15" : "border-white/15 bg-white/5 hover:border-cyan-300"} disabled:opacity-60`}>
          <span className="w-12 font-mono text-cyan-300">{d.code}</span><span>{d.name}</span>{d.id === floor.id && <span className="ml-auto font-mono text-[10px] text-cyan-200">YOU</span>}</button></li>; })}</ul>}
      <p className="mt-2 text-[10px] text-white/50">Step off the pad to close.</p>
    </div>}
    {court && <CourtGames progression={progression} onProgression={(n) => setProgression(() => n)} onClose={() => setCourt(false)} onToast={toast} />}
  </>;
}
export { EVAC_REWARD };
