# WORLD FRACTURE — Dungeons, Arsenal, Progression, and Identity

## Goal
Add a complete small-fireteam dungeon and progression layer without weakening the existing open world, raid identity, Mission 01 onboarding, vehicle unlock flow, or Titan/Hunter/Warlock class language. The uploaded images are visual references for composition and equipment presentation, not assets to embed.

## 1. Shared encounter engine and three dungeons
- Create one reusable stage engine for raids and dungeons: stage state, objectives, shared lives, wipes, checkpoints, timers, team size, and completion rewards.
- Define dungeons as private 1–3 player activities lasting 20–40 minutes, with 2–3 linear stages and lower shared lives. Keep raid and world-boss labels distinct.
- Add the three regional dungeons:
  - **Sunken Arcology Vaults / Solara Desert:** timed sand-fill traversal, Architect security construct boss.
  - **Glacial Crevasse Network / Frostspire:** shared cold-exposure resource, heat-source synchronization, cold-venting boss.
  - **Sunken Temple of Echoes / Shrouded Swamps:** reproduce recorded event sequences, time-desynced boss.
- Give each dungeon a fixed named exotic identity with controlled perk variations on repeat clears.
- Add a Dungeon Operations screen showing access, squad rules, stages, hazards, signature reward, and a playable stage run with objective updates, lives, hazard meters, victory, and wipe/retry states.

## 2. Master equipment manifests
- Add deterministic, validated manifests for exactly **122 weapon variants** across the six requested tiers and **92 armor pieces** across the requested progression bands.
- Preserve the current Titan/Hunter/Warlock class system. Convert the supplied legacy four-class armor count into class-neutral pieces plus class-specific Titan/Hunter/Warlock pieces so no removed class names return.
- Include the named example weapons, meaningful archetypes, damage elements, durability, perks, acquisition sources, and dungeon signatures.
- Extend generated loot to draw from these manifests while retaining existing caps: power ≤1000, five mods maximum, mod value ≤60.

## 3. Crafting, currencies, and Nexus vendors
- Model Credits, Faction Data Shards, and Pure Spatial Cores, plus all tier-upgrade materials and exact recipe costs.
- Add four Nexus vendor districts: Scrap-Market, Faction Quarter, Singularity Exchange, and Black-Market Node.
- Build a functional Arsenal screen with inventory, equipped gear, material balances, upgrade eligibility, repair/upkeep, crafting tax, vendor offers, purchase/exchange actions, and clear insufficient-resource states.
- Seed local demo progression so every screen can be exercised without changing the online backend.

## 4. Ability Network and mixed-class loadouts
- Add a node-web ability model joining Titan, Hunter, and Warlock paths through Combat, Systems, and Exploration mastery streams.
- Allow one Primary, one Tactical, and one Ultimate from any class, validate slot compatibility, calculate build archetype/synergy, and support Solo, Hybrid, and Team tuning.
- Build a visual Loadout / Ability Network screen with equipment slots, connected nodes, unlock progress, hover/focus previews, save-build behavior, and gameplay-ready active build state.
- Use **Fracture Core**, **Resonance**, and **Adaptation** terminology only. Do not restore EVO, EVOLIO, or companion narration.

## 5. Onboarding and character identity redesign
- Restyle the title, class, subclass, and appearance screens to match the supplied references: dominant live character, restrained floating equipment panels, technical lines, dark neutral surfaces, and distinct cyan/red/violet class energy.
- Expand appearance controls into body frame, identity shell, armor language, core type/color, and modular rig selections while keeping onboarding concise and still deploying directly into Mission 01.
- Make Titan broad and grounded, Hunter lean and asymmetric, and Warlock balanced with floating system elements in both preview silhouette and motion.

## 6. Cosmetic progression and live armor states
- Add modular armor slots, mastery cosmetics, prestige states, dungeon sets, and biome-reactive traits.
- Drive four visible runtime armor states—Stable, Active, Fracture, Ascendant—from combat intensity, damage, movement, ability chains, and team synchronization.
- Implement performant material/VFX changes using existing R3F meshes: core pulse, emissive seams, class-specific shield/trail/glyph modules, and limited orbiting fragments. Respect reduced motion and mobile rendering limits.
- Surface brief gameplay-readable status messages without adding legacy companion voice lines.

## 7. Integration and verification
- Add clear HUD/menu access to Dungeons, Arsenal, and Ability Network without crowding the combat HUD.
- Keep Mission 01, garage reward, raid-strategy tool, camera modes, convoy spacing, Nexus protection, and vehicle systems intact.
- Add/update unique route metadata where needed, remove duplicate or superseded definitions, and ensure forbidden legacy names are absent from player-facing content.
- Verify exact manifest counts and recipe math with focused tests, then run the TypeScript check and production build.
- Use the live preview to test desktop and mobile onboarding, dungeon completion/wipe, equipping mixed abilities, crafting/upgrading, vendor purchases, and visible class/armor-state changes.

## Technical notes
- New systems remain client-safe TypeScript data/state modules; no database expansion is required for this milestone.
- The encounter runner is shared rather than creating a dungeon-only engine.
- Uploaded screenshots define visual direction only and will not be copied into the game.
- Existing adaptive behavior may remain internally under neutral WORLD FRACTURE terminology, but all removed branded terminology stays banned.
