# EVOLIO Vehicle Roster and Deployment Flow

## Goal
Add the supplied land, air, water, and enemy vehicles to EVOLIO’s game data and turn the orbit screen into a clear deployment sequence inspired by the references, without embedding the screenshots themselves.

## What will change
- Create one vehicle roster containing all 14 concepts, with rarity, allegiance, movement type, seats, hull, speed, handling, weapon, terrain role, lore, and unlock status.
- Redesign the orbit flow as three focused steps: choose Resonant class, configure a compact visual identity, then choose an available deployment vehicle.
- Keep advanced vehicles visible in a codex as locked future unlocks; the Scrap-Built Interceptor and Wasteland Scout Jeep will be immediately deployable.
- Carry the selected class, appearance preset, and vehicle into gameplay.
- Render the selected starter vehicle using the existing compact licensed vehicle models, with distinct scavenged/jeep treatment and matching handling, hull, collision radius, weapon heat, and HUD identity.
- Add vehicle name, movement type, hull, weapon, seats, and role feedback to the live HUD.
- Guard older or partially initialized HUD state so the existing loot panel cannot crash the world screen.

## Visual direction
- Dark military sci-fi interface with narrow panels, technical dividers, restrained cyan/amber status colors, tall selection cards, and a large active choice.
- Character configuration uses armor finish, visor glow, and field marking presets that visibly recolor the existing Resonant model.
- References guide hierarchy and atmosphere only; their image files will not ship in the game.

## Technical details
- New typed roster module under the game layer; existing simulation remains pure TypeScript.
- Startup selections flow through `GameCanvas` into `Scene`, vehicle rendering, collisions, movement tuning, avatar materials, and `HudState`.
- Existing adaptive evolution bonuses remain multiplicative with vehicle base stats.
- No unsupported Unreal/RAGE/Tiger runtime integration; the browser-compatible Three.js game remains the engine.

## Verification
- Confirm the startup sequence can move forward/back, select a starter vehicle, and deploy.
- Confirm the chosen vehicle name/stats appear in the world HUD and the scene renders without runtime errors.
- Check desktop and mobile-width layouts, build health, and the live 3D preview.
