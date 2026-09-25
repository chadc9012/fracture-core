export type EnemyArchetype = "BRUTE" | "TRACKER" | "SUPPRESSOR" | "ADAPTIVE_ELITE";
export type PerceptionSignal = { distance: number; visible: boolean; sound: number; damageReceived: number; playerVelocity: number; coverScore: number };
export type ThreatProfile = { score: number; priority: "LOW" | "MEDIUM" | "HIGH"; reason: string };
export type FightMemory = { repeatedDashes: number; shieldSeconds: number; rangedDamage: number; lastCounterAt: number; counter: string | null };
export type EnemyDecision = { action: "ADVANCE" | "FLANK" | "SUPPRESS" | "DISENGAGE" | "TELEGRAPH_COUNTER"; tell: string; escapeLane: boolean };

export const ARCHETYPE_MODIFIERS: Record<EnemyArchetype, { armor: number; pursuit: number; suppression: number; adaptationDelay: number }> = {
  BRUTE: { armor: 1.45, pursuit: 0.72, suppression: 0.45, adaptationDelay: 8 },
  TRACKER: { armor: 0.82, pursuit: 1.35, suppression: 0.65, adaptationDelay: 7 },
  SUPPRESSOR: { armor: 1, pursuit: 0.8, suppression: 1.5, adaptationDelay: 9 },
  ADAPTIVE_ELITE: { armor: 1.2, pursuit: 1.1, suppression: 1.1, adaptationDelay: 12 },
};

export function scoreThreat(signal: PerceptionSignal): ThreatProfile {
  const proximity = Math.max(0, 35 - signal.distance) * 1.4;
  const score = Math.round(proximity + (signal.visible ? 24 : 0) + signal.sound * 12 + signal.damageReceived * 1.8 + signal.playerVelocity * 3 - signal.coverScore * 8);
  return { score, priority: score >= 70 ? "HIGH" : score >= 35 ? "MEDIUM" : "LOW", reason: signal.damageReceived > 12 ? "incoming damage" : signal.visible ? "visual contact" : "sound trace" };
}

export function chooseEnemyDecision(archetype: EnemyArchetype, threat: ThreatProfile, memory: FightMemory, elapsed: number): EnemyDecision {
  const mods = ARCHETYPE_MODIFIERS[archetype];
  const canAdapt = archetype === "ADAPTIVE_ELITE" && elapsed - memory.lastCounterAt >= mods.adaptationDelay;
  if (canAdapt && (memory.repeatedDashes >= 3 || memory.shieldSeconds >= 6 || memory.rangedDamage >= 80)) return { action: "TELEGRAPH_COUNTER", tell: memory.repeatedDashes >= 3 ? "Anchor field charging" : memory.shieldSeconds >= 6 ? "Disruptor strike charging" : "Reflective plating visible", escapeLane: true };
  if (threat.priority === "LOW") return { action: "ADVANCE", tell: "Searching", escapeLane: true };
  if (archetype === "TRACKER") return { action: "FLANK", tell: "Tracker beacon sweeping", escapeLane: true };
  if (archetype === "SUPPRESSOR") return { action: "SUPPRESS", tell: "Suppression cone projected", escapeLane: true };
  return { action: threat.priority === "HIGH" ? "DISENGAGE" : "ADVANCE", tell: threat.priority === "HIGH" ? "Armor vents opening" : "Heavy steps approaching", escapeLane: true };
}