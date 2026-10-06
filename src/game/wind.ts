/** Weather wind speed (world units/s, ~1 fog .. ~14 storm) → foliage bend strength 0.15..1.4. Pure. */
export function windStrength(speed: number): number {
  return Math.min(1.4, Math.max(0.15, 0.2 + (Math.max(0, speed) / 14) * 1.1));
}
