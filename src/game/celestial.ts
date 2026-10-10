/** Sun, moon and stars as pure functions of the day clock (time: day fraction that keeps counting
 * up across days). The moon drifts against the sun over an 8-day cycle, so its lit side really
 * comes from the sun and phases follow; stars fade in only after dusk and behind clear sky. */
export const LUNAR_CYCLE_DAYS = 8;

/** sun angle on its arc; -PI/2 at midnight, +PI/2 at noon */
export function sunAngle(time: number): number {
  return (((time % 1) + 1) % 1) * Math.PI * 2 - Math.PI / 2;
}

/** 0 = new moon (moon sits with the sun), 0.5 = full (opposite the sun) */
export function lunarPhase(time: number): number {
  return (((time / LUNAR_CYCLE_DAYS) % 1) + 1) % 1;
}

/** moon arc angle: lags the sun by the phase, so a full moon rises at sunset */
export function moonAngle(time: number): number {
  return sunAngle(time) + lunarPhase(time) * Math.PI * 2;
}

/** lit fraction of the disc, 0 new .. 1 full */
export function lunarIllumination(time: number): number {
  return (1 - Math.cos(lunarPhase(time) * Math.PI * 2)) / 2;
}

/** 0..1 star visibility: needs the sun well below the horizon, dimmed by cloud cover */
export function starVisibility(sunHeight: number, cloud: number): number {
  const dark = Math.min(1, Math.max(0, (-sunHeight - 0.05) / 0.25));
  return dark * Math.max(0, 1 - cloud * 1.2);
}

/** moonlight strength: only when the moon is up, scaled by phase and clouds */
export function moonlight(time: number, cloud: number): number {
  const h = Math.sin(moonAngle(time));
  if (h <= 0) return 0;
  return Math.min(1, h * 2) * (0.25 + 0.75 * lunarIllumination(time)) * (1 - cloud * 0.6);
}
