# WORLD FRACTURE Connected Systems Build

## Outcome
Turn the existing prototype into a coherent launch-to-endgame foundation. The first ten minutes become a staged, class-specific playable tutorial; the operations terminal then exposes connected dungeon, build, reward, social, competitive, raid, world, and economy systems.

## Build sequence
1. **First ten minutes**
   - Add a short boot pulse before the title screen.
   - Keep class choice identity-led, then show materialization, movement, first ability, combat, mastery, class chamber, power moment, Adaptive Sentinel, victory, and hub unlock as one tracked flow.
   - Make Titan, Hunter, and Warlock objectives and feedback distinct.
   - Persist completion, the first ability reward, and identity lock-in.

2. **Live build control surface**
   - Introduce one shared runtime bridge for equipped abilities, cooldowns, effects, environment reactions, AI threat recalculation, and HUD feedback.
   - Make branch changes produce visible gameplay consequences and build-aware dungeon modifiers.

3. **Dungeon fireteams and reports**
   - Add private 2–3 player lobby state with invite-link copying, player classes, ready checks, host launch gating, and clear encounter entry.
   - Track stage progress, shared-life use, damage, support, rewards, and repeat-clear perk variations in a completion report.

4. **Loot, crafting, and rewards**
   - Extend loot with item types, affinities, ability modifiers, synergy tags, transformation depth, and bounded values.
   - Add behavior-shaped drops, dismantling/crafting recipes, build blueprints, fair bonding rules, cosmetic-only premium categories, and progression persistence.

5. **Connected endgame foundations**
   - Add typed, deterministic foundations and usable operations views for guild progression, controlled markets, PvP modes/ranks, the 6–12 player Fracture Core raid, world layers/biome states, environment cycles, and build-aware Director events.
   - Keep these locally simulated and clearly labeled; no pretend online matchmaking, purchases, or live trading.

6. **Strategy planner and presentation**
   - Update the AI strategy tool to accept dungeon, class, weapons, and team composition using the required AI Gateway model and error behavior.
   - Remove Loadout / Customize from the startup menu.
   - Animate the title landscape with slow rock parallax and moving sunlight/shadows, respecting reduced motion.

## Technical details
- Keep TanStack Start, React Three Fiber, existing semantic design tokens, and local persisted progression.
- Extend existing combat, enemy intelligence, dungeon, loot, economy, world, and director modules rather than duplicating them.
- Keep AI calls server-side and streaming through `openai/gpt-6-astra` on the Responses API.
- Treat multiplayer, commerce, guilds, and PvP as honest local simulations until real services are requested.
- Preserve Nexus protection, vehicle unlock rules, loot safety caps, and convoy spacing.

## Verification
- Run the TypeScript checker and inspect current production health.
- Exercise the new-game onboarding, class variants, lobby ready/launch flow, completion report, ability changes, and strategy planner.
- Check desktop and mobile layouts and confirm no retired project naming appears.