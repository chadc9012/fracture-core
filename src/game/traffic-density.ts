/** City traffic by hour: thin overnight, busy at the morning and evening rush, steady between. Pure. With no clock set (tests, menus)
 * the full fleet runs, as before. Cars are switched on in a fixed order, so the same cars are the last to leave and the first to return. */
const KEYS: readonly (readonly [number, number])[] = [[0, 0.3], [4, 0.25], [6, 0.5], [8, 1], [10, 0.7], [15, 0.75], [17, 1], [19, 1], [21, 0.6], [24, 0.3]];

export function trafficDensity(hour: number | null): number {
  if (hour === null || !Number.isFinite(hour)) return 1;
  const h = ((hour % 24) + 24) % 24;
  for (let i = 1; i < KEYS.length; i++) {
    const [h1, d1] = KEYS[i]!, [h0, d0] = KEYS[i - 1]!;
    if (h <= h1) return d0 + ((d1 - d0) * (h - h0)) / (h1 - h0);
  }
  return KEYS[KEYS.length - 1]![1];
}
export const activeCars = (total: number, hour: number | null) => (total <= 0 ? 0 : Math.max(1, Math.min(total, Math.round(trafficDensity(hour) * total))));
export const carIsOut = (index: number, total: number, hour: number | null) => index < activeCars(total, hour);
