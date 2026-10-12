import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { PlayerProgression } from "@/game/progression";
import {
  AWAKEN_KILLS, CONFLICTS, PREMIUM_PLANNED, PREMIUM_STORE_ENABLED, RELIC_DESIGNS, RUNES, RUNE_ORDER, TIERS,
  ascendRelic, collectRuneDust, conflictOf, forgeRelic, removeRune, runeDustEarned, runeUnlocked, socketRune, type RuneId,
} from "@/game/godforge";

type Tab = "FORGE" | "RUNES" | "AWAKEN" | "COLLECTION" | "PREMIUM";
const TABS: Tab[] = ["FORGE", "RUNES", "AWAKEN", "COLLECTION", "PREMIUM"];

/** Vael's Godforge (godforge.ts). Every button runs a pure progression step; the Premium tab is visibly disabled. */
export function ForgePanel({ progression, onProgression, onClose }: { progression: PlayerProgression; onProgression: (p: PlayerProgression) => void; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("FORGE");
  const [notice, setNotice] = useState("");
  const relics = progression.inventory.filter((i) => i.godforge);
  const [relicId, setRelicId] = useState<string | null>(relics[0]?.id ?? null);
  const relic = relics.find((r) => r.id === relicId) ?? relics[0] ?? null;
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.code === "Escape") close.current(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, []);
  const run = (r: { progression: PlayerProgression; message: string } | { error: string }) => { if ("error" in r) setNotice(r.error); else { onProgression(r.progression); setNotice(r.message); } };
  const owed = runeDustEarned(progression) - progression.earnedRewards.filter((k) => k.startsWith("godforge:dust:")).length;

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[radial-gradient(ellipse_at_center,rgba(60,30,10,0.85),rgba(5,4,3,0.95))] p-4" role="dialog" aria-label="The Godforge">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto border border-[#ffb23e]/50 bg-[#0d0a07]/95 p-5 text-[#f3e6d0]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.35em] text-[#ffb23e]">The Hollow Crown · Godforge</p>
            <h3 className="mt-1 text-3xl font-light tracking-[0.12em]">VAEL, THE LAST FORGEWRIGHT</h3>
            <p className="mt-1 text-sm italic text-[#d9c3a0]">"Runes are not power. They are promises the weapon keeps."</p>
          </div>
          <div className="text-right font-mono text-[11px]">
            <p>{progression.fractureShards} shards · {progression.materials.forgeCatalyst ?? 0} catalyst · {progression.materials.runeDust ?? 0} rune dust · {progression.materials.crownHeart ?? 0} heart</p>
            <Button size="sm" variant="outline" className="mt-2" onClick={onClose}>Leave [Esc]</Button>
          </div>
        </div>
        <nav className="mt-4 flex flex-wrap gap-1" role="tablist">
          {TABS.map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => { setTab(t); setNotice(""); }} className={`ui-focus border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.25em] ${tab === t ? "border-[#ffb23e] bg-[#ffb23e]/15 text-[#ffd79a]" : "border-[#ffb23e]/25 text-[#c9b08a]"} ${t === "PREMIUM" ? "opacity-60" : ""}`}>{t}</button>)}
        </nav>
        {relics.length > 1 && tab !== "FORGE" && tab !== "PREMIUM" && (
          <div className="mt-3 flex flex-wrap gap-1">{relics.map((r) => <button key={r.id} onClick={() => setRelicId(r.id)} className={`border px-2 py-1 text-xs ${r.id === relic?.id ? "border-[#ffb23e]" : "border-[#ffb23e]/20"}`}>{r.name}</button>)}</div>
        )}

        {tab === "FORGE" && (
          <div className="mt-4 grid gap-2 md:grid-cols-3">
            {RELIC_DESIGNS.map((d) => {
              const owned = relics.some((r) => r.name === d.name);
              return (
                <div key={d.id} className="flex flex-col justify-between border border-[#ffb23e]/30 p-3">
                  <div><p className="font-mono text-[9px] uppercase tracking-widest text-[#ffb23e]">{d.slot === "heavy" ? "Heavy" : "Primary"} · Relic</p><p className="mt-1 text-lg">{d.name}</p><p className="mt-1 text-xs text-[#c9b08a]">{d.blurb}</p></div>
                  <Button size="sm" className="mt-3" disabled={owned} onClick={() => run(forgeRelic(progression, d.id))}>{owned ? "Forged" : `Forge · ${Object.entries(TIERS.RELIC.cost).map(([k, v]) => `${v} ${k}`).join(", ")}, ${TIERS.RELIC.shards} shards`}</Button>
                </div>
              );
            })}
            <div className="border border-[#ffb23e]/20 p-3 md:col-span-3">
              <p className="font-mono text-[9px] uppercase tracking-widest text-[#ffb23e]">Rune dust</p>
              <p className="mt-1 text-xs text-[#c9b08a]">Every slain nemesis leaves 2, every secret 1. {owed > 0 ? `Vael has ${owed} for you.` : "Nothing waiting."}</p>
              <Button size="sm" variant="outline" className="mt-2" disabled={owed <= 0} onClick={() => run(collectRuneDust(progression))}>Collect</Button>
            </div>
          </div>
        )}

        {tab === "RUNES" && (relic?.godforge ? (
          <div className="mt-4">
            <p className="text-sm">{relic.name} · {TIERS[relic.godforge.tier].label} · {relic.godforge.runes.length}/{TIERS[relic.godforge.tier].sockets} sockets · power {relic.power}</p>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              {RUNE_ORDER.map((id: RuneId) => {
                const r = RUNES[id], has = relic.godforge!.runes.includes(id), unlocked = runeUnlocked(progression, id), clash = conflictOf(id, relic.godforge!.runes);
                return (
                  <div key={id} className={`border p-3 ${has ? "border-[#ffb23e]" : "border-[#ffb23e]/20"} ${unlocked ? "" : "opacity-50"}`}>
                    <p className="text-sm">{r.name}</p>
                    <p className="mt-1 text-[11px] text-[#c9b08a]">{r.text}</p>
                    {!unlocked && <p className="mt-1 text-[10px] text-[#ff9b6b]">Unlock: {r.unlock.label}</p>}
                    {unlocked && !has && clash && <p className="mt-1 text-[10px] text-[#ff9b6b]">Conflicts with {RUNES[clash].name}</p>}
                    {unlocked && <Button size="sm" variant="outline" className="mt-2" onClick={() => run(has ? removeRune(progression, relic.id, id) : socketRune(progression, relic.id, id))}>{has ? "Remove" : "Socket"}</Button>}
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-[11px] text-[#c9b08a]">Conflicts: {CONFLICTS.map(([a, b]) => `${RUNES[a].name} / ${RUNES[b].name}`).join(" · ")}</p>
            {TIERS[relic.godforge.tier].next && (() => { const nt = TIERS[TIERS[relic.godforge!.tier].next!]; return (
              <div className="mt-3 border border-[#ffb23e]/30 p-3">
                <p className="text-sm">Ascend to {nt.label}: {nt.sockets} sockets</p>
                <p className="text-[11px] text-[#c9b08a]">Needs {nt.requires.toLowerCase()} · {Object.entries(nt.cost).map(([k, v]) => `${v} ${k}`).join(", ")}, {nt.shards} shards</p>
                <Button size="sm" className="mt-2" onClick={() => run(ascendRelic(progression, relic.id))}>Ascend</Button>
              </div>
            ); })()}
          </div>
        ) : <p className="mt-4 text-sm text-[#c9b08a]">Forge a relic first.</p>)}

        {tab === "AWAKEN" && (relic?.godforge ? (
          <div className="mt-4 border border-[#ffb23e]/30 p-3">
            <p className="text-sm">{relic.name}: {relic.godforge.awakened ? "Awakened" : "Sleeping"}</p>
            <p className="mt-1 text-xs text-[#c9b08a]">Kill {AWAKEN_KILLS} enemies with it in your hands. An awakened relic gains +30 power and deals 10% more damage.</p>
            <div className="mt-2 h-2 bg-[#2a1d10]"><div className="h-2 bg-[#ffb23e]" style={{ width: `${Math.min(100, (relic.godforge.kills / AWAKEN_KILLS) * 100)}%` }} /></div>
            <p className="mt-1 font-mono text-[11px]">{Math.min(relic.godforge.kills, AWAKEN_KILLS)}/{AWAKEN_KILLS}</p>
          </div>
        ) : <p className="mt-4 text-sm text-[#c9b08a]">Forge a relic first.</p>)}

        {tab === "COLLECTION" && (
          <ul className="mt-4 space-y-1 text-sm">
            {RELIC_DESIGNS.map((d) => { const r = relics.find((x) => x.name === d.name); return <li key={d.id} className="flex justify-between border-b border-[#ffb23e]/10 py-1"><span>{d.name}</span><span className="font-mono text-[11px] text-[#c9b08a]">{r?.godforge ? `${TIERS[r.godforge.tier].label} · ${r.godforge.runes.map((x) => RUNES[x].name).join(", ") || "no runes"}${r.godforge.awakened ? " · awakened" : ""}` : "undiscovered"}</span></li>; })}
            <li className="pt-2 text-xs text-[#c9b08a]">Runes known: {RUNE_ORDER.filter((id) => runeUnlocked(progression, id)).length}/{RUNE_ORDER.length}</li>
          </ul>
        )}

        {tab === "PREMIUM" && (
          <div className="mt-4 border border-dashed border-[#ffb23e]/30 p-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[#ff9b6b]">Unavailable during development{PREMIUM_STORE_ENABLED ? "" : " · purchases disabled"}</p>
            <p className="mt-1 text-xs text-[#c9b08a]">Planned optional offers. Cosmetic only, with full contents listed and no random rolls. Every tier of power is earned in play.</p>
            <ul className="mt-3 space-y-2">{PREMIUM_PLANNED.map((o) => <li key={o.name} className="flex items-center justify-between gap-3 border border-[#ffb23e]/15 p-2 opacity-70"><span><b className="text-sm">{o.name}</b><span className="block text-[11px] text-[#c9b08a]">{o.contents}</span></span><Button size="sm" variant="outline" disabled>Not available</Button></li>)}</ul>
          </div>
        )}
        {notice && <p className="mt-3 font-mono text-xs text-[#ffd79a]">{notice}</p>}
      </div>
    </div>
  );
}
