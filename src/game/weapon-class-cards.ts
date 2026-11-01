/** The Arsenal's six class cards (the concept sheet's Auto / Scout / Sniper / Shotgun / SMG / Heavy row). Each card is a real
 * in-game frame, so the numbers on it are the numbers the weapon fires with (weapons.ts, weapon-classes.ts). The art is the owner-supplied painted
 * concept for each class. Pure. */
import { frameDef, type FrameId } from "./weapon-classes";
import type { WeaponDef } from "./weapons";

export type ClassCard = { id: string; label: string; frame: FrameId; color: string; /** painted concept art (public/art/weapons) and the concept's name; concept art only, not an in-game model */ art: string; concept: string };
export const CLASS_CARDS: readonly ClassCard[] = [
  { id: "auto", label: "Assault rifles", frame: "AUTO", color: "#ef4444", art: "/art/weapons/dragonfire-ar-7.jpg", concept: "Dragonfire AR-7" },
  { id: "sniper", label: "Sniper rifles", frame: "SNIPER", color: "#60a5fa", art: "/art/weapons/frostveil-sr-9.jpg", concept: "Frostveil SR-9" },
  { id: "shotgun", label: "Shotguns", frame: "SHOTGUN", color: "#fbbf24", art: "/art/weapons/goliath-k-12.jpg", concept: "Goliath K-12" },
  { id: "smg", label: "SMGs", frame: "SMG", color: "#c084fc", art: "/art/weapons/neon-rift-smg.jpg", concept: "Neon Rift SMG" },
  { id: "handgun", label: "Handguns", frame: "SIDEARM", color: "#f59e0b", art: "/art/weapons/sunforge-revolver.jpg", concept: "Sunforge Revolver" },
  { id: "launcher", label: "Rocket launchers", frame: "ROCKET", color: "#84cc16", art: "/art/weapons/wyrmbreaker-rl-1.jpg", concept: "Wyrmbreaker RL-1" },
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
