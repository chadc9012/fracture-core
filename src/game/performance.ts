export type RenderTier = "LOW" | "MEDIUM" | "HIGH" | "ULTRA";
export type GameLayer = "gameplay" | "simulation" | "visual" | "network" | "optimization";

export const RENDER_PRESETS = {
  LOW: { dpr: 1, shadows: false, particles: 0.2, distortion: false, armorStages: 1, vfxBudget: 45 },
  MEDIUM: { dpr: 1.25, shadows: true, particles: 0.55, distortion: false, armorStages: 3, vfxBudget: 70 },
  HIGH: { dpr: 1.75, shadows: true, particles: 1, distortion: true, armorStages: 4, vfxBudget: 100 },
  ULTRA: { dpr: 2, shadows: true, particles: 1.35, distortion: true, armorStages: 4, vfxBudget: 125 },
} as const satisfies Record<RenderTier, object>;

export const VFX_COST = {
  shieldGlow: 10,
  dashTrail: 15,
  fractureDistortion: 30,
  bossAura: 40,
  companionOverlay: 25,
} as const;

export type SyncEvent =
  | { type: "ABILITY_USED"; playerId: string; abilityId: string; at: number }
  | { type: "BOSS_PHASE"; bossId: string; phase: number; at: number }
  | { type: "PLAYER_STATE"; playerId: string; state: "ALIVE" | "DEAD" | "TELEPORT"; at: number }
  | { type: "ENVIRONMENT_TRIGGER"; triggerId: string; active: boolean; at: number };

export function playerCountPreset(players: number) {
  if (players >= 12) return { fullRadius: 40, activeRooms: 1, farAi: "SIMPLIFIED" as const };
  if (players >= 6) return { fullRadius: 50, activeRooms: 2, farAi: "SIMPLIFIED" as const };
  return { fullRadius: 60, activeRooms: 3, farAi: "FULL" as const };
}

export function allocateVfx(tier: RenderTier, requested: readonly (keyof typeof VFX_COST)[]) {
  let remaining = RENDER_PRESETS[tier].vfxBudget;
  return requested.filter((effect) => {
    const cost = VFX_COST[effect];
    if (cost > remaining) return false;
    remaining -= cost;
    return true;
  });
}

export function shouldSimulateRoom(activeRoomId: string, roomId: string) {
  return activeRoomId === roomId;
}