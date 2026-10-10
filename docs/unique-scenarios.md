# Unique Scenarios

Status key: **Implemented** (code) / **Tested** (bun test, deterministic clock) / **Browser** (not verified in this environment).

| Scenario | Location | Encounter | Model | Status |
|---|---|---|---|---|
| Unbroken Glass | Solara | poise/weak-point gimmick (unchanged) | procedural | Implemented, existing tests |
| System Core | Thalassia fallback | poise gimmick (unchanged) | procedural | Implemented, existing tests |
| Rime Alpha | Frostspire | Hunt / Predation / Frostbound / Alpha's Fury | `public/models/bosses/frost-wolf.glb` (no custom animation clips; procedural motion) | Implemented + tested |
| Dark Knight | Wastelands | Warden / Fracture Field / Null Ascendant / Last Oath (+ Null Disruption, Null Sovereign, 25% Mantle) | `dark-knight.glb` | Implemented + tested |
| Drowned Monarch | Thalassia | Abyssal Court / Rising Tide / Broken Throne / Monarch's Fall | **missing** (procedural stand-in) | Implemented + tested |
| Hollow Saint | Shrouded Swamps | Procession / False Saints / Shroud Collapse / Last Benediction | **missing** (procedural stand-in) | Implemented + tested |
| Red Ronin | existing | gimmick (unchanged) | existing | unchanged |

## Contract
`unique-scenarios.ts` (id, name, region, lair, briefing, tell, drop, gimmick, rewardCredits) + `scenario-encounters.ts` (attacks, phases, finale) + `scenario-loot.ts` (reward table). Each summon mints a unique run id; `defeatMachine` attaches one `ScenarioClaim`; `grantScenarioReward` is idempotent per run via `earnedRewards`.

## Attack rules
Every attack: tell (seconds, text, ring), valid boss-to-player range, hit geometry resolved at impact against the player's position (SLAM circle, LUNGE lane, POUNCE landing, FAN cone, FIELD zones, CLONES), recovery, and a trimmed weak-point window. Damage goes through `hurtPlayer` so Rift Dash i-frames, Bastion barrier and armor resistance apply. Boss stuns are capped at 1.4 s; a stagger during a tell interrupts it.

## Finale
The last phase of Dark Knight / Drowned Monarch / Hollow Saint defines a finale attack (Last Oath / The Drowning / Last Benediction). Until a full rotation has been survived the boss cannot drop below `floorHp`; the finale opens a 5 s stagger + weak-point window and lifts the floor. Death during the fight resets the boss (full hp, phase 1, zones/decoys cleared).

## Hollow Saint identification rule
Only the real Saint tells and attacks. False Saints are inert, have 2 hp, never move, give no kill/credit/loot/progress and do not count as boss participation. Shattering all copies exposes the real Saint's weak point. The real boss is the machine with `boss && scenarioId === "hollow-saint"` in sim state.

## Rewards
- Drowned Monarch: Crown of the Drowned Court (helmet, legendary, guaranteed); Tidecaller Trident (secondary, legendary, 20%).
- Hollow Saint: Veil of the Hollow Saint (chest, legendary, guaranteed); Censer of the Hollow Saint (heavy, legendary, 20%).
- Dark Knight / Rime Alpha rewards unchanged. New gear uses existing gear stats only: no perks, models or looks yet.

## Not done / limits
No dedicated Drowned Monarch or Hollow Saint model; no encounter-specific audio/cinematics; no swimming/oxygen/pressure physics; no enemy shields; local single-player only (private fireteam access needs a separate authoritative backend); browser and production build not verified here (registry unreachable).
