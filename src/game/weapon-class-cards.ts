/** The Arsenal's six class cards (the concept sheet's Auto / Scout / Sniper / Shotgun / SMG / Heavy row). Each card is a real
 * in-game frame, so the numbers on it are the numbers the weapon fires with (weapons.ts, weapon-classes.ts). The game has no
 * separate scout rifle: the mid-range burst Pulse Rifle stands in for that card. Pure. */
import { frameDef, type FrameId } from "./weapon-classes";
import type { WeaponDef } from "./weapons";

export type ClassCard = { id: string; label: string; frame: FrameId; color: string };
export const CLASS_CARDS: readonly ClassCard[] = [
  { id: "auto", label: "Auto rifles", frame: "AUTO", color: "#38bdf8" },
  { id: "scout", label: "Scout rifles", frame: "PULSE", color: "#f59e0b" },
  { id: "sniper", label: "Sniper rifles", frame: "SNIPER", color: "#a78bfa" },
  { id: "shotgun", label: "Shotguns", frame: "SHOTGUN", color: "#f87171" },
  { id: "smg", label: "SMGs", frame: "SMG", color: "#4ade80" },
  { id: "heavy", label: "Heavy weapons", frame: "HEAVY", color: "#fbbf24" },
];

const clamp = (v: number) => Math.max(4, Math.min(100, Math.round(v)));
/** five 0-100 bars from a gun's real numbers: damage per pull, range (from how tight it is aimed), stability, handling (fire rate) and magazine */
export function cardStats(def: WeaponDef): { label: string; pct: number }[] {
  const perPull = def.damage * (def.pellets ?? 1) * (def.burst || 1);
  const reach = def.adsSpread <= 0.1 ? 95 : 100 - def.spread * 900 * Math.min(1.2, def.adsSpread + 0.4);
  return [
    { label: "Damage", pct: clamp((perPull / 6.5) * 100) },
    { label: "Range", pct: clamp(reach) },
    { label: "Stability", pct: clamp(100 - def.recoil * 1400) },
    { label: "Handling", pct: clamp((1 / Math.max(def.fireRate, 0.05) / 12) * 100) },
    { label: "Mag size", pct: clamp((def.mag / 40) * 100) },
  ];
}
export function cardFor(card: ClassCard) { const def = frameDef(card.frame); return { ...card, name: def.name, mag: def.mag, stats: cardStats(def) }; }
