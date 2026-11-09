# World Fracture task board (owner's Dec 4 plan)

Owner's instruction, Nov 2 2026: the roadmap session is the **lead session** — every Claude session working on this repo checks
this board before starting anything, claims its task here (one line, pushed to main) and does not start a task another session
holds. Lead session: `https://claude.ai/code/session_015nUG7fd8rEqjsn12yh1Fh7`. If you cannot reach it, claim here, push, and
carry on; the lead merges the board.

The full roadmap is the owner's doc "World Fracture roadmap" (claude.ai artifact, Nov 2). Target: a playable Godot vertical
slice on the owner's phone by **Dec 4 2026**. Scope that is **out** until then: Killbox and raids in Godot, melee slot
(option 2), clothing meshes, planes/ships/planet travel, the four new continents, Overgeared crafting, gore toggle, and any
web-build (`src/`) feature work beyond verification and fixes.

## How to claim
Append a row under *Claimed*, with your session link and the date, then push. Move it to *Done* with the commit when it lands.
Rows are the lock; `git fetch` before you claim.

## Phases (in order; each gates the next)
1. **Close out the web build** — melee as Fracture Blade skins/stats (option 1), server-side mission-run guard, phone verification.
2. **Godot on-foot player and combat** — third-person operator in the street slices, rifle/sniper/fusion frames, 5 enemy types, HUD.
3. **Godot progression and saves** — inventory, wardrobe/transmog, Nex per operator, Supabase cloud save + Google sign-in.
4. **Godot story** — Apartment 12-04 opening, Fracture Descent fd-01…fd-04, cutscenes.
5. **Godot cities and vehicles** — district streaming, traffic AI and building collisions, wishlist stores, one racing venue.

## Claimed
| Task | Session | Since |
| --- | --- | --- |
| Owner ask (Nov 8, 19:31): cleanup pass — play through every mission, fix performance / FPS, audio and dialogue issues, and unintended overlaps (trees, rocks, props, clothing); lands the playtest + phone-performance PRs #2/#3 against main as its base | session_01BYbdaSv5NptxoJHKBKWqiM | 2026-11-08 |
| Killbox bots, Skydock, Neon Yard, Glass Spire, Riverfront and Solara Outpost arenas, then the PvP maps board in order (web build, exported to Godot's killbox.json; the owner asked for this directly in session, Nov 2 21:14 — outside the Dec 4 scope by the owner's own call) | session_01HeBvGGZzSqLVyhhF3TcmJd | 2026-11-02 |

## Open (unclaimed, take in order within a phase)
- Asset catalog gaps (owner's boards, Nov 8; `docs/asset-catalog.md`), in this order once the Godot slice is on the phone:
  2. PvP modes missing from pvp.ts: Extraction, Ranked (owner's board) — web-side rules + bots (killbox web session), then re-export to Godot.
  3. Vehicles with no authored hull: tank, VTOL, jet, helicopter, cargo airship, boat / yacht, submarine, hovercraft.
  4. Wildlife set (deer, boar, wolf, bear, panther, crocodile, shark, raptor, reptile) + behaviours (herds, hunting, nocturnal).
  5. Fracture creatures (Rift Hound, Crystal Stalker, Abyssal Leviathan, Vyrak, Astravore, Colossus) with their fights.
  6. City infrastructure and interiors (part 2 §1–2), civilian life props (§3), combat details (§5), character appearance (§4).
  7. Vegetation / rock gaps (cherry blossom, baobab, bamboo, alien flora, vines; arch, cave, ice), natural effects (waterfall, lava, snow, lightning), VFX (rift, portal, hologram, energy field).
  8. Fantasy & dimensional set (§9) for the Shattered Expanse and boss arenas.

## Deferred past Dec 4 (lead's call, Nov 2)
- Controller unification: Mission 01's physics player onto scripts/player (the gear, outfit and drops already carry into the mission; the interiors rely on physics bodies, so the rewrite buys nothing playable before Dec 4).
- Phase 1: server-side mission-run guard — needs a migration applied on the live Supabase project that can't be verified from a session; changes nothing playable.

## Done
| Task | Commit |
| --- | --- |
| Owner ask (Nov 8 19:26): Nexus street closer to the night renders — wet-night pass (screen-space mirror overlay for the mobile renderer, dark wet paving with puddles, rain) and the first Meshy street set (bench-neon, kiosk, vending, motorbike, plaza-arch) placed per tile. **For the lead:** the glass towers (models/buildings/neon-v-*, nexus-civic-*) read as crumpled shards up close since the Android fit — worth a gentler collapse on those | see git log "wet night" (Nov 8) |
| Asset gap 2 (Godot half): Killbox modes — Dominion, Freefall, Lockdown, Ascendancy with a mode picker, zone / objective presence, bot objectives, round resets, per-mode HUD | see git log "Godot Killbox: every mode" (Nov 8) |
| Asset gap 1: Godot takes the web's authored sets — all fleet GLBs, pistol / shotgun / SMG / heavy / launcher / sword with their frames, foliage, the 18 web buildings; civilians on the sidewalks | see git log "Godot: the authored sets" (Nov 8) |
| Phase 5: district streaming — the street slice as seven block tiles, Active / Simulated / Frozen round the operator or car, index-stable obstacle slots, traffic over the simulated span | see git log "Godot: district streaming" (Nov 8) |
| Owner ask (Nov 8): Game Modes — PvP, Raids and Races as separate modes from a ⚔ GAME MODES hub styled on the owner's boards; PvP tiles open the Killbox arenas; Raid 01 The Hollow Star (Broken Gate + Astravore, four phases, bot fireteam, checkpoint, first-clear Lens + Starbreaker); the Neon Night Circuit street race with bot racers; bots now, online later (owner's call) | see git log "Game Modes" (Nov 8) |
| Post-Dec 4: Killbox in Godot — killbox.json export, Kaiju Complex built from the data (roofs, walks, cover, parapets, neon), Clash first-to-75 against two bot teams, kill plane, Billboard Blackout, scoreboard, KILLBOX button; then the arena picker with Fracture Floor (Grid Rewrite shifters) and Killbox Prime (Containment Lock) | see git log "Godot: the Killbox" and "Killbox: all three arenas" (Nov 3–8) |
| Phase 5 follow-up: Haven Home furniture drawn in Apartment 12-04 (per-slot replacements and additions) | see git log "Apartment 12-04 shows the furniture" (Nov 3) |
| Phase 3 follow-up: Google sign-in in the Godot app (PKCE via the browser and a localhost callback, no custom build) | see git log "Godot: sign in with Google" (Nov 3) |
| Phase 4: fd-02 First Resonance, fd-03 Broken Signal, fd-04 Into the Shrouded Swamps in the Verdant Forest (region PLAY mode, shared operator/guns/troopers/gear, quests.json) | see git log "Godot: the Fracture Descent" (Nov 3) |
| Phase 2/4 merge (gear side): the worn weapon's frame, numbers and authored model, the outfit tint and a first-clear boss drop in Mission 01 | see git log "Mission 01 takes the worn gear" (Nov 3) |
| Phase 5: mall shops — Nova Threads (outfits, worn tint) and Haven Home (furnishings) with Nex purchases | see git log "Godot: mall shops" (Nov 3) |
| Phase 5: Nexus Speedway, the first racing venue (track data, stands, pit lane, lights, 3 rivals, 3 laps, positions, best lap, prize Nex) | see git log "Godot: Nexus Speedway" (Nov 3) |
| Phase 5: traffic on the street slices (eight pooled civilian cars, lanes, gaps, stops for the operator and the player's car, moving obstacle boxes) | see git log "Godot: traffic" (Nov 3) |
| Phase 5: on foot ↔ driving on the street slices (ENTER a parked car, drive with its garage build, brake, EXIT; collisions with the scene's boxes; chase camera; troopers engage the car) | see git log "Godot: get in the car" (Nov 3) |
| Phase 3: Godot cloud save (email code sign-in, session, sync of character / profile / inventory / mission into player_saves `data.godot`, web-side mergeGodot) | see git log "Godot: cloud save" (Nov 3) |
| Phase 4: Apartment 12-04 opening in Godot — Mission 01 "The Fracture" end to end (owner asked directly, Nov 2: "build the first mission of the game first inside of the block"); session_01PQQWemhLWEFEw4j69oN1tq. **For the lead:** it carries its own on-foot player, rifle/blast/dash, echo enemies and HUD inside `scripts/mission/` (physics bodies, not the data-box rules of `scripts/player/`), so it should move onto `operator_player.gd` and the Phase 2 weapons/enemies/HUD when those land | 9d9079a, this push |
| Phase 3: Godot inventory + wardrobe + transmog (gear.json export, worn slots, bag, power, drops, transmog row; worn weapons are the gun list) | see git log "Godot: inventory" (Nov 3) |
| Phase 2: Godot enemies (scout, elite, executor, marksman, drone; patrol / alert / engage; they shoot back; hull, down, respawn) + HUD (hull bar, ammo, crosshair) | see git log "Godot: enemies" (Nov 3) |
| Phase 4: Mission 01 "The Fracture" in Godot (apartment, morning, Fracture, Breach fight) | 9d9079a (another session) |
| Phase 2: Godot weapons (Auto / Sniper / Fusion frames, hitscan, ammo, reload, fire/reload/swap, HUD, practice dummies) | see git log "Godot: shooting" (Nov 3) |
| Phase 2: Godot on-foot operator in the street slices (stick, look-drag, jump, sprint, chase camera, kerbs, obstacle slide) | see git log "Godot: on foot" (Nov 2); grapple waits for the weapons pass |
| Killbox: Kaiju Complex, Fracture Floor, Killbox Prime arenas + map rotation (web build, owner asked in session) | 81bebbc, d2729c1, 1bf20ec, this push |
| Phase 1: melee items as Fracture Blade skins/stats (web build) | see git log "Melee slot" (Nov 2) |
