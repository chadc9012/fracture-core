/** Penthouse upgrade ladders (pure). A penthouse is a base purchase plus a set of one-time upgrades, every one a Nex spend in the real
 * ledger (`upgrade:<penthouse>:<id>`), so ownership, cloud merge and repurchase protection work like homes and decor.
 * Prices are on the market scale (1 Nex ~ $100, market-prices.ts):
 *   Skyline Casino penthouse  $3.5M to buy, $10M fully upgraded   (35,000 -> 100,000 Nex)
 *   Aegis Spire penthouse     $1.5M to buy, $4M fully upgraded    (15,000 ->  40,000 Nex) */
import { nexBalance, spendNex, type NexLedger } from "./nex";
import { ownsPenthouseNex, PENTHOUSE_PRICE } from "./casino-property";
import { homeById, ownsHome } from "./housing";

export type PenthouseId = "skyline-penthouse" | "aegis-penthouse";
export type UpgradeDef = { id: string; name: string; text: string; price: number };
export type PenthouseDef = { id: PenthouseId; name: string; base: number; upgrades: readonly UpgradeDef[] };

export const PENTHOUSES: Record<PenthouseId, PenthouseDef> = {
  "skyline-penthouse": {
    id: "skyline-penthouse", name: "Skyline Casino Penthouse", base: PENTHOUSE_PRICE,
    upgrades: [
      { id: "designer", name: "Designer interior", text: "Unlocks the full finish and colour editor", price: 8_000 },
      { id: "suite", name: "Bedroom & kitchen suite", text: "Adds the master bedroom and chef's kitchen", price: 10_000 },
      { id: "bar", name: "Private bar", text: "A lit bar and lounge corner", price: 7_000 },
      { id: "cinema", name: "Cinema room", text: "Screening room with a wall screen", price: 12_000 },
      { id: "garage", name: "Ten-car garage", text: "Private parking under the tower", price: 14_000 },
      { id: "security", name: "Security & panic room", text: "Reinforced door and a safe room", price: 6_000 },
      { id: "terrace", name: "Sky terrace & pool", text: "Open terrace over the skyline", price: 8_000 },
    ],
  },
  "aegis-penthouse": {
    id: "aegis-penthouse", name: "Aegis Spire Penthouse", base: homeById("aegis-penthouse")!.price,
    upgrades: [
      { id: "glass", name: "Smart-glass walls", text: "Tint and opacity control", price: 5_000 },
      { id: "lift", name: "Private lift", text: "Keyed lift from the Spire lobby", price: 6_000 },
      { id: "office", name: "Home office", text: "Command desk and holo wall", price: 4_000 },
      { id: "spa", name: "Spa suite", text: "Plunge pool and sauna", price: 5_000 },
      { id: "helipad", name: "Helipad link", text: "Roof pad with a landing slot", price: 5_000 },
    ],
  },
};

export const upgradeKey = (pent: PenthouseId, id: string) => `upgrade:${pent}:${id}`;
export const upgradesTotal = (pent: PenthouseId) => PENTHOUSES[pent].upgrades.reduce((n, u) => n + u.price, 0);
/** base plus every upgrade: the all-in price of the fully fitted penthouse */
export const maxedPrice = (pent: PenthouseId) => PENTHOUSES[pent].base + upgradesTotal(pent);

type Save = { nexLedger: NexLedger };
export const ownsPenthouse = (p: Save, pent: PenthouseId) => pent === "skyline-penthouse" ? ownsPenthouseNex(p.nexLedger) : ownsHome(p as never, pent);
export const ownsUpgrade = (ledger: NexLedger | undefined, pent: PenthouseId, id: string) => !!ledger && upgradeKey(pent, id) in ledger;
export const ownedUpgrades = (ledger: NexLedger | undefined, pent: PenthouseId) => PENTHOUSES[pent].upgrades.filter((u) => ownsUpgrade(ledger, pent, u.id));
export const isMaxed = (ledger: NexLedger | undefined, pent: PenthouseId) => ownedUpgrades(ledger, pent).length === PENTHOUSES[pent].upgrades.length;
/** Nex spent on this penthouse so far (base once owned, plus upgrades) */
export const spentOn = (p: Save, pent: PenthouseId) => (ownsPenthouse(p, pent) ? PENTHOUSES[pent].base : 0) + ownedUpgrades(p.nexLedger, pent).reduce((n, u) => n + u.price, 0);

export function buyPenthouseUpgrade<P extends Save>(p: P, pent: PenthouseId, id: string): { progression: P; message: string } | { error: string } {
  const u = PENTHOUSES[pent]?.upgrades.find((x) => x.id === id);
  if (!u) return { error: "Unknown upgrade" };
  if (!ownsPenthouse(p, pent)) return { error: `Buy the ${PENTHOUSES[pent].name} first` };
  if (ownsUpgrade(p.nexLedger, pent, id)) return { error: "Already installed" };
  const ledger = spendNex(p.nexLedger, upgradeKey(pent, id), u.price);
  if (!ledger) return { error: `Needs ${u.price.toLocaleString()} Nex (you have ${nexBalance(p.nexLedger).toLocaleString()})` };
  return { progression: { ...p, nexLedger: ledger }, message: `${u.name} installed` };
}
