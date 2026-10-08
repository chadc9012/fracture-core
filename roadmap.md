# Roadmap

- [x] Build explorable Thalassia District B1 street with glass ocean promenade, elevated markets, luminous signs, and a moving overhead train.
- [x] Build a matching street-level Neon City market with walkable lanes, layered storefronts, signage, and moving elevated transit.

- [x] Make WORLD FRACTURE the sole game identity across the entire project.
- [x] Add a cinematic WORLD FRACTURE title screen with Continue, New Game, Loadout / Customize, Settings, and Exit.
- [x] Consolidate factions as Resonants, Controllers, Breakers, Corp Architects, Nomads, and neutral; only the first three participate in player allegiance.
- [x] Present The Core Breach raid and deterministic adaptive Overseer Core in the game interface/lore.
- [x] Use the newest uploaded character, environment, and interface references as visual direction only.
- [x] Add the full typed vehicle roster and starter deployment choices.
- [x] Replace vehicle selection during onboarding with class, subclass, and live appearance selection.
- [x] Launch every new player directly into the first mission after onboarding.
- [x] Unlock one starter vehicle choice after the first mission; reserve other vehicles for store purchase or part-based building.
- [x] Add garage ownership, vehicle summoning, and a garage assistant flow.
- [x] Add the Titan, Hunter, and Warlock flex-class definitions, signature abilities, subclasses, playstyle modes, and no-lock progression foundations without old-name references.
- [x] Add an in-app raid combat-log strategy advisor powered by AI Gateway.
- [x] Strengthen biome-specific streaming, weather, interaction, and AI patrol behavior across Veridan, Wastelands, Ember, Frostspire, and Nexus.
- [x] Prevent partial HUD state from crashing loot rendering.
- [x] Run full TypeScript, production build, desktop/mobile, and live 3D verification.
- [x] Build the shared raid/dungeon stage engine and three regional dungeons.
- [x] Add exact 122-weapon and 92-armor manifests with fixed dungeon exotics.
- [x] Add crafting recipes, currencies, Nexus vendors, and a functional Arsenal.
- [x] Add the mixed-class Ability Network with saved Solo/Hybrid/Team builds.
- [x] Redesign onboarding around the supplied equipment and character references.
- [x] Add modular cosmetics and live Stable/Active/Fracture/Ascendant armor states.
- [x] Equipped chest/helmet/legs gear now changes the Operator model's real geometry, not just a color/glow tint: Operator.tsx reads each slot's upgrade level (gearCost/upgradeGear's level 1/2/3+ tiers) and adds actual plates/collar/pauldron trim at tier 2 and ridges/crest/antenna/knee-spike at tier 3, on top of the existing procedural (no-GLB) model. Scene.tsx derives the three levels live from PlayerProgression.inventory/equippedGear, so gearing up visibly changes the character in-world, not just its stats.
- [x] Verify counts, dungeon flow, progression interactions, responsive layouts, and production health.
- [x] Persist mission, ability, reward vehicle, and garage-loadout progression across sessions.
- [x] Add AI screenshot hazard analysis with upload validation and traversal recommendations.
- [x] Add independent gameplay/simulation/visual/network/optimization contracts and render presets.
- [x] Add the Titan shield timing vertical slice, arena cover, hazard, and combat HUD feedback.
- [x] Apply supplied launch and operator artwork to the title and onboarding flow.
- [x] Verify TypeScript, production health, responsive interaction, AI request, and legacy-name audit.
- [x] Add the five-stage Sunken Arcology Vaults runtime and deterministic sand-pressure rules.
- [x] Add playable Burial Gates, Velocity Protocol, and Synthesis Fracture vertical slices.
- [x] Add shared enemy perception, threat, archetype, and fair fight-memory adaptation.
- [x] Add a unified data-driven combat ability/effect/state/synergy engine.
- [x] Add ability mastery, branch evolution, modifiers, and premium progression UI.
- [x] Verify TypeScript, production health, runtime flows, responsive UI, and legacy-name audit.
- [x] Replace the current launch-to-world jump with a staged ten-minute identity onboarding and first victory report.
- [ ] Connect equipped ability branches to live combat, enemy threat decisions, dungeon rules, environment responses, and HUD state.
- [ ] Add private 2–3 player dungeon lobby UX, invite links, ready checks, class visibility, launch gating, and completion summaries.
- [ ] Add build-aware dungeon modifiers, behavior-shaped loot, transformation crafting, repeat-clear perks, and reward persistence.
- [ ] Replace the old raid advisor call with the WORLD FRACTURE loadout strategy planner on the current AI Gateway contract.
- [ ] Add playable data foundations and operations views for cosmetics, fair economy/blueprints, guilds, PvP, Fracture Core raid, world layers, environment cycles, and AI Director decisions.
- [x] Remove Loadout / Customize from the startup menu and animate the title landscape, light, and shadows with reduced-motion support.
- [x] Give the title screen a live 3D skyline backdrop (camera drift, fog, neon lighting) crossfading in over the static art, a WORLD FRACTURE–branded loading screen, a procedural ambient swell on first input, and staggered menu fade-in — all reduced-motion aware, with the 3D layer sandboxed behind its own error boundary so a render failure there can never block New Game.
- [ ] Verify type safety, production health, onboarding and dungeon flows, desktop/mobile layout, AI behavior, and retired-name removal.
- [x] Make first-person shooting the default, retain a saved third-person preference, and blend to third-person for melee and special-skill actions with aligned aim and controls.
- [x] Weapon system: auto/pulse/heavy/sword, recoil, spread, camera punch, crosshair bloom, hit markers
- [x] Cloud saves: sign-in, save migration, cross-device merge with undo
- [x] Add seven-region atlas using supplied map art, regional enemy and dungeon boss references, and zone intelligence.
- [x] Add regional enemy appearances, named boss encounters, farmable materials, inventory loadout, upgrades, and elemental infusion.
- [x] Mission 01 Broken Signal (NOVA guide)
- [x] Mission 02 Blackout Protocol
- [x] Mission 03 Stitched Neon Core (the dungeon Blackout Protocol's ending hooked; ends in the game's first scripted boss fight against Aegis-Prime, and hooks fd-16/fd-17's Thalassia descent)
- [x] Mission 04 Descent Protocol (gives fd-16's dive-to-Thalassia a real destination in the already-built sunken city instead of a bare survive timer; ends on a cliffhanger, not a boss fight — the real confrontation is fd-18's still-unbuilt final mission)
- [x] Mission 05 The System Core — fd-18's final mission and boss (same ANCHOR/ARRIVED/CLEAR/HACK/ACK shape as Missions 01-04, picking up from Descent Protocol's cliffhanger: dive back into Thalassia, break its perimeter, collapse three containment locks, then fight the System Core itself). Thalassia has no catalog boss in encounters.ts, so the boss is wired through unique-scenarios.ts instead — the mechanism already built for exactly this case (Solara's Unbroken Glass) — with a new "system-core" scenario entry and a new fractureCore material for its drop. On completion, GameCanvas dispatches the BOSS_DEFEATED event keyed "system-core" that fd-18 is listening for, which completes fd-18 and fires the already-wired EndingOverlay.
- [x] Per-weapon ammo, reload, ammo HUD
- [x] Controller weapon switching, selector/wheel, configurable bindings
- [x] Password reset for cloud saves
- [x] Cloud save restore points
- [x] Combat audio
- [x] Explosions (structure collapse, boss death), a distinct faster/heavier boss-fight music pattern (updateCombatAudio's boss param), and a dialogue blip on every mission's NOVA line (Missions 01-04 + Awakening) — all procedural Web Audio, no files.
- [ ] Ability VFX
- [x] Vendors & marketplace
- [ ] Seasons
- [x] Extend the tutorial's control call-outs into Mission 01 (Broken Signal), and add an adaptive re-teaching system for repeated struggle (hack routing, taking hits without dodging, sitting low-hp without using an ability).
- [ ] Remaining uploaded design notes (UI animation, inventory UI, progression, performance)
- [x] Map markers + HUD tracking (missions, resources, bosses)
- [x] Operator model matches class reference art
- [x] Destructible interior (single building near spawn)
- [ ] Multiplayer destruction sync (needs multiplayer first)
- [ ] Replace boxy world props with higher-detail models
- [x] Replace tabbed character creation with the spatial Identity Forge chamber and cinematic armor handoff.
- [x] Replace the dashboard-like in-game overlay with a clean combat HUD.
- [x] Add a holographic HUD chrome restyle (HUD, tracker, minimap, inventory, start menu) matching Destiny-style reference art.
- [x] Add procedural weather particles (rain/snow/ashfall/dust) and procedural ground/rock detail textures.
- [x] Add ambient wildlife (deer, birds, fish, dogs, cats, snakes) with wander/flee AI.
- [x] Add ambient civilian NPCs (Nexus techs/vendors/medic, Veridan scavenger/observer) with wander/greet AI.
- [x] Add The Anomaly Prime as the named final boss of The Fracture Core raid.
- [x] Add Neon City (Nexus-adjacent market/cybernetics district) and Thalassia (sunken ark-city) as explorable locations.
- [x] Add a skippable opening cinematic (THE FRACTURE / factions / signal / NOVA first contact) between Identity Forge and the tutorial chamber.
- [x] Give the opening cinematic an actual camera flythrough + NOVA voice beats + world reveal, instead of text on a flat black screen: Scene.tsx's real camera (not a separate render) now flies a scripted path (src/game/intro-camera.ts — wide orbit over the shattered regions, a lateral pass, then a descent into spawn) while IntroCinematic.tsx's black veil clears across the SIGNAL/NOVA beats and closes in with letterbox bars, so the "reveal" is the actual live world the player is about to drop into. NOVA's lines now land as a timed run of blips per word instead of one flat chime, closer to a paced voice line. The flythrough's last frame matches Scene's resting third-person camera exactly, so control hands back to the player as a clean cut, not a pop.
- [x] Give named regional bosses three real combat phases (speed/damage/cooldown escalation + phase-change cue) instead of one flat health bar.
- [x] Add a safe-state layer (frame-loop error recovery, soft-fail save/load, world-crash recovery screen) so a bad frame or save never hard-crashes gameplay.
- [x] Add a Global Balance Controller — damage scaling and reward pacing tied to a player-power score, so progression doesn't trivialize early or turn unfair late.
- [x] Add Loot + XP System v1 — an overall player level/XP engine (kills, elites, bosses, missions), a level-up moment, and NOVA meta-progression unlocks, connected to the existing AI loot generator.
- [x] World dressing pass v2: two separate attempts at sourcing real CC0 tree/rock GLB models (Poly Haven PBR rocks, then a "nature-kit" GitHub pack) both turned out to point at dead or nonexistent CDN paths — the second was found and removed from models.ts this pass, since Vehicle.tsx preloads it unconditionally and it was a live black-screen risk identical to the first. Replaced the boxy perfect-icosahedron/dodecahedron/cone instancing across Veridan Forest, Frostspire, Wastelands, Solara, Ember, and the Swamps with seeded noise-deformed procedural geometry (src/game/organic-geometry.ts) instead — lumpy rocks and irregular tree canopies, still one draw call per species via the same <Instances> pipeline, with zero network dependency and so no load-time failure mode to roll back from.
- [ ] If a genuinely reachable CC0 rock/tree GLB source turns up, swap it in one model at a time (verify the URL resolves before wiring it in — see AGENTS.md's model-URL rule); not blocking, since the procedural pass above already fixes the boxy look.
- [x] Round out the remaining sharp-edged boxes the world-dressing pass missed: ambient wildlife (deer/dog/cat bodies and heads were raw boxGeometry, confirmed still boxy in an incognito preview load after the terrain pass shipped) and the humanoid regional-enemy torso/visor, both switched to RoundedBox to match the Operator model's treatment.
- [x] Sky pass: the atmosphere (turbidity/rayleigh/mie) was static regardless of time of day or weather, reading flat; now reacts each frame to sun angle, night factor, and the live regional weather-cycle sample (hazier/more turbid near the horizon, at low sun angles, and under cloud cover or poor visibility). Added a procedural cloud layer (src/game/sky-clouds.ts canvas-baked puff sprite, no external image) — a ring of far, high billboard puffs that fade in with a region's live cloud cover and tint with the day-phase light color, invisible in clear weather.
- [ ] MEDIUM/LOW performance: dpr, shadows, and post-processing were already tier-gated (RENDER_PRESETS), but world-prop instance counts and canopy shadow-casting were not — every tier scattered the same ~500 trees/rocks and cast canopy shadows whenever shadows were on at all. Terrain.tsx now takes a renderTier prop and scales prop density (LOW 0.5x, MEDIUM 0.75x, HIGH/ULTRA 1x) and skips canopy shadow-casting below HIGH. This is a real, scoped fix for one confirmed-unaddressed cost, not a verified fix for the whole complaint — the remaining likely cost is CPU-side simulation work (AI, collision, weather) that doesn't currently scale with render tier at all; needs the user's retest to tell whether more is needed there.

- [x] Add a Shangri-La Frontier-inspired boss weak-point/poise system — sustained damage breaks a boss's poise and staggers it into a high-damage punish window, and a weak-point core flashes open on every phase change; shown as a dedicated boss HP/poise bar in the HUD.
- [x] Add Emergency Quest world events — a rare, countdown-warned world-boss spawn that pulls in whoever's nearby, with its own HUD banner and bonus payout on a clear.
- [x] Add adaptive boss AI — an engaged boss reads the player's recent melee/ranged/dash/ability pattern and counters it mid-fight (speed, damage, or attack tempo), with a one-time "it's reading me" alert when the counter locks in.
- [x] Add the first Unique Scenario encounter ("Anomaly: The Unbroken Glass" in Solara, which otherwise has no catalog boss) — a boss that's near-immune to damage outside its weak-point/stagger window, so it can't be brute-forced.

- [ ] Export all current game code as a ZIP download

## Whole-game cinematic polish

- [ ] Stabilize graphics startup and Safari capability handling before adding visual load.
- [ ] Establish one grounded cinematic sci-fi render language across world, menus, HUD, map, and character creation.
- [ ] Upgrade traversal and combat feel: locomotion, camera response, animation feedback, enemy readability, impacts, and encounters.
- [ ] Upgrade biome terrain and dressing for forest, desert, wasteland, volcanic, alpine, swamp, city, ocean, and underwater districts.
- [ ] Deepen environmental simulation: wind, rain, storms, sun/moon cycle, water, lakes, ocean, lava, underwater atmosphere, and flying life/traffic.
- [ ] Replace remaining boxy placeholder characters, enemies, vehicles, weapons, and props with safe bundled or verified assets.
- [ ] Polish all 2D surfaces and overlays to the supplied tactical holographic visual language without cluttering combat.
- [ ] Playtest the complete first-session flow and representative regions on desktop, compact screens, Chrome, and Safari-safe settings.
- [x] Add centralized cinematic voice playback and saved voice controls.
- [x] Voice startup, onboarding, cinematics, missions, NPCs, bosses, victory, and ending.
- [x] Verify spoken flow, interruption, muting, Safari-safe fallback, and build health.
- [x] Apply the linked Destiny UI reference to startup, identity onboarding, deployment briefing, restrained HUD, categorized settings, and destination-first world navigation without copying proprietary assets.
- [x] Rewrote the in-game Roadmap screen (retention.ts ROADMAP, settings "Roadmap" tab) as real storyline missions instead of engineering feature flags: entries now read as story beats continuing past "The System Core" (a traced signal, the Silent Array raid, a fireteam-capable mission format, archived-never-removed seasons) in the same voice as the Chronicle, while keeping the existing {label, status} shape so no other code needed to change.
- [x] Gave the game a proper Operator roster instead of generic class labels: 9 named Operators (one per subclass), each with a callsign and bio, pickable in the Identity Forge's Subclass stage. The Appearance stage replaced its 4 fixed color presets with real customization — independent swatch rows for armor/undersuit/visor/trim plus an editable callsign — built on the Destiny-style character-customization reference screenshots already shared, adapted to this game's always-helmeted procedural armor model (no face/hair system, since there's no exposed face). Callsign now shows in the deployment briefing and HUD.
- [x] Cut the Operator roster from 9 down to 3 (one per class — Mara "Bastion" Voss, Kai "Shade" Esrin, Theo "Cipher" Marsh), per feedback that there should only be three customizable Operators. Each keeps their class's 3 subclasses, but a subclass is now a respec of the same character (appearance no longer resets on subclass change) rather than a different operator. Gave every subclass a named, unique special ability (SubclassDefinition.specialAbility), so each Operator has 3 distinct signature moves shown in the Identity Forge's Subclass stage.
- [x] Gave all 9 subclass special abilities a real, Destiny-style status-effect verb instead of flavor text (new src/game/subclass-verbs.ts): Weaken/Marked (bonus damage taken), Volatile (a dropped DoT zone), Suppress (extends enemy fire-cooldown), Rage (self damage-dealt buff), Overshield (self damage-taken reduction), and Haste (faster ability energy/cooldowns). Each subclass flavors one of its class's existing Primary/Tactical/Ultimate slots rather than adding a disconnected new ability, so the Ability Network stays the single source of truth for what Q/E/R do. Wired into live-build.ts's activateLiveAbility and sim.ts's damage/incoming-damage/machine-tick pipeline.
- [x] Added a first-time Operations Hub orientation tour (src/game/hub-tour.ts) — the "meet your vendors, learn your playlists" beat, matching the brief that onboarding should route new players through a guided hub tour and explain core activities before free play. Walks through Dungeon Operations (core playlist), the Arsenal's four vendor districts, the Ability Network, World/Director systems, and Social/PvP/Raid, highlighting each tab in turn. Shown once per device (localStorage, client-local like camera/bindings — never synced to player_saves), dismissible at any point. The earlier NOVA-guided field tutorial (onboarding.ts) and the "Awakening" first quest (quests.ts) already cover the guided-intro-quest and in-world mechanic pop-up pieces of this same brief.
- [x] Applied the game-design research pass (combat feel, enemy AI, pacing, progression): hit stop (45 ms on elite/boss hits, 70 ms plus a camera punch on kills); enemy attack tickets (at most 3 ranged machines wind up a shot at once, bosses exempt) with a pulsing wind-up telegraph before each shot lands; an amber ring at the feet of elites as a visible "better loot" cue; and the hub intro reworked from a five-panel front-load into one short intro per tab on first visit (teach-as-you-go, client-local).
- [x] Wire first-clear bonus (1.5×) and daily repeat taper into every mission payout.
- [x] Poly Haven ground surfaces per region + bundled boulder, moss rock and dead trunk models.
- [x] Show "What next" on the world map, star map and deployment briefing.
- [x] Auto-save indicator; checkpoint-based death respawn that avoids war zones and crossfire.
- [x] Star Map rebuilt from uploaded layout using real destination data, with deploy-to-region.
- [x] Per-class Arsenal weapon loadouts that drive in-world weapon slots.
- [x] Three-slot save manager on top of the cloud save.
- [x] Added in-game environmental systems (src/game/environment.ts, with tests): four 6-day seasons driven by the same deterministic day clock as weather, a per-region thermal index (cold rain falls as snow in winter, Frostspire stays cold, Ember and Solara run hot, Nexus is shielded), and telegraphed hazards — heat stress, cold exposure and spore fog build a visible exposure meter with a HUD warning before they hurt (relieved by interiors, safe zones and the Nexus shield), and storm lightning shows a pulsing ground ring for 1.6 s before landing, damaging both the player and any machines under it so storms are a tactical tool. HUD shows season, weather and temperature plus the active hazard line.
- [x] Added Helldivers-style stratagems from the shared co-op shooter design notes (src/game/stratagems.ts, with tests): hold N, enter an arrow code (arrow movement is suppressed while the menu is open), release N to throw the beacon. Three call-ins — Supply Drop (refills ammo and 40 hull on the pad), Orbital Strike (delayed blast with friendly fire) and Recon Pulse (marks machines for bonus damage, reusing the subclass Weaken machinery). Beacons fly under gravity, plant, show a pulsing radius telegraph that speeds up toward detonation, then blast. A HUD panel lights each code's arrows as you type and flashes red on a typo; codes have cooldowns and are never prefixes of each other. The rest of those notes (class backpacks, assisted reloads, armor-piercing, diegetic hover shopping, living ecosystem) are logged as candidates, not built.

- Class backpacks: Bastion (Titan: orbital friendly fire -70%, Supply Drop +50% repair), Slipstream (Hunter: call-in cooldowns -30%), Relay (Warlock: Recon Pulse +40% reach, 1.45x mark). Packs drawn on each Operator.

- Looks pass: slope-masked terrain coloring (dirt on mid slopes, cliff rock on steep faces, ~9% / ~7% of land).

- Looks pass 2: graded supply roads (smoother along-lane, ~5-10x on flat routes) and saplings/brush clustered around Veridan trees.

- Looks pass 3: regional atmosphere (fog tint/thickness, light tint per region + weather) and an underwater look (teal murk, caustic visor overlay).

- Looks pass 4: wind-swayed canopies/undergrowth/dead trees plus grass tufts (Veridan) and reeds (Swamps), driven by live weather wind.

- Dynamic crosshair: spread ring widens with sprint/air/fire, barrel index lags camera look, X hit marker (amber on kills).

- Movement kit: Titan lift, Hunter double air-jump, Warlock air-jump + glide (hold C), slide from sprint (Ctrl or J), sprint/slide FOV and camera drop.

- Operator look pass: Titan scorched-titanium + orange hazard visor, hazard-striped pauldrons, rotary chain-cannon; Hunter carbon + fuchsia with a translucent glowing phase cloak; Warlock trench-coat skirt, floating rings, amber holo streams, arc-coil carbine. Preset colors updated (saved custom colors are untouched).

- Movement feel: head bob, weight shift, strafe roll, landing dip, weapon sway, and a real walk/run limb cycle for the Operator; decorative GLBs deferred 4s after the world appears.
