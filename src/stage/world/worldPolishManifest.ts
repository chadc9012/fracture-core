// @ts-nocheck -- ported verbatim from the standalone Stage 9-16 packages; not yet type-checked against this repo (no tsc available when imported)
/** World-wide AAA art audit manifest. Asset keys describe targets, not assets already authored. */
export type PolishDiscipline = 'geometry'|'materials'|'lighting'|'atmosphere'|'animation'|'simulation'|'audio'|'ui'|'performance'|'accessibility';
export type PolishStatus = 'inventory'|'blockout'|'needs-authoring'|'integration-needed'|'verify-in-game';
export interface PolishTarget { id: string; label: string; disciplines: PolishDiscipline[]; status: PolishStatus; priority: 1|2|3; notes: string; }
const target = (id:string,label:string,disciplines:PolishDiscipline[],priority:1|2|3,notes:string,status:PolishStatus='inventory'):PolishTarget => ({id,label,disciplines,priority,notes,status});
const common: PolishTarget[] = [
 target('terrain-sculpt','Terrain sculpt, erosion, slopes, valleys, cliffs and horizon silhouettes',['geometry','materials','performance'],1,'Preserve authored heightfields and paths; blend soil, gravel, mud, sand, snow and rock by slope/height.'),
 target('terrain-transitions','Biome and road-edge blending',['materials','geometry'],1,'No sharp texture seams, floating roads, cliff gaps or abrupt material tiling.'),
 target('rock-library','Rocks, boulders, scree, cliffs and mineral deposits',['geometry','materials','performance'],1,'Use varied authored meshes, decals, roughness/normal detail, LODs and collision proxies.'),
 target('flora-library','Trees, shrubs, grass, flowers, roots, ferns, reeds and ground cover',['geometry','materials','animation','performance'],1,'Biome-specific species, wind response, density budgets, distance culling and interaction avoidance.'),
 target('water-system','Oceans, rivers, lakes, ponds, waterfalls, rapids and wet surfaces',['geometry','materials','simulation','audio'],1,'Depth/color, shoreline foam, flow direction, waterfall mist, reflections, underwater transition and local sound.'),
 target('weather','Rain, storms, wind, snow, ashfall, dust, fog and wetness accumulation',['simulation','materials','lighting','audio'],1,'Weather changes visibility, surface response, ambience and particles; avoid excessive full-screen effects.'),
 target('sky-celestial','Sun, moon, stars, clouds, night sky and atmospheric scattering',['lighting','atmosphere'],1,'Consistent time-of-day lighting, cloud shadows where supported, star visibility and horizon haze.'),
 target('fracture-vfx','The Fracture: violet code fissures, floating debris, gravity anomalies, time glitches and energy storms',['geometry','materials','lighting','animation','audio'],1,'Signature world identity; localized emissive lighting, distortion, audio layers and readable safe zones.'),
 target('lighting-pipeline','Global illumination strategy, shadows, emissives, exposure and color grading',['lighting','materials','performance'],1,'Consistent cinematic exposure; avoid crushed blacks, neon blowout and unlit armor.'),
 target('surface-materials','PBR material library for fabric, armor, skin, hair, stone, concrete, glass, foliage and painted metal',['materials','lighting'],1,'Author base color, normal, roughness, metalness and detail maps at sensible scales.'),
 target('cities','Neon City, Neon Core District, Nexus City and other authored city spaces',['geometry','materials','lighting','audio','performance'],1,'Keep Neon City and Nexus City distinct; navigable streets, interiors, signage, traffic, windows and believable scale.'),
 target('roads-rail','Roads, bridges, tunnels, rail lines, train tracks, platforms, signals and trains',['geometry','materials','simulation','audio'],1,'Ground-conforming splines, sleepers, rails, track joints, crossings, train movement and safe collision volumes.'),
 target('wildlife','Biome wildlife, birds, aquatic life, ambient insects and reactive creatures',['geometry','animation','simulation','audio','performance'],2,'Species-specific idle/move/flee behaviors, habitat placement, distance budgets and noncombat readability.'),
 target('npcs','Civilian, vendor, faction, quest, patrol and emergency NPCs',['geometry','animation','simulation','audio'],1,'Navigation, schedules, contextual barks, faction reactions, crowds with performance budgets.'),
 target('enemy-roster','Enemies, elite units, bosses, hit reactions, armor damage and telegraphs',['geometry','materials','animation','lighting','audio'],1,'Silhouette readability, authored rigs, distinct materials, attack telegraphs and phase-specific VFX.'),
 target('operators-armor','Operators, mix-and-match armor pieces, cloth, decals, shaders and weapon attachments',['geometry','materials','animation','lighting'],1,'Preserve existing operator identities; ensure armor matches environment fidelity and reacts to light.'),
 target('weapon-library','All guns, swords, melee weapons, projectiles, muzzle flashes, trails, impacts and reloads',['geometry','materials','animation','audio','lighting'],1,'Correct grip/pose, recoil, reload timing, material response, audio layers and readable projectile effects.'),
 target('vehicle-library','All ground, air, water and underwater vehicles',['geometry','materials','animation','lighting','audio'],1,'Distinct silhouettes, functional rigs, cockpit/camera, damage states, lights, landing gear or water interaction.'),
 target('menu-system','Title, onboarding, Atlas, character, inventory, map, vendor, property, settings and pause menus',['ui','audio','accessibility'],1,'Shared design system, controller focus, clear feedback, safe areas, responsive layouts and no dead buttons.'),
 target('world-audio','Region ambience, water, wind, rain, snow, ash, city beds, wildlife, enemies and music',['audio','simulation'],1,'Layered positional audio, occlusion where supported, region transitions and dynamic weather mix.'),
 target('cinematic-language','Camera transitions, intro/outro stingers, objective reveals and boss arrival moments',['animation','lighting','audio','ui'],2,'Keep authored operator appearances and NOVA; captions and hold-to-skip where already designed.'),
 target('performance-quality','Quality presets, LODs, instancing, texture budgets, culling, shader variants and fallback handling',['performance'],1,'Frame pacing and memory budgets; missing noncritical assets must not blank the scene.'),
 target('controller-accessibility','PlayStation/Xbox prompts, remapping, vibration settings, subtitles and visual accessibility',['ui','accessibility','audio'],1,'Controller-first focus navigation; prompts update to active device; audio/visual effects have options.'),
];
const regionTargets = [
 ['verdant-forest','Verdant Forest','Moss, layered canopy, shafts of sunlight, ferns, flowers, roots, creeks, birds and dense but budgeted vegetation.'],
 ['shrouded-swamps','Shrouded Swamps','Blackwater, reeds, cypress roots, floating plants, mist, wet mud, insects, amphibians and muffled ambience.'],
 ['ember-peaks','Ember Peaks','Volcanic rock, ash deposits, heat shimmer, lava-lit cracks where authored, wind-carved ridges and falling ash.'],
 ['solara-desert','Solara Desert / Glass Flats','Dunes, hardpan, wind ripples, glassy fracture fields, dust devils, heat haze and Vyrak arena readability.'],
 ['frost-spire','Frost Spire Mountains','Snow layers, ice, exposed rock, wind gusts, blizzards, icicles, frozen lakes and snow-crunch audio.'],
 ['wastelands','Wastelands','Eroded roads, wreckage, scrap towns, dust, dry gullies, underground exits and faction silhouettes.'],
 ['neon-city','Neon City / Neon Core District','Rain-slick roads, verticality, emissive signage, trains/rails, traffic, rooftop routes, parkour lines and underground racing culture.'],
 ['nexus-city','Nexus City','Distinct architectural language, cleaner civic spaces, luxury interiors, transit, faction landmarks and its own skyline.'],
 ['thalassia','Thalassia Underwater City','Pressure architecture, water columns, caustics, suspended particles, marine life, docking/submersible routes and underwater audio filtering.'],
 ['ocean-coast','Open oceans and coastlines','Wave scale, shore foam, seabed transition, islands, storms, boats, dive boundaries and underwater visibility falloff.'],
];
export const WORLD_POLISH_TARGETS: PolishTarget[] = [
 ...common,
 ...regionTargets.map(([id,label,notes])=>target(id,label,['geometry','materials','lighting','atmosphere','simulation','audio'],1,notes as string,'integration-needed')),
];
export const QUALITY_PROFILES = {
  cinematic: { shadows:'high', environmentDetail:'high', vegetationDensity:1, effectsDensity:1, reflections:'high', textureScale:'high', targetFps:60 },
  balanced: { shadows:'medium', environmentDetail:'medium', vegetationDensity:0.72, effectsDensity:0.7, reflections:'medium', textureScale:'medium', targetFps:60 },
  performance: { shadows:'low', environmentDetail:'low', vegetationDensity:0.42, effectsDensity:0.45, reflections:'low', textureScale:'medium', targetFps:60 },
} as const;
export function getTargetsByDiscipline(discipline: PolishDiscipline): PolishTarget[] { return WORLD_POLISH_TARGETS.filter(item => item.disciplines.includes(discipline)); }
export function getPriorityOneTargets(): PolishTarget[] { return WORLD_POLISH_TARGETS.filter(item => item.priority === 1); }
