/**
 * Floating damage numbers, Destiny style (pure; sim.ts records, DamageNumbers.tsx draws, the "Damage numbers" setting hides them).
 * Every source of the player's damage passes through applyMachineDamageMods, which records the final amount above the
 * enemy it hit: white for a body hit, gold for a precision (head-band) hit, larger for a big one.
 *  - Display units: sim hit points x `DISPLAY_SCALE` (a 1.4 hp rifle hit reads 140, a boss's 360 hp reads 36,000), rounded.
 *  - Hits on the same enemy within `MERGE_SECONDS` add into one number (a shotgun's pellets, a fusion volley, an SMG
 *    stream), so fast guns do not bury the screen; a precision hit makes the merged number gold.
 *  - Each number rises and fades over `LIFE` s; at most `MAX_LIVE` at once (the oldest goes).
 */
export const DISPLAY_SCALE = 100;
export const MERGE_SECONDS = 0.12;
export const LIFE = 0.9;
export const MAX_LIVE = 24;
/** a hit at least this share of the enemy's health is drawn big */
export const BIG_SHARE = 0.5;

export type DamageNumber = { id: number; target: number; x: number; y: number; z: number; amount: number; crit: boolean; big: boolean; at: number; last: number };
export type DamageNumbers = { list: DamageNumber[]; nextId: number };
export const freshDamageNumbers = (): DamageNumbers => ({ list: [], nextId: 1 });

/** record a hit of `amount` hp on enemy `target` (its index) at a world point; merges into a fresh number on the same target */
export function recordDamage(s: DamageNumbers, hit: { target: number; x: number; y: number; z: number; amount: number; crit: boolean; maxHp: number; now: number }) {
  if (!(hit.amount > 0) || !Number.isFinite(hit.amount)) return;
  const live = s.list.find((n) => n.target === hit.target && hit.now - n.last <= MERGE_SECONDS && hit.now - n.at < LIFE * 0.5);
  if (live) {
    live.amount += hit.amount; live.crit ||= hit.crit; live.last = hit.now;
    live.big ||= live.amount >= hit.maxHp * BIG_SHARE;
    return;
  }
  // spread fresh numbers a little so back-to-back hits on one enemy don't stack on one pixel
  const k = s.nextId;
  s.list.push({ id: s.nextId++, target: hit.target, x: hit.x + Math.sin(k * 2.4) * 0.35, y: hit.y, z: hit.z + Math.cos(k * 2.4) * 0.35, amount: hit.amount, crit: hit.crit, big: hit.amount >= hit.maxHp * BIG_SHARE, at: hit.now, last: hit.now });
  while (s.list.length > MAX_LIVE) s.list.shift();
}

/** drop numbers that have faded out */
export function pruneDamage(s: DamageNumbers, now: number) {
  if (s.list.length && now - s.list[0]!.at > LIFE) s.list = s.list.filter((n) => now - n.at <= LIFE);
}

/** the text a number shows */
export const damageText = (amount: number) => Math.max(1, Math.round(amount * DISPLAY_SCALE)).toLocaleString("en-US");

/** how a number looks `age` s after it appeared: metres risen, opacity, scale (a short pop, bigger for crits and big hits) */
export function damageFrame(n: Pick<DamageNumber, "crit" | "big">, age: number): { rise: number; opacity: number; scale: number } | null {
  if (age < 0 || age > LIFE) return null;
  const t = age / LIFE;
  const pop = age < 0.08 ? 1 + 0.6 * (1 - age / 0.08) : 1;
  const base = (n.big ? 1.35 : 1) * (n.crit ? 1.15 : 1);
  return { rise: 0.9 * (1 - (1 - t) * (1 - t)), opacity: t < 0.65 ? 1 : 1 - (t - 0.65) / 0.35, scale: base * pop };
}
