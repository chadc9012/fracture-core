import type { VehicleId } from "./vehicles";

export type EngineVoice = { base: number; type: OscillatorType; cutoff: number; ignition: number };
/** Authored voices, not random pitch hashes; upgrade ratio uses the real tuned speed. */
export const ENGINE_VOICES: Record<VehicleId, EngineVoice> = {
  "scrap-interceptor": { base: 48, type: "sawtooth", cutoff: 850, ignition: 0.8 },
  "goliath-tank": { base: 30, type: "square", cutoff: 420, ignition: 1.4 },
  "wasteland-jeep": { base: 58, type: "sawtooth", cutoff: 680, ignition: 0.95 },
  "aether-hoverbike": { base: 125, type: "sine", cutoff: 1800, ignition: 0.42 },
  "tech-transport": { base: 36, type: "triangle", cutoff: 560, ignition: 1.1 },
  "rift-helicopter": { base: 72, type: "square", cutoff: 920, ignition: 1.6 },
  "vanguard-jet": { base: 160, type: "sawtooth", cutoff: 2200, ignition: 1.2 },
  "void-skimmer": { base: 95, type: "sine", cutoff: 1400, ignition: 0.65 },
  "scrap-patrol-boat": { base: 42, type: "sawtooth", cutoff: 610, ignition: 1.05 },
  "hydro-sub-skiff": { base: 66, type: "triangle", cutoff: 380, ignition: 0.75 },
  leviathan: { base: 24, type: "triangle", cutoff: 300, ignition: 1.8 },
  "raider-buggy": { base: 88, type: "square", cutoff: 1250, ignition: 0.5 },
  "ai-interceptor": { base: 112, type: "triangle", cutoff: 1650, ignition: 0.55 },
  "fracture-behemoth": { base: 20, type: "sawtooth", cutoff: 460, ignition: 2 },
};
export function engineVoice(id: string, speedRatio = 1): EngineVoice {
  const v = ENGINE_VOICES[id as VehicleId] ?? ENGINE_VOICES["scrap-interceptor"];
  const k = Math.min(1.6, Math.max(1, speedRatio));
  return { ...v, base: v.base * (1 + (k - 1) * 0.22), cutoff: v.cutoff * k, ignition: v.ignition / Math.sqrt(k) };
}
/** RPM is a synthesized drive readout, not a simulated gearbox or fuel system. */
export function driveTelemetry(id: string, speed01: number, throttle: number, ratio = 1) {
  const v = engineVoice(id, ratio);
  return { rpm: Math.round(v.base * (1 + Math.min(1, Math.abs(speed01)) * 2.4 + Math.max(0, Math.min(1, throttle)) * 0.5) * 30) };
}