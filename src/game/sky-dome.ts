/** Pure parameters for the sky dome (SkyDome.tsx): where the sun is, how much cloud there is, how dark the night is, and the colours the
 * clouds and sun take at each hour. The shader only turns these numbers into pixels, so the look can be tuned and tested without a GPU. */
export type RGB = [number, number, number];
/** The Fracture Moon: a vast cracked world hanging over the horizon (fixed direction, so it is always where the player expects it). `radius` is its
 * angular radius in radians (~24 degrees, a huge cracked world filling a good part of the sky, about 50x the width of our moon), `dir` a unit vector in the south-west sky at ~30 degrees elevation. */
export const SKY_BODY = { dir: [-0.58, 0.5, -0.64] as RGB, radius: 0.42 } as const;
export const skyBodyElevation = () => { const [x, y, z] = SKY_BODY.dir; return Math.asin(y / Math.hypot(x, y, z)); };

const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
export type SkyParams = { zenith: RGB; horizon: RGB; wash: number; night: number; cover: number; sunStrength: number; sunColor: RGB; cloudLit: RGB; cloudShade: RGB; starStrength: number; milkyWay: number;
  /** how dark cloud bases get (light absorbed through the cloud) */ absorb: number; /** high cirrus amount 0..1 */ cirrus: number;
  /** cloud feature size: higher = smaller, busier clouds */ cloudScale: number; /** how much of the Fracture Moon shows by day (0 hidden .. 1 solid) */ moonDay: number;
  /** Sky Rift brightness multiplier */ riftK: number;
  /** the Fracture Moon: crack colour and glow, surface tint, and the night nebula strength */ crack: RGB; crackGlow: number; moonTint: RGB; nebula: number };

/** Sky looks (owner's style call: "gritty realistic overall"). Each is a full recipe for the clouds and how loud the Fracture sky elements are.
 * - clear: a real fair-weather sky, deep blue, scattered sunlit cumulus, the Fracture Moon only a ghost by day
 * - gritty: broken war-sky overcast, heavy dark-based cloud with bright sunlit tops, desaturated (Battlefield / Warzone tone)
 * - fracture: the cinematic one, real cumulus but the moon and the rift stay loud and the cloud shadows lean violet */
export type SkyLookId = "clear" | "gritty" | "fracture" | "vivid";
export type SkyLook = { cover: number; absorb: number; cirrus: number; cloudScale: number; moonDay: number; riftK: number; shadeTint: RGB; desat: number; /** colours come from the time-of-day keyframes (SKY_KEYS) */ keyed?: boolean };
export const SKY_LOOKS: Readonly<Record<SkyLookId, SkyLook>> = {
  clear: { cover: 0.32, absorb: 1.6, cirrus: 0.5, cloudScale: 1, moonDay: 0.1, riftK: 0.3, shadeTint: [1, 1, 1], desat: 0 },
  gritty: { cover: 0.54, absorb: 2.4, cirrus: 0.25, cloudScale: 0.8, moonDay: 0.06, riftK: 0.3, shadeTint: [0.92, 0.94, 1], desat: 0.35 },
  fracture: { cover: 0.42, absorb: 2, cirrus: 0.6, cloudScale: 0.9, moonDay: 0.38, riftK: 1, shadeTint: [1.05, 0.9, 1.15], desat: 0.1 },
  // the owner's sky board (docs/reference/sky-cycle.png): saturated and cinematic, bright white cumulus, the cracked moon always huge
  vivid: { cover: 0.3, absorb: 0.9, cirrus: 0.7, cloudScale: 0.85, moonDay: 0.96, riftK: 0.12, shadeTint: [1, 1, 1], desat: 0, keyed: true },
};
/** owner's sky board (Oct 25, "the sky transitions should look like this") replaced the gritty pick */
export const DEFAULT_SKY_LOOK: SkyLookId = "vivid";

/** Time-of-day keyframes from the owner's sky board: dawn, morning, mid-morning, noon, afternoon, sunset, dusk, night, late night.
 * `h` is the hour (sunrise 6, sunset 18). Between keys the colours ease smoothly; the cycle wraps through midnight. */
export type SkyKey = { h: number; zenith: RGB; horizon: RGB; sun: RGB; lit: RGB; shade: RGB; crack: RGB; crackGlow: number; moon: RGB; nebula: number };
const K = (h: number, zenith: string, horizon: string, sun: string, lit: string, shade: string, crack: string, crackGlow: number, moon: string, nebula: number): SkyKey =>
  ({ h, zenith: hex(zenith), horizon: hex(horizon), sun: hex(sun), lit: hex(lit), shade: hex(shade), crack: hex(crack), crackGlow, moon: hex(moon), nebula });
export const SKY_KEYS: readonly SkyKey[] = [
  K(2, "#03061a", "#0c1236", "#8090c0", "#1a2048", "#080b22", "#6f7dff", 0.45, "#2a3466", 1),     // late night: deep navy, blue-violet cracks
  K(5.6, "#232a66", "#ff8a5c", "#ffa060", "#f0907a", "#4a3a6a", "#ff8a4a", 0.7, "#8a7a9a", 0.25), // dawn: indigo overhead, a pink-orange band
  K(7.2, "#3d6cc0", "#ffc48a", "#ffd096", "#ffe0b8", "#8d93bb", "#ff9a4a", 0.35, "#b0b4c8", 0),  // morning: blue sky, gold horizon, peach-lit cloud
  K(8.2, "#2b68d2", "#b9d6f2", "#fff2dc", "#fff8ee", "#9fb1d0", "#3a3446", 0.1, "#b8c4da", 0),   // mid-morning
  K(12, "#1b5bcc", "#a6cdf4", "#fffaf0", "#ffffff", "#a4b6d6", "#36303f", 0.06, "#bcc8de", 0),   // noon: deep blue, bright white cumulus
  K(15, "#2560c6", "#c0d6ee", "#fff0d6", "#fff4e4", "#9caacb", "#3c3444", 0.1, "#b8c2d8", 0),    // afternoon
  K(16.9, "#2a5cc0", "#b6cce6", "#ffe2b0", "#fff0d8", "#98a4c4", "#5a3a3a", 0.2, "#b8bcd0", 0),  // late afternoon: still blue overhead (target wilds frame), the horizon only starting to warm
  K(18, "#4a2858", "#ff5a1c", "#ff7426", "#ff8c40", "#5c2c4a", "#ff5a14", 1.25, "#c48468", 0),  // sunset: red-orange horizon, fiery clouds, burning cracks
  K(19.2, "#1c1848", "#b83e5a", "#ff6040", "#c4586a", "#2a1f46", "#ff4a7a", 1.1, "#6a4a7a", 0.35), // dusk: violet overhead, a red ember band
  K(21, "#050a26", "#121a48", "#8090c0", "#1e2652", "#0a0e2a", "#7a6cff", 0.5, "#2e3c74", 1),    // night: navy and violet, glowing violet cracks, nebula
];
/** the sky board's colours at `hour` (0..24), eased between keys */
export function skyKeyAt(hour: number): Omit<SkyKey, "h"> {
  const h = ((hour % 24) + 24) % 24, n = SKY_KEYS.length;
  let i = n - 1;
  for (let k = 0; k < n; k++) if (SKY_KEYS[k]!.h <= h) i = k;
  const a = SKY_KEYS[i]!, b = SKY_KEYS[(i + 1) % n]!;
  const span = ((b.h - a.h) + 24) % 24 || 24, t0 = (((h - a.h) + 24) % 24) / span, t = t0 * t0 * (3 - 2 * t0);
  return { zenith: mix(a.zenith, b.zenith, t), horizon: mix(a.horizon, b.horizon, t), sun: mix(a.sun, b.sun, t), lit: mix(a.lit, b.lit, t), shade: mix(a.shade, b.shade, t), crack: mix(a.crack, b.crack, t), crackGlow: a.crackGlow + (b.crackGlow - a.crackGlow) * t, moon: mix(a.moon, b.moon, t), nebula: a.nebula + (b.nebula - a.nebula) * t };
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

const GOLD: RGB = [1.0, 0.52, 0.2], NOON: RGB = [1.0, 0.95, 0.86], MOONLIT: RGB = [0.42, 0.5, 0.72];
const SHADE_DAY: RGB = [0.5, 0.58, 0.72], SHADE_DUSK: RGB = [0.42, 0.34, 0.5], SHADE_NIGHT: RGB = [0.05, 0.07, 0.12];

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
export function skyParams(sunY: number, envCloud: number, regionId?: string | null, lookId: SkyLookId = DEFAULT_SKY_LOOK, hour?: number): SkyParams {
  const look = SKY_LOOKS[lookId];
  // keyed looks need the hour; without it (old callers) fall back to the hour implied by the sun height in the morning
  const key = look.keyed ? skyKeyAt(hour ?? (sunY < 0 ? Math.max(2, 5.6 + sunY * 12) : 6 + (Math.asin(Math.min(1, sunY)) / (Math.PI / 2)) * 6)) : null;
  const night = smooth(0.06, -0.14, sunY);
  const low = 1 - smooth(0.05, 0.45, sunY); // 1 at the horizon (golden hour), 0 high in the sky
  const sunColor = key ? key.sun : mix(NOON, GOLD, low);
  const day = smooth(-0.1, 0.35, sunY);
  const lit0 = mix(mix(sunColor, [1, 1, 1], 0.12 + 0.2 * (1 - low)), MOONLIT, night).map((c) => c * (0.6 + 0.4 * Math.max(day, 0.15)) * (1 - 0.55 * night)) as RGB; // sunset clouds glow, they do not go muddy
  const overcast = (c: RGB): RGB => mix(c, [0.62, 0.64, 0.68].map((v) => v * (1 - 0.8 * night)) as RGB, clamp01(envCloud) * 0.45); // weather greys the board colours
  const lit = key ? overcast(key.lit) : lit0;
  const shade = key ? overcast(key.shade) : mix(mix(SHADE_DAY, SHADE_DUSK, low * 0.8), SHADE_NIGHT, night);
  // sky wash: a colour grade drawn over the atmospheric sky so the look is authored, not just physical. Teal-blue noon, molten gold and magenta at the
  // horizon at golden hour, deep indigo with a violet band at night
  const zenith = key ? overcast(key.zenith) : mix(mix([0.1, 0.32, 0.68], [0.2, 0.22, 0.5], low * 0.85), [0.03, 0.04, 0.14], night);
  const horizon = key ? overcast(key.horizon) : mix(mix([0.74, 0.84, 0.94], [1.0, 0.46, 0.16], low), [0.2, 0.12, 0.34], night); // noon: pale blue-white haze (a cream noon horizon read as smog)
  const mood = regionId ? REGION_SKY_MOOD[regionId] : undefined;
  // a desaturated look greys the clock-driven gradient; the regions' reference-photo moods are graded on top, so they keep their colour
  const grey = (c: RGB): RGB => { const l = c[0] * 0.3 + c[1] * 0.55 + c[2] * 0.15; return mix(c, [l, l, l], look.desat); };
  const graded = mood ? gradeSky(grey(zenith), grey(horizon), mood, low, night) : { zenith: grey(zenith), horizon: grey(horizon) };
  const tint = (c: RGB): RGB => c.map((v, i) => clamp01(v * look.shadeTint[i]!)) as RGB;
  return {
    zenith: graded.zenith, horizon: graded.horizon, wash: key ? 0.97 : 0.66 + low * (1 - night) * 0.2 - night * 0.3, // golden hour: the authored sunset gradient dominates the bleached physical sky
    night,
    cover: Math.min(0.95, look.cover + clamp01(envCloud) * 0.5),
    sunStrength: smooth(-0.08, 0.06, sunY),
    sunColor,
    cloudLit: grey(lit),
    cloudShade: tint(grey(shade)),
    starStrength: night * (1 - clamp01(envCloud) * 0.85),
    milkyWay: night * (1 - clamp01(envCloud)),
    absorb: look.absorb, cirrus: look.cirrus, cloudScale: look.cloudScale, moonDay: look.moonDay, riftK: look.riftK,
    crack: key ? key.crack : mix([1, 0.62, 0.25], [0.4, 0.95, 1], night), crackGlow: key ? key.crackGlow : 0.35 + 0.9 * night,
    moonTint: key ? key.moon : [0.66, 0.62, 0.62], nebula: key ? key.nebula * (1 - clamp01(envCloud) * 0.9) : night * (1 - clamp01(envCloud)),
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
