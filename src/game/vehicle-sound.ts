/**
 * What each vehicle sounds like (owner, Nov 2026: "make sure vehicle audio matches vehicles"). Pure: audio.ts builds the
 * graph from these numbers. The sound follows the body the player sees (fleet-models.ts, a fleet build included), not just
 * the chassis underneath: a Civic Rover city pod on the jeep chassis hums electric, a Void Chaser hover car whines.
 *
 * Every engine is three layers:
 *  - a TONE (oscillator + an octave-down sub, through a lowpass) that rises with speed: the motor itself;
 *  - a PULSE that chops the tone at a rate tied to rpm (cylinder firing for engines, rotor blades for the gunship, track links
 *    for tanks; 0 for smooth electric and turbine motors);
 *  - a NOISE bed through a filter that opens with speed: exhaust rasp, turbine roar, rotor wash, water wash or air rush.
 */
import type { FleetModelId } from "./fleet-models";

export type SoundFamily =
  | "v8" | "sport" | "diesel" | "buggy" | "electric" | "hover" | "tracks"
  | "rotor" | "jet" | "shuttle" | "drone" | "outboard" | "submarine" | "ship";

export type EngineSound = {
  family: SoundFamily;
  /** tone at idle (Hz), how far it climbs at full speed (x), waveform */
  base: number; climb: number; wave: OscillatorType;
  /** lowpass on the tone: idle cutoff and how far it opens (x) */
  cutoff: number; open: number;
  /** pulses per tone cycle (engine firing), or a fixed rate (Hz) when `pulseFixed`; depth 0..1 */
  pulse: number; pulseDepth: number; pulseFixed?: boolean;
  /** noise bed: filter type, centre/cutoff (Hz) at idle and at speed, level at idle and at speed */
  noise: { type: BiquadFilterType; f0: number; f1: number; idle: number; full: number; q: number };
  /** overall level; how much of it is the tone vs noise is set by the layers above */
  level: number;
};

const S = (family: SoundFamily, o: Omit<EngineSound, "family">): EngineSound => ({ family, ...o });

export const SOUNDS: Record<SoundFamily, EngineSound> = {
  // big-block muscle: deep, lumpy idle (8 cylinders fire 4x per revolution), throaty rasp
  v8: S("v8", { base: 42, climb: 3.2, wave: "sawtooth", cutoff: 520, open: 2.6, pulse: 0.5, pulseDepth: 0.55, noise: { type: "bandpass", f0: 260, f1: 900, idle: 0.08, full: 0.35, q: 1.2 }, level: 1 }),
  // high-revving sports engine: higher, smoother, screams at the top
  sport: S("sport", { base: 62, climb: 4.2, wave: "sawtooth", cutoff: 760, open: 2.8, pulse: 0.5, pulseDepth: 0.3, noise: { type: "bandpass", f0: 600, f1: 2200, idle: 0.05, full: 0.3, q: 1.4 }, level: 0.95 }),
  // turbo-diesel trucks, 4x4s, armoured transports: slow, clattery, heavy
  diesel: S("diesel", { base: 34, climb: 2.4, wave: "square", cutoff: 380, open: 2.0, pulse: 0.5, pulseDepth: 0.65, noise: { type: "bandpass", f0: 180, f1: 600, idle: 0.12, full: 0.3, q: 1.0 }, level: 1 }),
  // the raider buggy: a rattly, buzzy small engine
  buggy: S("buggy", { base: 70, climb: 3.6, wave: "square", cutoff: 1100, open: 2.0, pulse: 1, pulseDepth: 0.5, noise: { type: "highpass", f0: 1500, f1: 3000, idle: 0.06, full: 0.28, q: 0.7 }, level: 0.9 }),
  // electric city cars: a clean inverter whine, no idle rumble, tyre and air noise doing the rest
  electric: S("electric", { base: 180, climb: 4.5, wave: "sine", cutoff: 2600, open: 1.6, pulse: 0, pulseDepth: 0, noise: { type: "bandpass", f0: 500, f1: 1400, idle: 0.0, full: 0.22, q: 0.6 }, level: 0.65 }),
  // hover vehicles: a shimmering repulsor hum (a slow wobble) and air rushing under the lift pads
  hover: S("hover", { base: 110, climb: 2.6, wave: "triangle", cutoff: 2200, open: 1.5, pulse: 7, pulseDepth: 0.18, pulseFixed: true, noise: { type: "lowpass", f0: 700, f1: 2400, idle: 0.1, full: 0.3, q: 0.5 }, level: 0.7 }),
  // tanks and crawlers: a deep diesel under the clank of the tracks, which speeds up with ground speed
  tracks: S("tracks", { base: 26, climb: 1.8, wave: "square", cutoff: 300, open: 1.8, pulse: 0.35, pulseDepth: 0.7, noise: { type: "bandpass", f0: 900, f1: 1800, idle: 0.04, full: 0.4, q: 2.2 }, level: 1 }),
  // the gunship: turbine whine under the blade chop (a fixed ~6 Hz rotor beat, faster when pulling hard) and rotor wash
  rotor: S("rotor", { base: 220, climb: 1.4, wave: "sawtooth", cutoff: 1400, open: 1.3, pulse: 6, pulseDepth: 0.85, pulseFixed: true, noise: { type: "lowpass", f0: 400, f1: 900, idle: 0.35, full: 0.6, q: 0.8 }, level: 1 }),
  // the strike jet: a turbine whine and a broad roar that dominates at speed
  jet: S("jet", { base: 520, climb: 2.4, wave: "sawtooth", cutoff: 2600, open: 1.4, pulse: 0, pulseDepth: 0, noise: { type: "lowpass", f0: 900, f1: 3800, idle: 0.35, full: 0.9, q: 0.4 }, level: 0.9 }),
  // the shuttle: an even reactor drone with a soft thruster hiss
  shuttle: S("shuttle", { base: 68, climb: 2.0, wave: "triangle", cutoff: 900, open: 1.6, pulse: 0.25, pulseDepth: 0.15, pulseFixed: false, noise: { type: "bandpass", f0: 1200, f1: 2600, idle: 0.12, full: 0.4, q: 0.6 }, level: 0.8 }),
  // drones: a high multi-rotor buzz (a fast fixed beat) and thin air noise
  drone: S("drone", { base: 160, climb: 1.6, wave: "sawtooth", cutoff: 2400, open: 1.3, pulse: 23, pulseDepth: 0.35, pulseFixed: true, noise: { type: "highpass", f0: 2200, f1: 4000, idle: 0.06, full: 0.18, q: 0.6 }, level: 0.75 }),
  // the patrol boat: an outboard two-stroke and the hull slapping through water
  outboard: S("outboard", { base: 55, climb: 3.0, wave: "sawtooth", cutoff: 800, open: 2.2, pulse: 1, pulseDepth: 0.45, noise: { type: "bandpass", f0: 350, f1: 1100, idle: 0.15, full: 0.55, q: 0.7 }, level: 1 }),
  // the sub-skiff: a muffled electric drive and water rushing past
  submarine: S("submarine", { base: 90, climb: 2.0, wave: "sine", cutoff: 420, open: 1.5, pulse: 0, pulseDepth: 0, noise: { type: "lowpass", f0: 250, f1: 700, idle: 0.2, full: 0.5, q: 0.7 }, level: 0.75 }),
  // the dreadnought: a vast low engine room thrum and a bow wave
  ship: S("ship", { base: 22, climb: 1.5, wave: "square", cutoff: 220, open: 1.6, pulse: 0.25, pulseDepth: 0.4, noise: { type: "lowpass", f0: 220, f1: 600, idle: 0.25, full: 0.6, q: 0.6 }, level: 1 }),
};

/** the family each body belongs to (a body is a fleet model) */
export const MODEL_SOUND: Record<FleetModelId, SoundFamily> = {
  "street-racer": "sport", "tuner": "sport", "luxury-sedan": "sport",
  "muscle-car": "v8", "armored-muscle": "v8",
  "offroad-truck": "diesel", "security-suv": "diesel", "tech-transport": "diesel", "war-rig": "diesel",
  "raider-buggy": "buggy",
  "city-pod": "electric",
  "hover-car": "hover", "aether-hoverbike": "hover",
  "goliath-tank": "tracks", "fracture-behemoth": "tracks",
  "rift-helicopter": "rotor",
  "vanguard-jet": "jet",
  "void-skimmer": "shuttle",
  "ai-interceptor": "drone",
  "scrap-patrol-boat": "outboard",
  "hydro-sub-skiff": "submarine",
  "leviathan": "ship",
};

export const soundForModel = (model: FleetModelId | string): EngineSound => SOUNDS[MODEL_SOUND[model as FleetModelId] ?? "v8"];

/** the layer settings for one frame: speed01 0..1 of top speed, throttle 0..1; `tune` (>= 1) is the tuned top speed ratio */
export function engineFrame(s: EngineSound, speed01: number, throttle: number, tune = 1) {
  const v = Math.min(1, Math.max(0, speed01)), th = Math.min(1, Math.max(0, throttle)), k = Math.min(1.6, Math.max(1, tune));
  const tone = s.base * (1 + (s.climb - 1) * (v * 0.85 + th * 0.15)) * (1 + (k - 1) * 0.15);
  return {
    tone,
    cutoff: s.cutoff * (1 + (s.open - 1) * Math.max(v, th * 0.7)),
    /** the chop rate: fixed (rotors, drones, hover wobble) or a share of the tone (engine firing, track links) */
    pulseHz: s.pulseFixed ? s.pulse * (1 + 0.35 * th + 0.25 * v) : tone * s.pulse,
    pulseDepth: s.pulseDepth,
    noiseF: s.noise.f0 + (s.noise.f1 - s.noise.f0) * v,
    noiseGain: s.noise.idle + (s.noise.full - s.noise.idle) * Math.max(v, th * 0.5),
    toneGain: (0.55 + 0.3 * th + 0.25 * v) * (s.family === "jet" ? 0.45 : 1),
  };
}
