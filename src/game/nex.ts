export type NexLedger = Record<string, number>;
export function nexBalance(ledger: NexLedger = {}) { return Math.max(0, Object.values(ledger).reduce((n, v) => n + v, 0)); }
export function normalizeNex(raw: unknown): NexLedger {
  if (!raw || typeof raw !== "object") return {};
  return Object.fromEntries(Object.entries(raw).filter(([, v]) => typeof v === "number" && Number.isFinite(v) && Number.isInteger(v))) as NexLedger;
}
export function spendNex(ledger: NexLedger, id: string, price: number): NexLedger | null {
  if (!Number.isInteger(price) || price <= 0 || id in ledger || nexBalance(ledger) < price) return null;
  return { ...ledger, [id]: -price };
}/** "NΞ 12,500" — the in-game wallet format (symbol NΞ, from the Nexus Exchange). */
export const formatNex = (n: number) => `NΞ ${Math.max(0, Math.floor(n)).toLocaleString("en-US")}`;
