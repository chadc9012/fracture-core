import { CarFront, Crosshair, Heart, Shield, Shirt, Hand, Footprints, HardHat, Sparkles, Bomb, Target } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SLOT_NAME, itemTooltip, tierOf, type Tier } from "@/game/character-sheet";
import { evaluateGear } from "@/game/gear-evaluation";
import type { GearItem, GearSlot } from "@/game/inventory";
import type { PlayerProgression } from "@/game/progression";

/** Shared gear presentation for the Inventory and Character menus (the owner's Destiny references): rarity tiles, the item
 * card with a side-by-side compare against what is worn, and the attribute read-out with deltas. Display only: every number
 * comes from character-sheet.ts / gear-evaluation.ts, the same paths combat uses. */

export const SLOT_ICON: Record<GearSlot, LucideIcon> = {
  primary: Crosshair, secondary: Target, heavy: Bomb, helmet: HardHat, chest: Shirt, gauntlets: Hand, legs: Footprints, classItem: Sparkles, vehicle: CarFront,
};
/** tile fills by rarity (Destiny: exotic gold, legendary purple, rare blue, common green) */
export const TIER_FILL: Record<Tier, { from: string; to: string; edge: string; text: string }> = {
  EXOTIC: { from: "#d9b83a", to: "#5c4a10", edge: "#f3d76a", text: "#fff6cf" },
  LEGENDARY: { from: "#6a3d88", to: "#251433", edge: "#a77ccb", text: "#efe2ff" },
  RARE: { from: "#4f7cb0", to: "#16263d", edge: "#86b4e6", text: "#e3f0ff" },
  COMMON: { from: "#3f7a4a", to: "#13261a", edge: "#7cc08a", text: "#e2ffe8" },
};
const ELEMENT_COLOR: Record<GearItem["element"], string> = { KINETIC: "#e8eef2", THERMAL: "#ff7a3d", CRYO: "#7fd8ff", ARC: "#9ae8ff", BIO: "#9be36a" };
const SIGN = (n: number) => (n > 0 ? `+${n}` : `${n}`);

export function GearTile({ item, slot, equipped = false, selected = false, onClick, onHover, size = "md", label }: {
  item: GearItem | null; slot: GearSlot; equipped?: boolean; selected?: boolean; size?: "sm" | "md" | "lg";
  onClick?: () => void; onHover?: (item: GearItem | null) => void; label?: string;
}) {
  const Icon = SLOT_ICON[slot];
  const fill = item ? TIER_FILL[tierOf(item)] : null;
  const px = size === "lg" ? "size-[5.5rem]" : size === "sm" ? "size-14" : "size-[4.5rem]";
  return (
    <button type="button" onClick={onClick} onMouseEnter={() => onHover?.(item)} onMouseLeave={() => onHover?.(null)} onFocus={() => onHover?.(item)} onBlur={() => onHover?.(null)}
      className={`wf-tile ${px} ${selected ? "wf-tile-on" : ""}`}
      style={fill ? { background: `linear-gradient(155deg, ${fill.from}, ${fill.to} 78%)`, borderColor: fill.edge } : undefined}
      aria-label={`${label ?? SLOT_NAME[slot]}: ${item ? `${item.name}, power ${item.power}${equipped ? ", equipped" : ""}` : "empty"}`} aria-pressed={selected}>
      <Icon className="absolute left-1/2 top-[44%] size-[42%] -translate-x-1/2 -translate-y-1/2 opacity-90" strokeWidth={1.4} style={{ color: fill?.text ?? "rgba(255,255,255,0.25)", filter: item ? "drop-shadow(0 1px 2px rgba(0,0,0,0.6))" : undefined }} />
      {item && <span className="wf-tile-power">{item.power}</span>}
      {item && item.element !== "KINETIC" && <span className="absolute left-1 top-1 size-2 rotate-45" style={{ background: ELEMENT_COLOR[item.element] }} title={item.element} />}
      {equipped && <span className="absolute right-0 top-0 size-0 border-l-[10px] border-t-[10px] border-l-transparent border-t-white/90" aria-hidden />}
      {item?.favorite && <Heart className="absolute bottom-1 left-1 size-3 fill-[#ff5f7a] text-[#ff5f7a]" />}
      {!item && <span className="absolute bottom-1 left-0 right-0 text-center font-[var(--wf-display)] text-[9px] uppercase tracking-[0.18em] text-white/40">{(label ?? SLOT_NAME[slot]).split(" ")[0]}</span>}
    </button>
  );
}

/** Destiny-style item card. With `worn` (a different item in the same slot) it shows ▲▼ against it. */
export function ItemCard({ item, worn, equippedLabel, className = "", children }: { item: GearItem; worn?: GearItem | null; equippedLabel?: boolean; className?: string; children?: React.ReactNode }) {
  const t = itemTooltip(item);
  const w = worn && worn.id !== item.id ? itemTooltip(worn) : null;
  const fill = TIER_FILL[t.tier];
  const delta = (label: string, value: number) => { const o = w?.stats.find((s) => s.label === label); return o ? value - o.value : 0; };
  return (
    <div className={`wf-item-card ${className}`} role="group" aria-label={`${t.title} details`}>
      <div className="flex items-start justify-between gap-3 px-4 py-2.5" style={{ background: `linear-gradient(90deg, ${fill.from}, ${fill.to})` }}>
        <div className="min-w-0"><p className="truncate text-xl font-bold uppercase leading-tight tracking-[0.04em] text-white">{t.title}</p><p className="text-sm text-white/85">{SLOT_NAME[item.slot]}</p></div>
        <p className="shrink-0 pt-1 text-sm font-semibold capitalize text-white/75">{t.tier.toLowerCase()}</p>
      </div>
      <div className="flex items-baseline gap-2 px-4 pt-3">
        <span className="text-5xl font-bold leading-none tracking-tight">{t.power}</span>
        {w && <span className={`text-lg font-bold ${t.power > w.power ? "text-[#7be08a]" : t.power < w.power ? "text-[#ff6b6b]" : "text-white/50"}`}>{t.power > w.power ? "▲" : t.power < w.power ? "▼" : "="} {SIGN(t.power - w.power)}</span>}
        <span className="ml-1 text-sm font-semibold uppercase tracking-[0.18em] text-white/70">{(["primary", "secondary", "heavy"] as GearSlot[]).includes(item.slot) ? "Attack" : "Defense"}</span>
        <span className="ml-auto text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: ELEMENT_COLOR[item.element] }}>{item.element}</span>
      </div>
      <p className="px-4 pt-1 text-sm italic text-white/60">Source: {t.source}{item.level > 1 ? ` · level ${item.level}` : ""}</p>
      <div className="mx-4 my-2 border-t border-white/15" />
      <div className="space-y-1.5 px-4">
        {t.stats.map((s) => { const d = delta(s.label, s.value); return (
          <div key={s.label} className="flex items-center gap-2 text-sm">
            <span className="w-20 text-white/75">{s.label}</span>
            <div className="h-2 flex-1 bg-white/10"><div className="h-2 bg-white/90" style={{ width: `${Math.min(100, (s.value / s.max) * 100)}%` }} /></div>
            <span className="w-8 text-right font-semibold">{s.value}</span>
            <span className={`w-10 text-right text-xs font-bold ${d > 0 ? "text-[#7be08a]" : d < 0 ? "text-[#ff6b6b]" : "text-transparent"}`}>{d ? `${d > 0 ? "▲" : "▼"}${Math.abs(d)}` : "·"}</span>
          </div>); })}
      </div>
      {t.perks.length > 0 && <ul className="mx-4 mt-3 space-y-1 border-t border-white/15 pt-2 text-sm text-white/70">{t.perks.map((p) => <li key={p} className="flex gap-2"><span className="text-white/40">◇</span>{p}</li>)}</ul>}
      {children && <div className="mt-3 border-t border-white/15 px-4 py-3">{children}</div>}
      {equippedLabel && <p className="border-t border-white/15 py-1.5 text-center text-sm font-semibold uppercase tracking-[0.18em] text-white/70">Currently equipped</p>}
    </div>
  );
}

/** the compare pair: worn on the left (labelled), the candidate on the right with deltas; one card when it is the worn item */
export function CompareCards({ item, progression, children }: { item: GearItem; progression: PlayerProgression; children?: React.ReactNode }) {
  const wornId = progression.equippedGear[item.slot];
  const worn = wornId ? progression.inventory.find((g) => g.id === wornId) ?? null : null;
  const ev = evaluateGear(progression, item);
  const verdictColor = ev.verdict === "UPGRADE" ? "#7be08a" : ev.verdict === "DOWNGRADE" ? "#ff6b6b" : "#92e9f5";
  if (!worn || worn.id === item.id) return <ItemCard item={item} equippedLabel={worn?.id === item.id}>{children}</ItemCard>;
  return (
    <div className="grid gap-3 xl:grid-cols-2">
      <ItemCard item={worn} equippedLabel className="opacity-90" />
      <ItemCard item={item} worn={worn}>
        <p className="text-sm font-bold uppercase tracking-[0.18em]" style={{ color: verdictColor }}>{ev.verdict} · Grade {ev.grade}</p>
        {ev.attributeDelta && (ev.attributeDelta.defense || ev.attributeDelta.mobility || ev.attributeDelta.intellect) ? <p className="mt-1 text-sm text-white/70">If equipped: Defense {SIGN(ev.attributeDelta.defense)} · Mobility {SIGN(ev.attributeDelta.mobility)} · Intellect {SIGN(ev.attributeDelta.intellect)}</p> : null}
        {children}
      </ItemCard>
    </div>
  );
}

/** Mobility / Defense / Intellect with an optional preview (the values if the focused item were equipped) */
export function AttributeBars({ attributes, preview, align = "left" }: { attributes: { label: string; value: number }[]; preview?: { label: string; value: number }[] | null; align?: "left" | "right" }) {
  return (
    <div className="space-y-2">
      {attributes.map((a) => { const p = preview?.find((x) => x.label === a.label); const d = p ? p.value - a.value : 0; return (
        <div key={a.label} className={`flex items-center gap-3 ${align === "right" ? "flex-row-reverse text-right" : ""}`}>
          <span className="w-20 text-sm font-semibold uppercase tracking-[0.12em] text-white/70">{a.label}</span>
          <div className="relative h-2 w-28 bg-white/10"><div className="h-2 bg-white/85" style={{ width: `${Math.min(100, a.value * 3)}%` }} /></div>
          <span className="w-8 text-lg font-bold">{a.value}</span>
          {d !== 0 && <span className={`text-sm font-bold ${d > 0 ? "text-[#7be08a]" : "text-[#ff6b6b]"}`}>{d > 0 ? "▲" : "▼"}{Math.abs(d)}</span>}
        </div>); })}
    </div>
  );
}
