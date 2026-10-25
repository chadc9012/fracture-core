/** Living NPC day/night routine: leaders, quest givers and informants work their posts by day and drift to a rest spot toward
 * the city centre overnight. Presentation and reach only: dialogue, contracts and rewards never depend on the hour, so nobody is ever
 * locked out of a quest by the clock. With no clock set (tests, menus) everyone stands at their post. */
import { CITIES } from "./living-world";
import type { LivingNpc } from "./living-npcs";

export const OFF_DUTY_FROM = 22, OFF_DUTY_TO = 5;
export const REST_DISTANCE = 8;

export function onDuty(hour: number | null): boolean {
  if (hour === null || !Number.isFinite(hour)) return true;
  const h = ((hour % 24) + 24) % 24;
  return !(h >= OFF_DUTY_FROM || h < OFF_DUTY_TO);
}

const hash = (id: string) => { let h = 2166136261; for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0; return h; };

/** offset from the city centre where this NPC rests: REST_DISTANCE toward the centre, a few metres to the side so they do not stack */
export function restSpot(npc: Pick<LivingNpc, "id" | "lx" | "lz">): { lx: number; lz: number } {
  const d = Math.hypot(npc.lx, npc.lz);
  const h = hash(npc.id);
  const ux = d > 1 ? -npc.lx / d : Math.cos((h % 628) / 100), uz = d > 1 ? -npc.lz / d : Math.sin((h % 628) / 100);
  const toward = Math.min(REST_DISTANCE, d > 1 ? d : REST_DISTANCE);
  const side = ((h >> 8) % 5) - 2; // -2..2 m
  return { lx: npc.lx + ux * toward + -uz * side, lz: npc.lz + uz * toward + ux * side };
}

/** world position at this hour */
export function npcPosition(npc: Pick<LivingNpc, "id" | "city" | "lx" | "lz">, hour: number | null): { x: number; z: number; onDuty: boolean } {
  const c = CITIES[npc.city];
  const duty = onDuty(hour);
  const p = duty ? npc : restSpot(npc);
  return { x: c.x + p.lx, z: c.z + p.lz, onDuty: duty };
}
