import { useEffect, useRef } from "react";
import type { RewardCard } from "@/game/scenario-loot";
import { useMenuInput } from "./useMenuInput";

const RARITY_COLOR: Record<string, string> = { EXOTIC: "#ffd166", LEGENDARY: "#b58cff", COMMON: "#9aa7b4" };
const OUTCOME_TEXT = {
  NEW: "Added to inventory",
  DUPLICATE_LEVEL: "Already owned — your copy gained a level",
  DUPLICATE_SHARDS: "Already owned at max level — converted to fracture shards",
} as const;

/** Shown after a Unique Scenario clear: the guaranteed signature reward and any chance-based drop, with what actually happened to each. */
export function ScenarioRewardCards({ title, cards, onDone }: { title: string; cards: RewardCard[]; onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  useMenuInput(true, (intent) => { if (intent === "confirm" || intent === "back") onDone(); }, ["confirm", "back"]);
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-background/80 p-4 backdrop-blur-sm" role="presentation">
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`${title} rewards`} className="w-full max-w-3xl border border-primary/40 bg-card p-6 outline-none">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">{title} · cleared</p>
        <h2 className="mt-1 text-xl font-semibold">Rewards</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {cards.map((card) => (
            <article key={card.itemId} className="border p-4" style={{ borderColor: RARITY_COLOR[card.rarity] ?? "#9aa7b4" }}>
              <p className="font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: RARITY_COLOR[card.rarity] ?? "#9aa7b4" }}>{card.rarity} · {card.slot === "classItem" ? "class item" : card.slot} · {card.guaranteed ? "guaranteed" : "chance drop"}</p>
              <h3 className="mt-1 text-lg font-semibold">{card.name}{card.level > 1 ? ` · Lv ${card.level}` : ""}</h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{card.blurb}</p>
              <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-foreground">{OUTCOME_TEXT[card.outcome]}</p>
            </article>
          ))}
        </div>
        <button type="button" onClick={onDone} className="mt-5 h-10 w-full border border-primary bg-primary/15 font-mono text-xs uppercase tracking-[0.2em] ui-focus">Continue · Enter / A</button>
      </div>
    </div>
  );
}
