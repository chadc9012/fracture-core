/**
 * Shop sales (pure): daily deals, weekly clearance, faction discounts and coordinated bundles. Applied on top of a vendor's
 * rotating stock; the listing's `price` becomes the sale price (so purchaseListing needs no change) and `basePrice` keeps the original.
 * Prestige rule: top-tier gear (armor T5 / S, weapons T5 / S) and everything from the black market is never discounted, and a
 * stack of discounts can never take more than 30% off.
 */
import type { VendorDef, VendorListing } from "./vendors";

export type SaleKind = "DAILY" | "CLEARANCE" | "FACTION" | "EVENT";
export type SaleTag = { kind: SaleKind; label: string; pct: number };
export type SaleListing = VendorListing & { basePrice: number; sales: SaleTag[] };

export const MAX_DISCOUNT = 0.3;
const PRESTIGE_TIERS = new Set(["T5", "S"]);
const mix = (n: number) => { let h = n >>> 0; h = Math.imul(h ^ (h >>> 16), 0x45d9f3b); h = Math.imul(h ^ (h >>> 16), 0x45d9f3b); return (h ^ (h >>> 16)) >>> 0; };
const strHash = (s: string) => s.split("").reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

export const isPrestige = (l: VendorListing) => PRESTIGE_TIERS.has(l.item.tier);
const eligible = (vendor: VendorDef, l: VendorListing) => vendor.id !== "black" && !isPrestige(l);

export type SaleContext = {
  /** UTC day number (floor(Date.now()/86400000)) */
  day: number;
  /** 0..100 reputation with the vendor's faction; discounts up to 15% at 100 (faction vendors only) */
  reputation?: number;
  /** current district event, e.g. a race festival; discounts matching gear 10% */
  districtEvent?: "race" | "festival" | "campaign" | null;
};

const EVENT_MATCH: Record<NonNullable<SaleContext["districtEvent"]>, (l: VendorListing) => boolean> = {
  race: (l) => l.kind === "armor" && l.item.slot === "LEGS",
  festival: (l) => l.kind === "armor",
  campaign: (l) => l.kind === "weapon",
};
/** the weekly clearance covers the cheapest tier of each kind, on day-of-week 0 (Sunday, UTC) */
const clearanceDay = (day: number) => ((day + 4) % 7) === 0; // epoch day 0 was a Thursday
const isCheapTier = (l: VendorListing) => l.item.tier === "T1" || l.item.tier === "T2" || l.item.tier === "T1-2";

export function applySales(stock: readonly VendorListing[], vendor: VendorDef, ctx: SaleContext): SaleListing[] {
  const ok = stock.filter((l) => eligible(vendor, l));
  const dealKey = ok.length ? ok[mix(ctx.day * 131 + strHash(vendor.id)) % ok.length]!.key : null;
  return stock.map((l) => {
    const sales: SaleTag[] = [];
    if (eligible(vendor, l)) {
      if (l.key === dealKey) sales.push({ kind: "DAILY", label: "Daily deal", pct: 0.2 });
      if (clearanceDay(ctx.day) && isCheapTier(l)) sales.push({ kind: "CLEARANCE", label: "Clearance", pct: 0.15 });
      if (vendor.id === "faction" && (ctx.reputation ?? 0) > 0) sales.push({ kind: "FACTION", label: "Faction standing", pct: 0.15 * Math.min(1, Math.max(0, (ctx.reputation ?? 0) / 100)) });
      if (ctx.districtEvent && EVENT_MATCH[ctx.districtEvent](l)) sales.push({ kind: "EVENT", label: `District ${ctx.districtEvent}`, pct: 0.1 });
    }
    const pct = Math.min(MAX_DISCOUNT, sales.reduce((n, s) => n + s.pct, 0));
    return { ...l, basePrice: l.price, price: Math.max(1, Math.round(l.price * (1 - pct))), sales };
  });
}

/** One weapon + one armor from today's stock sold together at 10% off the pair; none when either is prestige or there is no pair. */
export function todaysBundle(stock: readonly SaleListing[], vendor: VendorDef): { weapon: SaleListing; armor: SaleListing; price: number; basePrice: number } | null {
  if (vendor.id === "black") return null;
  const weapon = stock.find((l) => l.kind === "weapon" && !isPrestige(l));
  const armor = stock.find((l) => l.kind === "armor" && !isPrestige(l));
  if (!weapon || !armor || weapon.currency !== armor.currency) return null;
  const basePrice = weapon.price + armor.price;
  return { weapon, armor, basePrice, price: Math.round(basePrice * 0.9) };
}
