/**
 * Procedural combat audio (Web Audio, no files): layered weapon shots, reloads, impacts,
 * spatial panning/muffling by distance, and a combat-intensity music mixer.
 * Browser-only — every entry point is a no-op until unlocked by a user gesture.
 */
import { CUE_SHAPE, directorCue, type CueAction } from "./director-cues";
import type { WeaponId } from "./weapons";
import { voiceAction, type WaterMix, type WaterSource } from "./water-audio";
import { AUDIO_FILES } from "./audio-files";
import { BLAST_FLAVOR, SHOTS, blastAtDistance, shotKey, variation, type BlastFlavor, type ShotProfile } from "./audio-design";
import { BROADCAST_START, RADIO_STATIONS, hasRecordings, nextOnAir, onAir, type StationId } from "./radio-stations";
import { engineVoice } from "./vehicle-audio";
import { AUDIO_SAFETY, envelopeAttack, unitVolume } from "./audio-safety";
import { AMBIENT_MIX, WEATHER_BEDS, crossfadeLoop } from "./ambient-mix";

type Ctx = { ac: AudioContext; master: GainNode; sfx: GainNode; music: GainNode; amb: GainNode; abil: GainNode; noise: AudioBuffer; brown: AudioBuffer; verb: GainNode; drive: Map<number, Float32Array>; layers: { ambient: GainNode; tension: GainNode; drums: GainNode; motif: GainNode; arp: GainNode } | null; ambientOscs: OscillatorNode[]; musicRegion: string; beat: number };
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
  // underwater: the whole mix passes one lowpass that setUnderwaterMuffle() closes down while diving
  muffle = ac.createBiquadFilter(); muffle.type = "lowpass"; muffle.frequency.value = 18000; muffle.Q.value = 0.7; muffle.connect(master);
  // gentler bus compression: a hard 8:1 at -12 dB pumped the ambience up and down around every shot
  const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.25; comp.connect(muffle);
  const sfx = ac.createGain(); sfx.connect(comp);
  const music = ac.createGain(); music.gain.value = 0.35; music.connect(comp);
  const amb = ac.createGain(); amb.connect(comp); const abil = ac.createGain(); abil.connect(comp);
  const noise = ac.createBuffer(1, Math.floor(ac.sampleRate * AMBIENT_MIX.noiseSeconds), ac.sampleRate);
  const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  // brown noise (integrated white): the rolling low rumble of explosions and heavy tails
  const brown = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  { const b = brown.getChannelData(0); let last = 0; for (let i = 0; i < b.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; b[i] = last * 3.5; } }
  // outdoor reverb: a generated impulse (early slap-back off terrain + a long diffuse decay), shared by every shot and blast through one send bus
  const verbNode = ac.createConvolver(); verbNode.buffer = outdoorImpulse(ac, 1.5);
  const verb = ac.createGain(); verb.gain.value = AUDIO_SAFETY.reverbGain; verb.connect(verbNode).connect(comp);
  ctx = { ac, master, sfx, music, amb, abil, noise, brown, verb, drive: new Map(), layers: null, ambientOscs: [], musicRegion: "", beat: 0 };
  preloadSamples(ctx);
  applyMix();
  startMusic(ctx);
}

let muffle: BiquadFilterNode | null = null;
/** 0 = open air, 1 = fully submerged: eases the master lowpass from 18 kHz down to ~550 Hz (acoustic dampening). */
export function setUnderwaterMuffle(k: number) {
  if (!ctx || !muffle) return;
  const f = 18000 * Math.pow(550 / 18000, Math.max(0, Math.min(1, k)));
  muffle.frequency.setTargetAtTime(f, ctx.ac.currentTime, 0.12);
}

export function setVolume(v: number) { volume = unitVolume(v); if (ctx) ctx.master.gain.setTargetAtTime(volume, ctx.ac.currentTime, 0.05); }
let musicVol = 1; let sfxVol = 1; let ambVol = 1; let abilVol = 1;
let combatLevel = 0;
let externalMusic = false;
export function setExternalMusic(active: boolean) { externalMusic = active; if (ctx) ctx.music.gain.setTargetAtTime(active ? 0 : 0.35 * musicVol, ctx.ac.currentTime, 0.15); }
/** last combat intensity (0..1) fed by Scene; the kill playlist reads it */
export const getCombatLevel = () => combatLevel;
/** Separate channel levels (0..1) on top of master. Music bus keeps its 0.35 base mix. */
export function setMixVolumes(music: number, effects: number, ambience = 1, abilities = 1) {
  music = unitVolume(music); effects = unitVolume(effects); ambience = unitVolume(ambience); abilities = unitVolume(abilities);
  musicVol = music; sfxVol = effects; ambVol = ambience; abilVol = abilities;
  if (ctx) { ctx.amb.gain.setTargetAtTime(ambience, ctx.ac.currentTime, 0.05); ctx.abil.gain.setTargetAtTime(abilities, ctx.ac.currentTime, 0.05); }
  if (ctx) { ctx.music.gain.setTargetAtTime(externalMusic ? 0 : 0.35 * music, ctx.ac.currentTime, 0.05); ctx.sfx.gain.setTargetAtTime(effects, ctx.ac.currentTime, 0.05); }
}
function applyMix() { if (ctx) { ctx.music.gain.value = externalMusic ? 0 : 0.35 * musicVol; ctx.sfx.gain.value = sfxVol; ctx.amb.gain.value = ambVol; ctx.abil.gain.value = abilVol; } }

/** Plays the station as a linear broadcast (radio-stations.ts: its station ID, then its recorded rotation with a commercial after every AD_EVERY
 * programs) through the master bus at the music level; if a recording cannot load or play, falls back to the procedural
 * instrumental below. onTrack reports what is on air; the same line goes out as a `wf-radio-now-playing` window event. */
export function startRadio(id: StationId, onTrack?: (label: string) => void) {
  const c = ctx;
  if (!c) return () => {};
  if (typeof Audio === "undefined") return startProceduralRadio(id);
  if (!hasRecordings(id)) { onTrack?.(RADIO_STATIONS[id].name); return startProceduralRadio(id); }
  const el = new Audio(); el.preload = "auto";
  const bus = c.ac.createGain(); bus.gain.value = RECORDED_RADIO_GAIN * musicVol; bus.connect(c.master);
  let source: MediaElementAudioSourceNode | null = null;
  try { source = c.ac.createMediaElementSource(el); source.connect(bus); } catch { bus.disconnect(); return startProceduralRadio(id); }
  let broadcast = BROADCAST_START, adBreak = false, stopped = false, fallback: (() => void) | null = null;
  const play = () => {
    const t = onAir(id, broadcast, adBreak); el.src = t.path;
    const label = t.advertisement ? `Commercial · ${t.title}` : t.ident ? `${t.artist} · ${t.title}` : `${t.title} — ${t.artist}`;
    onTrack?.(label);
    window.dispatchEvent(new CustomEvent("wf-radio-now-playing", { detail: { station: id, title: label, advertisement: t.advertisement } }));
    void el.play().catch(() => { /* autoplay needs a gesture; the next tick retries */ });
  };
  el.onended = () => { const next = nextOnAir(broadcast, adBreak); broadcast = next.broadcast; adBreak = next.adBreak; play(); };
  el.onerror = () => {
    if (stopped || fallback) return;
    if (adBreak || broadcast.intro) { const next = nextOnAir(broadcast, adBreak); broadcast = next.broadcast; adBreak = next.adBreak; play(); return; } // a missing ad or station ID never silences the station
    fallback = startProceduralRadio(id); onTrack?.(RADIO_STATIONS[id].name);
  };
  const timer = window.setInterval(() => { bus.gain.setTargetAtTime(RECORDED_RADIO_GAIN * musicVol, c.ac.currentTime, 0.1); if (!fallback && el.paused && !el.ended && el.src) void el.play().catch(() => {}); }, 1000);
  play();
  return () => { stopped = true; window.clearInterval(timer); el.onended = null; el.onerror = null; el.pause(); el.removeAttribute("src"); el.load(); source?.disconnect(); bus.disconnect(); fallback?.(); };
}
/** recorded mixes are mastered loud; this sits them near the procedural station's level */
const RECORDED_RADIO_GAIN = 0.45;

/** Schedules a small look-ahead window on the existing audio graph; one cancellable station voice. */
function startProceduralRadio(id: StationId) {
  const c = ctx;
  if (!c) return () => {};
  const def = RADIO_STATIONS[id];
  const bus = c.ac.createGain(); bus.gain.value = 0.16 * musicVol; bus.connect(c.master);
  let cursor = c.ac.currentTime + 0.03, step = 0;
  const voices = new Set<OscillatorNode>();
  const note = (freq: number, duration: number, level: number, type: OscillatorType, at: number, endFreq?: number) => {
    const osc = c.ac.createOscillator(), gain = c.ac.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, at);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, at + duration);
    gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(level, at + 0.006); gain.gain.exponentialRampToValueAtTime(0.001, at + duration);
    osc.connect(gain).connect(bus); voices.add(osc); osc.onended = () => { voices.delete(osc); osc.disconnect(); gain.disconnect(); }; osc.start(at); osc.stop(at + duration + 0.01);
  };
  const timer = window.setInterval(() => {
    bus.gain.setTargetAtTime(0.16 * musicVol, c.ac.currentTime, 0.1);
    if (cursor < c.ac.currentTime - 0.1) cursor = c.ac.currentTime;
    while (cursor < c.ac.currentTime + 0.1) {
      const n = step % 16, chord = Math.floor(step / 16) % 4;
      const kick = id === "house" || id === "latin" ? n % 4 === 0 : id === "reggae" ? n === 4 || n === 12 : n === 0 || n === 8 || ((id === "hiphop" || id === "rnb") && n === 11);
      if (kick) note(140, 0.18, 0.75, "sine", cursor, 38);
      // dembow: the kick lands every beat and the snare answers on the off-beat tresillo (steps 3, 6, 11, 14)
      if (id === "latin" ? n === 3 || n === 6 || n === 11 || n === 14 : n === 4 || n === 12) note(220, 0.09, 0.15, "triangle", cursor, 90);
      if (n % 2 === 0) note(6200, 0.025, 0.028, "square", cursor);
      if (n % 4 === 0 || (id === "reggae" && n === 7)) note(def.bass[chord] ?? 55, 0.26, 0.3, "triangle", cursor);
      if (id === "reggae" ? n % 4 === 2 : id === "rock" ? n % 2 === 0 : n === 2 || n === 6 || n === 14) {
        const root = def.notes[chord] ?? 220;
        [1, 1.2, 1.5].forEach((ratio) => note(root * ratio, id === "house" ? 0.16 : 0.1, id === "rock" ? 0.045 : 0.07, def.wave, cursor));
      }
      cursor += 60 / def.bpm / 4; step++;
    }
  }, 25);
  return () => { window.clearInterval(timer); voices.forEach((v) => { v.onended = null; v.stop(); v.disconnect(); }); voices.clear(); bus.disconnect(); };
}

/** Spatial send: distance attenuation, stereo pan from listener yaw, lowpass muffling beyond 20m. */
type Where = { dist?: number; pan?: number };
/** voice limiting: a sound kind may start at most once per `gap` seconds (rapid fire, crowds of enemies and per-hit ticks used to
 * stack dozens of identical voices into a smeared, hissy wall). Returns false when the call should be dropped. */
const gateAt = new Map<string, number>();
function gate(key: string, gap: number): boolean {
  const now = typeof performance !== "undefined" ? performance.now() / 1000 : 0;
  if (now - (gateAt.get(key) ?? -1) < gap) return false;
  gateAt.set(key, now); return true;
}
function out(c: Ctx, w: Where = {}, bus?: GainNode) {
  const dist = w.dist ?? 0;
  const g = c.ac.createGain(); g.gain.value = AUDIO_SAFETY.effectsGain / (Math.max(0, dist) * 0.08 + 1);
  const p = c.ac.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, w.pan ?? 0));
  const lp = c.ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = dist > 20 ? Math.max(700, 9000 - dist * 90) : 18000;
  g.connect(lp).connect(p).connect(bus ?? c.sfx);
  return g;
}
function burst(c: Ctx, dest: AudioNode, { dur, freq, q = 1, type = "bandpass", gain = 1, at = 0 }: { dur: number; freq: number; q?: number; type?: BiquadFilterType; gain?: number; at?: number }) {
  const t = c.ac.currentTime + at;
  const src = c.ac.createBufferSource(); src.buffer = c.noise;
  const f = c.ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = c.ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + envelopeAttack(dur)); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(dest); src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
}
function tone(c: Ctx, dest: AudioNode, { f0, f1, dur, type = "sine", gain = 1, at = 0 }: { f0: number; f1: number; dur: number; type?: OscillatorType; gain?: number; at?: number }) {
  const t = c.ac.currentTime + at;
  const o = c.ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  const g = c.ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + envelopeAttack(dur)); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(dest); o.start(t); o.stop(t + dur + 0.02);
}

/** stereo impulse response: a couple of early reflections (terrain slap-back) and an exponentially decaying noise tail */
function outdoorImpulse(ac: AudioContext, seconds: number): AudioBuffer {
  const len = Math.floor(ac.sampleRate * seconds), buf = ac.createBuffer(2, len, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    // the tail is noise through a one-pole lowpass that closes as it decays (outdoors the air eats the top first), so the
    // reverb reads as distance and slap-back, never as a hiss of wind after each shot
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / ac.sampleRate, k = 0.35 * Math.exp(-t * 2.2) + 0.03; // ~2.6 kHz at the start, a few hundred Hz by the end
      lp += k * ((Math.random() * 2 - 1) - lp);
      d[i] = lp * Math.pow(1 - t / seconds, 4) * (t < 0.012 ? 0 : 1.4);
    }
    for (const [at, g] of [[0.045 + ch * 0.007, 0.5], [0.11 + ch * 0.013, 0.32], [0.19, 0.2]] as const) { const i = Math.floor(at * ac.sampleRate); if (i < len) d[i] = (d[i] ?? 0) + g; }
  }
  return buf;
}
/** soft-clip curve (cached per amount): pushes the blast layer into saturation for punch without harsh digital clipping */
function driveCurve(c: Ctx, amount: number): Float32Array {
  const k = Math.round(amount * 10) / 10; const hit = c.drive.get(k); if (hit) return hit;
  const n = 1024, curve = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; curve[i] = Math.tanh(x * k) / Math.tanh(k); }
  c.drive.set(k, curve); return curve;
}
/** output with a reverb send: returns the dry input node; `send` is how much goes to the shared outdoor reverb */
function outVerb(c: Ctx, w: Where = {}, send = 0.25, at = 0) {
  const dry = out(c, w);
  const s = c.ac.createGain(); s.gain.value = send * (w.dist ? 1 + Math.min(1.5, w.dist / 60) : 1); // far things are mostly reverb
  const input = c.ac.createGain();
  if (at > 0) { const dl = c.ac.createDelay(4); dl.delayTime.value = at; input.connect(dl); dl.connect(dry); dl.connect(s); }
  else { input.connect(dry); input.connect(s); }
  s.connect(c.verb);
  return input;
}
function noiseLayer(c: Ctx, dest: AudioNode, opts: { buf?: AudioBuffer; dur: number; freq: number; q?: number; type?: BiquadFilterType; gain: number; at?: number; drive?: number; sweepTo?: number; attack?: number }) {
  const t = c.ac.currentTime + (opts.at ?? 0);
  const src = c.ac.createBufferSource(); src.buffer = opts.buf ?? c.noise;
  const f = c.ac.createBiquadFilter(); f.type = opts.type ?? "bandpass"; f.frequency.setValueAtTime(opts.freq, t); f.Q.value = opts.q ?? 0.8;
  if (opts.sweepTo) f.frequency.exponentialRampToValueAtTime(opts.sweepTo, t + opts.dur);
  const g = c.ac.createGain(); const a = opts.attack ?? 0.002;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(opts.gain, t + a); g.gain.exponentialRampToValueAtTime(0.001, t + opts.dur);
  let node: AudioNode = src.connect(f);
  if (opts.drive) { const ws = c.ac.createWaveShaper(); ws.curve = new Float32Array(driveCurve(c, Math.min(AUDIO_SAFETY.maxDrive, opts.drive))); ws.oversample = "2x"; node = node.connect(ws); }
  node.connect(g).connect(dest);
  src.start(t, Math.random() * Math.max(0, (src.buffer?.duration ?? 0) - opts.dur - 0.05)); src.stop(t + opts.dur + 0.05);
}
/** shot tails were up to 1.3 s of brown noise per round; under auto fire they merged into a constant roar ("wind") */
const TAIL_SCALE = 0.45;
function shotLayers(c: Ctx, dest: AudioNode, p: ShotProfile, v: { pitch: number; gain: number }) {
  noiseLayer(c, dest, { dur: p.crack.dur, freq: p.crack.freq * v.pitch, type: "highpass", q: 0.7, gain: p.crack.gain * v.gain, attack: 0.0008 });
  noiseLayer(c, dest, { dur: p.blast.dur, freq: p.blast.freq * v.pitch, q: p.blast.q, gain: p.blast.gain * v.gain, drive: p.blast.drive, attack: 0.001 });
  tone(c, dest, { f0: p.thump.f0 * v.pitch, f1: p.thump.f1, dur: p.thump.dur, gain: p.thump.gain * v.gain });
  if (gate("shot-tail", 0.15)) noiseLayer(c, dest, { buf: c.brown, dur: p.tail.dur * TAIL_SCALE, freq: Math.min(900, p.tail.cutoff), type: "lowpass", q: 0.5, gain: p.tail.gain * 0.6, at: 0.015, attack: 0.02 });
  if (p.zap) tone(c, dest, { f0: p.zap.f0 * v.pitch, f1: p.zap.f1, dur: p.zap.dur, type: p.zap.type, gain: p.zap.gain });
  for (const m of p.mech ?? []) noiseLayer(c, dest, { dur: 0.035, freq: m.freq, q: 6, gain: m.gain, at: m.at });
}

/* ---------------- bundled samples (audio-files.ts); procedural synthesis stays the fallback ---------------- */
const SAMPLE_FILES = { rifle: "precision-rifle", shotgun: "shotgun-blast", tank: "tank-cannon", melee: "melee-impact", fracture: "reality-fracture-impact", portal: "reality-rift-portal", loot: "loot-pickup", engine: "vehicle-engine-start" } as const;
type SampleId = keyof typeof SAMPLE_FILES;
const AMBIENCE_FILES: Record<string, string> = { veridan: "forest-wilds", swamps: "swamp-marsh", thalassia: "underwater-city", nexus: "nexus-hum", frostspire: "frost-spire", solara: "solara-dunes", wastelands: "wasteland-wind", ember: "ember-peaks" };
const sampleBuffers = new Map<string, AudioBuffer>();
const sampleLoads = new Set<string>();
let activeBiomeRegion = "";
function loadSample(c: Ctx, id: string, file: string) {
  const url = AUDIO_FILES[file]; if (!url || sampleBuffers.has(id) || sampleLoads.has(id)) return;
  sampleLoads.add(id);
  fetch(url).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.arrayBuffer(); })
    .then((b) => c.ac.decodeAudioData(b)).then((buf) => {
      sampleBuffers.set(id, id.startsWith("ambient:") ? seamlessLoop(c, buf) : buf);
      if (id === `ambient:${activeBiomeRegion}` && biomeVoice) { biomeVoice.stop(); biomeVoice = null; updateBiomeAmbient(activeBiomeRegion); }
    })
    .catch(() => { /* keep the procedural sound */ }).finally(() => sampleLoads.delete(id));
}
/** ambience recordings loop: blend the seam once at load so the loop never clicks (ambient-mix.ts crossfadeLoop) */
function seamlessLoop(c: Ctx, buf: AudioBuffer): AudioBuffer {
  const fade = Math.floor(AMBIENT_MIX.loopCrossfadeSeconds * buf.sampleRate);
  if (buf.length < fade * 4) return buf;
  const out = c.ac.createBuffer(buf.numberOfChannels, buf.length - fade, buf.sampleRate);
  for (let ch = 0; ch < buf.numberOfChannels; ch++) out.copyToChannel(new Float32Array(crossfadeLoop(buf.getChannelData(ch), fade)), ch);
  return out;
}
/** a slow random-rate swell on a gain param (±depth around its level): wind gusts instead of a flat hiss */
function gust(c: Ctx, param: AudioParam, level: number): OscillatorNode {
  const lfo = c.ac.createOscillator(); lfo.type = "sine";
  const [lo, hi] = AMBIENT_MIX.gustHz; lfo.frequency.value = lo + Math.random() * (hi - lo);
  const depth = c.ac.createGain(); depth.gain.value = level * AMBIENT_MIX.gustDepth;
  lfo.connect(depth).connect(param); lfo.start(c.ac.currentTime + Math.random() * 3);
  return lfo;
}
function preloadSamples(c: Ctx) {
  for (const [id, f] of Object.entries(SAMPLE_FILES)) loadSample(c, id, f);
  for (const [r, f] of Object.entries(AMBIENCE_FILES)) loadSample(c, `ambient:${r}`, f);
}
/** true only when a decoded sample played; callers otherwise run their procedural sound */
function playSample(id: SampleId, w: Where = {}, gain = 0.8, rate = 1) {
  const c = ctx; const buffer = sampleBuffers.get(id); if (!c || !buffer) return false;
  const src = c.ac.createBufferSource(); src.buffer = buffer; src.playbackRate.value = rate;
  const o = outVerb(c, w, 0.2); const g = c.ac.createGain(); g.gain.value = gain;
  src.connect(g).connect(o); src.start();
  return true;
}
let ambientSample: { source: AudioBufferSourceNode; gain: GainNode; lfo: OscillatorNode } | null = null;
function stopAmbientSample() {
  const c = ctx, a = ambientSample; if (!c || !a) return; ambientSample = null;
  a.gain.gain.setTargetAtTime(0, c.ac.currentTime, 0.45);
  setTimeout(() => { try { a.source.stop(); a.lfo.stop(); } catch { /* stopped */ } }, 1800);
}
function startAmbientSample(regionId: string) {
  const c = ctx; const buf = sampleBuffers.get(`ambient:${regionId}`); if (!c || !buf) return false;
  stopAmbientSample();
  const source = c.ac.createBufferSource(); source.buffer = buf; source.loop = true;
  const gain = c.ac.createGain(); gain.gain.value = 0;
  const swell = c.ac.createGain(); swell.gain.value = 1; // the gust rides on a separate stage so the fade in/out stays clean
  source.connect(swell).connect(gain).connect(c.amb); source.start(c.ac.currentTime, Math.random() * buf.duration);
  const lfo = gust(c, swell.gain, 1);
  gain.gain.setTargetAtTime(AMBIENT_MIX.sampleGain * (AMBIENT_MIX.regionTrim[regionId] ?? 1), c.ac.currentTime, 1.2);
  ambientSample = { source, gain, lfo }; return true;
}
export function playVehicleEngineStart(vehicleId = "scrap-interceptor", speedRatio = 1) {
  const c = ctx; if (!c) return; const o = out(c);
  const v = engineVoice(vehicleId, speedRatio);
  // Keep the starter recording as a texture, with the model-specific ignition on top.
  if (vehicleId === "scrap-interceptor") playSample("engine", {}, 0.22, speedRatio);
  tone(c, o, { f0: v.base * 0.55, f1: v.base * 1.7, dur: v.ignition, type: v.type, gain: 0.16 });
  burst(c, o, { dur: v.ignition * 0.7, freq: v.cutoff * 0.7, type: "lowpass", gain: 0.12, at: 0.08 });
}

/** Player weapon: crack + saturated blast + thump + reverb tail (+ bolt/pump/zap) from audio-design.ts SHOTS, humanised per shot.
 * Launchers keep their element shading on top of the shared launcher profile. */
export function playShot(weapon: WeaponId | "VEHICLE" | "CANNON") {
  const c = ctx; if (!c) return;
  // the tank recording is a cannon: only shells use it (it used to play for every vehicle machine gun, ten times a second)
  if (weapon === "CANNON") { if (playSample("tank", {}, 0.85)) return; weapon = "HEAVY"; }
  if (weapon === "AUTO" && playSample("rifle", {}, 0.58, 0.94 + Math.random() * 0.12)) return;
  if ((weapon === "HEAVY" || weapon === "SHOTGUN") && playSample("shotgun", {}, 0.82, 0.96 + Math.random() * 0.08)) return;
  const key = shotKey(weapon); if (!key) return;
  const p = SHOTS[key];
  const o = outVerb(c, {}, p.tail.send);
  shotLayers(c, o, p, variation(Math.random));
  if (key === "LAUNCHER") {
    // rocket motor: a rushing exhaust that fades as the round leaves; the element shades its colour
    noiseLayer(c, o, { dur: 0.4, freq: weapon === "FROSTBITE" ? 2200 : weapon === "VITRIOL" ? 1300 : 800, q: 0.8, type: weapon === "FROSTBITE" ? "bandpass" : "lowpass", gain: 0.3, at: 0.03, attack: 0.04, sweepTo: 300 });
    if (weapon === "CINDER") tone(c, o, { f0: 300, f1: 90, dur: 0.4, type: "sawtooth", gain: 0.12 });
  }
}
export function playSwing(finisher: boolean) {
  if (playSample("melee", {}, finisher ? 0.9 : 0.62, finisher ? 0.86 : 1.08)) return;
  const c = ctx; if (!c) return; const o = out(c);
  noiseLayer(c, o, { dur: finisher ? 0.32 : 0.2, freq: finisher ? 700 : 1100, q: 1.4, gain: finisher ? 1 : 0.8, attack: 0.04, sweepTo: finisher ? 350 : 500 });
  tone(c, o, { f0: finisher ? 420 : 640, f1: 140, dur: 0.22, type: "triangle", gain: 0.16 });
  if (finisher) tone(c, o, { f0: 90, f1: 40, dur: 0.3, gain: 0.5, at: 0.12 });
}
export function playReload(phase: "start" | "end") {
  const c = ctx; if (!c) return; const o = out(c);
  if (phase === "start") { // mag release, mag out
    noiseLayer(c, o, { dur: 0.035, freq: 3000, q: 2.5, gain: 0.7, drive: 1.5 }); noiseLayer(c, o, { dur: 0.06, freq: 1500, q: 2, gain: 0.6, at: 0.14 }); tone(c, o, { f0: 180, f1: 120, dur: 0.06, gain: 0.25, at: 0.14 });
  } else { // mag seated, bolt home
    noiseLayer(c, o, { dur: 0.045, freq: 2200, q: 2.5, gain: 0.8, drive: 1.5 }); tone(c, o, { f0: 160, f1: 100, dur: 0.07, gain: 0.35 });
    noiseLayer(c, o, { dur: 0.05, freq: 3200, q: 2, gain: 0.6, at: 0.12 });
  }
}
export function playDryFire() { const c = ctx; if (!c) return; noiseLayer(c, out(c), { dur: 0.025, freq: 3600, q: 3, gain: 0.6 }); }
export function playSwitch() { const c = ctx; if (!c) return; const o = out(c); noiseLayer(c, o, { dur: 0.05, freq: 1800, q: 2, gain: 0.5 }); noiseLayer(c, o, { dur: 0.04, freq: 2800, q: 2.5, gain: 0.45, at: 0.08 }); tone(c, o, { f0: 150, f1: 110, dur: 0.06, gain: 0.2, at: 0.08 }); }

/** Material impact: enemies are machines (metal clang) or aberrations (organic thud). */
function hitTick(c: Ctx) { if (gate("hit-tick", 0.07)) tone(c, out(c), { f0: 2600, f1: 2600, dur: 0.03, type: "sine", gain: 0.06 }); }
export function playImpact(material: "METAL" | "ORGANIC" | "TECH", w: Where) {
  const c = ctx; if (!c) return;
  if (!gate(`impact:${material}`, 0.045)) { hitTick(c); return; }
  const o = out(c, w);
  if (material === "METAL" && playSample("melee", w, 0.42, 1.12)) { hitTick(c); return; }
  if (material === "METAL") { tone(c, o, { f0: 1800, f1: 1500, dur: 0.12, type: "triangle", gain: 0.18 }); burst(c, o, { dur: 0.05, freq: 5000, q: 3, gain: 0.25 }); }
  else if (material === "TECH") { noiseLayer(c, o, { dur: 0.06, freq: 3800, q: 2, gain: 0.4 }); tone(c, o, { f0: 1900, f1: 700, dur: 0.07, type: "triangle", gain: 0.1 }); }
  else { noiseLayer(c, o, { dur: 0.1, freq: 380, type: "lowpass", gain: 0.8 }); tone(c, o, { f0: 120, f1: 60, dur: 0.08, gain: 0.3 }); }
  hitTick(c); // hit-marker tick, always centered
}
/** A precision (head-band) hit: a bright two-note ping over the impact, so landing headshots is audible (weapon-meta.ts) */
export function playCritTick() {
  const c = ctx; if (!c || !gate("crit-tick", 0.06)) return;
  tone(c, out(c), { f0: 3300, f1: 3300, dur: 0.035, type: "sine", gain: 0.07 });
  tone(c, out(c), { f0: 4400, f1: 4200, dur: 0.05, type: "triangle", gain: 0.045 });
}
/** A real explosion: initial crack, a saturated sub thump, a brown-noise rumble whose filter closes over seconds, scattered debris ticks and
 * a big reverb send. Arrives late and darker with distance (blastAtDistance: speed of sound), so far blasts sound far. `flavor` adds an
 * elemental layer (fire roar, ice shatter, acid hiss, arc crackle). */
export function playExplosion(big: boolean, w: Where = {}, flavor: BlastFlavor = "KINETIC") {
  const c = ctx; if (!c) return;
  const far = blastAtDistance(w.dist ?? 0);
  const o = outVerb(c, { ...w, dist: 0 }, big ? 0.6 : 0.45, far.delay);
  const lp = c.ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = far.cutoff;
  const g = c.ac.createGain(); g.gain.value = far.gain; g.connect(lp).connect(o);
  const sub = c.ac.createGain(); sub.gain.value = far.sub; sub.connect(o); // the sub carries further than the crack
  noiseLayer(c, g, { dur: 0.05, freq: 3500, type: "highpass", gain: big ? 0.9 : 0.65, attack: 0.0008 });
  noiseLayer(c, g, { dur: big ? 0.5 : 0.3, freq: 900, q: 0.5, gain: big ? 1 : 0.8, drive: 3.5, attack: 0.002, sweepTo: 200 });
  tone(c, sub, { f0: big ? 75 : 95, f1: 22, dur: big ? 1.5 : 0.8, gain: big ? 1 : 0.75 });
  noiseLayer(c, sub, { buf: c.brown, dur: big ? 2.0 : 1.1, freq: big ? 900 : 1100, type: "lowpass", q: 0.6, gain: big ? 0.9 : 0.6, attack: 0.01, sweepTo: 90 });
  const ticks = big ? 14 : 7;
  for (let k = 0; k < ticks; k++) noiseLayer(c, g, { dur: 0.02 + Math.random() * 0.03, freq: 2500 + Math.random() * 4000, q: 4, gain: 0.12 + Math.random() * 0.15, at: 0.15 + Math.random() * (big ? 1.4 : 0.8) });
  const fl = BLAST_FLAVOR[flavor];
  if (fl.kind === "roar") noiseLayer(c, g, { dur: 0.9, freq: 500, q: 0.9, gain: fl.gain, at: 0.05, attack: 0.1, drive: 2 });
  else if (fl.kind === "shatter") for (let k = 0; k < 9; k++) tone(c, g, { f0: 2600 + Math.random() * 3000, f1: 1800, dur: 0.18, type: "triangle", gain: fl.gain * 0.4, at: 0.05 + Math.random() * 0.4 });
  else if (fl.kind === "hiss") noiseLayer(c, g, { dur: 1.0, freq: 3000, q: 1.2, gain: fl.gain * 0.6, at: 0.1, attack: 0.15 });
  else if (fl.kind === "crackle") for (let k = 0; k < 12; k++) noiseLayer(c, g, { dur: 0.015, freq: 6000, type: "highpass", gain: fl.gain, at: Math.random() * 0.9 });
}
/** a machine dying: a small mechanical blast (smaller than a full explosion) plus the confirm chime */
export function playKill(boss: boolean, w: Where) {
  const c = ctx; if (!c) return;
  if (boss) { playExplosion(true, w); } else {
    const o = outVerb(c, w, 0.35);
    noiseLayer(c, o, { dur: 0.03, freq: 4000, type: "highpass", gain: 0.5, attack: 0.0008 });
    noiseLayer(c, o, { dur: 0.22, freq: 1100, q: 0.6, gain: 0.7, drive: 2.5, sweepTo: 300 });
    tone(c, o, { f0: 130, f1: 30, dur: 0.4, gain: 0.7 });
    for (let k = 0; k < 4; k++) noiseLayer(c, o, { dur: 0.02, freq: 3000 + Math.random() * 3000, q: 4, gain: 0.15, at: 0.08 + Math.random() * 0.35 });
  }
  tone(c, out(c), { f0: 660, f1: 990, dur: 0.12, type: "triangle", gain: 0.08, at: 0.05 }); // confirm chime
}
export function playAbility(kind: string) {
  if ((kind === "RIFT" || kind === "PORTAL" || kind === "TELEPORT") && playSample("portal", {}, 0.72)) return;
  const c = ctx; if (!c) return; const o = out(c, {}, c.abil);
  // one voice per ability effect kind (combat-engine.ts effects[0].kind): eight of them used to share one generic sweep
  if (kind === "DASH") { burst(c, o, { dur: 0.22, freq: 900, q: 2, gain: 0.45 }); tone(c, o, { f0: 60, f1: 30, dur: 0.3, gain: 0.45 }); }
  else if (kind === "DOME" || kind === "SHIELD") { tone(c, o, { f0: 200, f1: 400, dur: 0.6, type: "triangle", gain: 0.25 }); tone(c, o, { f0: 300, f1: 600, dur: 0.6, type: "sine", gain: 0.2 }); tone(c, o, { f0: 60, f1: 30, dur: 0.4, gain: 0.5 }); }
  else if (kind === "MARK") { // target lock: two bright pings and a soft confirm
    tone(c, o, { f0: 1760, f1: 1760, dur: 0.07, type: "sine", gain: 0.35 }); tone(c, o, { f0: 2350, f1: 2350, dur: 0.09, type: "sine", gain: 0.3, at: 0.09 });
    tone(c, o, { f0: 440, f1: 330, dur: 0.25, type: "triangle", gain: 0.25, at: 0.2 }); tone(c, o, { f0: 90, f1: 50, dur: 0.2, gain: 0.3, at: 0.2 });
  } else if (kind === "TURRET") { // deploy: a clank, servos spinning up, a ready beep
    noiseLayer(c, o, { dur: 0.08, freq: 1300, q: 2, gain: 0.5, drive: 2 }); tone(c, o, { f0: 120, f1: 70, dur: 0.15, gain: 0.5 });
    tone(c, o, { f0: 180, f1: 520, dur: 0.45, type: "square", gain: 0.05, at: 0.12 }); tone(c, o, { f0: 1320, f1: 1320, dur: 0.08, type: "sine", gain: 0.14, at: 0.62 });
  } else if (kind === "VEIL") { // going dark: the world's sound folds away, a low shimmer
    tone(c, o, { f0: 900, f1: 260, dur: 0.6, type: "sine", gain: 0.26 }); tone(c, o, { f0: 1350, f1: 390, dur: 0.6, type: "sine", gain: 0.13, at: 0.03 });
    noiseLayer(c, o, { dur: 0.5, freq: 700, q: 1.5, gain: 0.2, attack: 0.15 }); tone(c, o, { f0: 70, f1: 40, dur: 0.5, gain: 0.3 });
  } else if (kind === "STRIKE") { // called-in strike: an incoming whistle, then the hit
    tone(c, o, { f0: 1500, f1: 480, dur: 0.55, type: "sine", gain: 0.12 });
    tone(c, o, { f0: 110, f1: 32, dur: 0.5, gain: 0.8, at: 0.55 }); noiseLayer(c, o, { dur: 0.3, freq: 800, q: 0.7, gain: 0.6, drive: 2.5, at: 0.55, sweepTo: 250 });
  } else if (kind === "SIEGE") { // heavy stance: a charging hum, then the plates lock
    tone(c, o, { f0: 70, f1: 150, dur: 0.6, type: "sawtooth", gain: 0.08 }); tone(c, o, { f0: 55, f1: 40, dur: 0.6, gain: 0.5 });
    noiseLayer(c, o, { dur: 0.06, freq: 1800, q: 3, gain: 0.45, at: 0.6, drive: 2 }); noiseLayer(c, o, { dur: 0.06, freq: 1400, q: 3, gain: 0.4, at: 0.7, drive: 2 });
  } else if (kind === "SILENCE") { // suppression pulse: a deep drop and a short crackle
    tone(c, o, { f0: 240, f1: 45, dur: 0.45, gain: 0.55 });
    for (let k = 0; k < 6; k++) noiseLayer(c, o, { dur: 0.02, freq: 2600, q: 2, gain: 0.12, at: 0.05 + Math.random() * 0.35 });
  } else if (kind === "DAMAGE") { // a raw energy hit: punch and crunch
    tone(c, o, { f0: 140, f1: 38, dur: 0.35, gain: 0.8 }); noiseLayer(c, o, { dur: 0.18, freq: 650, q: 0.8, gain: 0.6, drive: 3, sweepTo: 220 });
  } else if (kind === "RIFT" || kind === "PORTAL" || kind === "TELEPORT") { // (the recorded portal plays when loaded)
    tone(c, o, { f0: 220, f1: 660, dur: 0.5, type: "sine", gain: 0.18 }); tone(c, o, { f0: 227, f1: 680, dur: 0.5, type: "sine", gain: 0.14 });
    tone(c, o, { f0: 70, f1: 35, dur: 0.5, gain: 0.5, at: 0.1 });
  } else { tone(c, o, { f0: 300, f1: 1400, dur: 0.3, type: "triangle", gain: 0.12 }); noiseLayer(c, o, { dur: 0.3, freq: 1500, q: 1.2, gain: 0.2 }); tone(c, o, { f0: 60, f1: 30, dur: 0.4, gain: 0.5 }); }
}
export function playHurt() { const c = ctx; if (!c) return; const o = out(c); tone(c, o, { f0: 180, f1: 60, dur: 0.2, type: "square", gain: 0.12 }); burst(c, o, { dur: 0.12, freq: 800, type: "lowpass", gain: 0.4 }); }
/** Enemy telegraph: shot from a hostile, positioned in space. */
export function playEnemyShot(kind: string, heavy: boolean, w: Where) {
  const c = ctx; if (!c) return;
  if (!gate("enemy-shot", 0.035)) return; const o = outVerb(c, w, 0.3, Math.min(0.25, (w.dist ?? 0) / 343)); // distant fire arrives late, like real gunfire
  const v = 0.9 + Math.random() * 0.2; // per-shot pitch variation
  if (kind === "OVERCLOCKED") { tone(c, o, { f0: 1600 * v, f1: 400, dur: 0.12, type: "sawtooth", gain: 0.08 }); burst(c, o, { dur: 0.06, freq: 5000, type: "highpass", gain: 0.2 }); }
  else if (kind === "ABERRATION") { burst(c, o, { dur: 0.25, freq: 500 * v, q: 3, gain: 0.45 }); tone(c, o, { f0: 220 * v, f1: 90, dur: 0.25, type: "triangle", gain: 0.15 }); }
  else if (kind === "VANGUARD") { tone(c, o, { f0: 900 * v, f1: 250, dur: 0.14, type: "square", gain: 0.08 }); burst(c, o, { dur: 0.08, freq: 2200, q: 1, gain: 0.35 }); }
  else { shotLayers(c, o, SHOTS.AUTO, { pitch: v, gain: 0.55 }); } // raider ballistic: a real rifle report, a bit lighter than yours
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
  const swell = c.ac.createGain(); swell.gain.value = 1;
  src.connect(f).connect(swell).connect(g).connect(dest);
  src.start(c.ac.currentTime, Math.random() * AMBIENT_MIX.noiseSeconds);
  const lfo = gust(c, swell.gain, 1);
  // the filter drifts a little with the gust too, so the bed changes colour rather than sitting on one hiss
  const drift = c.ac.createGain(); drift.gain.value = cutoff * 0.25; lfo.connect(drift).connect(f.frequency);
  g.gain.setTargetAtTime(gain, c.ac.currentTime, 1.2);
  return { stop: () => { g.gain.setTargetAtTime(0, c.ac.currentTime, 0.6); setTimeout(() => { src.stop(); lfo.stop(); }, 1500); } };
}
/** A bird call: a short tonal chirp (two quick upward sweeps), not a burst of filtered noise. */
function birdChirp(c: Ctx, dest: AudioNode) {
  const f = 2300 + Math.random() * 1600, n = 1 + Math.floor(Math.random() * 3);
  const p = c.ac.createStereoPanner(); p.pan.value = Math.random() * 1.6 - 0.8; p.connect(dest);
  for (let k = 0; k < n; k++) tone(c, p, { f0: f, f1: f * (1.25 + Math.random() * 0.2), dur: 0.07 + Math.random() * 0.05, type: "sine", gain: 0.03 + Math.random() * 0.02, at: k * 0.11 });
}
/** Swamp frogs/insects: a low wooden croak or a high cricket pulse. */
function marshCall(c: Ctx, dest: AudioNode) {
  if (Math.random() < 0.5) { const f = 180 + Math.random() * 120; for (let k = 0; k < 3; k++) tone(c, dest, { f0: f, f1: f * 0.8, dur: 0.06, type: "triangle", gain: 0.035, at: k * 0.09 }); }
  else { const f = 4200 + Math.random() * 800; for (let k = 0; k < 4; k++) tone(c, dest, { f0: f, f1: f, dur: 0.025, type: "sine", gain: 0.015, at: k * 0.05 }); }
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
  veridan: { bedCutoff: 700, bedGain: 0.03, textureEvery: [1400, 4200], texture: birdChirp },
  swamps: { bedCutoff: 420, bedGain: 0.035, textureEvery: [900, 2600], texture: marshCall },
  nexus: { bedCutoff: 260, bedGain: 0.02, hum: 118 },
  frostspire: { bedCutoff: 1100, bedGain: 0.05 },
  solara: { bedCutoff: 1000, bedGain: 0.045 },
  wastelands: { bedCutoff: 700, bedGain: 0.04 },
  ember: { bedCutoff: 220, bedGain: 0.05, textureEvery: [1800, 3600], texture: (c, dest) => burst(c, dest, { dur: 0.25, freq: 500, type: "lowpass", gain: 0.06 }) },
};

/** Called once per HUD tick with the current region id; only rebuilds voices when the region actually changes. */
export function updateBiomeAmbient(regionId: string) {
  const c = ctx; if (!c) return;
  activeBiomeRegion = regionId;
  if (biomeVoice?.key === regionId) return;
  biomeVoice?.stop(); biomeVoice = null;
  const def = BIOME_AMBIENT[regionId];
  if (startAmbientSample(regionId)) {
    // the recordings are steady beds; the region's calls (birds, frogs) still play on top so the place sounds alive
    const stopTexture = def?.texture && def.textureEvery ? periodicTexture(() => def.texture!(c, c.amb), def.textureEvery) : null;
    biomeVoice = { key: regionId, stop: () => { stopAmbientSample(); stopTexture?.(); } };
    return;
  }
  if (!def) return;
  const dest = c.amb;
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

/** Same swap-only-on-change pattern as updateBiomeAmbient, keyed on the HUD's existing `weather` label ("Clear shield" gets no bed).
 * Levels and filters live in ambient-mix.ts WEATHER_BEDS; rain also gets sparse droplet ticks so it reads as rain, not static. */
export function updateWeatherAmbient(weather: string) {
  const c = ctx; if (!c) return;
  if (weatherVoice?.key === weather) return;
  weatherVoice?.stop(); weatherVoice = null;
  const def = WEATHER_BEDS[weather];
  if (!def) return;
  const bed = noiseBed(c, c.amb, { cutoff: def.cutoff, gain: def.gain, type: def.type, q: def.q });
  const drops = weather === "Rain mist" ? periodicTexture(() => { for (let k = 0; k < 3; k++) tone(c, c.amb, { f0: 1100 + Math.random() * 1300, f1: 600, dur: 0.02, type: "sine", gain: 0.008, at: Math.random() * 0.25 }); }, [120, 380]) : null;
  weatherVoice = { key: weather, stop: () => { bed.stop(); drops?.(); } };
}

/* ---------------- running water: one stream voice + one waterfall voice (water-audio.ts decides gains) ---------------- */

type WaterVoice = { gain: GainNode; pan: StereoPannerNode; nodes: AudioScheduledSourceNode[]; silentSince: number };
const waterVoices: { stream: WaterVoice | null; fall: WaterVoice | null } = { stream: null, fall: null };
/** peak loudness of each voice at gain 1 (below the combat mix; nature stays a bed) */
const WATER_PEAK = AMBIENT_MIX.waterPeak;

function loopNoise(c: Ctx, dest: AudioNode, type: BiquadFilterType, freq: number, q: number, level: number): { gain: GainNode; src: AudioBufferSourceNode } {
  const src = c.ac.createBufferSource(); src.buffer = c.noise; src.loop = true;
  const f = c.ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = c.ac.createGain(); g.gain.value = level;
  src.connect(f).connect(g).connect(dest);
  src.start(0, Math.random() * 0.8);
  return { gain: g, src };
}
function startWaterVoice(c: Ctx, kind: "stream" | "fall"): WaterVoice {
  const gain = c.ac.createGain(); gain.gain.value = 0;
  const pan = c.ac.createStereoPanner();
  gain.connect(pan).connect(c.amb);
  const nodes: AudioScheduledSourceNode[] = [];
  if (kind === "stream") {
    nodes.push(loopNoise(c, gain, "bandpass", 850, 0.5, 0.55).src);
    const chatter = loopNoise(c, gain, "bandpass", 2700, 1.3, 0.22);
    nodes.push(chatter.src);
    // slow gain wobble on the high band: the burble of water over stones
    const lfo = c.ac.createOscillator(); lfo.type = "sine"; lfo.frequency.value = 0.8 + Math.random() * 0.5;
    const depth = c.ac.createGain(); depth.gain.value = 0.12;
    lfo.connect(depth).connect(chatter.gain.gain); lfo.start(); nodes.push(lfo);
  } else {
    nodes.push(loopNoise(c, gain, "lowpass", 1500, 0.4, 0.7).src);
    nodes.push(loopNoise(c, gain, "bandpass", 420, 0.6, 0.6).src);
    nodes.push(loopNoise(c, gain, "lowpass", 160, 0.5, 1).src); // roar
  }
  return { gain, pan, nodes, silentSince: performance.now() };
}
function stopWaterVoice(c: Ctx, v: WaterVoice) {
  v.gain.gain.setTargetAtTime(0, c.ac.currentTime, 0.3);
  window.setTimeout(() => { for (const n of v.nodes) { try { n.stop(); } catch { /* already stopped */ } } v.gain.disconnect(); v.pan.disconnect(); }, 1500);
}
/** Called with the listener pose every audio tick. Gains ease (setTargetAtTime), a voice is created only while its source is audible and torn down after LINGER_MS of silence. */
export function updateWaterAudio(lx: number, lz: number, yaw: number, mix: WaterMix) {
  const c = ctx; if (!c) return;
  const now = performance.now();
  for (const kind of ["stream", "fall"] as const) {
    const src: WaterSource | null = mix[kind];
    const gain = src?.gain ?? 0;
    let v = waterVoices[kind];
    if (gain > 0.01) v ??= waterVoices[kind] = startWaterVoice(c, kind);
    if (!v) continue;
    if (gain > 0.01) v.silentSince = now;
    const act = voiceAction(gain, true, now - v.silentSince);
    if (act === "stop") { stopWaterVoice(c, v); waterVoices[kind] = null; continue; }
    v.gain.gain.setTargetAtTime(gain * WATER_PEAK[kind], c.ac.currentTime, 0.35);
    if (src) v.pan.pan.setTargetAtTime(Math.max(-0.85, Math.min(0.85, where(lx, lz, yaw, src.x, src.z).pan ?? 0)), c.ac.currentTime, 0.2);
  }
}
/** Leaving the world (menu, hub, unmount): fade both water voices out and release their nodes. */
export function stopWaterAudio() {
  const c = ctx; if (!c) return;
  for (const kind of ["stream", "fall"] as const) { const v = waterVoices[kind]; if (v) { stopWaterVoice(c, v); waterVoices[kind] = null; } }
}

/** Continuous vehicle engine: per-vehicle voice, rpm follows speed + throttle, brake squeal on hard decel. */
type Engine = { id: string; osc: OscillatorNode; sub: OscillatorNode; filter: BiquadFilterNode; gain: GainNode; brake: GainNode; brakeSrc: AudioBufferSourceNode };
let engine: Engine | null = null;
/** the engine sat louder than explosions (-20 dBFS while driving) and its filter opened to a full sawtooth buzz at top speed */
const ENGINE_LEVEL = 0.35;
const ENGINE_MAX_CUTOFF = 1600;
export function updateEngine(active: boolean, vehicleId: string, speed01: number, throttle: number, braking: boolean, speedRatio = 1) {
  const c = ctx; if (!c) return;
  if (!active) { if (engine) { engine.gain.gain.setTargetAtTime(0, c.ac.currentTime, 0.15); const e = engine; setTimeout(() => { e.osc.stop(); e.sub.stop(); e.brakeSrc.stop(); }, 800); engine = null; } return; }
  if (!engine || engine.id !== vehicleId) {
    updateEngine(false, vehicleId, 0, 0, false);
    const v = engineVoice(vehicleId, speedRatio);
    const osc = c.ac.createOscillator(); osc.type = v.type; const sub = c.ac.createOscillator(); sub.type = "sine";
    const filter = c.ac.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = v.cutoff; filter.Q.value = 0.7;
    const gain = c.ac.createGain(); gain.gain.value = 0;
    const brake = c.ac.createGain(); brake.gain.value = 0; const bf = c.ac.createBiquadFilter(); bf.type = "bandpass"; bf.frequency.value = 2600; bf.Q.value = 8;
    const bfTop = c.ac.createBiquadFilter(); bfTop.type = "lowpass"; bfTop.frequency.value = 4000; bfTop.Q.value = 0.5;
    const brakeSrc = c.ac.createBufferSource(); brakeSrc.buffer = c.noise; brakeSrc.loop = true;
    const smooth = c.ac.createBiquadFilter(); smooth.type = "lowpass"; smooth.frequency.value = ENGINE_MAX_CUTOFF * 1.4; smooth.Q.value = 0.5;
    osc.connect(filter); sub.connect(filter); filter.connect(smooth).connect(gain).connect(c.sfx); brakeSrc.connect(bf).connect(bfTop).connect(brake).connect(c.sfx);
    osc.start(); sub.start(); brakeSrc.start();
    engine = { id: vehicleId, osc, sub, filter, gain, brake, brakeSrc };
  }
  const v = engineVoice(vehicleId, speedRatio), t = c.ac.currentTime;
  const rpm = v.base * (1 + speed01 * 2.4 + throttle * 0.5);
  engine.osc.frequency.setTargetAtTime(rpm, t, 0.08);
  engine.sub.frequency.setTargetAtTime(rpm / 2, t, 0.08);
  engine.filter.frequency.setTargetAtTime(Math.min(ENGINE_MAX_CUTOFF, v.cutoff * (1 + throttle * 0.8 + speed01 * 0.6)), t, 0.1);
  engine.gain.gain.setTargetAtTime((0.06 + throttle * 0.08 + speed01 * 0.05) * ENGINE_LEVEL, t, 0.1);
  engine.brake.gain.setTargetAtTime(braking && speed01 > 0.15 ? 0.03 * speed01 : 0, t, 0.05);
}

/** Music: ambient pad always; tension pulse and combat drums fade in with intensity (0–1). */
function startMusic(c: Ctx) {
  const mk = () => { const g = c.ac.createGain(); g.gain.value = 0; g.connect(c.music); return g; };
  const ambient = mk(), tension = mk(), drums = mk(), motif = mk(), arp = mk();
  ambient.gain.value = AMBIENT_MIX.pad;
  motif.gain.value = 1;
  // The pad used to be three full-level sines held forever (an idling-engine drone). Now: a warm, lowpassed chord whose
  // voices swell in and out on their own slow cycles, so the bed breathes and never sits on one steady tone.
  const padTone = c.ac.createBiquadFilter(); padTone.type = "lowpass"; padTone.frequency.value = AMBIENT_MIX.padCutoff; padTone.Q.value = 0.5; padTone.connect(ambient);
  [55, 82.4, 110.2].forEach((f, i) => {
    const o = c.ac.createOscillator(); o.type = "sine"; o.frequency.value = f;
    const voice = c.ac.createGain(); voice.gain.value = 0.5;
    const swell = c.ac.createOscillator(); swell.frequency.value = 1 / (AMBIENT_MIX.padSwellSeconds * (1 + i * 0.37));
    const depth = c.ac.createGain(); depth.gain.value = 0.5; swell.connect(depth).connect(voice.gain); // voice level rides 0..1
    o.connect(voice).connect(padTone); o.start(); swell.start(c.ac.currentTime + i * 4);
    c.ambientOscs.push(o);
  });
  const t = c.ac.createOscillator(); t.type = "triangle"; t.frequency.value = 110; const tf = c.ac.createBiquadFilter(); tf.type = "lowpass"; tf.frequency.value = 500;
  const trem = c.ac.createGain(); trem.gain.value = 0.3; const tl = c.ac.createOscillator(); tl.frequency.value = 4; const tlg = c.ac.createGain(); tlg.gain.value = 0.3; tl.connect(tlg).connect(trem.gain);
  t.connect(tf).connect(trem).connect(tension); t.start(); tl.start();
  c.layers = { ambient, tension, drums, motif, arp };
}

/** Called every frame; schedules drum hits on a 120bpm grid while in combat. With `boss` true
 * (an engaged boss nearby), the grid runs faster (150bpm) with an extra off-beat hit and never
 * drops below a driving floor, so a boss fight reads as a distinct, more frantic piece rather
 * than just "regular combat but louder" — the "different fights get different music" ask. */
export function updateCombatAudio(intensity: number, boss = false) {
  combatLevel = intensity;
  const c = ctx; if (!c || !c.layers) return;
  const now = c.ac.currentTime;
  const eff = boss ? Math.max(intensity, 0.72) : intensity;
  const grid = boss ? 0.2 : 0.25;
  c.layers.ambient.gain.setTargetAtTime(eff < 0.3 ? AMBIENT_MIX.pad : AMBIENT_MIX.padCombat, now, 0.8);
  c.layers.tension.gain.setTargetAtTime(eff > 0.4 ? (boss ? 0.2 : 0.12) * Math.min(1, (eff - 0.4) * 3) : 0, now, 0.8);
  c.layers.drums.gain.setTargetAtTime(eff > 0.65 ? (boss ? 0.45 : 0.38) : 0, now, 0.5); // drums peaked above the player's own gun
  if (eff > 0.65 && now >= c.beat) {
    c.beat = Math.max(now, c.beat) + grid;
    const step = Math.round(c.beat / grid) % 8;
    if (step % 4 === 0) tone(c, c.layers.drums, { f0: boss ? 150 : 120, f1: boss ? 45 : 40, dur: 0.3, gain: boss ? 1 : 0.8 });
    if (step % 4 === 2) burst(c, c.layers.drums, { dur: 0.15, freq: 1800, q: 0.8, gain: 0.35 });
    if (boss && step % 2 === 1) burst(c, c.layers.drums, { dur: 0.08, freq: 2600, q: 1.5, gain: 0.3 });
    if (step % 2 === 1) burst(c, c.layers.drums, { dur: 0.025, freq: 6500, q: 1.4, gain: eff > 0.85 ? 0.05 : 0.025 });
  }
}

/** Drive music (owner's audio brief, Oct 25: the soundtrack shifts when you're drifting off-road, not only in fights): a synth
 * arpeggio on the region's scale fades in with ground speed when there's no fight on, and doubles its rate while you're in
 * the air off a jump. Called every frame with speed 0..1 (0 on foot). */
let arpAt = 0, arpStep = 0;
export function updateDriveMusic(speed01: number, airborne: boolean) {
  const c = ctx; if (!c || !c.layers) return;
  const now = c.ac.currentTime;
  const level = combatLevel < 0.65 && speed01 > 0.3 ? Math.min(1, (speed01 - 0.3) * 2.2) : 0;
  c.layers.arp.gain.setTargetAtTime(level * 0.11, now, level > 0 ? 0.8 : 1.6);
  if (level <= 0.02 || now < arpAt) return;
  const def = MUSIC_REGION[c.musicRegion], root = def?.root ?? 220, ratios = def?.ratios ?? [1, 1.25, 1.5, 2];
  const seq = [0, 2, 1, 3, 2, 4, 3, 1];
  const f = root * (ratios[seq[arpStep % seq.length]! % ratios.length] ?? 1) * (arpStep % 16 >= 8 ? 2 : 1);
  arpAt = Math.max(now, arpAt) + (airborne ? 0.0938 : 0.1875); // 16ths at 80 bpm, 32nds in the air
  arpStep++;
  tone(c, c.layers.arp, { f0: f, f1: f * 0.995, dur: 0.16, type: "sawtooth", gain: 0.35 });
  if (arpStep % 8 === 0) tone(c, c.layers.arp, { f0: root / 2, f1: root / 2, dur: 0.6, type: "triangle", gain: 0.7 });
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
  if (playSample("loot", {}, 0.56)) return;
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

/** Boss attack wind-up warning: a rising two-tone siren whose pitch climbs with severity (finale = 2). Plays at tell start. */
export function playBossTell(severity: 0 | 1 | 2 = 0) {
  const c = ctx; if (!c) return; const o = out(c);
  const f = 420 + severity * 120;
  tone(c, o, { f0: f, f1: f * 1.6, dur: 0.28, type: "triangle", gain: 0.14 });
  tone(c, o, { f0: f * 1.2, f1: f * 2, dur: 0.28, type: "triangle", gain: 0.12, at: 0.3 });
  if (severity > 0) tone(c, o, { f0: 90, f1: 55, dur: 0.6, type: "sawtooth", gain: 0.18 });
}
/** Weak point exposed: a bright, clean chime so the opening is audible even off-screen. */
export function playWeakPointOpen() {
  const c = ctx; if (!c) return; const o = out(c);
  tone(c, o, { f0: 1320, f1: 1320, dur: 0.18, type: "sine", gain: 0.12 });
  tone(c, o, { f0: 1760, f1: 1760, dur: 0.3, type: "sine", gain: 0.1, at: 0.1 });
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

/** Director UI cues (director-cues.ts): a short region-voiced blip on select, a rising sweep when a map opens, a falling one on Back. */
export function playDirectorCue(action: CueAction, destinationId?: string | null) {
  const c = ctx; if (!c) return;
  const cue = directorCue(destinationId), shape = CUE_SHAPE[action], o = out(c);
  const [a, b] = shape.up > 0 ? [cue.f0, cue.f1] : [cue.f1, cue.f0];
  tone(c, o, { f0: a, f1: b, dur: shape.dur, type: cue.wave, gain: 0.07 });
  if (cue.band > 0 && cue.noise > 0) burst(c, o, { dur: shape.dur * 0.8, freq: cue.band, q: 3, gain: cue.noise * 0.5 });
}

/* ---------------- vehicle gadgets (vehicle-gadgets.ts): one-shots and two positional loops ---------------- */
export type GadgetSound = "MINE_DROP" | "CALTROPS" | "FLARES" | "DRONE_LAUNCH" | "DRONE_SHOT" | "BREACH";
/** Drop clank then the arming beeps; the caltrop canister's thump and a scatter of steel; flare pops with a fizz; the drone
 * spinning up off its dock; the drone's light gun; the breach thruster's ignition kick and rush. */
export function playGadget(kind: GadgetSound, w: Where = {}) {
  const c = ctx; if (!c) return;
  const o = outVerb(c, w, 0.2);
  if (kind === "MINE_DROP") {
    noiseLayer(c, o, { dur: 0.09, freq: 1400, q: 3, gain: 0.5, drive: 2 });           // steel on dirt
    tone(c, o, { f0: 180, f1: 90, dur: 0.12, gain: 0.35 });
    for (let k = 0; k < 2; k++) tone(c, o, { f0: 2200, f1: 2200, dur: 0.05, type: "square", gain: 0.05, at: 0.55 + k * 0.18 }); // arming
    tone(c, o, { f0: 3000, f1: 3000, dur: 0.09, type: "square", gain: 0.06, at: 0.92 });
  } else if (kind === "CALTROPS") {
    tone(c, o, { f0: 140, f1: 60, dur: 0.18, gain: 0.5 });
    noiseLayer(c, o, { dur: 0.12, freq: 700, q: 0.8, gain: 0.5, drive: 2.5 });
    for (let k = 0; k < 16; k++) noiseLayer(c, o, { dur: 0.02, freq: 3500 + Math.random() * 3500, q: 7, gain: 0.08 + Math.random() * 0.08, at: 0.35 + Math.random() * 0.5 }); // spikes landing
  } else if (kind === "FLARES") {
    for (let k = 0; k < 8; k++) {
      noiseLayer(c, o, { dur: 0.04, freq: 1800, q: 1.2, gain: 0.35, at: k * 0.06, drive: 2 });
      noiseLayer(c, o, { dur: 0.7, freq: 2600, q: 1.2, gain: 0.025, at: k * 0.06 + 0.03, attack: 0.05 }); // fizz
    }
  } else if (kind === "DRONE_LAUNCH") {
    noiseLayer(c, o, { dur: 0.08, freq: 900, q: 2, gain: 0.35 }); // release latch
    tone(c, o, { f0: 60, f1: 420, dur: 1.1, type: "sawtooth", gain: 0.06, at: 0.05 });
    noiseLayer(c, o, { dur: 1.2, freq: 1200, q: 0.9, gain: 0.18, at: 0.05, attack: 0.4, sweepTo: 2400 });
  } else if (kind === "DRONE_SHOT") {
    noiseLayer(c, o, { dur: 0.03, freq: 5200, type: "highpass", gain: 0.35, attack: 0.0008 });
    noiseLayer(c, o, { dur: 0.07, freq: 1600, q: 1.4, gain: 0.3, drive: 2 });
    tone(c, o, { f0: 320, f1: 140, dur: 0.06, gain: 0.15 });
  } else {
    tone(c, o, { f0: 90, f1: 30, dur: 0.6, gain: 0.8 });
    noiseLayer(c, o, { dur: 0.06, freq: 2600, type: "highpass", gain: 0.6, attack: 0.0008 });
    noiseLayer(c, o, { buf: c.brown, dur: 1.4, freq: 2200, type: "lowpass", q: 0.6, gain: 0.7, attack: 0.03, sweepTo: 400, drive: 2 });
  }
}

type LoopVoice = { gain: GainNode; pan: StereoPannerNode; nodes: AudioScheduledSourceNode[] };
const gadgetLoops: { flame: LoopVoice | null; drone: LoopVoice | null } = { flame: null, drone: null };
function startGadgetLoop(c: Ctx, kind: "flame" | "drone"): LoopVoice {
  const gain = c.ac.createGain(); gain.gain.value = 0;
  const pan = c.ac.createStereoPanner();
  gain.connect(pan).connect(c.sfx);
  const nodes: AudioScheduledSourceNode[] = [];
  if (kind === "flame") {
    // a gas roar: a low rumble, a mid "whoomph" band that gusts, and a hiss of the jets
    const dark = c.ac.createBiquadFilter(); dark.type = "lowpass"; dark.frequency.value = 2200; dark.Q.value = 0.5; dark.connect(gain);
    nodes.push(loopNoise(c, dark, "lowpass", 260, 0.6, 0.9).src);
    const mid = loopNoise(c, dark, "bandpass", 650, 0.8, 0.45); nodes.push(mid.src);
    nodes.push(loopNoise(c, dark, "bandpass", 1500, 1.2, 0.08).src); // the jets' hiss, kept under 2 kHz
    nodes.push(gust(c, mid.gain.gain, 0.5));
  } else {
    // four rotors: two slightly detuned buzzes through a band, with a flutter
    const top = c.ac.createBiquadFilter(); top.type = "lowpass"; top.frequency.value = 2400; top.Q.value = 0.5; top.connect(gain);
    const band = c.ac.createBiquadFilter(); band.type = "bandpass"; band.frequency.value = 520; band.Q.value = 1.2; band.connect(top);
    for (const f of [178, 183.5]) { const os = c.ac.createOscillator(); os.type = "sawtooth"; os.frequency.value = f; const g = c.ac.createGain(); g.gain.value = 0.35; os.connect(g).connect(band); os.start(); nodes.push(os); }
    nodes.push(loopNoise(c, top, "bandpass", 1500, 1, 0.25).src);
    const lfo = c.ac.createOscillator(); lfo.frequency.value = 11; const d = c.ac.createGain(); d.gain.value = 0.25; lfo.connect(d).connect(gain.gain); lfo.start(); nodes.push(lfo);
  }
  return { gain, pan, nodes };
}
/** every frame: the flame jets' roar while they burn (on the player's own hull) and the drone's rotors where it flies */
export function updateGadgetAudio(flame: boolean, drone: Where | null) {
  const c = ctx; if (!c) return;
  const t = c.ac.currentTime;
  for (const [kind, on, w, peak] of [["flame", flame, {} as Where, 0.5], ["drone", !!drone, drone ?? {}, 0.16]] as const) {
    let v = gadgetLoops[kind];
    if (on) v ??= gadgetLoops[kind] = startGadgetLoop(c, kind);
    if (!v) continue;
    if (!on) {
      v.gain.gain.setTargetAtTime(0, t, 0.12);
      const dead = v; gadgetLoops[kind] = null;
      window.setTimeout(() => { for (const n of dead.nodes) { try { n.stop(); } catch { /* stopped */ } } dead.gain.disconnect(); dead.pan.disconnect(); }, 900);
      continue;
    }
    v.gain.gain.setTargetAtTime(peak / ((w.dist ?? 0) * 0.06 + 1), t, kind === "flame" ? 0.05 : 0.2);
    v.pan.pan.setTargetAtTime(Math.max(-0.85, Math.min(0.85, w.pan ?? 0)), t, 0.15);
  }
}

/** an enemy grenade's fuse beep (positional, short, cutting through the mix so the player hears where it is) */
export function playGrenadeBeep(w: Where = {}) {
  const c = ctx; if (!c) return;
  tone(c, out(c, w), { f0: 2900, f1: 2900, dur: 0.05, type: "square", gain: 0.09 });
}
