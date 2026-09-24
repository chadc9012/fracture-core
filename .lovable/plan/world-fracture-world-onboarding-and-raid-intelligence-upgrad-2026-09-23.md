# WORLD FRACTURE World, Onboarding, and Raid Intelligence Upgrade

## Goal
Turn the current prototype into a clearer playable opening: players choose a flex class and subclass, customize a visible operator, deploy directly into a guided first mission on foot, then earn their first vehicle choice. Add biome-aware world behavior and an in-game raid strategy advisor.

## Player flow
1. Keep the cinematic WORLD FRACTURE title screen.
2. Replace the current vehicle onboarding step with:
   - **Class:** Titan, Hunter, or Warlock.
   - **Subclass:** three signatures for the chosen class.
   - **Appearance:** live 3D character preview with armor, cloth, visor, and markings changing immediately.
3. Start new characters on foot in **Mission 01: First Resonance** in Veridan Forest.
4. Show the mission’s objectives and live progress in the HUD from the first frame.
5. On completion, present the two starter vehicles as the player’s first permanent unlock choice.
6. Keep the rest of the 14-vehicle roster locked behind store purchase or world-part construction, and expose garage/summon availability in the HUD.

## Flex-class foundation
- Define Titan, Hunter, and Warlock identity, subclasses, primary/tactical/ultimate signatures, and Solo/Hybrid/Team modes as typed game data.
- Make class bonuses a starting foundation rather than a permanent restriction.
- Retain the adaptive playstyle system under WORLD FRACTURE terminology; do not restore any removed EVOLIO/EVO names or narration.
- Surface selected subclass, equipped signatures, and cooldown-ready states in the live HUD.

## Living world upgrade
- Keep the existing sculpted heightmap, water, roads, destructible props, day/night cycle, convoy lanes, combat simulation, and zone ownership systems.
- Add explicit active/neighbor/dormant zone streaming tiers around the player instead of replacing the world with flat biome planes.
- Add biome environment profiles:
  - Veridan: mist/rain, dense forest, wildlife and light patrols.
  - Wastelands: dust, roads, convoy traffic and raider patrols.
  - Ember: ash, lava glow, heat pressure and aggressive enemies.
  - Frostspire: snow haze, reduced visibility and survival pressure.
  - Nexus: protected clear-air hub behavior and defense interception.
- Extend biome AI with patrol, chase, attack, flee/return states while preserving safe-zone exclusion and convoy route discipline.

## Raid strategy advisor
- Add a compact **Fireteam Strategy** panel reachable from the live mission HUD.
- Let players paste or type a combat log plus encounter and fireteam context.
- Send validated, size-limited input through a server function to Lovable AI Gateway.
- Return concise personalized recommendations: failure patterns, positioning, role assignments, phase plan, and three prioritized adjustments.
- Include loading, empty-input, gateway failure, and retry states. No private key reaches the browser.

## Vehicle progression
- Remove starter vehicle selection from onboarding.
- Track whether the first-mission reward is pending, chosen, or unlocked.
- Add clear acquisition metadata to every vehicle: first-mission reward, store purchase, found-parts build, faction reward, or boss-only.
- Add a garage assistant panel for unlocked vehicle selection and summoning; purchase/build actions remain visibly locked foundations unless backed by the required economy or parts.

## Technical details
- Extend `src/game/loadout.ts`, `src/game/director.ts`, and `src/game/vehicles.ts` with typed definitions and progression state.
- Refactor `StartMenu`, `GameCanvas`, `Scene`, and `HUD` so onboarding, mission state, vehicle reward, garage, and raid advice flow cleanly.
- Add a dedicated client-safe server-function module for AI Gateway requests using `LOVABLE_API_KEY` only inside the handler.
- Use existing design tokens and button components; keep the main route client-only for Three.js.
- Avoid per-frame React state updates and random render-time geometry; preserve frame-rate-independent movement and simulation budgets.

## Verification
- Run the full TypeScript typecheck and production build, fixing all reported errors.
- Browser-test title → class → subclass → live appearance → first mission.
- Confirm no vehicle is selectable during onboarding and a reward vehicle can only be chosen after mission completion.
- Confirm biome visuals/AI change by region, the world remains lit and nonblank, and no console/runtime/network errors occur.
- Confirm raid recommendations work through the server and fail gracefully.
- Check desktop and mobile layouts, including no overlapping HUD panels.
