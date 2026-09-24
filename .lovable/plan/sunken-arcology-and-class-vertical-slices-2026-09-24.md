# Sunken Arcology and Class Vertical Slices

## Build
- Expand Sunken Arcology Vaults into a deterministic five-stage runtime: Burial Gates, Archive Corridors, Data Flood Chambers, Core Shaft, and Archive Guardian.
- Model objectives, enemy groups, triggers, sand pressure, route choices, node defense, rewards, shared lives, scaling, fail states, and four boss phases as typed game data.
- Add three selectable training missions: Titan’s Burial Gates Prototype, Hunter’s Velocity Protocol, and Warlock’s Synthesis Fracture.
- Reuse the current encounter runner so stages advance, hazards escalate, checkpoints work, and completion rewards persist.

## Combat and Enemy Systems
- Add a shared data-driven ability engine with common inputs, cooldowns, costs, effects, combat states, class modifiers, and cross-class synergy rules.
- Add a unified enemy intelligence model for perception, threat scoring, Brute/Tracker/Suppressor/Adaptive archetypes, and fair observe → counter → pressure adaptation.
- Keep adaptation fight-local, delayed, readable, and unable to hard-lock movement.

## Progression and Interface
- Extend saved progression with per-ability mastery, chosen evolution branches, modifiers, tokens, and shards using a backwards-safe version upgrade.
- Build a premium ability screen with character identity, loadout slots, ability detail, mastery, three evolution branches, synergy visualization, recommendations, and explicit apply controls.
- Update dungeon operations to expose stage flow, sand pressure, boss phases, route choices, class training missions, and rewards.
- Keep all player-facing naming under WORLD FRACTURE and use “Core Guidance” for system narration.

## Technical Details
- New runtime data remains browser-safe TypeScript and plugs into `raid-stages.ts`, `dungeons.ts`, existing progression, and Operations Hub.
- The full 20–40 minute dungeon is represented as runnable encounter data; the preview provides deterministic controls for validating every stage without waiting real time.
- Multiplayer is represented through scaling and sync-safe event contracts only; no network service is added in this slice.

## Verification
- Run the full TypeScript check and inspect the preview build report.
- Test dungeon launch, stage progression, sand pressure, boss phases, ability evolution/apply flow, persistence, and mobile layout.
- Audit removed legacy names and ensure no player-facing reintroduction.
