import { nexBalance, formatNex } from "@/game/nex";

/** NEX wallet balance (NΞ), shown top-right under the compass strip. */
export function NexChip({ ledger }: { ledger: Record<string, number> | undefined }) {
  return <div className="pointer-events-none fixed right-3 top-14 z-[34] border border-primary/50 bg-background/70 px-2 py-1 font-mono text-[11px] text-primary" aria-label={`${nexBalance(ledger)} NEX`}>{formatNex(nexBalance(ledger))}</div>;
}
