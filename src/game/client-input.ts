/**
 * Client-local shared state written by DOM overlays (touch controls, skate shop) and read by Scene each frame.
 * Not progression: equipped boots and touch input are per-device presentation/input.
 */
import { BOOTS_EQUIP_KEY } from "./skate-boots";

export const touch = { active: false, fire: false, aim: false, lookDX: 0, lookDY: 0 };

let equipped: string | null = null;
export function getEquippedBoots(): string | null {
  if (equipped === null && typeof window !== "undefined") equipped = window.localStorage.getItem(BOOTS_EQUIP_KEY) ?? "none";
  return equipped;
}
export function setEquippedBoots(id: string) {
  equipped = id;
  try { window.localStorage.setItem(BOOTS_EQUIP_KEY, id); } catch { /* private mode */ }
}

/** true on phones/tablets. Not just "(pointer: coarse)": Galaxy phones with an S Pen report a fine primary pointer (owner's phone,
 * Oct 26 2026: the phone HUD layout, 30 fps cap and phone render tuning never switched on), so a touch screen counts when it is
 * the primary pointer, or on a phone/tablet (mobile UA or the Android app) whatever its pen reports. Touch laptops stay desktop. */
export function isTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  const touch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  if (!touch) return false;
  const mq = (q: string) => Boolean(window.matchMedia?.(q).matches);
  if (mq("(pointer: coarse)")) return true;
  const native = Boolean((window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.());
  const mobileUa = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return native || mobileUa;
}

/** tags <html> with `wf-touch` so the phone HUD layout in styles.css follows the same test (a CSS media query alone misses S Pen phones) */
export function markTouchDocument(): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("wf-touch", isTouchDevice());
}
if (typeof document !== "undefined") markTouchDocument();

/** active stim buffs (stash.ts) — timed and per-session, so client-local */
import type { Buffs } from "./stash";
export const activeBuffs: { current: Buffs } = { current: {} };
/** Operator dash readout written by Scene each frame (dash.ts), read by DashHud */
export const dashHud: { current: { name: string; charges: number; max: number; fill: number } | null } = { current: null };

/** Dragonite ability readout written by Scene each frame (dragonite-cast.ts), read by DragoniteHud; null when the Operator is not bonded */
export const dragoniteHud: { current: { name: string; cd: number; max: number; key: string }[] | null } = { current: null };
