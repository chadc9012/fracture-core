import { evaluateGear } from "@/game/gear-evaluation";
import type { GearItem } from "@/game/inventory";
import type { PlayerProgression } from "@/game/progression";

const SIGN = (n: number) => (n > 0 ? `+${n}` : `${n}`);
const VERDICT_CLASS: Record<string, string> = { UPGRADE: "text-primary", DOWNGRADE: "text-destructive", SIDEGRADE: "text-muted-foreground", EQUIPPED: "text-primary", "EMPTY SLOT": "text-primary" };

/** Inventory read-out from gear-evaluation.ts: grade, verdict against what is worn in the slot, and the Intellect / Mobility / Defense change that equipping would cause
 * (computed by the same attribute path combat uses, so the numbers shown are the numbers that apply). Display only. */
export function GearEvaluation({ progression, item }: { progression: PlayerProgression; item: GearItem }) {
  const ev = evaluateGear(progression, item);
  const a = ev.attributeDelta;
  return (
    <div className="mt-3 border-b border-primary/20 pb-3 text-xs" aria-label="Gear evaluation">
      <div className="flex items-baseline justify-between"><span className="hud-label">Evaluation</span><span><b className="text-primary">Grade {ev.grade}</b> <span className="text-muted-foreground">({ev.score})</span></span></div>
      <p className={`mt-1 font-mono uppercase tracking-widest ${VERDICT_CLASS[ev.verdict] ?? ""}`}>{ev.verdict}{ev.verdict !== "EQUIPPED" && ev.verdict !== "EMPTY SLOT" ? ` · power ${SIGN(ev.powerDelta)}` : ""}</p>
      {a && (a.intellect !== 0 || a.mobility !== 0 || a.defense !== 0) && <p className="mt-1 text-muted-foreground">If equipped: Defense {SIGN(a.defense)} · Mobility {SIGN(a.mobility)} · Intellect {SIGN(a.intellect)}</p>}
      {ev.notes.map((n) => <p key={n} className="text-muted-foreground">{n}</p>)}
    </div>
  );
}
