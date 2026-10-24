/** Fracture-shard gain visual (owner's trailer, "a glass shard tumbling through light streaks", listed as planned in
 * docs/trailer-references.md): whenever the save's fractureShards go up, a few glass shards burst from the operator, tumble upward
 * and fade, each trailing a light streak. Presentation only: it reads the shard total, never grants or spends anything.
 * Pure (counts and trajectories, seeded) so the rules stay testable apart from rendering. */
export const SHARD_FX = { maxShards: 8, life: 1.7, rise: [3.2, 5.6] as const, spread: 1.6, spin: [4, 11] as const } as const;

/** a gain worth showing: only increases, never the first value seen (loading a save is not a reward) */
export function shardGain(prev: number | undefined, next: number | undefined): number {
  if (prev === undefined || next === undefined || !Number.isFinite(prev) || !Number.isFinite(next)) return 0;
  return next > prev ? next - prev : 0;
}

/** how many shards to throw for a gain: grows with the amount (log scale), 1..maxShards */
export function shardCount(gain: number): number {
  if (gain <= 0) return 0;
  return Math.max(1, Math.min(SHARD_FX.maxShards, Math.round(1 + Math.log10(gain) * 2.5)));
}

export type ShardFlight = { vx: number; vy: number; vz: number; ax: number; ay: number; az: number; spin: number; scale: number; delay: number };

function rng(seed: number) { let s = seed >>> 0 || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

/** per-shard flights for one burst (deterministic per seed): up and outward, each spinning about its own axis, slightly staggered */
export function shardFlights(count: number, seed: number): ShardFlight[] {
  const r = rng(seed), out: ShardFlight[] = [];
  for (let i = 0; i < count; i++) {
    const a = (i / Math.max(1, count)) * Math.PI * 2 + r() * 0.8, out1 = SHARD_FX.spread * (0.5 + r() * 0.5);
    const ax = r() - 0.5, ay = r() - 0.5, az = r() - 0.5, l = Math.hypot(ax, ay, az) || 1;
    out.push({
      vx: Math.cos(a) * out1, vz: Math.sin(a) * out1, vy: SHARD_FX.rise[0] + r() * (SHARD_FX.rise[1] - SHARD_FX.rise[0]),
      ax: ax / l, ay: ay / l, az: az / l, spin: SHARD_FX.spin[0] + r() * (SHARD_FX.spin[1] - SHARD_FX.spin[0]),
      scale: 0.16 + r() * 0.12, delay: i * 0.05,
    });
  }
  return out;
}

/** 0..1 visibility over a shard's life: quick fade in, hold, fade out */
export function shardAlpha(t: number): number {
  if (t <= 0 || t >= SHARD_FX.life) return 0;
  const k = t / SHARD_FX.life;
  return Math.min(1, k / 0.08) * (k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4);
}
