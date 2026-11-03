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
| Post-Dec 4 (owner: everything in order, full permission): Killbox in Godot — export the arena data (killbox-arenas.ts) to Godot, build Kaiju Complex from it, Clash (6v6 TDM) with trooper bots on two teams, the Killbox screen on the globe | lead (session_015nUG7fd8rEqjsn12yh1Fh7) | 2026-11-03 |
| Killbox bots: full bot teams on the arenas, allies and rivals (web build; the owner asked for this directly in session, Nov 2 21:14 — outside the Dec 4 scope by the owner's own call) | session_01HeBvGGZzSqLVyhhF3TcmJd | 2026-11-02 |

## Open (unclaimed, take in order within a phase)
- Phase 5: district streaming (Active / Simulated / Frozen) once the block becomes more than one street.

## Deferred past Dec 4 (lead's call, Nov 2)
- Controller unification: Mission 01's physics player onto scripts/player (the gear, outfit and drops already carry into the mission; the interiors rely on physics bodies, so the rewrite buys nothing playable before Dec 4).
- Phase 1: server-side mission-run guard — needs a migration applied on the live Supabase project that can't be verified from a session; changes nothing playable.

## Done
| Task | Commit |
| --- | --- |
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
