# Roadmap

## Current request
- [x] Add simulated Gamepad API browser tests for GOLIATH, NYX and CIPHER selection, previews and deployment; fix confirmed controller gaps (three browser flows and 18 existing menu/forge tests pass; physical controllers remain unverified).
- [ ] Cinematic Veyra benchmark: inspect uploaded art snapshot without overwriting latest source; improve real-time forest/armor materials and lighting, fix noisy audio, rename Star Map to World Map, verify playable flows.
- [ ] Neon mag-grind traversal and NPC robots/pets; Operator-bound small Vaelith companion with Dragonite rewards; expand unique encounter dialogue and task acceptance.
- [ ] Carry benchmark standards to remaining regions only after visual and device-performance verification; requested AI names are references only.
- [ ] Vehicle expansion, remaining: menu and phone HUD polish using provided references (no reference images are available in this environment to match against, so this stays open rather than guessed at). (Component damage already existed: vehicle-condition.ts's body/engine/tires/suspension with real speed/grip/stability effects and visible dent/glass/headlight/soot stages. Six-personality racing AI/rival persistence done: src/game/rival-personas.ts gives each race's rival slots a stable named personality that shapes its pacing curve, and a one-time "first beaten" record per race+difficulty+slot, surfaced in the race result line. Separate earned Nex and repair/recovery done: `repairVehicle` (vehicle-condition.ts) is a real, repeatable Nex spend — `repairPrice` existed but was never wired to anything — surfaced in GaragePanel's new Condition/Repair section. Fleet/vehicle acquisition gap closed: void-skimmer — the game's rarest (EXOTIC) chassis, with a real JET handling profile and its own engine voice but no fleet build anywhere — now has one, the Void-Skimmer Prototype at the Neon City Spire Vault; leviathan stays unacquirable on purpose, since its own lore calls for a cooperative full-crew capture the game has no multiplayer to support.)
- [ ] Expanded brief: personalized cinematic actors and emotes → economy/vendor dialogue → housing/build mode → garages/cosmetics → factions/map integration; preserve latest source and verify each phase independently.
- [ ] Review the running world against realistic sci-fi and Destiny-style references; fix confirmed overlaps and missing assets.
- [ ] Verify phone-sized gameplay controls/HUD (physical phone validation remains a device check). Partly done: desktop HUD references saved (docs/reference/hud-*.png); real screenshots at 844x390 and 960x540 showed the portrait-only touch layout piling up top-left, fixed with a landscape block in styles.css (vitals/ammo dock bottom, Cloud Save chip + rails tucked up). Ability icons are no longer permanent (operator-presentation.ts: cooldown chips + Super meter). Still unchecked: free-roam (post-cutscene) HUD, touch buttons overlapping vitals, vehicle HUD; the sandbox browser crashes loading the full world.
- [x] Test audio/radio playback and add vehicle-specific engine/startup profiles linked to existing tuning. (Already done, found on audit: vehicle-audio.ts's `ENGINE_VOICES` gives all 14 vehicles a distinct ignition/engine profile, and `engineVoice`'s tuning ratio shifts pitch/startup from the same real speed-tuning number Scene.tsx feeds it via `driveTelemetry` — audio.ts calls it for both ambient and cockpit playback. Radio playback logic is covered by radio-stations.test.ts/audio-design.test.ts/audio-safety.test.ts; physical speaker/output verification remains a device check, like line 4's controllers.)
- [ ] Integrate story and boss cutscene playback, including dungeon and raid coverage.
- [ ] Test building entry, shop purchase and confirmed duplicate sales.
- [x] Improve vehicle telemetry and tuning presentation on the existing fleet system: the Vehicle HUD now reads a pure `fleetTuningSummary` (fleet.ts) off the active build's real tuning levels and shows per-stat upgrade bars (SPEED/HANDLING/ARMOR/RAM, filled segments = levels bought, with the live % bonus) plus the build's ability name, instead of only speed/RPM/hull/load.
- [x] Show four distinct equipped skate-boot designs on all Operators. (Already done, found on audit: skate-visuals.ts's `skateDesign` gives Street/Grind/Sky/Rocket each a unique silhouette — wheels, rail, wings or turbines — scaled to the wearer's class bulk, and skate-attachments.ts's `attachSkates` parents that model onto either foot bone of any Operator's shared rig. OperatorModel.tsx and Scene.tsx both call it from the real equipped boot, so every Operator shows the pair actually owned, not a placeholder.)
- [x] Add world-vendor duplicate sales with prices and confirmation. (Already done, found on audit: ShopWindow.tsx's "Sell duplicate gear" section lists every spare copy `canSellDuplicate` finds, priced by `sellValue`, behind a role="alertdialog" confirm step before the sale fires.)
- [x] Make Ruin Stones usable with a combat boost and HUD timer. (Already done, found on audit: stash.ts's `useStim`/`RUIN_SURGE` give Ruin Stones a real, stacking +15%-per-stack damage buff; ConsumableHud.tsx shows the live stack count and a countdown in seconds until it expires.)
- [x] Add gameplay quick-use stims with effects, stacks and timers. (Already done, found on audit: stash.ts's STIMS (heal/armor) are real Nex-free crafted consumables with `STACK_CAP`-limited stacking and expiring buffs via `useStim`, bound to quick-use keys and shown with a live countdown in ConsumableHud.tsx.)
- [x] Add Hip-hop, Rock, EDM / House and Dancehall / Reggae radio channels. (Already done, found on audit: radio-stations.ts's RADIO_STATIONS has all four as real stations with their own recorded rotations — Block Signal/hiphop, Rust Riot/rock, Neon Frequency/house, Island Relay/reggae — and KillPlaylistPanel lists and tunes to every one of them.)

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
- [x] Equipped ability branches now change live combat (src/game/branch-effects.ts, with tests): Power scales effect values/damage +18%, Control stretches durations +25% (siege, veil, shield dome, verbs), Utility cuts energy cost 15%; the HUD effect line names the active bonus. Enemy squads now read a branch posture too (two or more equipped abilities on one tier): Power makes ranged units/leaders keep a longer standoff, Control makes squads spread out, Utility makes flankers commit early; the HUD threat line names it. Fixed stepSim wiping the build-driven squad fields (archetype, hold-fire) every step. Still open: dungeon rules and environment responses reacting to branches.
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

- [x] Operators renamed NYX / GOLIATH / CIPHER with new ability lists, base stats, save migration and rift turrets.
- [x] Female / Male / Robot body types in the Identity Forge, saved with the character.
- [x] Save Character & Deploy: validate -> save (local + cloud) -> launch Mission 1, duplicate-click safe.
- [ ] Server-side mission-run guard (no mission_runs table exists yet; the player_saves revision check only protects the save).
- [x] Mix-and-match armor attributes (src/game/armor-attributes.ts, with tests), from the uploaded armor-system notes: every armor piece carries INTELLECT (ability recharge), MOBILITY (move speed, slides) and DEFENSE (resistance) derived from its slot/power/set, with soft caps, trade-offs (heavy defense costs mobility, heavy intellect costs defense), a mixed-gear flexibility bonus, and soft fragile/slow warnings. Applied live in Scene via loadoutEffects; shown in the Armor Sets panel. Still open from those notes: per-piece perks/mod slots/rarity, saved and switchable loadouts, per-body armor fitting (male/female/robot), and per-piece 3D model updates.
- [x] Per-piece armor perks and body-fitted looks (src/game/armor-perks.ts, armor-look.ts, ArmorMotif.tsx, with tests): all 30 regional set pieces carry a unique perk that works worn alone (helmet = ability recharge, gauntlets = weapon damage, chest = protection, legs = movement, class item = recovery/utility), scaled by piece level and stacked with set bonuses; each set has a signature motif per slot drawn in the set color on the Operator, and every slot has its own fit for female, male and robot bodies. Still open: rarity and mod slots, saved/switchable loadouts, a dedicated per-body armor model pipeline, and a preview of worn sets in the Identity Forge.

## Realism & world completion (Oct 2026)
- [x] Weapon and armor drops in loot boxes (rarity-scaled, region element).
- [x] Separate helmet / chest+shoulder / gauntlet / leg armor pieces on Goliath, Nyx, Cipher rigs (starter procedural geometry).
- [x] Region-faction enemy troopers replace box-and-capsule enemies (procedural, articulated).
- [x] Warmer sun at golden hour, softer moonlight, warm street/plaza light, coloured light kept to shops and signs, lit building windows.
- [ ] Terrain shaping + biome vegetation pass (must re-run the water-network guards).
- [ ] Playable city district: connected roads, building footprints, street detail, paths fitted to terrain/water.
- [ ] City safe hub: mission access, trading, upgrades, protected spawns.
- [ ] Replayable regional mission scenarios using each region's hazards, enemies, traversal.
- [x] Weapon models in hand (from the modular armor/weapon document). (Found already done on audit: public/models/weapons has authored rifle, pistol, shotgun, heavy, launcher and sword GLBs plus arms; ViewWeapon.tsx draws them first-person with moving mag/bolt parts, and OperatorModel.tsx attaches the same models to every Operator's hands. Not visually checked here.)
- [x] User's seven Meshy enemy models optimized and wired per faction/role (procedural motion; rigs have no clips).
- [ ] Shopkeeper models + idle animations (no merchant models supplied yet).
- [ ] Civilian variety + ambient routines and combat reactions across regions.
- [ ] Walk/attack/death animation clips for the Meshy enemy rigs (models ship without clips).

## Armor loot, shops & black market (user notes, in order)
- [x] Stage 1: 30 armor collections in 5 families, mix-and-match, named drop sources, mission drops with bad-luck protection
- [x] Stage 2: tiered city armor/weapon shops (daily deals, rotation) — raid/exotic never sold
- [x] Stage 3: Neon City underground black market (The Undercroft; level 10 + Stitched Neon Core)
- [x] Stage 4: Vyrak's Covenant rules (class-bound Wyrmling, Dragonite set/abilities/daily gift)
- [x] Stage 4 world wiring: Vyrak lair + 3-phase encounter in Solara, boss-story intro/bond/archive dialogue, bond on confirmed kill, covenant abilities castable, Wyrmling companion rendered, daily gift on world entry
- [ ] Stage 5: remaining unique encounters

## Cinematic action pass (user brief, in order)
- [x] Combat feedback tiers + per-frame particle budget + controller rumble helper (rules only; not wired to Scene VFX yet)
- [x] Armor shaders: own once, apply/remove, appearance-only, exotic glow rule (rules only; no UI yet)
- [x] Neon City First Arrival cinematic data with NOVA line and handoff
- [x] Wire combat feedback/rumble into Scene hits; enemy stagger/armor-break visuals (Found already done on audit: Scene.tsx scales camera kick + controller rumble per impact class on hits, kills, damage taken, boss phases and abilities; Actors.tsx throws enemies back along the shot, hardest on a stagger (enemy-reactions.ts). No separate armor-break visual exists beyond the stagger recoil.)
- [ ] Shader UI in inventory + renderer using shaderLook
- [ ] Vyrak/Wyrmling authored dragon models (both still procedural bodies, built to the owner's reference sheet; a supplied authored model would replace them). Done: the in-world bonded Wyrmling (Wyrmling.tsx) now renders the sheet's chibi WyrmlingBody instead of a shrunken Vyrak, with its mood (happy idle, alert sprinting or just hit, aggressive in a fight) driving eyes, brows, jaw and wing-beat, and it perches on the shoulder when you stand still. Vyrak's fire now turns white-hot gold in phase 3 (it was always orange: `vyrakFire` was never called). Not visually verified: no renderer in this sandbox.
- [ ] Neon districts (Aegis Spire / Grid / Rust-Muck), underground racing loop, arrival trigger in Scene
- [ ] Graphics quality presets measured in-game

- [x] Vyrak balance pass (longer tells, wider weak-point windows, stronger Dragonite abilities)
- [x] Homes/garage quarters rules + saving (housing.ts)
- [x] Homes: Veyra Realty office (Neon City) + decorate screen
- [ ] UI Foundation Package 01: Atlas, activity log, patrol beacon, bounty, faction contacts in Neon City

## Map, street shopping and furnished homes
- [x] Show all existing regions and cities in the playable atlas and preserve actual travel destinations. (Found already done on audit: region-atlas.ts names every city/region site, destinations.ts/locations.ts keep real drop points; region-atlas, destination-map and locations tests pass.)
- [x] Add enterable regional storefronts and interactive outdoor window/table vendors using existing stock and prices. (Found already done on audit: storefronts.ts/Storefronts.tsx build walk-in, window and table shops with real door gaps and wall colliders from regional-shops stock; storefronts tests pass.)
- [x] Replace purchased home furniture with detailed models while preserving saved placement and clear doorways. (Found already done on audit, with one correction: home-furniture.ts builds multi-part procedural assemblies per room and home style, not externally sourced models; home-furniture.test.ts checks every combination keeps doorways clear.)
- [ ] Verify destination selection, indoor/outdoor purchases and furnished rooms; distinguish automated and browser checks. (Automated: 44 atlas/storefront/furniture/destination-map tests pass. Browser: not run in this sandbox, so still open.)

## Combat, gore and gaps pass (owner request, Oct 24 2026)
- [x] Combat tested through the real sim (src/game/combat-playtest-*.test.ts: on foot, melee, driving + shooting, flying + shooting). Fixed: bullets hit a body-sized cylinder along their swept path (no hits from 100 m up or from behind, no tunnelling); rounds leave from the eye line so tracers cross the crosshair; sword hits a 150° arc at your height through the shared damage path (boss poise, scenario loot credit); sliding works at life-size foot speed; Vitriol one-shots a basic grunt.
- [x] Vehicle weapons per vehicle and per fleet build (vehicle-weapons.ts): every chassis fires its listed weapons from real barrels with inherited velocity; the 21 fleet builds fire their own garage-card hardpoints; RMB/pad Y fires ordnance or a second gun; tank shells splash; rounds and rockets splash into the sea. Not built (garage text only): mine/caltrop droppers, flare pods, flame jets, the Remora drone dock, the breach thruster.
- [x] Gore system (gore.ts, GoreFx.tsx; Settings > Gameplay > Gore Off/Reduced/Full): red blood for people, sparks/oil/coolant for machines, green/blue for aliens and wildlife (now shootable); decals and pools, severed limbs and gibs, bodies that topple along the hit and sink away. Death animation clips for the Meshy rigs are still not authored (bodies fall as frozen poses).
- [x] Gaps: first-person arm/gun (forearm stump, aim clipping, FOV drift, pistol hands, wrist step); feet on the ground (operators, crawlers, loading stand-ins, landed aircraft); world holes (Thalassia anchored to the seabed, ground streams coarse-first after fast travel, far LOD cracks, far road strips); mantle/stand on crates and walls; the twelve catalogue exotics are earnable from story missions.
- [ ] Reference-sheet merchants and enemy groups: placement decided (reference-roster.ts). Still open: a Nexus vehicle shop for Cruz Mendez and a Solara exotics shop for Rafiq Kaleem; spawns, models and AI for Shadeborn, Ancient Guardians, Abyssal and Skyborn.
- [x] Offline caching: service worker (public/sw.js) caches what a player has loaded and serves it offline; the dynamic quality scaler (quality-governor.ts), local + cloud saves and procedural fallbacks were already built. Not verified in a real browser, and install-to-desktop still needs PNG icons plus a manifest.

## Fracture Gate descents, Stages 59–61 (owner request, Oct 25 2026)
Design: Destiny dungeon structure + Solo Leveling/Overgeared gates and danger; no dungeon map, you descend to a boss room at the very bottom.
- [x] Stage 59 — gates and the descent (fracture-gates.ts): ranks F–S (depth 60–1,000 m, 3–10 floors, gate 25–60 m tall, colour by rank, red + chained when sealed), nine signature dungeons, a gate per region each day (six with sites: Verdant, Swamps, Solara, Wastelands, Frostspire, Ember), about one gate-day in seven runs a rank deeper than it reads; the descent is a column of closed stone rooms far outside the world disc, each with a one-way drop shaft (slowed fall) into the next.
- [x] Stage 60 — tiers and enemies (descent-run.ts): threshold, chambers, two-wave encounters, a gatekeeper from B up, the boss room; gated drops open only when the tier's waves are dead; champions (Bulwark/Surge/Juggernaut) and gatekeepers are named, much tougher elites; 1–3 player scaling within the 18-machine pool; shared lives; boss collapse clock; one boss room in five cracks onto hidden depths with a second boss.
- [x] Stage 61 — rewards and wiring: encounter/gatekeeper chests once per tier per week, a clear pays once per dungeon per day through rewardMission (`side-rift-…`), Flawless/Solo/Solo Flawless seals with a Legendary Recognition toast, dungeon breaks after 18:00 UTC; Scene ground/walls/bounds/death/atmosphere hooks, DescentDungeon.tsx (gates + rooms), DescentTracker (depth readout, no map).
- [ ] Not yet: champion round-type counters in combat, boss mechanics specific to each dungeon (each boss currently uses the shared elite/boss AI), the Sublevel Protocol / Forgotten Foundation / Abyssal Vault gate sites (no site in Neon, Nexus or Thalassia yet), fireteams online, dungeon gear sets.
- Checked: 33 new tests (incl. a full descent through the real sim), full suite 2,338 pass, typecheck and production build pass; gate and rooms rendered headless by eye (standalone preview; the full game runs at ~0.6 fps on the software renderer, too slow to capture).

## The planet, Stages 148–150 (owner decisions, Oct 25 2026)
Owner: split the regions onto separate continents with travel between them; start on Veyloria; the Wastelands on Kharos with Solara; Aetheria's public capital is Meridian; Thalassia is on no continent, off Veyloria's coast, entered by an elevator or an underwater vehicle.
- [x] Stage 148 — planet data (planet.ts): Veyra (16,500 km, 1 g held by the simulation), 12 continents (7 playable now, Zephyria partly via the Storm Islands, 4 on the map only), 7 oceans, 48 nations; every map point belongs to one continent world (weighted anchors, tuned so borders run between cities: every region centre, Neon City's plateau, the Nexus hub and suburb and every landmark are checked).
- [x] Stage 149 — borders and travel (travel.ts, Scene): you cannot walk, drive, sail or fly across a continental border (free roam only: interiors, descents, the Storm Islands' airspace, races/activities and scripted missions suspend it); a transit terminal beside each landing zone (8, placed on clear ground) with a departures board (Y), flights through the existing transit; first landfall on each continent is recorded. The Thalassia elevator: a pier and platform off Veyloria's coast, a 6 s ride down to the Sentry Dock and back up; the Hydro-Phase Sub-Skiff can still sail there (Veyloria ↔ Thalassia is the one open crossing).
- [x] Stage 150 — the planet view (Director → Planet tab): a turnable globe, continents lit when playable, oceans, flight routes, Thalassia marked offshore; per-continent nations, look and a fly button once you have made landfall.
- [ ] Stage 151 — physical split: move each region onto its own landmass with real sea between (world.ts layout + terrain), then re-bake race routes and re-route supply roads per continent. Until then the regions still sit side by side, so borders are invisible lines and races/missions that were laid out across them suspend borders while running.
- Checked: 18 new tests, full suite 2,418 pass, typecheck passes; globe, elevator and terminal rendered headless by eye (standalone preview).
- [x] Owner reference boards applied (Oct 25): the dungeon-concepts board sets each signature dungeon's depth (600 m Rootbound to 3 km Abyssal Vault), floor range (6–8 up to 16–24, rolled per gate-day), its four areas (Surface Gate → … → the boss's area, shown on the HUD per floor) and its boss (The Ancient Spawn, Sun Eater, Frost Sovereign, Forge Warden, Sinking Saint, Prototype, Core Intelligence, Fracture Being, Leviathan King); a lying gate runs 25% deeper with two more floors. The planetary map board sets the globe layout (continent and ocean positions) and puts Thalassia off Veyloria's east coast in the Meridian Ocean. The Hollow Star raid board was already built upstream (Astravore). The enemies board's groups (Shadeborn, Ancient Guardians, Abyssal, Skyborn …) are still placement-only in reference-roster.ts.
- [x] Planet map looks like the owner's boards (Oct 25): the Planet tab is the owner's planetary map art with the live game drawn on it: dashed air routes with planes between the playable continents (bright once both ends are visited), the cyan sea lane to Thalassia off Veyloria, continent rings (open / make landfall first / not yet explorable), your location, and the board's legend and info panel (nations, major cities, size, climate, travel options) filled from planet.ts with the worldbuild board's continent pictures; pad A/B/X/Y and RT/LT (keyboard Enter, L, N, + / -) as on the board.
- [x] Raids are not on the map (owner, Oct 25): the Hollow Star arena moved to an instance far off the world, Astravore lost its walk-in lair and map marker, and the Raid tab launches it (transit, arena, boss wakes, exit pad back to Nexus). Checked in the real game: launching drops you in the cavern arena and Astravore wakes. Future raids join raid-instances.ts.


## Destiny-style dungeon and raid nodes on the destination map (owner request, Oct 25 2026)
- Done: every signature dungeon and the Hollow Star raid have a node on the Map tab's painted planet, beside their destination (director-activities.ts, ActivityNodes.tsx). Dungeons are rank-coloured diamonds, the raid a gold hex crest; a world gate open today pulses; cleared shows a check.
- Done: hover card (type, destination, rank, depth, floors, fireteam, boss) and a full launch screen with hero art, the four descent areas or the raid's six encounters, the final boss and roster, modifiers (champions, shared lives, collapse timer, sealed) and rewards (chests, clear, seals / Lens, Starbreaker, blueprint).
- Done: Launch on a dungeon travels to today's gate (or the destination, or the Thalassia pier for the Abyssal Vault) and starts the descent on arrival; this makes the gateless Sublevel Protocol, Forgotten Foundation and Abyssal Vault playable. The raid node uses the Raid tab's own launch.
- Open: fireteam size in the launch screen is display-only until online fireteams exist (descents run solo); keyboard V opens the selected destination's first node, a pad binding for cycling nodes is still to do.
