/**
 * Speech-driven facial/gesture animation. The voice director publishes a live
 * envelope; animated characters read getVoicePose() inside useFrame. Pure helpers
 * (classifyMood, poseFor, captionEnvelope) are unit tested.
 */
export type VoiceMood = "calm" | "threat" | "urgent";
export type VoicePose = { talking: boolean; jaw: number; glow: number; nod: number; lean: number; tilt: number; arm: number; breathe: number; mood: VoiceMood };

type Live = { speaker: string | null; text: string; level: number; startedAt: number; captionOnly: boolean };
const live: Live = { speaker: null, text: "", level: 0, startedAt: 0, captionOnly: false };

export const voiceLive = {
  start(speaker: string, text: string, captionOnly = false) { live.speaker = speaker.toUpperCase(); live.text = text; live.level = 0; live.startedAt = performance.now(); live.captionOnly = captionOnly; },
  level(value: number) { live.level = value; },
  end() { live.speaker = null; live.level = 0; },
};

export function classifyMood(speaker: string, text: string): VoiceMood {
  if (/OVERSEER|PRIME|CORE|SENTINEL|KING|KRAKEN|WARDEN/i.test(speaker)) return "threat";
  if (/!|now|hurry|incoming|move|danger|warning|critical/i.test(text)) return "urgent";
  return "calm";
}

/** Synthetic envelope from caption timing (~14 chars/s, syllable-rate pulses) for muted playback. */
export function captionEnvelope(elapsedSec: number, text: string): number {
  const duration = Math.max(1.2, text.length / 14);
  if (elapsedSec < 0 || elapsedSec > duration) return 0;
  return 0.35 + 0.35 * Math.abs(Math.sin(elapsedSec * 11)) * (0.6 + 0.4 * Math.sin(elapsedSec * 2.3));
}

export function poseFor(level: number, mood: VoiceMood, t: number): VoicePose {
  const l = Math.min(1, Math.max(0, level));
  const breathe = Math.sin(t * 1.6) * 0.03;
  const base = { talking: l > 0.02, jaw: l * 0.45, glow: 1 + l * 3, breathe, mood };
  if (mood === "threat") return { ...base, nod: 0, lean: 0.12 + l * 0.12, tilt: 0, arm: 0.4 + l * 0.6 };
  if (mood === "urgent") return { ...base, nod: Math.sin(t * 9) * 0.12 * l, lean: 0.06, tilt: 0, arm: 0.25 * l };
  return { ...base, nod: Math.sin(t * 3) * 0.05 * l, lean: 0, tilt: Math.sin(t * 0.9) * 0.12, arm: 0.08 * l };
}

const IDLE: VoicePose = { talking: false, jaw: 0, glow: 1, nod: 0, lean: 0, tilt: 0, arm: 0, breathe: 0, mood: "calm" };

/** Pose for a character; `match` decides whether the current speaker is this character. */
export function getVoicePose(match: (speaker: string) => boolean, t: number): VoicePose {
  if (!live.speaker || !match(live.speaker)) return { ...IDLE, breathe: Math.sin(t * 1.6) * 0.03 };
  const level = live.captionOnly ? captionEnvelope((performance.now() - live.startedAt) / 1000, live.text) : live.level;
  return poseFor(level, classifyMood(live.speaker, live.text), t);
}

export const isBossSpeaker = (s: string) => /OVERSEER|PRIME|CORE|SENTINEL|KING|KRAKEN|WARDEN/i.test(s);
export const isNpcSpeaker = (s: string) => s !== "NOVA" && s !== "NARRATOR" && !isBossSpeaker(s);
