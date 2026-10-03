import { createParser } from "eventsource-parser";
import { voiceLive } from "./voice-animation";

export type VoicePriority = "ambient" | "story" | "critical";
export type VoiceLine = { id: string; scope: string; speaker: string; text: string; priority?: VoicePriority };
export type VoiceStatus = { state: "idle" | "loading" | "speaking" | "unavailable"; speaker?: string; text?: string; message?: string };

type QueuedLine = VoiceLine & { rank: number };
const rank = { ambient: 1, story: 2, critical: 3 } as const;
const queue: QueuedLine[] = [];
const spoken = new Set<string>();
const listeners = new Set<(status: VoiceStatus) => void>();
let enabled = true;
let volume = 0.85;
let heavyLoad = false;
let active: { line: QueuedLine; controller: AbortController } | null = null;
let processing = false;

/* ---- decoded-line cache (LRU) so replays/barks start instantly with no new request ---- */
const CACHE_LIMIT = 40;
const cache = new Map<string, Float32Array[]>();
const cacheKey = (speaker: string, text: string) => `${speaker.toUpperCase()}|${text}`;
const cacheGet = (key: string) => { const v = cache.get(key); if (v) { cache.delete(key); cache.set(key, v); } return v; };
const cachePut = (key: string, chunks: Float32Array[]) => { cache.set(key, chunks); while (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value as string); };

/* ---- one shared audio graph: context → gain → analyser → destination ---- */
let ctx: AudioContext | null = null;
let gain: GainNode | null = null;
let analyser: AnalyserNode | null = null;
let levelBuf: Uint8Array<ArrayBuffer> | null = null;
let meterRaf = 0;
function graph() {
  if (ctx) return ctx;
  const Ctor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) throw new Error("This browser cannot play spoken dialogue.");
  ctx = new Ctor({ sampleRate: 24000 });
  gain = ctx.createGain(); gain.gain.value = volume;
  analyser = ctx.createAnalyser(); analyser.fftSize = 256;
  levelBuf = new Uint8Array(new ArrayBuffer(analyser.fftSize));
  gain.connect(analyser); analyser.connect(ctx.destination);
  return ctx;
}
function meter() {
  if (!analyser || !levelBuf) return;
  analyser.getByteTimeDomainData(levelBuf);
  let sum = 0;
  for (let i = 0; i < levelBuf.length; i++) { const v = (levelBuf[i]! - 128) / 128; sum += v * v; }
  voiceLive.level(Math.min(1, Math.sqrt(sum / levelBuf.length) * 5));
  meterRaf = requestAnimationFrame(meter);
}

const emit = (status: VoiceStatus) => listeners.forEach((listener) => listener(status));

export function subscribeVoice(listener: (status: VoiceStatus) => void) {
  listeners.add(listener);
  listener({ state: "idle" });
  return () => { listeners.delete(listener); };
}

export function configureVoice(next: { enabled: boolean; volume: number }) {
  enabled = next.enabled;
  volume = Math.min(1, Math.max(0, next.volume));
  if (gain && ctx) gain.gain.setTargetAtTime(volume, ctx.currentTime, 0.05);
  if (!enabled || volume === 0) stopVoice();
}

/** Scene reports heavy combat / low frame rate; ambient barks are skipped while true. */
export function setVoiceLoad(heavy: boolean) { heavyLoad = heavy; }

export function speakVoice(line: VoiceLine) {
  if (!line.text.trim() || spoken.has(line.id) || queue.some((item) => item.id === line.id) || active?.line.id === line.id) return;
  if (!enabled || volume === 0) {
    // captions-only: still drive faces from caption timing
    voiceLive.start(line.speaker, line.text, true);
    return;
  }
  if (heavyLoad && (line.priority ?? "story") === "ambient") return;
  prefetchAbort?.abort("superseded");
  const item: QueuedLine = { ...line, rank: rank[line.priority ?? "story"] };
  if (active && item.rank > active.line.rank) active.controller.abort("interrupted");
  queue.push(item);
  queue.sort((a, b) => b.rank - a.rank);
  void processQueue();
}

export function stopVoice(scope?: string) {
  if (!scope || active?.line.scope === scope) active?.controller.abort("stopped");
  if (scope) {
    for (let i = queue.length - 1; i >= 0; i--) if (queue[i]?.scope === scope) queue.splice(i, 1);
  } else queue.length = 0;
  emit({ state: "idle" });
}

/* ---- prefetch: fetch the next likely line while idle (one request at a time) ---- */
let prefetchAbort: AbortController | null = null;
const prefetchQueue: { speaker: string; text: string }[] = [];
export function prefetchVoice(_id: string, text: string, speaker: string) {
  if (!enabled || volume === 0 || !text.trim() || cache.has(cacheKey(speaker, text))) return;
  if (prefetchQueue.some((p) => p.text === text && p.speaker === speaker)) return;
  prefetchQueue.push({ speaker, text });
  const run = () => void drainPrefetch();
  const idle = (window as typeof window & { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback;
  if (idle) idle(run); else setTimeout(run, 200);
}
async function drainPrefetch() {
  if (processing || prefetchAbort) return;
  const next = prefetchQueue.shift();
  if (!next) return;
  prefetchAbort = new AbortController();
  try {
    const chunks: Float32Array[] = [];
    await stream(next.speaker, next.text, prefetchAbort.signal, (s) => chunks.push(s));
    cachePut(cacheKey(next.speaker, next.text), chunks);
  } catch { /* prefetch is best effort; no retry */ }
  finally { prefetchAbort = null; }
  if (prefetchQueue.length && !processing) void drainPrefetch();
}

function decodePCM(pending: Uint8Array, incoming: Uint8Array) {
  const bytes = new Uint8Array(pending.length + incoming.length);
  bytes.set(pending); bytes.set(incoming, pending.length);
  const usable = bytes.length - (bytes.length % 2);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const samples = new Float32Array(usable / 2);
  for (let i = 0; i < samples.length; i++) samples[i] = view.getInt16(i * 2, true) / 32768;
  return { samples, pending: bytes.slice(usable) };
}

async function stream(speaker: string, text: string, signal: AbortSignal, onChunk: (samples: Float32Array) => void) {
  const response = await fetch("/api/voice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, speaker }), signal });
  if (!response.ok || !response.body) {
    const body = await response.json().catch(() => ({ message: "Spoken dialogue is unavailable." })) as { message?: string };
    throw new Error(body.message ?? "Spoken dialogue is unavailable.");
  }
  let pending = new Uint8Array(0);
  let completed = false;
  let total = 0;
  const parser = createParser({ onEvent(event) {
    const payload = JSON.parse(event.data) as { type?: string; audio?: string; error?: unknown; message?: string };
    if (payload.type === "error" || payload.error) throw new Error(payload.message ?? "Spoken dialogue was blocked.");
    if (payload.type === "speech.audio.done") { completed = true; return; }
    if (payload.type !== "speech.audio.delta" || !payload.audio || completed) return;
    const decoded = decodePCM(pending, Uint8Array.from(atob(payload.audio), (c) => c.charCodeAt(0)));
    pending = decoded.pending;
    if (decoded.samples.length) { total += decoded.samples.length; onChunk(decoded.samples); }
  }});
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  try { while (true) { const next = await reader.read(); if (next.done) break; parser.feed(next.value); } parser.reset({ consume: true }); }
  finally { reader.releaseLock(); }
  if (!completed || !total || pending.length) throw new Error("The spoken line ended early. Captions remain active.");
}

async function play(line: QueuedLine, signal: AbortSignal) {
  const key = cacheKey(line.speaker, line.text);
  const cached = cacheGet(key);
  emit({ state: cached ? "speaking" : "loading", speaker: line.speaker, text: line.text });
  const context = graph();
  if (context.state === "suspended") await context.resume();
  // per-line fade node so interruptions fade instead of clicking
  const fade = context.createGain();
  fade.gain.value = 1; fade.connect(gain!);
  const sources = new Set<AudioBufferSourceNode>();
  let playhead = 0;
  let lastPlayback = Promise.resolve();
  let started = false;
  const schedule = (samples: Float32Array) => {
    const buffer = context.createBuffer(1, samples.length, 24000);
    buffer.copyToChannel(samples as Float32Array<ArrayBuffer>, 0);
    const source = context.createBufferSource();
    source.buffer = buffer; source.connect(fade); sources.add(source);
    lastPlayback = new Promise<void>((resolve) => { source.onended = () => { sources.delete(source); resolve(); }; });
    playhead = Math.max(playhead, context.currentTime + 0.05);
    source.start(playhead); playhead += buffer.duration;
    if (!started) { started = true; voiceLive.start(line.speaker, line.text); cancelAnimationFrame(meterRaf); meterRaf = requestAnimationFrame(meter); emit({ state: "speaking", speaker: line.speaker, text: line.text }); }
  };
  const abort = () => {
    const now = context.currentTime;
    fade.gain.cancelScheduledValues(now); fade.gain.setValueAtTime(fade.gain.value, now); fade.gain.linearRampToValueAtTime(0, now + 0.12);
    for (const source of sources) { try { source.stop(now + 0.13); } catch { /* stopped */ } }
  };
  signal.addEventListener("abort", abort, { once: true });
  try {
    if (cached) cached.forEach(schedule);
    else {
      const chunks: Float32Array[] = [];
      await stream(line.speaker, line.text, signal, (s) => { chunks.push(s); schedule(s); });
      cachePut(key, chunks);
    }
    await lastPlayback;
    signal.throwIfAborted();
  } finally {
    signal.removeEventListener("abort", abort);
    if (signal.aborted) await new Promise((r) => setTimeout(r, 140));
    for (const source of sources) { try { source.stop(); } catch { /* stopped */ } }
    fade.disconnect();
    cancelAnimationFrame(meterRaf);
    voiceLive.end();
  }
}

async function processQueue() {
  if (processing) return;
  processing = true;
  let failed = false;
  while (queue.length && enabled && volume > 0) {
    const line = queue.shift();
    if (!line) break;
    const controller = new AbortController();
    active = { line, controller };
    try { await play(line, controller.signal); spoken.add(line.id); }
    catch (error) {
      if (!controller.signal.aborted) {
        failed = true;
        voiceLive.start(line.speaker, line.text, true);
        emit({ state: "unavailable", speaker: line.speaker, text: line.text, message: error instanceof Error ? error.message : "Spoken dialogue is unavailable." });
      }
    } finally { if (active?.line.id === line.id) active = null; }
  }
  processing = false;
  if (!active && !failed) emit({ state: "idle" });
  if (prefetchQueue.length) void drainPrefetch();
}
