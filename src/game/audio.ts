/**
 * Procedural combat audio (Web Audio, no files): layered weapon shots, reloads, impacts,
 * spatial panning/muffling by distance, and a combat-intensity music mixer.
 * Browser-only — every entry point is a no-op until unlocked by a user gesture.
 */
import type { WeaponId } from "./weapons";

type Ctx = { ac: AudioContext; master: GainNode; sfx: GainNode; music: GainNode; noise: AudioBuffer; layers: { ambient: GainNode; tension: GainNode; drums: GainNode; motif: GainNode } | null; ambientOscs: OscillatorNode[]; musicRegion: string; beat: number };
let ctx: Ctx | null = null;
let volume = 0.7;
export const VOLUME_KEY = "world-fracture-volume";

export function unlockAudio() {
  if (typeof window === "undefined") return;
  if (ctx) { if (ctx.ac.state === "suspended") void ctx.ac.resume(); return; }
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  const ac = new AC();
  const master = ac.createGain(); master.gain.value = volume; master.connect(ac.destination);
  const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(master);
  const sfx = ac.createGain(); sfx.connect(comp);
  const music = ac.createGain(); music.gain.value = 0.35; music.connect(comp);
  const noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  ctx = { ac, master, sfx, music, noise, layers: null, ambientOscs: [], musicRegion: "", beat: 0 };
  applyMix();
  startMusic(ctx);
}

export function setVolume(v: number) { volume = v; if (ctx) ctx.master.gain.setTargetAtTime(v, ctx.ac.currentTime, 0.05); }
let musicVol = 1; let sfxVol = 1;
/** Separate channel levels (0..1) on top of master. Music bus keeps its 0.35 base mix. */
export function setMixVolumes(music: number, effects: number) {
  musicVol = music; sfxVol = effects;
  if (ctx) { ctx.music.gain.setTargetAtTime(0.35 * music, ctx.ac.currentTime, 0.05); ctx.sfx.gain.setTargetAtTime(effects, ctx.ac.currentTime, 0.05); }
}
function applyMix() { if (ctx) { ctx.music.gain.value = 0.35 * musicVol; ctx.sfx.gain.value = sfxVol; } }

/** Spatial send: distance attenuation, stereo pan from listener yaw, lowpass muffling beyond 20m. */
type Where = { dist?: number; pan?: number };
function out(c: Ctx, w: Where = {}) {
  const dist = w.dist ?? 0;
  const g = c.ac.createGain(); g.gain.value = 1 / (dist * 0.08 + 1);
  const p = c.ac.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, w.pan ?? 0));
  const lp = c.ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = dist > 20 ? Math.max(700, 9000 - dist * 90) : 18000;
  g.connect(lp).connect(p).connect(c.sfx);
  return g;
}
function burst(c: Ctx, dest: AudioNode, { dur, freq, q = 1, type = "bandpass", gain = 1, at = 0 }: { dur: number; freq: number; q?: number; type?: BiquadFilterType; gain?: number; at?: number }) {
  const t = c.ac.currentTime + at;
  const src = c.ac.createBufferSource(); src.buffer = c.noise;
  const f = c.ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = c.ac.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(dest); src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
}
function tone(c: Ctx, dest: AudioNode, { f0, f1, dur, type = "sine", gain = 1, at = 0 }: { f0: number; f1: number; dur: number; type?: OscillatorType; gain?: number; at?: number }) {
  const t = c.ac.currentTime + at;
  const o = c.ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  const g = c.ac.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(dest); o.start(t); o.stop(t + dur + 0.02);
}

/** Weapon = base shot + mechanical layer + energy layer + sub-bass recoil. */
export function playShot(weapon: WeaponId | "VEHICLE") {
  const c = ctx; if (!c) return;
  const o = out(c);
  if (weapon === "AUTO" || weapon === "VEHICLE") {
    burst(c, o, { dur: 0.09, freq: 2400, q: 0.7, gain: 0.55 });
    burst(c, o, { dur: 0.04, freq: 6000, type: "highpass", gain: 0.25 });
    tone(c, o, { f0: 140, f1: 50, dur: 0.08, gain: 0.5 });
  } else if (weapon === "PULSE") {
    burst(c, o, { dur: 0.1, freq: 1800, q: 1.2, gain: 0.45 });
    tone(c, o, { f0: 1400, f1: 300, dur: 0.12, type: "square", gain: 0.12 });
    tone(c, o, { f0: 110, f1: 45, dur: 0.1, gain: 0.5 });
  } else if (weapon === "HEAVY") {
    burst(c, o, { dur: 0.45, freq: 600, q: 0.5, type: "lowpass", gain: 0.9 });
    tone(c, o, { f0: 90, f1: 28, dur: 0.5, gain: 1 });
    tone(c, o, { f0: 900, f1: 120, dur: 0.25, type: "sawtooth", gain: 0.1 });
    burst(c, o, { dur: 0.9, freq: 400, type: "lowpass", gain: 0.18, at: 0.12 }); // distance tail
  }
}
export function playSwing(finisher: boolean) {
  const c = ctx; if (!c) return; const o = out(c);
  burst(c, o, { dur: finisher ? 0.35 : 0.22, freq: finisher ? 900 : 1400, q: 2, gain: 0.5 });
  tone(c, o, { f0: finisher ? 500 : 800, f1: 120, dur: 0.25, type: "triangle", gain: 0.12 });
}
export function playReload(phase: "start" | "end") {
  const c = ctx; if (!c) return; const o = out(c);
  if (phase === "start") { burst(c, o, { dur: 0.03, freq: 3500, q: 6, gain: 0.5 }); burst(c, o, { dur: 0.05, freq: 1800, q: 5, gain: 0.4, at: 0.14 }); }
  else { burst(c, o, { dur: 0.04, freq: 2600, q: 6, gain: 0.6 }); tone(c, o, { f0: 220, f1: 180, dur: 0.06, type: "square", gain: 0.08, at: 0.06 }); }
}
export function playDryFire() { const c = ctx; if (!c) return; burst(c, out(c), { dur: 0.02, freq: 4200, q: 8, gain: 0.4 }); }
export function playSwitch() { const c = ctx; if (!c) return; const o = out(c); burst(c, o, { dur: 0.04, freq: 2000, q: 4, gain: 0.3 }); burst(c, o, { dur: 0.04, freq: 3000, q: 4, gain: 0.3, at: 0.08 }); }

/** Material impact: enemies are machines (metal clang) or aberrations (organic thud). */
export function playImpact(material: "METAL" | "ORGANIC" | "TECH", w: Where) {
  const c = ctx; if (!c) return; const o = out(c, w);
  if (material === "METAL") { tone(c, o, { f0: 1800, f1: 1500, dur: 0.12, type: "triangle", gain: 0.18 }); burst(c, o, { dur: 0.05, freq: 5000, q: 3, gain: 0.25 }); }
  else if (material === "TECH") { burst(c, o, { dur: 0.1, freq: 7000, type: "highpass", gain: 0.25 }); tone(c, o, { f0: 2400, f1: 600, dur: 0.08, type: "sawtooth", gain: 0.06 }); }
  else { burst(c, o, { dur: 0.1, freq: 300, type: "lowpass", gain: 0.5 }); }
  tone(c, out(c), { f0: 2600, f1: 2600, dur: 0.04, type: "sine", gain: 0.1 }); // hit-marker tick, always centered
}
/** A real explosion — sub-bass thump, a sawtooth blast layer, a high-passed crack of debris, and
 * a rolling lowpass aftershock tail. Distinct from playKill()'s short "confirm" chime: this is
 * for structure collapses and boss deaths, where the scene should actually read as something
 * blowing up rather than just a kill being logged. */
export function playExplosion(big: boolean, w: Where = {}) {
  const c = ctx; if (!c) return; const o = out(c, w);
  burst(c, o, { dur: big ? 1.6 : 0.8, freq: big ? 220 : 400, type: "lowpass", gain: big ? 1 : 0.7 });
  tone(c, o, { f0: big ? 70 : 100, f1: 20, dur: big ? 1.4 : 0.8, type: "sawtooth", gain: big ? 0.9 : 0.55 });
  burst(c, o, { dur: 0.3, freq: 5500, type: "highpass", gain: big ? 0.35 : 0.2, at: 0.02 });
  burst(c, o, { dur: big ? 1.2 : 0.6, freq: 300, type: "lowpass", gain: big ? 0.4 : 0.2, at: 0.15 });
}
export function playKill(boss: boolean, w: Where) {
  const c = ctx; if (!c) return; const o = out(c, w);
  burst(c, o, { dur: boss ? 1.4 : 0.6, freq: 500, type: "lowpass", gain: boss ? 1 : 0.6 });
  tone(c, o, { f0: boss ? 70 : 120, f1: 25, dur: boss ? 1.2 : 0.5, gain: 0.7 });
  tone(c, out(c), { f0: 660, f1: 990, dur: 0.12, type: "triangle", gain: 0.08, at: 0.05 }); // confirm chime
}
export function playAbility(kind: string) {
  const c = ctx; if (!c) return; const o = out(c);
  if (kind === "DASH") burst(c, o, { dur: 0.3, freq: 1200, q: 1.5, gain: 0.6 });
  else if (kind === "DOME" || kind === "SHIELD") { tone(c, o, { f0: 200, f1: 400, dur: 0.6, type: "triangle", gain: 0.25 }); tone(c, o, { f0: 300, f1: 600, dur: 0.6, type: "sine", gain: 0.2 }); }
  else { tone(c, o, { f0: 300, f1: 1800, dur: 0.35, type: "sawtooth", gain: 0.1 }); burst(c, o, { dur: 0.4, freq: 3000, q: 1, gain: 0.3 }); }
  tone(c, o, { f0: 60, f1: 30, dur: 0.4, gain: 0.5 });
}
export function playHurt() { const c = ctx; if (!c) return; const o = out(c); tone(c, o, { f0: 180, f1: 60, dur: 0.2, type: "square", gain: 0.12 }); burst(c, o, { dur: 0.12, freq: 800, type: "lowpass", gain: 0.4 }); }
/** Enemy telegraph: shot from a hostile, positioned in space. */
export function playEnemyShot(kind: string, heavy: boolean, w: Where) {
  const c = ctx; if (!c) return; const o = out(c, w);
  const v = 0.9 + Math.random() * 0.2; // per-shot pitch variation
  if (kind === "OVERCLOCKED") { tone(c, o, { f0: 1600 * v, f1: 400, dur: 0.12, type: "sawtooth", gain: 0.08 }); burst(c, o, { dur: 0.06, freq: 5000, type: "highpass", gain: 0.2 }); }
  else if (kind === "ABERRATION") { burst(c, o, { dur: 0.25, freq: 500 * v, q: 3, gain: 0.45 }); tone(c, o, { f0: 220 * v, f1: 90, dur: 0.25, type: "triangle", gain: 0.15 }); }
  else if (kind === "VANGUARD") { tone(c, o, { f0: 900 * v, f1: 250, dur: 0.14, type: "square", gain: 0.08 }); burst(c, o, { dur: 0.08, freq: 2200, q: 1, gain: 0.35 }); }
  else { burst(c, o, { dur: 0.1, freq: 1400 * v, q: 0.8, gain: 0.5 }); tone(c, o, { f0: 130, f1: 50, dur: 0.08, gain: 0.25 }); } // raider ballistic
  if (heavy) { tone(c, o, { f0: 80, f1: 30, dur: 0.35, gain: 0.5 }); burst(c, o, { dur: 0.5, freq: 350, type: "lowpass", gain: 0.2, at: 0.08 }); }
}

let lastStep = 0;
/** Footstep: surface-tinted thump + scuff, alternating pitch. */
export function playFootstep(surface: "GRASS" | "HARD" | "SNOW" | "SAND" | "WATER", sprint: boolean) {
  const c = ctx; if (!c) return; const o = out(c); lastStep ^= 1;
  const g = sprint ? 0.5 : 0.35, f = lastStep ? 1 : 0.9;
  if (surface === "HARD") { burst(c, o, { dur: 0.05, freq: 2400 * f, q: 2, gain: g }); tone(c, o, { f0: 110 * f, f1: 60, dur: 0.06, gain: g * 0.6 }); }
  else if (surface === "SNOW") burst(c, o, { dur: 0.14, freq: 3000 * f, q: 0.6, gain: g * 0.7 });
  else if (surface === "SAND") burst(c, o, { dur: 0.12, freq: 1800 * f, q: 0.5, gain: g * 0.6 });
  else if (surface === "WATER") { burst(c, o, { dur: 0.12, freq: 1200 * f, q: 1, gain: g * 0.7 }); tone(c, o, { f0: 260 * f, f1: 120, dur: 0.08, gain: g * 0.4 }); }
  else { burst(c, o, { dur: 0.09, freq: 700 * f, q: 0.8, gain: g }); tone(c, o, { f0: 80, f1: 45, dur: 0.07, gain: g * 0.5 }); }
}

/** A body breaking the surface: filtered noise slap + a falling-pitch "plunk", scaled by entry speed. */
export function playSplash(intensity: number, w: Where = {}) {
  const c = ctx; if (!c) return; const o = out(c, w);
  burst(c, o, { dur: 0.28, freq: 1100, q: 0.8, gain: Math.min(1, 0.35 + intensity * 0.65) });
  tone(c, o, { f0: 320, f1: 90, dur: 0.22, gain: Math.min(0.6, 0.15 + intensity * 0.45) });
}

/* ---------------- ambient beds: biome + weather (procedural, no files, loops until swapped) ---------------- */

/** Looping filtered noise, the shared basis for wind/rain/dust/rumble beds — a bare tone-generator would sound too clean for weather. */
function noiseBed(c: Ctx, dest: AudioNode, { cutoff, type = "lowpass", gain = 0.08, q = 0.5 }: { cutoff: number; type?: BiquadFilterType; gain?: number; q?: number }) {
  const src = c.ac.createBufferSource(); src.buffer = c.noise; src.loop = true;
  const f = c.ac.createBiquadFilter(); f.type = type; f.frequency.value = cutoff; f.Q.value = q;
  const g = c.ac.createGain(); g.gain.value = 0;
  src.connect(f).connect(g).connect(dest);
  src.start();
  g.gain.setTargetAtTime(gain, c.ac.currentTime, 1.2);
  return { stop: () => { g.gain.setTargetAtTime(0, c.ac.currentTime, 0.6); setTimeout(() => src.stop(), 1500); } };
}
/** Fires `spawn` on a randomized interval — birds, insects, embers — until stopped. */
function periodicTexture(spawn: () => void, everyMs: readonly [number, number]) {
  let alive = true;
  const tick = () => { if (!alive) return; spawn(); timer = setTimeout(tick, everyMs[0] + Math.random() * (everyMs[1] - everyMs[0])); };
  let timer = setTimeout(tick, 200 + Math.random() * 400);
  return () => { alive = false; clearTimeout(timer); };
}

type AmbientVoice = { key: string; stop: () => void };
let biomeVoice: AmbientVoice | null = null;
let weatherVoice: AmbientVoice | null = null;

type BiomeAmbientDef = { bedCutoff: number; bedGain: number; bedType?: BiquadFilterType; hum?: number; textureEvery?: readonly [number, number]; texture?: (c: Ctx, dest: AudioNode) => void };
/** One bed + optional texture per region — Nexus hums low and electronic, the wilds get wind, Ember rumbles and cracks. */
const BIOME_AMBIENT: Record<string, BiomeAmbientDef> = {
  veridan: { bedCutoff: 900, bedGain: 0.05, textureEvery: [900, 2400], texture: (c, dest) => burst(c, dest, { dur: 0.12, freq: 2200 + Math.random() * 1400, q: 7, gain: 0.06 }) },
  swamps: { bedCutoff: 450, bedGain: 0.07, textureEvery: [400, 1300], texture: (c, dest) => burst(c, dest, { dur: 0.06, freq: 3200 + Math.random() * 900, q: 10, gain: 0.04 }) },
  nexus: { bedCutoff: 260, bedGain: 0.03, hum: 118 },
  frostspire: { bedCutoff: 1500, bedGain: 0.11 },
  solara: { bedCutoff: 1300, bedGain: 0.09 },
  wastelands: { bedCutoff: 800, bedGain: 0.06 },
  ember: { bedCutoff: 220, bedGain: 0.1, textureEvery: [1300, 2600], texture: (c, dest) => burst(c, dest, { dur: 0.25, freq: 500, type: "lowpass", gain: 0.1 }) },
};

/** Called once per HUD tick with the current region id; only rebuilds voices when the region actually changes. */
export function updateBiomeAmbient(regionId: string) {
  const c = ctx; if (!c) return;
  if (biomeVoice?.key === regionId) return;
  biomeVoice?.stop(); biomeVoice = null;
  const def = BIOME_AMBIENT[regionId];
  if (!def) return;
  const dest = c.sfx;
  const stops: (() => void)[] = [noiseBed(c, dest, { cutoff: def.bedCutoff, gain: def.bedGain, ...(def.bedType ? { type: def.bedType } : {}) }).stop];
  if (def.hum) {
    const o = c.ac.createOscillator(); o.type = "sine"; o.frequency.value = def.hum;
    const g = c.ac.createGain(); g.gain.value = 0; o.connect(g).connect(dest); o.start();
    g.gain.setTargetAtTime(0.05, c.ac.currentTime, 1);
    stops.push(() => { g.gain.setTargetAtTime(0, c.ac.currentTime, 0.4); setTimeout(() => o.stop(), 800); });
  }
  if (def.texture && def.textureEvery) stops.push(periodicTexture(() => def.texture!(c, dest), def.textureEvery));
  biomeVoice = { key: regionId, stop: () => stops.forEach((fn) => fn()) };
}

const WEATHER_AMBIENT: Record<string, { cutoff: number; gain: number; type?: BiquadFilterType }> = {
  "Rain mist": { cutoff: 4200, gain: 0.1, type: "highpass" },
  Ashfall: { cutoff: 300, gain: 0.06 },
  "Snow haze": { cutoff: 1100, gain: 0.04 },
  "Dust front": { cutoff: 1900, gain: 0.08 },
};
/** Same swap-only-on-change pattern as updateBiomeAmbient, keyed on the HUD's existing `weather` label ("Clear shield" gets no bed). */
export function updateWeatherAmbient(weather: string) {
  const c = ctx; if (!c) return;
  if (weatherVoice?.key === weather) return;
  weatherVoice?.stop(); weatherVoice = null;
  const def = WEATHER_AMBIENT[weather];
  if (!def) return;
  weatherVoice = { key: weather, stop: noiseBed(c, c.sfx, { cutoff: def.cutoff, gain: def.gain, type: def.type ?? "lowpass" }).stop };
}

/** Continuous vehicle engine: per-vehicle voice, rpm follows speed + throttle, brake squeal on hard decel. */
type Engine = { id: string; osc: OscillatorNode; sub: OscillatorNode; filter: BiquadFilterNode; gain: GainNode; brake: GainNode; brakeSrc: AudioBufferSourceNode };
let engine: Engine | null = null;
const ENGINE_VOICE: Record<string, { base: number; type: OscillatorType; cutoff: number }> = {};
function voiceFor(id: string) {
  if (!ENGINE_VOICE[id]) { let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0; const types: OscillatorType[] = ["sawtooth", "square", "triangle"]; ENGINE_VOICE[id] = { base: 38 + (h % 50), type: types[h % 3]!, cutoff: 500 + (h % 900) }; }
  return ENGINE_VOICE[id]!;
}
export function updateEngine(active: boolean, vehicleId: string, speed01: number, throttle: number, braking: boolean) {
  const c = ctx; if (!c) return;
  if (!active) { if (engine) { engine.gain.gain.setTargetAtTime(0, c.ac.currentTime, 0.15); const e = engine; setTimeout(() => { e.osc.stop(); e.sub.stop(); e.brakeSrc.stop(); }, 800); engine = null; } return; }
  if (!engine || engine.id !== vehicleId) {
    updateEngine(false, vehicleId, 0, 0, false);
    const v = voiceFor(vehicleId);
    const osc = c.ac.createOscillator(); osc.type = v.type; const sub = c.ac.createOscillator(); sub.type = "sine";
    const filter = c.ac.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = v.cutoff; filter.Q.value = 4;
    const gain = c.ac.createGain(); gain.gain.value = 0;
    const brake = c.ac.createGain(); brake.gain.value = 0; const bf = c.ac.createBiquadFilter(); bf.type = "bandpass"; bf.frequency.value = 3200; bf.Q.value = 8;
    const brakeSrc = c.ac.createBufferSource(); brakeSrc.buffer = c.noise; brakeSrc.loop = true;
    osc.connect(filter); sub.connect(filter); filter.connect(gain).connect(c.sfx); brakeSrc.connect(bf).connect(brake).connect(c.sfx);
    osc.start(); sub.start(); brakeSrc.start();
    engine = { id: vehicleId, osc, sub, filter, gain, brake, brakeSrc };
  }
  const v = voiceFor(vehicleId), t = c.ac.currentTime;
  const rpm = v.base * (1 + speed01 * 2.4 + throttle * 0.5);
  engine.osc.frequency.setTargetAtTime(rpm, t, 0.08);
  engine.sub.frequency.setTargetAtTime(rpm / 2, t, 0.08);
  engine.filter.frequency.setTargetAtTime(v.cutoff * (1 + throttle * 1.5 + speed01), t, 0.1);
  engine.gain.gain.setTargetAtTime(0.06 + throttle * 0.08 + speed01 * 0.05, t, 0.1);
  engine.brake.gain.setTargetAtTime(braking && speed01 > 0.15 ? 0.12 * speed01 : 0, t, 0.05);
}

/** Music: ambient pad always; tension pulse and combat drums fade in with intensity (0–1). */
function startMusic(c: Ctx) {
  const mk = () => { const g = c.ac.createGain(); g.gain.value = 0; g.connect(c.music); return g; };
  const ambient = mk(), tension = mk(), drums = mk(), motif = mk();
  ambient.gain.value = 0.5;
  motif.gain.value = 1;
  for (const f of [55, 82.4, 110.2]) {
    const o = c.ac.createOscillator(); o.type = "sine"; o.frequency.value = f;
    const lfo = c.ac.createOscillator(); lfo.frequency.value = 0.07 + f / 5000; const lg = c.ac.createGain(); lg.gain.value = 0.8; lfo.connect(lg).connect(o.detune);
    o.connect(ambient); o.start(); lfo.start();
    c.ambientOscs.push(o);
  }
  const t = c.ac.createOscillator(); t.type = "sawtooth"; t.frequency.value = 110; const tf = c.ac.createBiquadFilter(); tf.type = "lowpass"; tf.frequency.value = 500;
  const trem = c.ac.createGain(); trem.gain.value = 0.3; const tl = c.ac.createOscillator(); tl.frequency.value = 4; const tlg = c.ac.createGain(); tlg.gain.value = 0.3; tl.connect(tlg).connect(trem.gain);
  t.connect(tf).connect(trem).connect(tension); t.start(); tl.start();
  c.layers = { ambient, tension, drums, motif };
}

/** Called every frame; schedules drum hits on a 120bpm grid while in combat. With `boss` true
 * (an engaged boss nearby), the grid runs faster (150bpm) with an extra off-beat hit and never
 * drops below a driving floor, so a boss fight reads as a distinct, more frantic piece rather
 * than just "regular combat but louder" — the "different fights get different music" ask. */
export function updateCombatAudio(intensity: number, boss = false) {
  const c = ctx; if (!c || !c.layers) return;
  const now = c.ac.currentTime;
  const eff = boss ? Math.max(intensity, 0.72) : intensity;
  const grid = boss ? 0.2 : 0.25;
  c.layers.ambient.gain.setTargetAtTime(eff < 0.3 ? 0.5 : 0.25, now, 0.8);
  c.layers.tension.gain.setTargetAtTime(eff > 0.4 ? (boss ? 0.2 : 0.12) * Math.min(1, (eff - 0.4) * 3) : 0, now, 0.8);
  c.layers.drums.gain.setTargetAtTime(eff > 0.65 ? (boss ? 1.1 : 0.9) : 0, now, 0.5);
  if (eff > 0.65 && now >= c.beat) {
    c.beat = Math.max(now, c.beat) + grid;
    const step = Math.round(c.beat / grid) % 8;
    if (step % 4 === 0) tone(c, c.layers.drums, { f0: boss ? 150 : 120, f1: boss ? 45 : 40, dur: 0.3, gain: boss ? 1 : 0.8 });
    if (step % 4 === 2) burst(c, c.layers.drums, { dur: 0.15, freq: 1800, q: 0.8, gain: 0.35 });
    if (boss && step % 2 === 1) burst(c, c.layers.drums, { dur: 0.08, freq: 2600, q: 1.5, gain: 0.3 });
    burst(c, c.layers.drums, { dur: 0.03, freq: 8000, type: "highpass", gain: eff > 0.85 ? 0.15 : 0.06 });
  }
}

/** Root note + a handful of scale-degree ratios (above the root) each region's music leans on for its sparse motif layer. */
const MUSIC_REGION: Record<string, { root: number; ratios: readonly number[] }> = {
  veridan: { root: 220, ratios: [1, 1.125, 1.25, 1.5, 1.6667] }, // A, pastoral major-ish
  swamps: { root: 196, ratios: [1, 1.0595, 1.2, 1.5, 1.5874] }, // G, murky/dissonant
  nexus: { root: 261.6, ratios: [1, 1.125, 1.3333, 1.5, 1.6875] }, // C, clean and sparse
  frostspire: { root: 293.7, ratios: [1, 1.2, 1.5, 1.8, 2] }, // D, open fifths, icy
  solara: { root: 246.9, ratios: [1, 1.25, 1.5, 1.6667, 2] }, // B, warm major
  wastelands: { root: 174.6, ratios: [1, 1.1892, 1.3333, 1.5, 1.7818] }, // F, gritty/tritone-tinged
  ember: { root: 146.8, ratios: [1, 1.0595, 1.3333, 1.4142, 1.6818] }, // D, low and tense
};
let motifStop: (() => void) | null = null;
/** Called once per HUD tick with the current region id (interiors keep their home region's music, not silence — see Scene.tsx). Retunes the always-on ambient drone to the region's root and swaps a sparse melodic motif layer, only when the region actually changes. */
export function updateMusicRegion(regionId: string) {
  const c = ctx; if (!c || !c.layers) return;
  if (c.musicRegion === regionId) return;
  c.musicRegion = regionId;
  const def = MUSIC_REGION[regionId];
  const root = def?.root ?? 220;
  const bases = [root / 2, root * 0.75, root];
  c.ambientOscs.forEach((o, i) => o.frequency.setTargetAtTime(bases[i] ?? root, c.ac.currentTime, 3));
  motifStop?.(); motifStop = null;
  if (def) {
    const motif = c.layers.motif;
    motifStop = periodicTexture(() => {
      const ratio = def.ratios[Math.floor(Math.random() * def.ratios.length)]!;
      const f = root * 2 * ratio;
      tone(c, motif, { f0: f, f1: f, dur: 1.6, type: "sine", gain: 0.045 + Math.random() * 0.03 });
    }, [2400, 5200]);
  }
}

/** The Fracture Descent's closing sting — one of three short procedural fanfares matching the
 * Control/Chaos/Resonant(Balance) endings, played once when fd-18 completes (see EndingOverlay.tsx). */
export function playEnding(tier: "CONTROL" | "CHAOS" | "BALANCE") {
  const c = ctx; if (!c) return; const o = out(c);
  if (tier === "CONTROL") {
    tone(c, o, { f0: 220, f1: 440, dur: 1.2, type: "sine", gain: 0.3 });
    tone(c, o, { f0: 330, f1: 660, dur: 1.4, type: "triangle", gain: 0.15, at: 0.15 });
  } else if (tier === "CHAOS") {
    burst(c, o, { dur: 1.6, freq: 900, q: 0.6, gain: 0.5 });
    tone(c, o, { f0: 80, f1: 30, dur: 1.8, type: "sawtooth", gain: 0.35 });
    burst(c, o, { dur: 0.8, freq: 4000, type: "highpass", gain: 0.2, at: 0.3 });
  } else {
    tone(c, o, { f0: 220, f1: 220, dur: 2, type: "sine", gain: 0.25 });
    tone(c, o, { f0: 330, f1: 330, dur: 2, type: "sine", gain: 0.2, at: 0.3 });
    tone(c, o, { f0: 440, f1: 440, dur: 2, type: "sine", gain: 0.18, at: 0.6 });
  }
}

/** The "dopamine hit" cue for a player level-up (Loot + XP System v1) — a short bright ascending arpeggio. */
export function playLevelUp() {
  const c = ctx; if (!c) return; const o = out(c);
  const notes = [440, 554, 659, 880];
  notes.forEach((f, i) => tone(c, o, { f0: f, f1: f, dur: 0.22, type: "triangle", gain: 0.28, at: i * 0.07 }));
  burst(c, o, { dur: 0.4, freq: 2200, q: 0.5, gain: 0.2, at: 0.24 });
}

/** A weightier cue for a NOVA meta-progression unlock — distinct from an ordinary level-up. */
export function playNovaUnlock() {
  const c = ctx; if (!c) return; const o = out(c);
  tone(c, o, { f0: 220, f1: 660, dur: 1.1, type: "sawtooth", gain: 0.22 });
  tone(c, o, { f0: 880, f1: 1320, dur: 0.6, type: "sine", gain: 0.18, at: 0.15 });
  burst(c, o, { dur: 0.8, freq: 1600, q: 0.4, gain: 0.25, at: 0.1 });
}

/** Boss phase-change sting — escalates with phase index so OVERLOADED (phase 2) hits harder/lower than OVERDRIVEN (phase 1). */
export function playBossPhaseChange(phase: 0 | 1 | 2) {
  const c = ctx; if (!c) return; const o = out(c);
  const base = 200 - phase * 40;
  burst(c, o, { dur: 0.5 + phase * 0.2, freq: 1200 - phase * 200, q: 0.7, gain: 0.35 + phase * 0.1 });
  tone(c, o, { f0: base, f1: base * 0.4, dur: 0.8, type: "sawtooth", gain: 0.3 });
  tone(c, o, { f0: base * 2.5, f1: base * 1.6, dur: 0.5, type: "square", gain: 0.15, at: 0.05 });
}

/** Hull-destroyed sting — heavier and longer than playHurt()'s per-tick flinch, marking the actual respawn-at-Nexus event. */
export function playDeath() {
  const c = ctx; if (!c) return; const o = out(c);
  burst(c, o, { dur: 1.1, freq: 220, type: "lowpass", gain: 0.6 });
  tone(c, o, { f0: 160, f1: 20, dur: 1.4, type: "sawtooth", gain: 0.4 });
  tone(c, o, { f0: 90, f1: 18, dur: 1.6, type: "sine", gain: 0.5, at: 0.1 });
  burst(c, o, { dur: 0.5, freq: 3200, type: "highpass", gain: 0.15, at: 0.05 });
}

/** A single spoken-line "blip" for the dialogue system — pitch is stable per speaker (hashed from their name) so each character reads as a consistent voice, like classic text-blip games rather than TTS (no files, no network in this sandbox). */
export function playDialogueBlip(speaker: string) {
  const c = ctx; if (!c) return;
  let h = 0; for (const ch of speaker) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const base = 260 + (h % 220);
  const jitter = (Math.random() - 0.5) * 40;
  tone(c, out(c), { f0: base + jitter, f1: base * 0.88, dur: 0.045, type: "square", gain: 0.1 });
}

/** Low rising drone for the opening cinematic's "world already broken" beats — same synth building
 * blocks as playEnding(), just inverted (rising instead of resolving) so it reads as tension, not release. */
export function playIntroSwell() {
  const c = ctx; if (!c) return; const o = out(c);
  tone(c, o, { f0: 55, f1: 90, dur: 3.4, type: "sawtooth", gain: 0.18 });
  tone(c, o, { f0: 110, f1: 165, dur: 3, type: "sine", gain: 0.12, at: 0.4 });
  burst(c, o, { dur: 2.2, freq: 240, type: "lowpass", gain: 0.14, at: 0.2 });
}

/** Short synth chime for the NOVA-activation beat — brighter and shorter than playIntroSwell(). */
export function playNovaActivation() {
  const c = ctx; if (!c) return; const o = out(c);
  tone(c, o, { f0: 660, f1: 880, dur: 0.5, type: "sine", gain: 0.16 });
  tone(c, o, { f0: 990, f1: 1320, dur: 0.4, type: "triangle", gain: 0.1, at: 0.08 });
}

/** Pan/distance of a world point relative to the listener (x,z,yaw). */
export function where(lx: number, lz: number, yaw: number, x: number, z: number): Where {
  const dx = x - lx, dz = z - lz;
  const dist = Math.hypot(dx, dz);
  const ang = Math.atan2(dx, dz) - yaw;
  return { dist, pan: -Math.sin(ang) };
}
