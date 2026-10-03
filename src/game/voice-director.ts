import { createParser } from "eventsource-parser";

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
let active: { line: QueuedLine; controller: AbortController } | null = null;
let processing = false;

const emit = (status: VoiceStatus) => listeners.forEach((listener) => listener(status));

export function subscribeVoice(listener: (status: VoiceStatus) => void) {
  listeners.add(listener);
  listener({ state: "idle" });
  return () => { listeners.delete(listener); };
}

export function configureVoice(next: { enabled: boolean; volume: number }) {
  enabled = next.enabled;
  volume = Math.min(1, Math.max(0, next.volume));
  if (!enabled || volume === 0) stopVoice();
}

export function speakVoice(line: VoiceLine) {
  if (!enabled || volume === 0 || !line.text.trim() || spoken.has(line.id) || queue.some((item) => item.id === line.id) || active?.line.id === line.id) return;
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

function decodePCM(pending: Uint8Array, incoming: Uint8Array) {
  const bytes = new Uint8Array(pending.length + incoming.length);
  bytes.set(pending); bytes.set(incoming, pending.length);
  const usable = bytes.length - (bytes.length % 2);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const samples = new Float32Array(usable / 2);
  for (let i = 0; i < samples.length; i++) samples[i] = view.getInt16(i * 2, true) / 32768;
  return { samples, pending: bytes.slice(usable) };
}

async function play(line: QueuedLine, signal: AbortSignal) {
  emit({ state: "loading", speaker: line.speaker, text: line.text });
  const response = await fetch("/api/voice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: line.text, speaker: line.speaker }),
    signal,
  });
  if (!response.ok || !response.body) {
    const body = await response.json().catch(() => ({ message: "Spoken dialogue is unavailable." })) as { message?: string };
    throw new Error(body.message ?? "Spoken dialogue is unavailable.");
  }
  const AudioContextCtor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) throw new Error("This browser cannot play spoken dialogue.");
  const context = new AudioContextCtor({ sampleRate: 24000 });
  const gain = context.createGain();
  gain.gain.value = volume;
  gain.connect(context.destination);
  const sources = new Set<AudioBufferSourceNode>();
  let playhead = 0;
  let pending = new Uint8Array(0);
  let completed = false;
  let samplesPlayed = 0;
  let lastPlayback = Promise.resolve();
  const abort = () => { for (const source of sources) { try { source.stop(); } catch { /* already stopped */ } } };
  signal.addEventListener("abort", abort, { once: true });
  try {
    if (context.state === "suspended") await context.resume();
    const parser = createParser({ onEvent(event) {
      const payload = JSON.parse(event.data) as { type?: string; audio?: string; error?: unknown; message?: string };
      if (payload.type === "error" || payload.error) throw new Error(payload.message ?? "Spoken dialogue was blocked.");
      if (payload.type === "speech.audio.done") { completed = true; return; }
      if (payload.type !== "speech.audio.delta" || !payload.audio || completed) return;
      const decoded = decodePCM(pending, Uint8Array.from(atob(payload.audio), (char) => char.charCodeAt(0)));
      pending = decoded.pending;
      if (!decoded.samples.length) return;
      samplesPlayed += decoded.samples.length;
      const buffer = context.createBuffer(1, decoded.samples.length, 24000);
      buffer.copyToChannel(decoded.samples, 0);
      const source = context.createBufferSource();
      source.buffer = buffer; source.connect(gain); sources.add(source);
      lastPlayback = new Promise<void>((resolve) => { source.onended = () => { sources.delete(source); resolve(); }; });
      playhead = Math.max(playhead, context.currentTime + 0.05);
      source.start(playhead); playhead += buffer.duration;
      emit({ state: "speaking", speaker: line.speaker, text: line.text });
    }});
    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    try { while (true) { const next = await reader.read(); if (next.done) break; parser.feed(next.value); } parser.reset({ consume: true }); }
    finally { reader.releaseLock(); }
    if (!completed || !samplesPlayed || pending.length) throw new Error("The spoken line ended early. Captions remain active.");
    await lastPlayback;
    signal.throwIfAborted();
  } finally {
    signal.removeEventListener("abort", abort);
    abort();
    await context.close();
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
        emit({ state: "unavailable", speaker: line.speaker, text: line.text, message: error instanceof Error ? error.message : "Spoken dialogue is unavailable." });
      }
    } finally { if (active?.line.id === line.id) active = null; }
  }
  processing = false;
  if (!active && !failed) emit({ state: "idle" });
}