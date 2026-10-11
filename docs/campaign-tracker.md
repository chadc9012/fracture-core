# World Fracture — Campaign Tracking Document and Story Gap Analysis

Repo state: commit `769c0c3` plus uncommitted docs. **The repository is the source of truth for what is implemented.** The 10/22/45-mission plans live only in chat history; they are kept as Appendix 1 and are not the baseline.

**Method and limits.** Everything here comes from reading code, `grep` across `src`, and two throw-away `bun` simulations of `gameTick` (run, then deleted; no gameplay file was touched). Tests run: `bun test src/game` → **175 pass, 0 fail** (pure logic only). **No browser verification was performed**, so **no item is VERIFIED PLAYABLE.** The only runtime evidence is the user's own screenshots of 2026-10-09: the tutorial at "02 · Movement Trial" (gates 3/3), forest and convoy rendering. Findings marked *(static)* come from code reading and are not observed in a browser.

Status legend — Playable: NOT STARTED · DATA ONLY · PARTIALLY PLAYABLE · PLAYABLE BUT UNVERIFIED · VERIFIED PLAYABLE. Story: NOT WRITTEN · PREMISE ONLY · PARTIAL (in-engine lines only) · COMPLETE (opening, dialogue, objectives, encounters, boss mechanics, transitions, rewards, consequences all written — **nothing meets this**).

---

## 1. The real campaign structure

| Layer | Count | Where | How it relates |
|---|---|---|---|
| Tutorial / first mission `mission-01` "First Resonance" | 1 | `onboarding.ts`, `GameCanvas.tsx deploy()` | **Not a quest.** Outside the `fd-` chain; completes on tutorial VICTORY. |
| Quest spine "The Fracture Descent" `fd-01`…`fd-18` | 18 | `src/game/quests.ts` | Linear `nextQuestId` chain, verified by simulation: fd-01 → … → fd-18, no branches. |
| Scripted missions (state machines) | 6 | `src/game/missions/*` | **All six are embedded inside quests** (below). They are not independent. |
| Dungeons / raids | 4 playable-ish + 1 concept | `dungeons.ts`, `system-foundations.ts` | Side activities. Only the Fuel King raid is read by a quest (`fd-15`). |
| Finale | 1 | `system-core` mission = quest `fd-18` | The campaign **already ends** here: completion fires `EndingOverlay` (3 auto-selected endings). |

**Scripted missions are embedded, not additional.** Mapping (from the objectives in `quests.ts` and the completion effects in `GameCanvas.tsx`):

| Scripted mission | Embedded in quest | Event it emits |
|---|---|---|
| `awakening` | `fd-01` Awakening | `MISSION_COMPLETE awakening` |
| `broken-signal` | `fd-03` Broken Signal | `MISSION_COMPLETE broken-signal` |
| `blackout-protocol` | `fd-06` Signals in the Static (+ heat 3) | `MISSION_COMPLETE blackout-protocol` |
| `stitched-neon-core` | `fd-07` Full Lockdown (+ heat 5) | `MISSION_COMPLETE stitched-neon-core` |
| `descent-protocol` | `fd-16` Descent Protocol (+ 60 s dive) | `MISSION_COMPLETE descent-protocol` |
| `system-core` | `fd-18` The System Core | `BOSS_DEFEATED system-core` |

So the true main-story length today is **18 quests + the tutorial = 19 units**, with 6 of the 18 backed by a scripted mission and 12 backed only by a generic objective (kill count, survive timer, enter region, hack, lockdown tier, boss). Counting scripted missions on top of quests would double count six.

---

## 2a. Status of the B1/B2 repair (2026-10-09, code + unit tests only; **not browser-verified**)

| Finding | Fix | Where | Tests |
|---|---|---|---|
| 2.1 Kill/survive events never emitted | `questEventsFromHud` turns each HUD snapshot into `ENTER_WORLD`, `HEAT_LEVEL`, `LOCKDOWN_TIER`, `HACK_COMPLETE`, **`KILL {region}`** (one per defeated machine, baseline-safe) and **`SURVIVED {region}`** (alive only, capped per snapshot); `GameCanvas` applies them with a functional update | `src/game/quest-signals.ts`, `GameCanvas.tsx` | `quest-progression.test.ts`: per-quest tests for fd-02/05/08/11/12/13/14, wrong-region tests, full fd-01→fd-18 replay |
| 2.2 Early mission completion dropped | Event ledger `reconcileQuests`: the active quest is credited with missions/raid clears already in `completedMissions`/`dungeonClears`; cascades, idempotent, repairs already-stuck saves; runs inside `gameTick` and once on load | `src/game/quests.ts`, `GameCanvas.tsx` | early completion, later activation, duplicate delivery, raid clear, save/load, stuck-save repair |
| 2.3 Returning player re-asked for vehicle / `broken-signal` blocked | `vehicleUnlocked` is derived from saved `selectedVehicle` (and `vehicleId` follows it); gate extracted as `brokenSignalReady` | `src/game/mission-gates.ts`, `GameCanvas.tsx` | returning-player and prerequisite tests |

**Mission persistence pass (code + unit tests, not browser-verified):** 2.4 now addressed in code — `progression.activeMissions` stores each scripted mission's phase and progress, restored on load when safe (`missions/persistence.ts`); 2.6 now has state-machine tests for all six machines (awakening, broken-signal, blackout-protocol, stitched-neon-core, descent-protocol, system-core). Still open: 2.5 Awakening not zone-anchored; resumed combat/boss phases respawn their wave/boss fresh (by design); mission statuses stay UNVERIFIED until played in a browser. Remaining browser checks: kill 5 enemies in Veridan and watch `fd-02` advance; stand ~90 s in the Swamps at `fd-05`; Continue as a returning player and confirm no vehicle prompt and that Broken Signal starts about 6 s after Awakening is done.

---

## 2. Critical findings (read these first)

1. **The quest chain cannot get past `fd-02` in the current code** *(static + simulation)*. `fd-02`, `fd-05`, `fd-08`, `fd-11`, `fd-12`, `fd-13` and `fd-14` need `KILL {world}` or `SURVIVED {world}` events (for Veridan, Swamps, Solara, Frostspire, Ember, Wastelands). `grep` finds **no code that dispatches them**: the only `gameTick` call sites are in `GameCanvas.tsx` (six `MISSION_COMPLETE`/`BOSS_DEFEATED`, plus `ENTER_WORLD`, `HEAT_LEVEL`, `LOCKDOWN_TIER`, `HACK_COMPLETE`, and `SURVIVED thalassia-dive`) and `OperationsHub.tsx` (`DUNGEON_CLEARED`, `BOSS_DEFEATED`). A simulation replaying every event the game can emit six times leaves the player at **`active = fd-02`, done = `fd-01`**. Consequences: `fd-03`…`fd-18` never become active through normal play; `QuestTracker` shows `fd-02` forever; and `system-core` cannot start because its gate requires `activeQuestId === "fd-18"` (`GameCanvas.tsx` l.364). **The finale is unreachable**, and `corruptionLevel` never rises from kills (same missing `KILL` event), so the Wastelands auto-unlock via corruption (`updateWorldState`) never fires either.
2. **Quest events for an inactive quest are discarded** *(simulation)*. `gameTick` only credits the active quest. Scripted missions 2–4 are gated only by the previous mission (`completedMissions`), not by the quest chain, so if `broken-signal` finishes while `fd-02` is active, its `MISSION_COMPLETE` is lost; because the mission cannot replay, `fd-03` can never complete. Same exposure for `fd-06`, `fd-07`, `fd-16`. (Simulation: complete `broken-signal` during `fd-02`, finish 5 kills → `fd-03` active but stuck until the event is replayed.)
3. **Returning players are re-offered the vehicle choice and `broken-signal` may never start** *(static)*. `vehicleUnlocked` is local `useState(false)` (`GameCanvas.tsx` l.236) and is only set inside `deploy()` (l.482). Continue → hub → world skips `deploy()`, so the "Choose your first vehicle" overlay (l.717, shown when `tutorialComplete && !vehicleUnlocked`) reappears and `missionReady` (needs `vehicleUnlocked`, l.293) stays false until a vehicle is picked again.
4. **Mission state is not persisted** *(static)*. Each machine's run object lives in React `useState`; only completion (`completedMissions`, quest progress) is saved. Reloading mid-mission restarts the mission from `IDLE`. The Verdant crash-site scan (`verdant.ts`) is also session-only and emits no quest/mission event.
5. **Awakening is not tied to a place** *(static)*: it starts 2.5 s after the tutorial wherever the player stands, anchored at their position (`Scene.tsx` ~l.1499–1501), while its text says "Neon Core" and quest `fd-01` says Veridan.
6. **Tests cover almost none of this.** Only `missions/broken-signal.test.ts` (3 tests) exists for the mission engine. The other five machines, `quests.ts` `gameTick`, `GameCanvas` mission effects and Scene wiring are untested. `mission-rewards.test.ts` covers `rewardMission`.

---

## 3. Quest tracker — `fd-01`…`fd-18`

Common to all quests: **persistence** — `completedMissions`, `activeQuestId`, `questObjectiveProgress`, `unlockedWorlds`, `worldFlags`, `corruptionLevel`, `fractureShards` on `PlayerProgression` (`progression.ts`, rides cloud-save merge); **tests** — none for `quests.ts`; **narrative** — one `line` each in `quests.ts`, no brief/dialogue/cinematic. `unlocksWorld` is a flag, never a movement gate. "Gate" = what makes the objective possible in the running game.

| ID | Name | Zone | Objective (completion) | Scripted mission | Event the game emits? | Playable status | Reward (shards) | Missing — gameplay | Missing — narrative |
|---|---|---|---|---|---|---|---|---|---|
| fd-01 | Awakening | veridan | `MISSION_COMPLETE awakening` | `awakening` | Yes (`GameCanvas` l.283) | PLAYABLE BUT UNVERIFIED | 150 | Zone anchor; tests; persistence of run | Why the player is here; location contradiction |
| fd-02 | First Resonance | veridan | KILLS veridan ×5 | — | **No (`KILL` never emitted)** | **PARTIALLY PLAYABLE — blocks the chain** | 150 | Emit `KILL {world}` from `defeatMachine`/Scene | Same title as tutorial `mission-01` |
| fd-03 | Broken Signal | veridan | `MISSION_COMPLETE broken-signal` | `broken-signal` | Yes (l.301), dropped if not active | PLAYABLE BUT UNVERIFIED | 200 | Catch-up of earlier completions; vehicle gate | Who built the signal |
| fd-04 | Into the Shrouded Swamps | veridan→swamps | ENTER_WORLD swamps | — | Yes (l.391) | PLAYABLE BUT UNVERIFIED | 120 | Zone-entry content | Threshold scene |
| fd-05 | Crossing the Shrouded Swamps | swamps | SURVIVE swamps 90 s | — | **No** | DATA ONLY | 260 | Emit `SURVIVED {region}` | Swamp storyline; KV-Unit boss unused |
| fd-06 | Signals in the Static | neon | `MISSION_COMPLETE blackout-protocol` + HEAT ≥3 | `blackout-protocol` | Yes (l.319) + heat (l.396) | PLAYABLE BUT UNVERIFIED | 220 | Tests; quest-order catch-up | Syndicate motives |
| fd-07 | Full Lockdown | neon | `MISSION_COMPLETE stitched-neon-core` + HEAT ≥5 | `stitched-neon-core` | Yes (l.337) | PLAYABLE BUT UNVERIFIED | 320 | Tests; catch-up | Aegis-Prime backstory |
| fd-08 | The Desert Approach | solara | SURVIVE solara 90 s | — | **No** | DATA ONLY | 260 | Emit `SURVIVED`; Solara has no catalog boss | Solara storyline |
| fd-09 | Protocol Breach | nexus | HACK_COMPLETE | — | Yes (l.406, stealth hack meter) | PLAYABLE BUT UNVERIFIED | 280 | Dedicated hack objective | Nexus Authority arc |
| fd-10 | Sector Lockdown | nexus | LOCKDOWN_TIER purge | — | Yes (l.401) | PLAYABLE BUT UNVERIFIED | 340 | Deliberate trigger (currently incidental) | Why a purge targets the player |
| fd-11 | Ember's Warning *(mis-titled; zone is frostspire)* | frostspire | SURVIVE frostspire 90 s | — | **No** | DATA ONLY | 260 | Emit `SURVIVED` | Rename; Frostspire arc |
| fd-12 | Core Fragment Recovery | ember | KILLS ember ×8 | — | **No** | DATA ONLY | 300 | Emit `KILL` | Ember storyline |
| fd-13 | The Failure Core | ember | SURVIVE ember 60 s | — | **No** | DATA ONLY | 340 | Emit `SURVIVED`; Overseer Kael boss unused | Containment-failure scene |
| fd-14 | Grid-Iron Highway | wastelands | KILLS wastelands ×10 | — | **No** | DATA ONLY | 300 | Emit `KILL` | Rebellion arc |
| fd-15 | The Fuel King | wastelands | BOSS_DEFEATED `wasteland-fuel-king` | — (raid) | Yes, via `OperationsHub` raid clear (menu-driven) | PLAYABLE BUT UNVERIFIED (not in-world) | 500 | In-world boss path | Fuel King motives |
| fd-16 | Descent Protocol | thalassia | `MISSION_COMPLETE descent-protocol` + dive 60 s | `descent-protocol` | Yes (l.355) + dive (l.412) | PLAYABLE BUT UNVERIFIED | 320 | Tests; catch-up | Deepmind introduction |
| fd-17 | Thalassia | thalassia | SURVIVE thalassia-dive 180 s | — | Yes (l.412) | PLAYABLE BUT UNVERIFIED | 400 | Dedicated encounter | "Finish what it started" scene |
| fd-18 | The System Core | thalassia | BOSS_DEFEATED `system-core` | `system-core` | Yes (l.376), **but starts only when `activeQuestId === fd-18`** | **Unreachable in practice (finding 1)** | 1000 | Chain unblock; tests | Finale content; 3 endings auto-picked |

Quest rewards also include `rewardMaterials` and `corruption` in `quests.ts` (not repeated here).

---

## 4. Scripted-mission tracker

Common: run state in React state (not saved); completion saved via `rewardMission` (first-clear 1.5×, daily repeat taper, `progression.ts`) then `gameTick`; spawns use `spawnMissionDrones` (`sim.ts` l.518: base 3 hp, elite 6 hp) or `summonBoss(..., {mission:true})`; events from `Scene.tsx` l.1396–1515.

| ID | Name / zone | Trigger & prerequisite | State machine & completion | Enemies / boss | Reward | Tests | Narrative present | Missing |
|---|---|---|---|---|---|---|---|---|
| `mission-01` | First Resonance / veridan | Deploy as new player (`deploy()` sets `FIRST_TUTORIAL`); skipped if `tutorialComplete` | `onboarding.ts`: MATERIALIZE → MOVEMENT → ABILITY → CONTACT → REINFORCE → CHAMBER → POWER → SENTINEL → VICTORY | training drones, tutorial Sentinel (`Scene.tsx` `sentinel`) | `rewardMission mission-01` (+1 data shard, `tutorialComplete`, calibration token, tactical ability unlock) | None for `advanceTutorial` | Tutorial text complete (9 steps), intro cinematic | Step not saved (reload restarts); no crash-site link; no controller prompts |
| `awakening` | Awakening / "Neon Core" text, runs anywhere | 2.5 s after tutorial if not `awakeningDone` | IDLE → DROP → PATROL → ESCALATION → LOOT → CAPTURE → HOLD → EXTRACT → COMPLETE (`missions/awakening.ts`) | Waves via `spawnMissionDrones` (elite on escalation) | `rewardMission` +2 data shards; +4 scrap at loot | None | NOVA line per state | Zone anchor; contradictory location; tests |
| `broken-signal` | Broken Signal / veridan | `missionReady`: world phase, no tutorial, **`vehicleUnlocked`**, `awakeningDone`, not completed; starts after 6 s | IDLE → TRIGGERED → DISCOVERY → TRAVERSAL → COMBAT_1 (3 drones) → HACKING → COMBAT_2 (5 elite) → COMPLETE → WORLD_UPDATE | 8 drones | `rewardMission` +3 data shards | **3 tests** (`broken-signal.test.ts`: order, wave gating) | NOVA lines, hack overlay (`BrokenSignalOverlay`) | Persist; vehicle gate bug; quest-order catch-up |
| `blackout-protocol` | Blackout Protocol / Neon City | `completedMissions ∋ broken-signal` (l.310) | IDLE → TRIGGERED → INFILTRATION → COMBAT_1 (4) → HACKING → COMBAT_2 (6 elite) → COMPLETE | 10 drones | +4 micro-circuits | None | NOVA lines | Travel to Neon not enforced; tests |
| `stitched-neon-core` | Stitched Neon Core / Neon City | `∋ blackout-protocol` (l.328) | IDLE → TRIGGERED → DESCENT → COMBAT_1 (5 elite) → STABILIZING → BOSS → COMPLETE | Aegis-Prime (`encounters.ts`, 3-phase `boss-phases.ts`, poise `boss-poise.ts`) | +1 aegis core | None | NOVA lines | Boss narrative; tests |
| `descent-protocol` | Descent Protocol / Thalassia | `∋ stitched-neon-core` (l.346) | IDLE → TRIGGERED → DIVE → COMBAT_1 (4) → TRACING → COMPLETE (ends on cliffhanger) | 4 drones | +5 data shards | None | NOVA lines | Underwater combat check; tests |
| `system-core` | The System Core / Thalassia | `∋ descent-protocol` **and `activeQuestId === fd-18`** (l.364) | IDLE → TRIGGERED → DIVE → COMBAT_1 (6 elite) → STABILIZING (3 locks) → BOSS → COMPLETE; fires `BOSS_DEFEATED system-core` → `EndingOverlay` | `summonBoss thalassia` → unique scenario "system-core" | +1 fracture core; fd-18 1000 shards | None | NOVA lines; 3 endings | Unreachable until finding 1 is fixed; ending choice; tests |

---

## 5. Dungeons and raids (separate activities)

All run through `OperationsHub.tsx` `DungeonOperations` using the shared stage engine (`raid-stages.ts` `createEncounterRun`). They are **menu-driven stage simulations, not world-integrated**, and are unverified in a browser. Persistence: clear/reward via `progression` (`DUNGEON_CLEARED`, rewards). No tests found for the stage engine's content.

| ID | Name | Zone | Stages / boss | Required by main story? | Status |
|---|---|---|---|---|---|
| `arcology_vaults` | Sunken Arcology Vaults | Solara | 5 stages, Archive Guardian (4 phases) | No | PLAYABLE BUT UNVERIFIED (menu) |
| `glacial-crevasse` | Glacial Crevasse Network | Frostspire | 2 stages, Rimeheart | No | PLAYABLE BUT UNVERIFIED (menu) |
| `temple-echoes` | Sunken Temple of Echoes | Swamps | 3 stages, The Antiphon | No | PLAYABLE BUT UNVERIFIED (menu) |
| `wasteland-fuel-king` | The Fuel King (raid) | Wastelands | 4 stages, 3-phase Fuel King | **Yes — `fd-15` reads its boss clear** | PLAYABLE BUT UNVERIFIED (menu) |
| `fracture-core` | The Fracture Core raid (6–12 players) | Fracture Core | 4 phases, Core Sentinel / Anomaly Prime | No | DATA ONLY |

Other: Unique Scenario "Unbroken Glass" (Solara boss; debug/Emergency spawn), Emergency Quests, Director live missions — systemic content, not story.

---

## 6. Is it one coherent campaign?

**Not yet.** What holds together: a clear geographic descent (Veridan → Swamps → Neon → Solara → Nexus → Frostspire → Ember → Wastelands → Thalassia), a persistent spine, a bookend (Awakening in a forest → System Core at the bottom), and a consistent NOVA voice. What does not:

- **Mechanically the spine is broken** (findings 1–2): the finale cannot be reached.
- **Two parallel progress systems** (mission-ID chain vs quest chain) with different gating rules.
- **Twelve of eighteen quests are generic grinders** (kill N / survive N seconds) with a single line of text; only six have scripted content, and those six cluster in Veridan, Neon and Thalassia. Swamps, Solara, Nexus, Frostspire, Ember and Wastelands have **no scripted story mission**.
- **The story order is unstable**: Chronicle regions disagree with the code (§A.3 below), `fd-11` is mis-titled, `awakening` has three different locations.
- **The ending arrives with no earned choice**: 3 endings picked automatically from play style (`endingTierFor`).
- Faction allegiance (Resonants / Controllers / Breakers) and NOVA's secret have no hooks in any quest.

---

## 7. Gap lists

### A. Story gaps (priority order)
1. **Fix the canon**: one name/location per mission (resolve the 13 contradictions in §A.3), retitle `fd-11`, decide `mission-01` vs `fd-02` naming.
2. **Write the briefs for the 19 existing units** (tutorial + `fd-01`…`fd-18`): opening beat, mission-giver, dialogue, objectives, consequences. Today only one NOVA line per quest and per machine state exist.
3. **Zone storylines for the six zones with only generic quests** (Swamps, Solara, Nexus, Frostspire, Ember, Wastelands): who lives there, what they want, how it ties to the descent.
4. **Character arcs**: the Operator (three named operators exist), NOVA (what she knows and withholds), the Deepmind, the Authority, the Wasteland Rebellion, the Fuel King, the Syndicate.
5. **Reveals and transitions**: what each zone reveals, how the player gets from zone to zone, why the signal leads where it does.
6. **Choice model and finale**: define flags that matter, tie them to the endings (3 vs 4 endings undecided), write the System Core confrontation and aftermath. Decide whether the finale stays at `fd-18`.
7. **Dungeon/raid lore hooks** into the main story (only the Fuel King is referenced).

### B. Gameplay gaps (priority order)
1. **Unblock the chain**: emit `KILL {world}` and region `SURVIVED {world, seconds}` events (or change those objectives to events the game does emit). Without this nothing after `fd-02` is reachable and the finale cannot start.
2. **Make quest/mission ordering robust**: catch-up when a quest becomes active (credit already-completed missions) or gate missions on the active quest.
3. **Persist mission state** and the crash-site scan; fix returning-player `vehicleUnlocked` (derive from `progression.selectedVehicle`).
4. **Tests**: five untested machines, `gameTick`, the full chain with only emitted events (a regression test for finding 1), `rewardMission` interplay.
5. **Zone anchoring**: tie Awakening and mission starts to their zones; enforce or at least guide travel.
6. **Real encounters for the generic quests**, using existing bosses (Kael, KV-Unit, Subject Zero, Rimeheart) and existing zone hazards.
7. **In-world versions of dungeons/raids**, or an explicit decision to keep them menu-based.
8. **Browser verification pass** of the whole chain; only then promote any item to VERIFIED PLAYABLE.

---

## 8. Minimum additional main-story missions

Preserve all 18 quests and 6 scripted missions. The campaign does **not** need 45 missions. A coherent descent needs scripted content where none exists:

| New mission | Zone | Replaces / upgrades | Why needed |
|---|---|---|---|
| Swamp story mission (using KV-Unit boss) | Swamps | upgrades `fd-05` | Zone has only a survival timer |
| Solara story mission | Solara | upgrades `fd-08` (Unbroken Glass available) | Zone has only a timer |
| Nexus story mission (Authority purge) | Nexus | upgrades `fd-09`/`fd-10` | Nexus Authority arc has no mission |
| Frostspire story mission | Frostspire | upgrades `fd-11` | Timer only; Subject Zero available |
| Ember story mission (Overseer Kael) | Ember | upgrades `fd-12`/`fd-13` | Boss exists, no mission |
| Wasteland story mission | Wastelands | upgrades `fd-14` (Fuel King is `fd-15`) | Kill counter only |
| One mid-campaign reveal mission | any | new | Carries the NOVA secret and faction choice (no hook exists) |
| Finale approach / aftermath | Thalassia / beyond | extends `fd-18` | Optional; only if System Core stays final |

That is **6 upgraded quests + 1–2 new missions**, i.e. roughly **25 total** units instead of 45. Dungeons and raids stay separate, except that `fd-15` keeps its Fuel King raid dependency. If you want the roster's orbital/final acts, they are additions beyond System Core and need new engine systems (orbital region, branching ending).

---

## 9. Implementation order

**Track B first for the first two items, because they make the existing story reachable; then both tracks in parallel.**

1. **B1 — Unblock the chain** (emit `KILL` / region `SURVIVED`, or change objectives), plus a regression test that replays only emitted events through `gameTick` to `fd-18`.
2. **B2 — Ordering robustness + returning-player vehicle bug.**
3. **A1 — Canon decisions** (names, locations, `fd-11` title, ending count, whether System Core stays final).
4. **B3 — Persist mission state and crash-site scan; tests for the five missions.**
5. **A2 — Briefs for the 19 existing units** (start with the six scripted missions, then the generic quests).
6. **B4 — Browser verification pass of the full chain**, recording results in this file.
7. **A3 + B5 — Zone story missions** (one zone at a time, content plugged into the existing mission engine; write story, then data, then tests).
8. **A4 + B6 — Reveal mission, choice model, finale and ending selection.**
9. **A5 / B7 — Dungeon/raid lore hooks and in-world versions (optional).**

---

### A.0 Inventory of story material in the repo

| Source | What it contains | Completeness |
|---|---|---|
| `README.md` (545 lines) | Original design notes: world map structure, regions/war belt, factions, systems. Not mission scripts. | Design notes only |
| `roadmap.md` | Build log; mission entries 01–05 summarised (Broken Signal, Blackout Protocol, Stitched Neon Core, Descent Protocol, System Core) | Implementation notes, not story |
| `.lovable/plan/*.md` (9 files) | Feature plans (onboarding, dungeons, voice, UI). No mission catalog. | None for story |
| `src/game/quests.ts` | `fd-01`…`fd-18`: title, world, one narrative `line`, objectives, rewards, `nextQuestId`, `corruption` | One line per quest; no dialogue/cinematic/boss design |
| `src/game/missions/*.ts` (6) | NOVA `line` strings per state, `alert` strings, objective labels, header comments with story intent | Partial: beats exist for 6 missions |
| `src/game/retention.ts` `CHRONICLE` | 7 chapter summaries | Summaries only; region labels conflict (§A.3) |
| `src/game/retention.ts` `ROADMAP` | Forward story hooks: Signal Beyond, The Silent Array (Frostspire raid), Fireteam Protocol, Archive Seasons | Premise only |
| `src/game/onboarding.ts` | 9 tutorial steps with NOVA text (Materialization … Identity Stabilized) | Complete for the tutorial |
| `src/game/dialogue.ts` | Interior NPC dialogue (`INTERIOR_DIALOGUE`), revisit lines | NPC flavour, not mission script |
| `src/game/intro.ts` / `IntroCinematic.tsx` | Opening cinematic beats (THE FRACTURE / factions / signal / NOVA first contact) | Complete for the intro |
| `src/game/encounters.ts` | 7 regional troop rosters; 6 named bosses with lair, drop, tell: Veridan Effigy (veridan), Overseer Kael (ember), Rust-King Gant (wastelands), Subject Zero (frostspire), Kraken-Vanguard KV-Unit (swamps), Aegis-Prime (nexus); Solara has none | Boss names + tells; no mission context |
| `src/game/unique-scenarios.ts` | "Anomaly: The Unbroken Glass" (Solara), "system-core" scenario (Thalassia) | Two scripted bosses |
| `src/game/dungeons.ts` | 4 definitions with identity text, hazards, stages, boss phases: Sunken Arcology Vaults (Solara, Archive Guardian), Glacial Crevasse Network (Frostspire, Rimeheart), Sunken Temple of Echoes (Swamps, The Antiphon), The Fuel King raid (Wastelands) | Best-developed boss designs in the repo |
| `src/game/system-foundations.ts` | "The Fracture Core" raid (4 phases, ends in Core Sentinel), biome list incl. "Echo Veil" | Data/concept only |
| `src/game/raid-stages.ts` + `inventory.ts` | Core Breach / "The Anomaly Prime" final raid boss (material `anomalyCore`) | Data only |
| `src/components/game/EndingOverlay.tsx` | 3 endings | Written; selection logic is play-style, not choice-based |
| Factions (`roadmap.md`) | Resonants, Controllers, Breakers (player-allegiance); Corp Architects, Nomads, neutral | Named only |


### A.3 Contradictions and duplicates to resolve

| # | Issue | Evidence |
|---|---|---|
| 1 | Mission name drift: roster "First Signal" / "Broken Protocol" vs repo "First Resonance" / "Broken Signal" | `retention.ts`, `quests.ts`, `missions/broken-signal.ts` |
| 2 | Chronicle regions wrong: `broken-signal`, `blackout-protocol`, `stitched-neon-core` listed as "Nexus City"; `descent-protocol` and `system-core` listed as "Swamps" — code runs Broken Signal in Veridan (quest `fd-03`), Descent/System Core in **Thalassia** | `retention.ts` lines 7–13 vs `quests.ts`, `Scene.tsx` anchors |
| 3 | Chronicle says `awakening` is in "Nexus City"; `awakening.ts` says "Neon Core"; quest `fd-01` places it in Veridan ("You wake in a fractured forest") and Awakening starts wherever the player stands 2.5 s after the tutorial | `GameCanvas.tsx` ~l.276 |
| 4 | Quest `fd-02` "First Resonance" (kill 5 Veridan wildlife) is a different thing from tutorial `mission-01` "First Resonance" (HUD mission, tutorial VICTORY). Same name, two objects | `quests.ts`, `GameCanvas.tsx` deploy() |
| 5 | Quest `fd-11` is titled "Ember's Warning" but its world is **frostspire**; `fd-12`/`fd-13` are the actual Ember quests | `quests.ts` |
| 6 | Chronicle/in-game story order (Awakening → Broken Signal → Blackout → Stitched → Descent → System Core) vs roster order | — |
| 7 | Aegis-Prime is the Stitched Neon Core boss in code; roster has both "Neon Execution Unit" (M07) and "The Nexus Guardian AI" (M12). One boss, two roster slots | `encounters.ts`, `stitched-neon-core.ts` |
| 8 | Roster "Ember Core Titan", "Cryo Leviathan", "Deepmind Sentinel" vs code bosses "Overseer Kael", "Subject Zero" / "Rimeheart", System Core | `encounters.ts`, `dungeons.ts` |
| 9 | Roster "Architect's Vault" is the repo's Sunken Arcology Vaults, but that dungeon is in **Solara**, not the Act III zones | `dungeons.ts` |
| 10 | Roster Act III (Thalassia → Frost → Swamps) vs `quests.ts` order (Swamps → Neon → Solara → Nexus → Frostspire → Ember → Wastelands → Thalassia) — a different geography order | `quests.ts` header comment |
| 11 | The Fuel King (quest `fd-15`, wasteland raid) has no slot in the roster | `dungeons.ts`, `quests.ts` |
| 12 | Endings: code has 3 (Control/Chaos/Resonant, auto-selected); roster has 4 (choice-based) | `EndingOverlay.tsx` |
| 13 | Roster says NOVA withholds a secret (M36) — no earlier NOVA deception beats or flags exist to pay it off | — |


---

## Appendix 1 — Proposed 45-mission roster mapped onto the repo (reference only, not the baseline)

Mission IDs `M-01`…`M-45` are tracker IDs (proposed). "Existing ID" is the code ID where content exists. **Mapping is approximate; every mapped row is a loose match, not a confirmed equivalence.**

| ID | Title (roster) | Act / Zone | Existing ID | Story | Playable | Evidence (files / functions) | Objectives in code | Encounters / Boss | Rewards | Depends on |
|---|---|---|---|---|---|---|---|---|---|---|
| M-01 | First Signal | I · Veridan | `mission-01` (tutorial) + forest crash-site scan | PARTIAL (tutorial text complete; no mission brief; no "signal core") | PARTIALLY PLAYABLE | `onboarding.ts` `advanceTutorial`; `GameCanvas.tsx` `deploy()` (hud mission SURVIVE 20 s, KILL 2); `verdant.ts` `stepInvestigation`, `shouldWakePatrol`; `forest-encounter.ts` `spawnForestPatrol`; `Scene.tsx` ~l.1488 | Tutorial 9 steps; crash-site scan (session-only, not persisted); patrol ambush | Forest patrol; training drones; Sentinel (tutorial boss, `Scene.tsx` `sentinel`) | `rewardMission("mission-01")` on tutorial VICTORY | Character deploy |
| M-02 | First Contact | I · Veridan | — | PREMISE ONLY | NOT STARTED | No survivors-mission; civilians exist (`civilians.ts`) but no mission | — | — | — | M-01 |
| M-03 | The Forest Remembers | I · Veridan | — | PREMISE ONLY | NOT STARTED | — | — | — | — | M-02 |
| M-04 | Broken Protocol | I · Veridan→Nexus | `broken-signal` (+ quest `fd-03`) | PARTIAL (NOVA lines; name mismatch) | PLAYABLE BUT UNVERIFIED | `missions/broken-signal.ts` `advanceMission`; `broken-signal.test.ts` (3 pass); `Scene.tsx` l.1396–1410; `GameCanvas.tsx` l.293–306 | DISCOVERY → TRAVERSAL → COMBAT_1 → HACKING → COMBAT_2 → COMPLETE | 2 mission waves | `rewardMission` +3 dataShards, `gameTick` | M-01, `awakening` done, vehicle unlocked |
| M-05 | Road to Neon | I · Neon | — | PREMISE ONLY | NOT STARTED | No escort system | — | — | — | M-04 |
| M-06 | Neon Outskirts | I · Neon | `blackout-protocol` (+ `fd-06`) | PARTIAL | PLAYABLE BUT UNVERIFIED | `missions/blackout-protocol.ts`; `Scene.tsx` l.1432–1442; `GameCanvas.tsx` l.310–325 | INFILTRATION → COMBAT_1 → HACKING → COMBAT_2 | 2 waves in Neon City | `microCircuits`×4 | `broken-signal` |
| M-07 | Neon Core Infiltration | I · Neon | `stitched-neon-core` (+ `fd-07`) | PARTIAL (boss is Aegis-Prime, not "Neon Execution Unit") | PLAYABLE BUT UNVERIFIED | `missions/stitched-neon-core.ts`; `Scene.tsx` l.1444–1458; `encounters.ts` Aegis-Prime; `boss-poise.ts` | DESCENT → COMBAT_1 → STABILIZING → BOSS | Aegis-Prime | `aegisCore`×1 | `blackout-protocol` |
| M-08 | Echo of War | I · — | — | PREMISE ONLY | NOT STARTED | — | — | — | — | M-07 |
| M-09 | Nexus Signal | I · Nexus | quest `fd-09` Protocol Breach | PARTIAL (one quest line) | DATA ONLY | `quests.ts` fd-09 (HACK_COMPLETE); `stealth.ts` hack meter; hack event wired `GameCanvas.tsx` ~l.406 | One HACK | — | 280 shards | M-07 |
| M-10 | The Three Fractures | II · Nexus | — | PREMISE ONLY | NOT STARTED | — | — | — | — | M-09 |
| M-11 | City Under Siege | II · Nexus | quest `fd-10` Sector Lockdown | PARTIAL | DATA ONLY | `quests.ts` fd-10 (LOCKDOWN_TIER purge); `stealth.ts`. **No defend objective** | Reach purge tier | — | 340 shards | M-09 |
| M-12 | The Nexus Guardian | II · Nexus | boss exists only as Aegis-Prime (used by M-07) | PREMISE ONLY (duplicate boss) | DATA ONLY | `encounters.ts` | — | Aegis-Prime (already used) | — | M-11 |
| M-13 | Ghosts in the Network | II · Nexus | — | PREMISE ONLY | NOT STARTED | — | — | — | — | M-12 |
| M-14 | The Rebel Port | II · Wastelands | quest `fd-14` Grid-Iron Highway | PARTIAL | DATA ONLY | `quests.ts` fd-14 (KILLS wastelands 10); `wasteland.ts`; `lanes.ts`. **No negotiate/fight choice** | 10 kills | Wasteland raiders | 300 shards | M-13 |
| M-15 | Below the Wastes | II · Wastelands | Fuel King raid stage `underground-access` | PARTIAL (stage text) | DATA ONLY (menu-driven raid stage, not in-world) | `dungeons.ts` `wasteland-fuel-king`; `OperationsHub.tsx` `DungeonOperations`; `raid-stages.ts` `createEncounterRun` | Stage objective | — | — | M-14 |
| M-16 | Convoy of Ash | II · Wastelands | Fuel King raid stage `surface-convoy-raid` + `fd-15` | PARTIAL | DATA ONLY | `dungeons.ts`; `lanes.ts` (ambient convoys); `adaptation.ts`. **No protect-convoy objective** | Raid 3 convoys (raid UI) | Convoy escorts | — | M-15 |
| M-17 | Ember Peaks | II · Ember | quests `fd-12`, `fd-13` | PARTIAL | DATA ONLY | `quests.ts` (KILLS ember 8; SURVIVE ember 60); `region-hazards.ts`; `environment.ts` | Kills + survive | Ember troops | 300 / 340 shards | M-16 |
| M-18 | The Ember Core Titan | II · Ember | catalog boss Overseer Kael | PREMISE ONLY | DATA ONLY | `encounters.ts` Kael; `boss-phases.ts` (3 phases); `sim.ts` `summonBoss` (debug "B" / Emergency Quest only — **no mission trigger**) | — | Overseer Kael | `magmaCore` | M-17 |
| M-19 | Descent to Thalassia | III · Thalassia | `descent-protocol` (+ `fd-16`) | PARTIAL | PLAYABLE BUT UNVERIFIED | `missions/descent-protocol.ts`; `Scene.tsx` l.1460–1469; `underwater.ts`; `Thalassia.tsx` | DIVE → COMBAT_1 → TRACING | 1 wave | `dataShards`×5 | `stitched-neon-core` |
| M-20 | Sunken Truth | III · Thalassia | quest `fd-17` | PARTIAL | DATA ONLY | `quests.ts` fd-17 (SURVIVE thalassia-dive 180) | Survive 180 s | — | 400 shards | M-19 |
| M-21 | Deepmind Sentinel | III · Thalassia | `system-core` (+ `fd-18`) | PARTIAL — but it is currently the **campaign finale** (§1 (the campaign finale)) | PLAYABLE BUT UNVERIFIED | `missions/system-core.ts`; `Scene.tsx` l.1471–1485; `unique-scenarios.ts` "system-core"; `GameCanvas.tsx` l.376 `BOSS_DEFEATED`; `EndingOverlay.tsx` | DIVE → COMBAT_1 → STABILIZING (3 locks) → BOSS | System Core scenario boss | `fractureCore`; 1000 shards; **fires EndingOverlay** | M-19 |
| M-22 | The Temple of Echoes | III · Swamps | dungeon `temple-echoes` | PARTIAL (identity + boss phases) | PLAYABLE BUT UNVERIFIED (menu-driven dungeon, not world-integrated) | `dungeons.ts`; `OperationsHub.tsx` `DungeonOperations` (`DUNGEON_CLEARED` ~l.108) | 3 stages | The Antiphon | Antiphon's Refrain | M-21 |
| M-23 | The Architect's Vault | III · (Solara in code) | dungeon `arcology_vaults` | PARTIAL (best-developed) | PLAYABLE BUT UNVERIFIED (menu-driven) | `dungeons.ts`; `sand-pressure` rules; `OperationsHub.tsx` | 5 stages | Archive Guardian (4 phases) | Hourglass Protocol | M-22 |
| M-24 | Frostspire Descent | III · Frostspire | quest `fd-11` ("Ember's Warning", mislabeled) | PARTIAL | DATA ONLY | `quests.ts` fd-11; `environment.ts` cold exposure | Survive 90 s | — | 260 shards | M-23 |
| M-25 | Frozen Echo | III · Frostspire | dungeon `glacial-crevasse` / boss Subject Zero | PARTIAL ("Cryo Leviathan" ≠ Subject Zero/Rimeheart) | PLAYABLE BUT UNVERIFIED (menu-driven) | `dungeons.ts`; `encounters.ts` | 2 stages | Rimeheart / Subject Zero | Rimeheart Covenant; `zeroCore` | M-24 |
| M-26 | The Shrouded Signal | III · Swamps | quests `fd-04`, `fd-05` | PARTIAL | DATA ONLY | `quests.ts` (ENTER_WORLD swamps; SURVIVE swamps 90) | Enter, survive | KV-Unit exists (`encounters.ts`), unused | 120 / 260 shards | M-25 |
| M-27 | The Real Enemy | III | — | PREMISE ONLY | NOT STARTED | — | — | — | — | M-26 |
| M-28 | System Collapse | IV | `ROADMAP` "Signal Beyond" (text only) | PREMISE ONLY | NOT STARTED | `retention.ts` | — | — | — | M-27 |
| M-29 | The Fracture Spreads | IV | — | PREMISE ONLY | NOT STARTED | `corruptionLevel` exists as a variable only | — | — | — | M-28 |
| M-30 | The Live Fire Zone | IV | — | PREMISE ONLY | NOT STARTED | No simulation mode | — | — | — | M-29 |
| M-31 | Raid on the Core Facility | IV | raid `fracture-core` | PARTIAL (concept) | DATA ONLY | `system-foundations.ts` `FRACTURE_RAID` (6–12 players); `raid-stages.ts` | — | Core Sentinel / Anomaly Prime (`inventory.ts` `anomalyCore`) | — | M-30 |
| M-32 | The Broken Mind | IV | — | PREMISE ONLY | NOT STARTED | `boss-adaptive-ai.ts` is the nearest system | — | — | — | M-31 |
| M-33 | The Missing Fleet | IV | — | PREMISE ONLY | NOT STARTED | No orbital region in `world.ts` | — | — | — | M-32 |
| M-34 | The Orbital Gate | IV | — | PREMISE ONLY | NOT STARTED | — | — | — | — | M-33 |
| M-35 | Beyond the Sky | IV | — | PREMISE ONLY | NOT STARTED | — | — | — | — | M-34 |
| M-36 | NOVA's Secret | IV | — | PREMISE ONLY | NOT STARTED | NOVA is a tutorial/dialogue voice only | — | — | — | M-35 |
| M-37 | Return to a Broken World | V | — | PREMISE ONLY | NOT STARTED | — | — | — | — | M-36 |
| M-38 | The Last Alliance | V | — | PREMISE ONLY | NOT STARTED | Faction allegiance concept (Resonants/Controllers/Breakers) not implemented as choices | — | — | — | M-37 |
| M-39 | The Fracture Engine | V | — | PREMISE ONLY | NOT STARTED | — | — | — | — | M-38 |
| M-40 | Worlds Colliding | V | — | PREMISE ONLY | NOT STARTED | — | — | — | — | M-39 |
| M-41 | The Mirror Army | V | — | PREMISE ONLY | NOT STARTED | `adaptation.ts` squad adaptation is the nearest | — | — | — | M-40 |
| M-42 | NOVA CORE | V | — | PREMISE ONLY | NOT STARTED | — | — | — | — | M-41 |
| M-43 | The Reality Breaker | V | — | PREMISE ONLY | NOT STARTED | — | — | — | — | M-42 |
| M-44 | The Final Protocol | V | — | PREMISE ONLY | NOT STARTED | — | — | — | — | M-43 |
| M-45 | The Fracture End | V | `EndingOverlay` (3 endings) | PARTIAL (3 endings, auto-picked) | PARTIALLY PLAYABLE | `EndingOverlay.tsx` `endingTierFor`; no choice mechanic, 3 vs 4 endings | — | — | — | M-44 |

**Other playable content with no roster slot:** `awakening` (Neon-Core micro-chain; `missions/awakening.ts`, `fd-01`) — PLAYABLE BUT UNVERIFIED, starts anywhere; quest `fd-08` The Desert Approach (Solara, SURVIVE 90 s, DATA ONLY); Fuel King boss (`fd-15`, in raid); Emergency Quests and the Director's live missions (`director.ts`, `emergency-quest.ts`) — ephemeral systemic content, not story.

### C.1 Side missions and dungeons (separate catalog)

| ID | Name | Region | Playable | Evidence |
|---|---|---|---|---|
| D-01 | Sunken Arcology Vaults (5 stages, Archive Guardian) | Solara | PLAYABLE BUT UNVERIFIED (menu-driven) | `dungeons.ts`, `OperationsHub.tsx` |
| D-02 | Glacial Crevasse Network (Rimeheart) | Frostspire | PLAYABLE BUT UNVERIFIED (menu-driven) | same |
| D-03 | Sunken Temple of Echoes (The Antiphon) | Swamps | PLAYABLE BUT UNVERIFIED (menu-driven) | same |
| D-04 | The Fuel King raid (3 phases) | Wastelands | PLAYABLE BUT UNVERIFIED (menu-driven) | same; `fd-15` listens for its boss |
| D-05 | The Fracture Core raid (6–12 players) | Fracture Core | DATA ONLY | `system-foundations.ts` |
| S-01 | Unbroken Glass (Unique Scenario boss) | Solara | PLAYABLE BUT UNVERIFIED (debug "B" / Emergency Quest spawn) | `unique-scenarios.ts`, `sim.ts` `summonBoss` |
| S-02 | Emergency Quest world events | all | PLAYABLE BUT UNVERIFIED | `emergency-quest.ts` |

Note: M-22, M-23, M-25 are the same objects as D-01…D-03. Decide whether they are main-story missions or side dungeons; they cannot be both.

---


---

## Test results (this pass)

- `bun test src/game`: **175 pass, 0 fail** (31 files). Pure logic only.
- Two throw-away simulations of `gameTick` (not committed) produced the findings in §2.1–2.2.
- Typecheck: not rerun (no code changed this pass).
- Browser: **not performed.**

---

## Zone story missions (A3 + B5) — progress

| Zone | Mission | Quest | State | Notes |
|---|---|---|---|---|
| Shrouded Swamps | **The Drowned Relay** (`drowned-relay`) | upgrades `fd-05` (adds `MISSION_COMPLETE drowned-relay` as objective 2; the 90 s survive stays objective 1 so part-way saves keep progress) | PLAYABLE BUT UNVERIFIED — state machine, persistence, purge minigame and placement unit-tested; not browser-verified | TRIGGERED → WADING (relay site from `relaySite`, kept far from the KV-Unit free-roam lair) → COMBAT_1 (swamp troops via `spawnMissionDrones(..., "swamps")`) → PURGING (3-channel carrier-pulse minigame) → BOSS (KV-Unit, `summonBoss("swamps", { mission: true })`) → COMPLETE → WORLD_UPDATE. Pays bioCatalyst ×2 + dataShards ×2 through `applyMissionCompletion`. Story: the Broken Signal trace sinks into a drowned Vanguard relay; the KV-Unit is the war-frame the swamp grew into; the relay was only forwarding the signal to Neon City (hands off to Blackout Protocol). Blackout Protocol now starts only after the Drowned Relay (or once `fd-05` is already complete, so older saves are unaffected). |
| Solara Desert | **Solar Array Alpha** (`solar-array`) | upgrades `fd-08` (objective 2 `MISSION_COMPLETE solar-array`; survive timer stays objective 1) | PLAYABLE BUT UNVERIFIED — unit-tested, not browser-verified | TRIGGERED → CROSSING (`arraySite`) → COMBAT_1 (Solara troops) → REALIGNING (3-mirror alignment minigame) → BOSS (Unbroken Glass via `summonBoss("solara")` scenario fallback, poise gimmick) → COMPLETE → WORLD_UPDATE. Pays anomalyCarbon ×2 + dataShards ×2. Story: Neon's grid power is beamed from the desert; the drifted mirrors fed the anomaly; the realigned beam leads into Nexus City's Core Node (hands off to fd-09). Descent Protocol now waits for it (or for `fd-08` already complete). |
| Frostspire | **The Frozen Beacon** (`frozen-beacon`, shared machine in `zone-missions.ts`) | upgrades `fd-11` (objective 2) | PLAYABLE BUT UNVERIFIED | Starts after `fd-10`. Frostspire troops → beacon re-key (sequence memory) → Subject Zero. Story: the Nexus purge order was relayed from the high passes; it came from Ember Peaks. |
| Ember Peaks | **The Failure Core** (`failure-core`) | upgrades `fd-13` (objective 2; `fd-12` kills unchanged) | PLAYABLE BUT UNVERIFIED | Starts after `fd-12`. Ember troops → reactor venting (valve dials) → Overseer Kael. Story: the reactor was feeding the Fracture; its fuel came up the Grid-Iron Highway. |
| Wastelands | **Convoy Breaker** (`convoy-breaker`) | upgrades `fd-14` (objective 2) | PLAYABLE BUT UNVERIFIED | Starts after `fd-13`. Wasteland troops → convoy override (code match) → Rust-King Gant. Story: every tanker was bound for the Fuel King (hands off to `fd-15`). |

All six zone missions in §8 now exist in code.

### Reveal mission and choice model (A4 + B6)
| Item | State | Notes |
|---|---|---|
| **The Core Node** (`core-node`, upgrades `fd-09`, objective 2) | PLAYABLE BUT UNVERIFIED | Starts after `fd-08` (and for older saves past `fd-09` that never chose a side; never after `fd-18`). Nexus troops → archive handshake (sequence) → REVEAL: `REVEAL_GRAPH` conversation in StoryDialogue. NOVA's secret: she is a loose fragment of the Thalassian Deepmind that started the Fracture. The archive names the Carrier program: carry the key to the System Core. The player chooses Controllers / Breakers / Resonants (`story.choices.faction`, first answer stands, replay-safe). Skipping leaves REVEAL open; the overlay's "Talk to NOVA" reopens it. |
| Ending selection | DONE (unit-tested) | `src/game/endings.ts`: the allegiance decides the ending (Controllers → Control, Breakers → Chaos, Resonants → Balance); saves without one keep the corruption rule. Settles the "3 vs 4 endings" question at 3. |
| Aftermath | DONE (unit-tested) | `aftermathFor`: one line on what the chosen side does with the world, one on NOVA's fate from her trust (reveal choices). Shown under the ending. |

Still open: browser verification of every mission above; faction-specific gameplay (vendors, allies at the Core) beyond the ending; the orbital/Act IV-V roster is out of scope until new engine systems exist.
