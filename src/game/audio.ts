/**
 * Procedural combat audio (Web Audio, no files): layered weapon shots, reloads, impacts,
 * spatial panning/muffling by distance, and a combat-intensity music mixer.
 * Browser-only — every entry point is a no-op until unlocked by a user gesture.
 */
import type { WeaponId } from "./weapons";

type Ctx = { ac: AudioContext; master: GainNode; sfx: GainNode; music: GainNode; noise: AudioBuffer; layers: { ambient: GainNode; tension: GainNode; drums: GainNode } | null; beat: number };
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
  ctx = { ac, master, sfx, music, noise, layers: null, beat: 0 };
  startMusic(ctx);
}

export function setVolume(v: number) { volume = v; if (ctx) ctx.master.gain.setTargetAtTime(v, ctx.ac.currentTime, 0.05); }

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
export function playFootstep(surface: "GRASS" | "HARD" | "SNOW" | "SAND", sprint: boolean) {
  const c = ctx; if (!c) return; const o = out(c); lastStep ^= 1;
  const g = sprint ? 0.5 : 0.35, f = lastStep ? 1 : 0.9;
  if (surface === "HARD") { burst(c, o, { dur: 0.05, freq: 2400 * f, q: 2, gain: g }); tone(c, o, { f0: 110 * f, f1: 60, dur: 0.06, gain: g * 0.6 }); }
  else if (surface === "SNOW") burst(c, o, { dur: 0.14, freq: 3000 * f, q: 0.6, gain: g * 0.7 });
  else if (surface === "SAND") burst(c, o, { dur: 0.12, freq: 1800 * f, q: 0.5, gain: g * 0.6 });
  else { burst(c, o, { dur: 0.09, freq: 700 * f, q: 0.8, gain: g }); tone(c, o, { f0: 80, f1: 45, dur: 0.07, gain: g * 0.5 }); }
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
  const ambient = mk(), tension = mk(), drums = mk();
  ambient.gain.value = 0.5;
  for (const f of [55, 82.4, 110.2]) { const o = c.ac.createOscillator(); o.type = "sine"; o.frequency.value = f; const lfo = c.ac.createOscillator(); lfo.frequency.value = 0.07 + f / 5000; const lg = c.ac.createGain(); lg.gain.value = 0.8; lfo.connect(lg).connect(o.detune); o.connect(ambient); o.start(); lfo.start(); }
  const t = c.ac.createOscillator(); t.type = "sawtooth"; t.frequency.value = 110; const tf = c.ac.createBiquadFilter(); tf.type = "lowpass"; tf.frequency.value = 500;
  const trem = c.ac.createGain(); trem.gain.value = 0.3; const tl = c.ac.createOscillator(); tl.frequency.value = 4; const tlg = c.ac.createGain(); tlg.gain.value = 0.3; tl.connect(tlg).connect(trem.gain);
  t.connect(tf).connect(trem).connect(tension); t.start(); tl.start();
  c.layers = { ambient, tension, drums };
}

/** Called every frame; schedules drum hits on a 120bpm grid while in combat. */
export function updateCombatAudio(intensity: number) {
  const c = ctx; if (!c || !c.layers) return;
  const now = c.ac.currentTime;
  c.layers.ambient.gain.setTargetAtTime(intensity < 0.3 ? 0.5 : 0.25, now, 0.8);
  c.layers.tension.gain.setTargetAtTime(intensity > 0.4 ? 0.12 * Math.min(1, (intensity - 0.4) * 3) : 0, now, 0.8);
  c.layers.drums.gain.setTargetAtTime(intensity > 0.65 ? 0.9 : 0, now, 0.5);
  if (intensity > 0.65 && now >= c.beat) {
    c.beat = Math.max(now, c.beat) + 0.25;
    const step = Math.round(c.beat / 0.25) % 8;
    if (step % 4 === 0) tone(c, c.layers.drums, { f0: 120, f1: 40, dur: 0.3, gain: 0.8 });
    if (step % 4 === 2) burst(c, c.layers.drums, { dur: 0.15, freq: 1800, q: 0.8, gain: 0.35 });
    burst(c, c.layers.drums, { dur: 0.03, freq: 8000, type: "highpass", gain: intensity > 0.85 ? 0.15 : 0.06 });
  }
}

/** Pan/distance of a world point relative to the listener (x,z,yaw). */
export function where(lx: number, lz: number, yaw: number, x: number, z: number): Where {
  const dx = x - lx, dz = z - lz;
  const dist = Math.hypot(dx, dz);
  const ang = Math.atan2(dx, dz) - yaw;
  return { dist, pan: -Math.sin(ang) };
}
