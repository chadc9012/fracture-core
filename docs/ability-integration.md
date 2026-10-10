# Live ability integration (Phase 2.1)

Source of truth: `ability-network.ts` (names, branches) · `combat-engine.ts` (cost, cooldown, effect numbers) · `live-build.ts` (energy, cooldown, timers) · **`ability-effects.ts` (what a cast does to the sim)** · `ability-hud.ts` (what the HUD shows).
Input: keyboard Q / E / R, or controller chord (hold View + X / Y / B; rebindable). Costs below are base energy; Utility branch ×0.85. Cipher builds run cooldowns ×0.9 (existing synergy).

| Operator | Slot | Ability | Cost / CD | Authoritative effect (sim) | Valid targets / refusal | Event / HUD |
|---|---|---|---|---|---|---|
| Goliath | Q | Siege Mode | 25 / 25 s | 8 s: outgoing damage ×1.3 (sim.verbDamageMult), move ×0.8, bloom ×0.5 | self | CAST · HUD ACTIVE then cooldown |
| Goliath | E | Kinetic Slam | 20 / 18 s | radius 14 m: 3 dmg through shared damage rules, 6 m knockback (not bosses), 1.2 s stun (bosses capped 1.4 s), wind-up interrupted, boss poise | every living machine in range; area, so never "no target" | CAST hits/bossHits/kills/radius |
| Goliath | R | Bastion Shield | 40 / 24 s | 10 s barrier: hurtPlayer negates all damage (any class) | self | CAST · lastBlockedAt on absorbed hit |
| Nyx | Q | Phase Veil | 15 / 18 s | 6 s: enemy sight ×0.15 (sim.stealthMult); breaks to 0.4 s on attack (Scene) | self | CAST |
| Nyx | E | Rift Dash | 12 / 10 s | 11 m along facing, stops before solid obstacles; 0.28 s real i-frames (sim.iframes); +speed/heal window | self | CAST (event x/z = landing) |
| Nyx | R | Shadow Strike | 35 / 22 s | teleport behind nearest enemy ≤16 m, 4 dmg (8 under Veil), stun, interrupt, ends Veil | **refused NO_TARGET if none in reach (no cost, no cooldown)** | CAST / REJECTED |
| Cipher | Q | Recon Swarm | 18 / 20 s | enemies ≤30 m take ×1.25 damage for 8 s (vulnMult, via shared damage rules) | area | CAST hits |
| Cipher | E | Disruption Pulse | 24 / 18 s | ≤14 m: 5 s stun (bosses capped 1.4 s + 15 poise), wind-ups cancelled; field keeps ordinary enemies from firing while it lasts, never bosses | area | CAST hits/bossHits |
| Cipher | R | Rift Turret | 45 / 30 s | up to 2 turrets, 20 s, shots use shared damage rules (boss poise, participation) | self (placed ahead) | CAST |

Branches (Power +18% effect · Control +25% duration · Utility −15% cost) apply through `branch-effects.ts` for every ability above.
Refusals (`COOLDOWN`, `ENERGY`, `NO_TARGET`, `NO_ABILITY`, `IN_VEHICLE`) spend nothing and are logged as REJECTED events; the HUD shows READY / ACTIVE / COOLDOWN (seconds) / NO_ENERGY (cost).
Death/respawn: `cancelAbilities` clears timers, barrier, i-frames, queued verbs, turrets and cooldowns, keeps the build, logs CANCELLED.

## Defects found and fixed
- Shadow Strike with no target spent energy and cooldown.
- Slam / Strike / turrets bypassed boss poise, Weaken/Marked and Unique Scenario rules, and did not count toward Dark Knight reward participation.
- Recon Swarm left a permanent ×1.25 outgoing-damage buff.
- Rift Dash claimed to avoid damage but only healed; now real i-frames.
- Bastion Shield did nothing unless the class was Goliath; now a sim-level barrier.
- Disruption Pulse's field and the stun hard-locked bosses.
- Death/respawn left Siege/Veil/Dash/verb timers, cooldowns and turrets running.
- HUD ability row came from the class definition, ignored energy and showed no cooldown; controller had no ability input at all.

## Known gaps (not changed)
- Goliath's native Q block / E bash / R dome (titan.ts) share the same keys as the Q / E / R abilities when playing Goliath; both fire. Pre-existing design.
- Mirror Plate (`shieldReflect`) only changes enemy posture; no reflected damage.
- Recon Swarm marks and weakens; there is no separate "reveal" overlay.
- Ability hits do not build Null Charge (the perk is bullets-only by design).
