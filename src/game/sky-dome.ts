/** Pure parameters for the sky dome (SkyDome.tsx): where the sun is, how much cloud there is, how dark the night is, and the colours the
 * clouds and sun take at each hour. The shader only turns these numbers into pixels, so the look can be tuned and tested without a GPU. */
export type RGB = [number, number, number];
/** The Fracture Moon: a vast cracked world hanging over the horizon (fixed direction, so it is always where the player expects it). `radius` is its
 * angular radius in radians (~24 degrees, a huge cracked world filling a good part of the sky, about 50x the width of our moon), `dir` a unit vector in the south-west sky at ~30 degrees elevation. */
export const SKY_BODY = { dir: [-0.58, 0.5, -0.64] as RGB, radius: 0.42 } as const;
export const skyBodyElevation = () => { const [x, y, z] = SKY_BODY.dir; return Math.asin(y / Math.hypot(x, y, z)); };

export type SkyParams = { zenith: RGB; horizon: RGB; wash: number; night: number; cover: number; sunStrength: number; sunColor: RGB; cloudLit: RGB; cloudShade: RGB; starStrength: number; milkyWay: number;
  /** how dark cloud bases get (light absorbed through the cloud) */ absorb: number; /** high cirrus amount 0..1 */ cirrus: number;
  /** cloud feature size: higher = smaller, busier clouds */ cloudScale: number; /** how much of the Fracture Moon shows by day (0 hidden .. 1 solid) */ moonDay: number;
  /** Sky Rift brightness multiplier */ riftK: number };

/** Sky looks (owner's style call: "gritty realistic overall"). Each is a full recipe for the clouds and how loud the Fracture sky elements are.
 * - clear: a real fair-weather sky, deep blue, scattered sunlit cumulus, the Fracture Moon only a ghost by day
 * - gritty: broken war-sky overcast, heavy dark-based cloud with bright sunlit tops, desaturated (Battlefield / Warzone tone)
 * - fracture: the cinematic one, real cumulus but the moon and the rift stay loud and the cloud shadows lean violet */
export type SkyLookId = "clear" | "gritty" | "fracture";
export type SkyLook = { cover: number; absorb: number; cirrus: number; cloudScale: number; moonDay: number; riftK: number; shadeTint: RGB; desat: number };
export const SKY_LOOKS: Readonly<Record<SkyLookId, SkyLook>> = {
  clear: { cover: 0.32, absorb: 1.6, cirrus: 0.5, cloudScale: 1, moonDay: 0.1, riftK: 0.3, shadeTint: [1, 1, 1], desat: 0 },
  gritty: { cover: 0.54, absorb: 2.4, cirrus: 0.25, cloudScale: 0.8, moonDay: 0.06, riftK: 0.3, shadeTint: [0.92, 0.94, 1], desat: 0.35 },
  fracture: { cover: 0.42, absorb: 2, cirrus: 0.6, cloudScale: 0.9, moonDay: 0.38, riftK: 1, shadeTint: [1.05, 0.9, 1.15], desat: 0.1 },
};
export const DEFAULT_SKY_LOOK: SkyLookId = "gritty"; // owner picked the gritty war sky (Oct 25)

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

const GOLD: RGB = [1.0, 0.52, 0.2], NOON: RGB = [1.0, 0.95, 0.86], MOONLIT: RGB = [0.42, 0.5, 0.72];
const SHADE_DAY: RGB = [0.5, 0.58, 0.72], SHADE_DUSK: RGB = [0.42, 0.34, 0.5], SHADE_NIGHT: RGB = [0.05, 0.07, 0.12];

const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
export type SkyMoodColors = { zenith: RGB; horizon: RGB };
export type SkyMood = { golden?: SkyMoodColors; night?: SkyMoodColors; day?: SkyMoodColors };
/** Per-region sky colour from the reference photographs in docs/reference/world-photos. The golden-hour moods are the photos' clear-sky zenith
 * and the glow at the horizon, not band averages (averaging a pink-cloud, blue-sky band gave every sunset a flat mauve; Stage 46). `golden` is the sunrise/sunset look, `night` and `day` the other two. Regions without a reference photo for a
 * phase keep the authored global gradient for it. */
export const REGION_SKY_MOOD: Readonly<Record<string, SkyMood>> = {
  veridan: { golden: { zenith: hex("#5f86cf"), horizon: hex("#ffc488") } },   // sunrise - Verdant Forest: clear blue overhead, peach-gold dawn low
  nexus: { golden: { zenith: hex("#36407e"), horizon: hex("#ff7a30") } },     // sunset - Nexus City: deep blue-violet overhead, burning orange at the horizon
  wastelands: { golden: { zenith: hex("#4a4278"), horizon: hex("#ff6e3a") } },// sunset - The Wastelands: dusk violet over a red-orange horizon
  frostspire: { night: { zenith: hex("#0c3475"), horizon: hex("#134897") } }, // night - Frostspire Mountains
  // storm - Ember Peaks at night; by day and at dusk an ash-choked sky, bruised brown overhead and burning orange at the horizon
  // (reference "volcano" / "storm - Ember Peaks"): the clear-blue noon gradient never suited a volcano
  ember: { night: { zenith: hex("#1d3a66"), horizon: hex("#324f83") }, day: { zenith: hex("#4b3a40"), horizon: hex("#c76a3e") }, golden: { zenith: hex("#3a1c28"), horizon: hex("#ff5a22") } },
  // the Shrouded Swamps: a low, murky green-grey overcast
  swamps: { day: { zenith: hex("#64786f"), horizon: hex("#a3b090") } },
  solara: { day: { zenith: hex("#abcbf6"), horizon: hex("#7c97be") } },       // day - Solara Desert
};
/** How far the sky moves toward the reference colours (never all the way: the clock-driven gradient stays underneath). */
export const SKY_MOOD_STRENGTH = 0.65;
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
export function skyParams(sunY: number, envCloud: number, regionId?: string | null, lookId: SkyLookId = DEFAULT_SKY_LOOK): SkyParams {
  const look = SKY_LOOKS[lookId];
  const night = smooth(0.06, -0.14, sunY);
  const low = 1 - smooth(0.05, 0.45, sunY); // 1 at the horizon (golden hour), 0 high in the sky
  const sunColor = mix(NOON, GOLD, low);
  const day = smooth(-0.1, 0.35, sunY);
  const lit = mix(mix(sunColor, [1, 1, 1], 0.12 + 0.2 * (1 - low)), MOONLIT, night).map((c) => c * (0.6 + 0.4 * Math.max(day, 0.15)) * (1 - 0.55 * night)) as RGB; // sunset clouds glow, they do not go muddy
  const shade = mix(mix(SHADE_DAY, SHADE_DUSK, low * 0.8), SHADE_NIGHT, night);
  // sky wash: a colour grade drawn over the atmospheric sky so the look is authored, not just physical. Teal-blue noon, molten gold and magenta at the
  // horizon at golden hour, deep indigo with a violet band at night
  const zenith = mix(mix([0.1, 0.32, 0.68], [0.2, 0.22, 0.5], low * 0.85), [0.03, 0.04, 0.14], night);
  const horizon = mix(mix([0.74, 0.84, 0.94], [1.0, 0.46, 0.16], low), [0.2, 0.12, 0.34], night); // noon: pale blue-white haze (a cream noon horizon read as smog)
  const mood = regionId ? REGION_SKY_MOOD[regionId] : undefined;
  // a desaturated look greys the clock-driven gradient; the regions' reference-photo moods are graded on top, so they keep their colour
  const grey = (c: RGB): RGB => { const l = c[0] * 0.3 + c[1] * 0.55 + c[2] * 0.15; return mix(c, [l, l, l], look.desat); };
  const graded = mood ? gradeSky(grey(zenith), grey(horizon), mood, low, night) : { zenith: grey(zenith), horizon: grey(horizon) };
  const tint = (c: RGB): RGB => c.map((v, i) => clamp01(v * look.shadeTint[i]!)) as RGB;
  return {
    zenith: graded.zenith, horizon: graded.horizon, wash: 0.66 + low * (1 - night) * 0.2 - night * 0.3, // golden hour: the authored sunset gradient dominates the bleached physical sky
    night,
    cover: Math.min(0.95, look.cover + clamp01(envCloud) * 0.5),
    sunStrength: smooth(-0.08, 0.06, sunY),
    sunColor,
    cloudLit: grey(lit),
    cloudShade: tint(grey(shade)),
    starStrength: night * (1 - clamp01(envCloud) * 0.85),
    milkyWay: night * (1 - clamp01(envCloud)),
    absorb: look.absorb, cirrus: look.cirrus, cloudScale: look.cloudScale, moonDay: look.moonDay, riftK: look.riftK,
  };
}

/** The Sky Rift (trailer reference "broken horizon", docs/trailer-references.md): a jagged tear in the sky itself, running from high in the
 * north-east sky down toward the eastern horizon, opposite the Fracture Moon, with streams of simulation "code" leaking from its edges.
 * `from`/`to` are unit-ish directions on the dome (the tear follows the great circle between them); `width` is the core half-width in
 * radians. Fixed in the sky like the moon, so the intro and the player always find it in the same place. */
export const SKY_RIFT = { from: [0.32, 0.86, -0.4] as RGB, to: [0.86, 0.06, 0.5] as RGB, width: 0.022, jag: 0.05 } as const;
/** How strongly the rift glows: it reads by day, burns at night and flares while a storm is overhead (the fracture feeds on storms). */
export function riftGlow(night: number, cloud: number, storm: boolean): number {
  return clamp01(0.55 + 0.45 * clamp01(night) + (storm ? 0.35 : 0) - clamp01(cloud) * 0.15);
}
/** Unit direction of a point `t` (0 = from, 1 = to) along the rift's great circle — where the intro camera looks to frame it. */
export function riftPoint(t: number): RGB {
  const n = (v: RGB): RGB => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
  const a = n(SKY_RIFT.from as RGB), b = n(SKY_RIFT.to as RGB);
  const om = Math.acos(Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));
  const s = Math.sin(om), k0 = Math.sin((1 - t) * om) / s, k1 = Math.sin(t * om) / s;
  return n([a[0] * k0 + b[0] * k1, a[1] * k0 + b[1] * k1, a[2] * k0 + b[2] * k1]);
}
