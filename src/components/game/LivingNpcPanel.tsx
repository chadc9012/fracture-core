import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { PlayerProgression } from "@/game/progression";
import type { LivingHud } from "@/game/living-runtime";
import type { WasteHud } from "@/game/wasteland-runtime";
import { CITIES, DISTRICTS, EMPTY_LIVING, FACTIONS, TIER_RULES, districtStatus } from "@/game/living-world";
import { headingLabel, headingTo } from "@/game/compass";
import { REGIONS } from "@/game/world";
import { contractById, npcActions, npcById, npcLine, performNpcAction, repSummary } from "@/game/living-npcs";

/** Talk panel for Living World NPCs (living-npcs.ts): the NPC's line, your standing in their city, district status, your
 * contracts there and every action they offer. Every button runs a pure progression step; nothing here decides rules. */
export function LivingNpcPanel({ npcId, progression, eventTitle, onProgression, onClose }: { npcId: string; progression: PlayerProgression; eventTitle?: string | null; onProgression: (next: PlayerProgression) => void; onClose: () => void }) {
  const npc = npcById(npcId);
  const [notice, setNotice] = useState("");
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.code === "Escape") close.current(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  if (!npc) return null;
  const living = progression.living ?? EMPTY_LIVING;
  const now = Date.now();
  const faction = FACTIONS[npc.faction];
  const actions = npcActions(progression, npc, now);
  const standing = repSummary(progression, npc.city);
  const districts = DISTRICTS.filter((d) => d.city === npc.city);
  const contracts = Object.entries(living.contracts).map(([id, run]) => ({ c: contractById(id), run })).filter((x) => x.c && x.c.city === npc.city);
  const act = (id: string) => {
    const r = performNpcAction(progression, npc.id, id, Date.now());
    if ("error" in r) setNotice(r.error);
    else { onProgression(r.progression); setNotice(r.message); }
  };

  return (
    <div className="living-panel absolute inset-0 z-40 flex items-end justify-center bg-gradient-to-t from-background/90 via-background/40 to-transparent p-4 md:items-center">
      <div className="w-full max-w-3xl border border-border bg-card/95 p-5 shadow-2xl" style={{ borderTopColor: faction.color, borderTopWidth: 3 }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.3em]" style={{ color: faction.color }}>{faction.name} · {CITIES[npc.city].name}</p>
            <h3 className="mt-1 text-2xl font-semibold tracking-wide">{npc.name}</h3>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{npc.title}</p>
          </div>
          <Button size="sm" variant="outline" onClick={onClose}>Leave [Esc]</Button>
        </div>

        <p className="mt-4 border-l-2 pl-3 text-base italic leading-relaxed" style={{ borderColor: faction.color }}>"{npcLine(progression, npc, { eventTitle }, now)}"</p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="border border-border/60 p-3">
            <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground">Standing</p>
            {standing.map(({ faction: f, rep, tier }) => (
              <div key={f.id} className="mt-2">
                <div className="flex justify-between font-mono text-[11px]"><span>{f.name}</span><span style={{ color: TIER_RULES[tier].color }}>{TIER_RULES[tier].label} · {rep}</span></div>
                <div className="relative mt-1 h-1.5 bg-muted"><div className="absolute top-0 h-1.5" style={{ left: rep < 0 ? `${50 + rep / 2}%` : "50%", width: `${Math.abs(rep) / 2}%`, background: TIER_RULES[tier].color }} /><div className="absolute left-1/2 top-[-2px] h-2.5 w-px bg-foreground/50" /></div>
              </div>
            ))}
          </div>
          <div className="border border-border/60 p-3">
            <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground">Districts</p>
            {districts.map((d) => {
              const st = districtStatus(living, d.id, now);
              return <div key={d.id} className="mt-1 flex justify-between font-mono text-[11px]"><span>{d.name}</span><span className={st === "FALLEN" ? "text-destructive" : st === "SECURED" ? "text-emerald-400" : "text-muted-foreground"}>{st === "FALLEN" ? "Overrun · trade closed" : st === "SECURED" ? "Secured · 10% off" : "Stable"}</span></div>;
            })}
          </div>
        </div>

        {contracts.length > 0 && (
          <div className="mt-3 border border-border/60 p-3">
            <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground">Your contracts in {CITIES[npc.city].name}</p>
            {contracts.map(({ c, run }) => <p key={c!.id} className="mt-1 font-mono text-[11px]">{c!.title} · {c!.kind === "DELIVER" ? `deliver ${c!.amount} ${c!.material}` : `${Math.min(run.progress, c!.amount)}/${c!.amount}`} <span className="text-muted-foreground">({FACTIONS[c!.faction].name})</span></p>)}
          </div>
        )}

        <div className="mt-4 space-y-2">
          {actions.length === 0 && <p className="text-xs text-muted-foreground">{npc.name} has nothing more for you right now.</p>}
          {actions.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 border border-border p-3">
              <div><p className="font-mono text-sm">{a.label}</p><p className="text-[11px] text-muted-foreground">{a.detail}</p></div>
              <Button size="sm" variant={a.enabled ? "default" : "outline"} disabled={!a.enabled} title={a.enabled ? undefined : a.reason} onClick={() => act(a.id)}>{a.enabled ? "Confirm" : a.reason ?? "Locked"}</Button>
            </div>
          ))}
        </div>
        {notice && <p className="mt-3 font-mono text-xs text-primary">{notice}</p>}
      </div>
    </div>
  );
}

/** Live world-event card (mission-tracker style) plus the most recent Living World message. Presentation only. */
export function LivingTracker({ living, px, pz, toast, patrol, waste = null }: { living: LivingHud | null | undefined; px: number; pz: number; toast: string | null; patrol?: PlayerProgression["patrol"] | undefined; waste?: WasteHud }) {
  const ev = living?.event;
  const nem = living?.nemesis;
  const sec = living?.secret;
  if (!ev && !toast && !patrol && !nem && !sec && !waste) return null;
  const dist = ev ? Math.round(Math.hypot(ev.x - px, ev.z - pz)) : 0;
  const bearing = ev ? headingLabel(headingTo(px, pz, ev.x, ev.z)) : "";
  const color = !ev ? "" : ev.phase === "WON" ? "#7ef2b0" : ev.phase === "FAILED" ? "#ff4d4d" : ev.kind === "FRACTURE" ? "#b968ff" : ev.phase === "WARNING" ? "#ffb23e" : "#ff3b4e";
  return (
    <div className="mission-tracker living-tracker pointer-events-none absolute left-4 top-[22%] w-72 space-y-2">
      {ev && (
        <div className="border border-border/60 bg-background/75 p-3 backdrop-blur-sm" style={{ borderLeft: `3px solid ${color}` }}>
          <p className="font-mono text-[9px] uppercase tracking-[0.3em]" style={{ color }}>{ev.phase === "WARNING" ? "World event incoming" : ev.phase === "ACTIVE" ? "World event" : ev.phase === "WON" ? "Event won" : "Event lost"} · {ev.district}</p>
          <p className="mt-1 text-sm font-semibold uppercase tracking-wider">{ev.title}</p>
          {(ev.phase === "WARNING" || ev.phase === "ACTIVE") && <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{ev.brief}</p>}
          {ev.phase === "WARNING" && <p className="mt-1 font-mono text-[11px]">Starts in {Math.ceil(ev.timer)} s · {dist} m {bearing}</p>}
          {ev.phase === "ACTIVE" && ev.kind !== "FRACTURE" && <p className="mt-1 font-mono text-[11px]">Hostiles {ev.left} · {Math.ceil(ev.timer)} s left · {dist} m {bearing}</p>}
          {ev.phase === "ACTIVE" && ev.kind === "FRACTURE" && (
            <>
              <p className="mt-1 font-mono text-[11px]">{ev.inRift ? "Holding the rift" : `Get inside the rift · ${dist} m ${bearing}`} · {Math.ceil(ev.timer)} s</p>
              <div className="mt-1 h-1 bg-muted"><div className="h-1" style={{ width: `${Math.min(100, (ev.hold / ev.holdNeed) * 100)}%`, background: color }} /></div>
            </>
          )}
        </div>
      )}
      {waste && (
        <div className="border border-border/60 bg-background/80 p-3 backdrop-blur-sm" style={{ borderLeft: `3px solid ${waste.kind === "RALLY" ? "#38e8ff" : waste.kind === "DERBY" ? "#ff5a3c" : "#ffb23e"}` }}>
          <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#ffb23e]">Wastelands{waste.tx !== undefined && waste.tz !== undefined ? ` · ${Math.round(Math.hypot(waste.tx - px, waste.tz - pz))} m ${headingLabel(headingTo(px, pz, waste.tx, waste.tz))}` : ""}</p>
          <p className="mt-1 text-sm font-semibold uppercase tracking-wider">{waste.title}</p>
          {waste.lines.map((l) => <p key={l} className="mt-1 font-mono text-[11px]">{l}</p>)}
          {waste.progress !== undefined && <div className="mt-1 h-1 bg-muted"><div className="h-1 bg-[#ffb23e]" style={{ width: `${Math.max(0, Math.min(1, waste.progress)) * 100}%` }} /></div>}
        </div>
      )}
      {sec && (
        <p className="border border-[#b968ff]/50 bg-background/75 px-3 py-2 font-mono text-[11px] text-[#d6b8ff]">
          {sec.inReach ? (sec.open ? `NOVA: ${sec.name}.` : `${sec.name}: ${sec.locked}`) : `NOVA: Resonance nearby · ${sec.dist} m`}
        </p>
      )}
      {nem && (
        <div className="border border-[#ff2e63]/70 bg-background/80 p-3 backdrop-blur-sm" style={{ borderLeft: "3px solid #ff2e63" }}>
          <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#ff2e63]">Nemesis · rank {nem.rank}</p>
          <p className="mt-1 text-sm font-semibold uppercase tracking-wider">{nem.name}</p>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">{nem.traits.join(" · ")}{nem.weak ? ` · weak to ${nem.weak.toLowerCase()}` : ""}</p>
        </div>
      )}
      {patrol && (
        <div className="border border-border/60 bg-background/75 p-3 backdrop-blur-sm" style={{ borderLeft: "3px solid #66e0ff" }}>
          <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#66e0ff]">Patrol · {REGIONS.find((r) => r.id === patrol.regionId)?.name ?? patrol.regionId}</p>
          <p className="mt-1 font-mono text-[11px]">Hostiles {patrol.kills}/{patrol.need}</p>
          <div className="mt-1 h-1 bg-muted"><div className="h-1 bg-[#66e0ff]" style={{ width: `${(patrol.kills / patrol.need) * 100}%` }} /></div>
        </div>
      )}
      {toast && <p className="border border-border/60 bg-background/80 px-3 py-2 font-mono text-[11px] text-primary">{toast}</p>}
    </div>
  );
}
