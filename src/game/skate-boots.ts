import { spendNex, type NexLedger } from "./nex";
/**
 * Jet-boots (Jet Set Radio-style skates) sold at the Neon City skate shop. Pure rules: ownership lives in
 * progression.earnedRewards as "boots:<id>" (unioned by the cloud merge), the equipped pair is a client-local choice.
 * Scene reads bootStats() for sprint boost, ground/air jump height, extra air jumps and the Shift dash burst.
 */
export type BootId = "none" | "street" | "grind" | "sky" | "rocket" | "maggrind";
export type BootStats = {
  id: BootId; name: string; tagline: string; price: number; color: string;
  /** multiplies sprint speed */ boost: number;
  /** multiplies ground + air jump vertical speed */ jump: number;
  /** extra air jumps on top of the class kit */ extraAirJumps: number;
  /** horizontal burst (units/s) on a Shift tap; 0 = no dash */ dash: number;
  /** seconds between dashes */ dashCooldown: number;
  /** dash direction: ground skids forward, air dashes keep you aloft */ dashStyle: "skid" | "air" | "blink";
  /** NEX-only price; when set the pair cannot be bought with shards */ nexPrice?: number;
  /** magnetic soles: can latch onto Neon City grind rails */ grind?: boolean;
};

export const BOOTS: Record<Exclude<BootId, "none">, BootStats> = {
  street: { id: "street", name: "Street Kickz", tagline: "Everyday skates. A little faster everywhere.", price: 40, color: "#ff4fa3", boost: 1.25, jump: 1.1, extraAirJumps: 0, dash: 18, dashCooldown: 1.6, dashStyle: "skid" },
  grind: { id: "grind", name: "Grind Kings", tagline: "Low and fast. Long ground skid dashes.", price: 90, color: "#3ee6ff", boost: 1.45, jump: 1.0, extraAirJumps: 0, dash: 30, dashCooldown: 1.1, dashStyle: "skid" },
  sky: { id: "sky", name: "Sky Hoppers", tagline: "Big air. One extra mid-air jump.", price: 120, color: "#b6ff3e", boost: 1.2, jump: 1.45, extraAirJumps: 1, dash: 14, dashCooldown: 1.4, dashStyle: "air" },
  rocket: { id: "rocket", name: "Rocket Rollers", tagline: "Jet blink dash. Huge top speed.", price: 220, color: "#ffb23e", boost: 1.7, jump: 1.25, extraAirJumps: 1, dash: 40, dashCooldown: 2.2, dashStyle: "blink" },
  maggrind: { id: "maggrind", name: "Mag-Grind Boots", tagline: "Magnetic soles lock onto Neon City rails. Grind the Grid, jump off with the speed you built.", price: 0, nexPrice: 8000, grind: true, color: "#7dffca", boost: 1.5, jump: 1.1, extraAirJumps: 0, dash: 26, dashCooldown: 1.2, dashStyle: "skid" },
};

export const NO_BOOTS: BootStats = { id: "none", name: "No boots", tagline: "", price: 0, color: "#888", boost: 1, jump: 1, extraAirJumps: 0, dash: 0, dashCooldown: 0, dashStyle: "skid" };

export const bootKey = (id: BootId) => `boots:${id}`;
export const ownsBoots = (earned: readonly string[], id: BootId) => id === "none" || earned.includes(bootKey(id));
/** stats for the equipped pair; unowned or unknown ids fall back to no boots */
export function bootStats(earned: readonly string[], equipped: string | null | undefined): BootStats {
  const b = equipped && equipped !== "none" ? BOOTS[equipped as Exclude<BootId, "none">] : undefined;
  return b && ownsBoots(earned, b.id) ? b : NO_BOOTS;
}

export type BuyResult = { ok: true; earnedRewards: string[]; fractureShards: number } | { ok: false; reason: "OWNED" | "FUNDS" | "UNKNOWN" | "NEX_ONLY" };
/** Buying spends fracture shards once; owned pairs are refused so a double tap never charges twice. */
export function buyBoots(p: { earnedRewards: readonly string[]; fractureShards: number }, id: BootId): BuyResult {
  const b = id === "none" ? undefined : BOOTS[id];
  if (!b) return { ok: false, reason: "UNKNOWN" };
  if (b.nexPrice) return { ok: false, reason: "NEX_ONLY" };
  if (ownsBoots(p.earnedRewards, id)) return { ok: false, reason: "OWNED" };
  if (p.fractureShards < b.price) return { ok: false, reason: "FUNDS" };
  return { ok: true, earnedRewards: [...p.earnedRewards, bootKey(id)], fractureShards: p.fractureShards - b.price };
}

export const BOOTS_EQUIP_KEY = "world-fracture-boots";
/** skate shop sits on the Neon City market avenue, offset from the district centre (metres) */
export const SKATE_SHOP_OFFSET = { x: -14, z: 10 };
export const SKATE_SHOP_RADIUS = 7;

/** NEX purchase (Mag-Grind Boots, 8,000 NEX at NEON RUSH). One-time: the ledger entry `boots:<id>` also guards against a double charge,
 * and the unlock is kept in earnedRewards so the cloud merge unions it like every other pair. */
export function buyBootsNex<P extends { earnedRewards: readonly string[]; nexLedger: NexLedger }>(p: P, id: BootId): { ok: true; progression: P } | { ok: false; reason: "OWNED" | "FUNDS" | "UNKNOWN" } {
  const b = id === "none" ? undefined : BOOTS[id];
  if (!b || !b.nexPrice) return { ok: false, reason: "UNKNOWN" };
  if (ownsBoots(p.earnedRewards, id) || bootKey(id) in p.nexLedger) return { ok: false, reason: "OWNED" };
  const ledger = spendNex(p.nexLedger, bootKey(id), b.nexPrice);
  if (!ledger) return { ok: false, reason: "FUNDS" };
  return { ok: true, progression: { ...p, nexLedger: ledger, earnedRewards: [...p.earnedRewards, bootKey(id)] } };
}
