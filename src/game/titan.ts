export type TitanFeedback = "PERFECT BLOCK" | "SHIELD OVERLOAD" | "ENERGY CHARGED" | "STABILITY HIGH" | "";

export type TitanState = {
  shield: number;
  energy: number;
  stability: number;
  blocking: boolean;
  shieldBroken: number;
  blockStartedAt: number;
  bashCooldown: number;
  domeCooldown: number;
  domeTime: number;
  storedDamage: number;
  feedback: TitanFeedback;
  feedbackTime: number;
};

export const createTitanState = (): TitanState => ({
  shield: 100, energy: 0, stability: 55, blocking: false, shieldBroken: 0,
  blockStartedAt: -10, bashCooldown: 0, domeCooldown: 0, domeTime: 0,
  storedDamage: 0, feedback: "", feedbackTime: 0,
});

export function tickTitan(titan: TitanState, dt: number) {
  titan.shieldBroken = Math.max(0, titan.shieldBroken - dt);
  titan.bashCooldown = Math.max(0, titan.bashCooldown - dt);
  titan.domeCooldown = Math.max(0, titan.domeCooldown - dt);
  titan.domeTime = Math.max(0, titan.domeTime - dt);
  titan.feedbackTime = Math.max(0, titan.feedbackTime - dt);
  if (titan.feedbackTime === 0) titan.feedback = "";
  if (!titan.blocking && titan.shieldBroken === 0) titan.shield = Math.min(100, titan.shield + dt * (5 + titan.stability * 0.05));
  titan.stability = Math.max(0, Math.min(100, titan.stability - dt * (titan.blocking ? 0.8 : 0.12)));
}

export function absorbTitanDamage(titan: TitanState, damage: number, nowSeconds: number) {
  if (titan.domeTime > 0) return 0;
  if (!titan.blocking || titan.shieldBroken > 0) {
    titan.stability = Math.max(0, titan.stability - damage * 1.2);
    return damage;
  }
  const perfectWindow = 0.3 + titan.stability * 0.003;
  const perfect = nowSeconds - titan.blockStartedAt <= perfectWindow;
  const absorbed = Math.min(titan.shield, damage * (perfect ? 1.35 : 0.72));
  titan.shield -= absorbed;
  titan.storedDamage = Math.min(60, titan.storedDamage + absorbed);
  titan.energy = Math.min(100, titan.energy + absorbed * (perfect ? 0.6 : 0.28));
  titan.stability = Math.min(100, titan.stability + (perfect ? 12 : 2));
  if (perfect) { titan.feedback = "PERFECT BLOCK"; titan.feedbackTime = 1.2; }
  if (titan.energy >= 90) { titan.feedback = "ENERGY CHARGED"; titan.feedbackTime = 1.2; }
  if (titan.shield <= 0) { titan.shieldBroken = 2.5; titan.blocking = false; titan.feedback = "SHIELD OVERLOAD"; titan.feedbackTime = 1.6; }
  return Math.max(0, damage - absorbed);
}