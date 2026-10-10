# Boss stories: The Last Oath, The First Hunt, The Drowned Crown, The Last Benediction

Story packages for the four existing Unique Scenario bosses, on the shared story layer (`src/game/story.ts`). Code: `src/game/boss-stories.ts`; tests: `src/game/boss-stories.test.ts`.

## What is implemented
| Boss | Story | Lair intro | Phase captions | After the kill | Vault conversation | Saved decision |
|---|---|---|---|---|---|---|
| Dark Knight | The Last Oath | yes | 4 | Vale's last words, 3 responses | Aegis vault terminal | `dark-knight.response` = compassion / confront / investigate |
| Rime Alpha | The First Hunt | yes | 4 | - | Research tower laboratory | - |
| Drowned Monarch | The Drowned Crown | yes | 4 | - | Royal archive console | `drowned.archive` = preserve / expose |
| Hollow Saint | The Last Benediction | yes | 4 | - | Benediction Archive | - |

Flags (exact names from the drafts): `dark_knight_defeated`, `vale_released`, `vale_response_compassion|confrontation|investigation`, `world_anchor_evidence`, `command_signature_recovered`; `rime_alpha_defeated`, `rime_research_archive_found`, `chrono_resonance_revealed`, `preconstruction_signal_found`, `thalassia_signal_marked`; `drowned_monarch_defeated`, `aurelian_archive_found`, `previous_convergence_revealed`, `drowned_archive_preserved`, `drowned_truth_released`, `anchor_continuity_record_found`, `origin_signal_marked`; `hollow_saint_defeated`, `elian_archive_found`, `identity_truth_revealed`, `haven_records_preserved`, `fracture_network_evidence_found`, `anchor_network_lead_found`. Evidence items are story collectibles (`evidence:*`).

## How it ties to the real fight
- Scene forwards the encounter's own `PHASE` events as captions (presentation only) and the `VICTORY` event as `BOSS_DEFEATED`. `VICTORY` is emitted only by a real kill through `defeatMachine`: truces, resets, deaths and the finale hp floor never emit it.
- The lair intro plays when the player enters the lair and the intro is unheard; the boss is summoned right after. Esc counts as heard so a skip never blocks the fight.
- Post-fight conversations and the vault trigger are due only once the stage is `defeated` or later. A skipped conversation reopens at the vault. Everything is once-keyed, so replays change nothing.
- Stages are monotonic and merge furthest-wins; decisions keep the newer copy's value; flags and evidence union.

## What is deliberately NOT changed
Encounter phases, tells, hit detection, poise, Null Disruption, death reset, `scenario-loot.ts` rewards and odds. Story progress never touches rewards, credits or inventory (tested). No new models, cutscene renderer, voice acting, swimming/pressure rules or companion systems.

## Adaptation from the drafts
The Dark Knight's finishing-stagger exchange is a modal choice; running it mid-duel would fight the combat input, so it plays as his last words right after the killing blow. Choices are hidden once a decision exists (a story-layer fix that also covers Vaelith's artifact choice).

## Not verified
Automated tests cover the pure story logic and the real kill path for the Dark Knight in the sim. Dialogue overlay, captions, vault triggers and lair-intro timing in a running browser, and a production build, have NOT been verified in this environment. Vault positions are placeholders 16 m from each lair: confirm they are walkable in the game.
