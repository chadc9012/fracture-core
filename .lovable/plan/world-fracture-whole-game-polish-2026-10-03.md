# WORLD FRACTURE whole-game polish

## Goal
Bring the complete playable experience closer to the supplied references: grounded cinematic sci-fi, dense believable regions, strong atmosphere and weather, responsive Destiny-like movement and combat, readable enemies, a restrained holographic HUD, and reliable performance in Chrome with a safe Safari path.

## Delivery order

### 1. Stabilize graphics first
- Harden the WebGL capability check for Safari’s missing shader-precision response and show the existing useful error screen before the 3D renderer can reject.
- Remove unnecessary eager model loading and keep every new model self-contained or verified before use.
- Make shadows follow the active player area instead of spending one fixed shadow map across the entire world.
- Preserve the lighter Safari path: capped sharpness, simpler shadows, no expensive post effects.

### 2. Establish one cinematic world look
- Tune exposure, fog, sun/moon colors, ambient reflections, bloom, color grade, film grain, and depth effects as one restrained stack.
- Drive reflection lighting from the live day/night cycle using local light sources; do not add runtime HDR downloads.
- Keep bright holograms and weapon effects readable without turning the world into neon everywhere.
- Add distance silhouettes, haze layers, and stronger landmark framing so every region has depth and a recognizable horizon.

### 3. Improve movement, camera, and combat feel
- Retune acceleration, sprint, air control, landing, slope response, swimming, vehicle steering, braking, and camera damping for faster, weightier traversal.
- Preserve FPS as default, the saved local F toggle, and the short automatic third-person blend for melee and abilities.
- Add procedural locomotion feedback: head/body motion, landing compression, weapon sway, viewmodel motion, enemy recoil/stagger, hit reactions, and clearer attack telegraphs.
- Improve impact presentation with short-lived particles, surface-aware impacts, damage direction, shield reactions, boss phase cues, and restrained camera shake.
- Play through onboarding and Missions 01–03 so objectives, encounters, death, rewards, and progression cannot stall.

### 4. Upgrade every biome and environmental system
- **Veridan Forest:** denser layered foliage, wind-reactive canopies, wet ground, mist pockets, roots, stones, sci-fi ruins, and stronger portal framing.
- **Ember Peaks:** animated lava channels and crater surface, heat shimmer, embers, ash, scorched rock variation, and eruption lighting.
- **Frostspire:** snow material variation, wind-driven snowfall, ice shelves, frozen water, exposed rock, and cold atmospheric light.
- **Solara:** dune detail, dust fronts, heat haze, rock formations, wreckage, and long warm shadows.
- **Wastelands:** denser war debris, damaged infrastructure, convoy routes, smoke, fires, and clearer combat cover.
- **Shrouded Swamps:** layered fog, reeds, shallow pools, dead trees, insects, and ambush-readable cover.
- **Nexus and Neon City:** richer streets, wet reflections, traffic, overhead rail, signs, storefront depth, rooftop silhouettes, and civilian motion.
- **Thalassia:** underwater fog and color grade, particles, caustic light, fish schools, ocean silhouettes, glass-vault readability, market life, and train motion.
- Add localized lakes/ocean behavior instead of one visually identical water treatment everywhere.
- Add airborne fauna and city traffic; enable controllable aerial movement for AIR-domain vehicles while keeping other vehicle rules intact.

### 5. Replace the remaining placeholder look
- Upgrade the procedural operator and first-person arms/weapons so proportions, armor layering, silhouettes, and materials match the reference operators more closely.
- Give enemy families and named bosses distinct silhouettes, armor, weapons, weak points, movement, and attack tells from the shared encounter catalog.
- Replace boxy wrecks, cover, vehicles, and key landmarks with richer procedural assemblies first; use external 3D models only after downloading, validating, and storing self-contained copies with the game.
- Add more safe instanced prop variants so terrain remains performant without obvious repetition.

### 6. Unify all 2D presentation
- Keep the combat HUD minimal, then tighten icon scale, glass opacity, brackets, spacing, alerts, boss bars, objective tracking, minimap, and damage feedback.
- Apply the same smoked holographic language to the world atlas, inventory, dialogue, mission overlays, strategy panel, death/victory screens, settings, and cloud-save panel.
- Restyle the tactical map as a projected battlefield display while retaining the supplied illustrated map and encounter art.
- Polish Identity Forge lighting, framing, armor presentation, subclass/appearance steps, and assembly handoff without restoring startup tabs.

### 7. Validate the whole game
- Check type safety and current build diagnostics after each pass.
- Browser-play the title screen, Identity Forge, opening cinematic, onboarding, first mission sequence, combat, vehicles, underwater travel, interiors, map/inventory/settings, death/recovery, and cloud-save controls.
- Capture representative views in forest, city, lava, snow, desert, swamp, ocean, and Thalassia at day and night.
- Verify Chrome at desktop and compact sizes, then verify Safari-safe behavior and forced graphics-failure recovery.
- Tune against the supplied images for lighting balance, bloom, fog, movement speed, tracer length, HUD density, and subject readability.

## Technical approach
- Continue with React Three Fiber and the existing simulation; Unreal Engine cannot run inside this browser project.
- Keep frame motion delta-time based and preserve current save, mission, bindings, camera, destruction-event, and marker contracts.
- Use instancing, pooled effects, quality-tier budgets, local procedural textures, and camera-local environmental detail to stay within a mobile-web rendering budget.
- Build each visual system as an isolated, reversible pass so a quality upgrade cannot blank the entire world.

## Scope boundary
This is a full-game quality pass, not a promise of offline-rendered AAA fidelity. The target is a polished, coherent, playable browser game that strongly matches the references while remaining reliable on real devices.
