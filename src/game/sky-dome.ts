/** Pure parameters for the sky dome (SkyDome.tsx): where the sun is, how much cloud there is, how dark the night is, and the colours the
 * clouds and sun take at each hour. The shader only turns these numbers into pixels, so the look can be tuned and tested without a GPU. */
export type RGB = [number, number, number];
/** The Fracture Moon: a vast cracked world hanging over the horizon (fixed direction, so it is always where the player expects it). `radius` is its
 * angular radius in radians (~24 degrees, a huge cracked world filling a good part of the sky, about 50x the width of our moon), `dir` a unit vector in the south-west sky at ~30 degrees elevation. */
export const SKY_BODY = { dir: [-0.58, 0.5, -0.64] as RGB, radius: 0.42 } as const;
export const skyBodyElevation = () => { const [x, y, z] = SKY_BODY.dir; return Math.asin(y / Math.hypot(x, y, z)); };

export type SkyParams = { zenith: RGB; horizon: RGB; wash: number; night: number; cover: number; sunStrength: number; sunColor: RGB; cloudLit: RGB; cloudShade: RGB; starStrength: number; milkyWay: number };

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

const GOLD: RGB = [1.0, 0.52, 0.2], NOON: RGB = [1.0, 0.95, 0.86], MOONLIT: RGB = [0.42, 0.5, 0.72];
const SHADE_DAY: RGB = [0.46, 0.55, 0.7], SHADE_DUSK: RGB = [0.5, 0.3, 0.4], SHADE_NIGHT: RGB = [0.05, 0.07, 0.12];

const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
export type SkyMoodColors = { zenith: RGB; horizon: RGB };
export type SkyMood = { golden?: SkyMoodColors; night?: SkyMoodColors; day?: SkyMoodColors };
/** Per-region sky colour, sampled from the reference photographs in docs/reference/world-photos (average of the top and upper sky bands; see
 * docs/reference-world-brief.md). `golden` is the sunrise/sunset look, `night` and `day` the other two. Regions without a reference photo for a
 * phase keep the authored global gradient for it. */
export const REGION_SKY_MOOD: Readonly<Record<string, SkyMood>> = {
  veridan: { golden: { zenith: hex("#8995cf"), horizon: hex("#c3b4bd") } },   // sunrise - Veridan Forest
  nexus: { golden: { zenith: hex("#97647c"), horizon: hex("#e67c48") } },     // sunset - Nexus City
  wastelands: { golden: { zenith: hex("#a57886"), horizon: hex("#c08574") } },// sunset - The Wastelands
  frostspire: { night: { zenith: hex("#0c3475"), horizon: hex("#134897") } }, // night - Frostspire Mountains
  ember: { night: { zenith: hex("#1d3a66"), horizon: hex("#324f83") } },      // storm - Ember Peaks
  solara: { day: { zenith: hex("#abcbf6"), horizon: hex("#7c97be") } },       // day - Solara Desert
};
/** How far the sky moves toward the reference colours (never all the way: the clock-driven gradient stays underneath). */
export const SKY_MOOD_STRENGTH = 0.55;
function gradeSky(zenith: RGB, horizon: RGB, mood: SkyMood, low: number, night: number): { zenith: RGB; horizon: RGB } {
  const wGolden = low * (1 - night), wNight = night, wDay = (1 - low) * (1 - night);
  let z = zenith, h = horizon;
  for (const [m, w] of [[mood.golden, wGolden], [mood.night, wNight], [mood.day, wDay]] as const) {
    if (!m || w <= 0) continue;
    z = mix(z, m.zenith, w * SKY_MOOD_STRENGTH); h = mix(h, m.horizon, w * SKY_MOOD_STRENGTH);
  }
  return { zenith: z, horizon: h };
}

/** `sunY` is the sun's height as a unit-vector y (-1..1); `envCloud` is the live regional weather cloud cover 0..1.
 * Even a clear day keeps scattered cumulus (cover >= 0.38) so the sky is never an empty gradient. */
export function skyParams(sunY: number, envCloud: number, regionId?: string | null): SkyParams {
  const night = smooth(0.06, -0.14, sunY);
  const low = 1 - smooth(0.05, 0.45, sunY); // 1 at the horizon (golden hour), 0 high in the sky
  const sunColor = mix(NOON, GOLD, low);
  const day = smooth(-0.1, 0.35, sunY);
  const lit = mix(mix(sunColor, [1, 1, 1], 0.12), MOONLIT, night).map((c) => c * (0.35 + 0.65 * Math.max(day, 0.15))) as RGB;
  const shade = mix(mix(SHADE_DAY, SHADE_DUSK, low * 0.8), SHADE_NIGHT, night);
  // sky wash: a colour grade drawn over the atmospheric sky so the look is authored, not just physical. Teal-blue noon, molten gold and magenta at the
  // horizon at golden hour, deep indigo with a violet band at night
  const zenith = mix(mix([0.16, 0.42, 0.74], [0.3, 0.2, 0.5], low * 0.85), [0.03, 0.04, 0.14], night);
  const horizon = mix(mix([1.0, 0.86, 0.62], [1.0, 0.42, 0.22], low), [0.2, 0.12, 0.34], night);
  const mood = regionId ? REGION_SKY_MOOD[regionId] : undefined;
  const graded = mood ? gradeSky(zenith, horizon, mood, low, night) : { zenith, horizon };
  return {
    zenith: graded.zenith, horizon: graded.horizon, wash: 0.5 - night * 0.15,
    night,
    cover: 0.38 + clamp01(envCloud) * 0.5,
    sunStrength: smooth(-0.08, 0.06, sunY),
    sunColor,
    cloudLit: lit,
    cloudShade: shade,
    starStrength: night * (1 - clamp01(envCloud) * 0.85),
    milkyWay: night * (1 - clamp01(envCloud)),
  };
}
