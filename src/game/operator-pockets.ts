/**
 * Per-operator progress and money. Titan, Hunter and Warlock each have their own level, XP, Nex, fracture shards and
 * materials bag. Everything else in the save (gear, vehicles, homes, story, quests, claims) stays shared.
 *
 * The live fields (`level`, `xp`, `materials`, `fractureShards`, and the Nex balance of `nexLedger`) always belong to
 * `pocketClass`, the operator being played, so every existing reader and reward rule keeps working unchanged. The
 * other two operators' values wait in `operators`. `switchOperator` swaps them when the played operator changes.
 *
 * The Nex ledger also records ownership and one-time claims (`home:<id>`, `fleet:<id>`, payout keys), so it can't be
 * split per operator. Instead one balancing entry, `wallet:offset`, makes the ledger's total equal the played
 * operator's balance; purchases and claims stay shared, only the money moves.
 */
import type { MaterialId } from "./inventory";
import { nexBalance, type NexLedger } from "./nex";

export type ClassId = "TITAN" | "HUNTER" | "WARLOCK";
export const OPERATOR_CLASSES: readonly ClassId[] = ["TITAN", "HUNTER", "WARLOCK"];
export const NEX_OFFSET_KEY = "wallet:offset";

export type OperatorPocket = { level: number; xp: number; nex: number; fractureShards: number; materials: Partial<Record<MaterialId, number>> };
/** what an operator who has never been played starts with (matches DEFAULT_PROGRESSION) */
export const FRESH_POCKET: OperatorPocket = { level: 1, xp: 0, nex: 0, fractureShards: 120, materials: {} };
export const freshPockets = (): Record<ClassId, OperatorPocket> => ({ TITAN: { ...FRESH_POCKET, materials: {} }, HUNTER: { ...FRESH_POCKET, materials: {} }, WARLOCK: { ...FRESH_POCKET, materials: {} } });

type Pocketed = { level: number; xp: number; fractureShards: number; materials: Partial<Record<MaterialId, number>>; nexLedger: NexLedger; pocketClass: ClassId; operators: Record<ClassId, OperatorPocket> };

const isClass = (c: unknown): c is ClassId => c === "TITAN" || c === "HUNTER" || c === "WARLOCK";

/** the played operator's values, read from the live fields */
export const livePocket = (p: Pocketed): OperatorPocket => ({ level: p.level, xp: p.xp, nex: nexBalance(p.nexLedger), fractureShards: p.fractureShards, materials: { ...p.materials } });

/** any operator's values (live for the one being played) */
export const operatorPocket = (p: Pocketed, cls: ClassId): OperatorPocket => (cls === p.pocketClass ? livePocket(p) : p.operators[cls] ?? FRESH_POCKET);

/** a ledger whose balance is `target`, with every purchase and claim kept */
function ledgerWithBalance(ledger: NexLedger, target: number): NexLedger {
  const { [NEX_OFFSET_KEY]: _old, ...rest } = ledger;
  const raw = Object.values(rest).reduce((n, v) => n + v, 0);
  const offset = Math.round(target) - raw;
  return offset === 0 ? rest : { ...rest, [NEX_OFFSET_KEY]: offset };
}

/** make `cls` the played operator: store the current one's values, load `cls`'s */
export function switchOperator<P extends Pocketed>(p: P, cls: ClassId | null | undefined): P {
  if (!isClass(cls) || cls === p.pocketClass) return p;
  const operators = { ...p.operators, [p.pocketClass]: livePocket(p) };
  const next = operators[cls] ?? FRESH_POCKET;
  return { ...p, operators, pocketClass: cls, level: next.level, xp: next.xp, fractureShards: next.fractureShards, materials: { ...next.materials }, nexLedger: ledgerWithBalance(p.nexLedger, next.nex) };
}

const num = (v: unknown, min: number, fallback: number) => (typeof v === "number" && Number.isFinite(v) && v >= min ? v : fallback);
function normalizeMaterials(raw: unknown): Partial<Record<MaterialId, number>> {
  if (!raw || typeof raw !== "object") return {};
  return Object.fromEntries(Object.entries(raw).filter(([, v]) => typeof v === "number" && Number.isFinite(v) && v >= 0)) as Partial<Record<MaterialId, number>>;
}
function normalizePocket(raw: unknown): OperatorPocket {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof OperatorPocket, unknown>>;
  return { level: Math.floor(num(r.level, 1, 1)), xp: num(r.xp, 0, 0), nex: Math.floor(num(r.nex, 0, 0)), fractureShards: num(r.fractureShards, 0, FRESH_POCKET.fractureShards), materials: normalizeMaterials(r.materials) };
}

/**
 * Saves from before per-operator pockets had one shared level and wallet: the operator being played keeps all of it
 * (it stays in the live fields) and the other two start fresh.
 */
export function normalizePockets(raw: { pocketClass?: unknown; operators?: unknown; identityClass?: unknown }): { pocketClass: ClassId; operators: Record<ClassId, OperatorPocket> } {
  const pocketClass = isClass(raw.pocketClass) ? raw.pocketClass : isClass(raw.identityClass) ? raw.identityClass : "TITAN";
  const stored = raw.operators && typeof raw.operators === "object" ? (raw.operators as Record<string, unknown>) : {};
  const operators = freshPockets();
  for (const c of OPERATOR_CLASSES) if (c in stored) operators[c] = normalizePocket(stored[c]);
  return { pocketClass, operators };
}

/** cloud merge: per operator, keep whichever copy has gone further (level, then XP); ties go to the newer copy */
export function mergePockets(newer: Pocketed, older: Pocketed): Record<ClassId, OperatorPocket> {
  const out = freshPockets();
  for (const c of OPERATOR_CLASSES) {
    const a = operatorPocket(newer, c), b = operatorPocket(older, c);
    out[c] = b.level > a.level || (b.level === a.level && b.xp > a.xp) ? b : a;
  }
  return out;
}
