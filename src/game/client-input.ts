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

/** true on phones/tablets: coarse pointer and touch support */
export function isTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  return ("ontouchstart" in window || navigator.maxTouchPoints > 0) && window.matchMedia?.("(pointer: coarse)").matches;
}

/** active stim buffs (stash.ts) — timed and per-session, so client-local */
import type { Buffs } from "./stash";
export const activeBuffs: { current: Buffs } = { current: {} };
/** Operator dash readout written by Scene each frame (dash.ts), read by DashHud */
export const dashHud: { current: { name: string; charges: number; max: number; fill: number } | null } = { current: null };
