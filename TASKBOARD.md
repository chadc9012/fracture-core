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
| Phase 3: Godot inventory + wardrobe + transmog reading the web catalogues (export-godot-data.ts), equip from the street | lead (session_015nUG7fd8rEqjsn12yh1Fh7) | 2026-11-03 |
| Killbox bots: full bot teams on the arenas, allies and rivals (web build; the owner asked for this directly in session, Nov 2 21:14 — outside the Dec 4 scope by the owner's own call) | session_01HeBvGGZzSqLVyhhF3TcmJd | 2026-11-02 |

## Open (unclaimed, take in order within a phase)
- Phase 2/4 merge: Mission 01 (scripts/mission/, landed Nov 3 by session_01… without a claim) carries its own player.gd and rifle; move it onto scripts/player + scripts/combat so one operator, one gun and one HUD serve the street and the mission.
- Phase 3: Godot Supabase cloud save with Google sign-in (same `player_saves` table and `com.chadc9012.worldfracture://auth/callback`).
- Phase 4: fd-01…fd-04 missions in Godot on the quest engine contract.
- Phase 5: traffic AI + building collisions in the driving district; district streaming (Active / Simulated / Frozen).
- Phase 5: shoppable clothing and furnishings stores in the mall; first racing venue with stands and pit lane.

## Deferred past Dec 4 (lead's call, Nov 2)
- Phase 1: server-side mission-run guard — needs a migration applied on the live Supabase project that can't be verified from a session; changes nothing playable.

## Done
| Task | Commit |
| --- | --- |
| Phase 4: Apartment 12-04 opening in Godot — Mission 01 "The Fracture" end to end (owner asked directly, Nov 2: "build the first mission of the game first inside of the block"); session_01PQQWemhLWEFEw4j69oN1tq. **For the lead:** it carries its own on-foot player, rifle/blast/dash, echo enemies and HUD inside `scripts/mission/` (physics bodies, not the data-box rules of `scripts/player/`), so it should move onto `operator_player.gd` and the Phase 2 weapons/enemies/HUD when those land | 9d9079a, this push |
| Phase 2: Godot enemies (scout, elite, executor, marksman, drone; patrol / alert / engage; they shoot back; hull, down, respawn) + HUD (hull bar, ammo, crosshair) | see git log "Godot: enemies" (Nov 3) |
| Phase 4: Mission 01 "The Fracture" in Godot (apartment, morning, Fracture, Breach fight) | 9d9079a (another session) |
| Phase 2: Godot weapons (Auto / Sniper / Fusion frames, hitscan, ammo, reload, fire/reload/swap, HUD, practice dummies) | see git log "Godot: shooting" (Nov 3) |
| Phase 2: Godot on-foot operator in the street slices (stick, look-drag, jump, sprint, chase camera, kerbs, obstacle slide) | see git log "Godot: on foot" (Nov 2); grapple waits for the weapons pass |
| Killbox: Kaiju Complex, Fracture Floor, Killbox Prime arenas + map rotation (web build, owner asked in session) | 81bebbc, d2729c1, 1bf20ec, this push |
| Phase 1: melee items as Fracture Blade skins/stats (web build) | see git log "Melee slot" (Nov 2) |
