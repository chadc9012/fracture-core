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
| Phase 2: Godot weapons — rifle / sniper / fusion frames, hitscan + projectile, ammo and reload, fire button | lead (session_015nUG7fd8rEqjsn12yh1Fh7) | 2026-11-02 |
| Killbox arena maps to the owner's PvP maps board (web build; the owner asked for this directly in session — outside the Dec 4 scope, paused after Killbox Prime pending the owner's call) | session_01HeBvGGZzSqLVyhhF3TcmJd | 2026-11-02 |

## Open (unclaimed, take in order within a phase)
- Phase 2: Godot enemies — 5 types from the web AI (`src/game/sim.ts`), spawns in the Nexus block.
- Phase 2: Godot HUD — hull, ammo, crosshair, compass, objective (the phone's simple HUD first).
- Phase 3: Godot inventory + wardrobe + transmog reading the web catalogues via `export-godot-data.ts`.
- Phase 3: Godot Supabase cloud save with Google sign-in (same `player_saves` table and `com.chadc9012.worldfracture://auth/callback`).
- Phase 4: Apartment 12-04 opening in Godot.
- Phase 4: fd-01…fd-04 missions in Godot on the quest engine contract.
- Phase 5: traffic AI + building collisions in the driving district; district streaming (Active / Simulated / Frozen).
- Phase 5: shoppable clothing and furnishings stores in the mall; first racing venue with stands and pit lane.

## Deferred past Dec 4 (lead's call, Nov 2)
- Phase 1: server-side mission-run guard — needs a migration applied on the live Supabase project that can't be verified from a session; changes nothing playable.

## Done
| Task | Commit |
| --- | --- |
| Phase 2: Godot on-foot operator in the street slices (stick, look-drag, jump, sprint, chase camera, kerbs, obstacle slide) | see git log "Godot: on foot" (Nov 2); grapple waits for the weapons pass |
| Killbox: Kaiju Complex, Fracture Floor, Killbox Prime arenas + map rotation (web build, owner asked in session) | 81bebbc, d2729c1, 1bf20ec, this push |
| Phase 1: melee items as Fracture Blade skins/stats (web build) | see git log "Melee slot" (Nov 2) |
