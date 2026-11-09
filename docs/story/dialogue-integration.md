# Dialogue integration — review notes (Nov 9)

The owner sent two packages on Nov 9:

1. **Mission 1 cinematic prototype** (`WorldFracture_Mission1_Cinematic_Playable_Escape.zip`): ten recorded lines
   (news anchor, player, NOVA), four storyboard panels, and a standalone escape prototype.
2. **Campaign dialogue draft 1** (`WorldFracture_Full_Campaign_Dialogue_Draft1.zip`): 257 lines over 25 missions,
   branches, ambient, combat, vehicle and companion lines, with stable ids. The bible is kept here as
   `WorldFracture_Dialogue_Bible_Draft1.md`.

Its README asks that existing canonical dialogue isn't overwritten without review. This file lists every change.

## Where everything lives

| What | Where |
| --- | --- |
| Draft lines, verbatim with ids | `godot-world-fracture/data/dialogue/campaign_draft1.json` |
| Mission 01 opening script (cinematic lines `CINE_*`, joining lines `M01X_*`) | `godot-world-fracture/data/dialogue/m01_opening.json` |
| Every voiced line, by id (PLAYER lines as `_m` / `_f` / `_r` for the male, female and robot bodies) | `godot-world-fracture/audio/voices/lines/<id>.ogg` |
| Index used by the game (speaker, text, length, variants) | `godot-world-fracture/data/dialogue/voices.json` |
| The owner's ten recordings, untouched | `assets-src/voices-provided/` |
| Voice generator (Piper, the cast list, per-character treatments) | `godot-world-fracture/tools/make_voices.py` |
| Score cues and cinematic sound effects | `godot-world-fracture/audio/cinema/` (from `tools/make_cinema_audio.py`) |

The owner's recordings are used as recorded for the anchor, NOVA and the male player. NOVA's lines get her synthetic
treatment and the anchor's go through the TV speaker. The female and robot player versions of those four player lines
are generated. Every other line is generated with Piper (local neural TTS), one cast voice per character.

## What plays in the game now

- **Mission 01 opening**: the owner's cinematic script, word for word, as in-engine cutscenes (`scripts/mission/m01_cinema.gd`).
- **The escape on 12**: draft Mission 01 lines M01_008–011 play on entering the corridor after the Fracture.
- **The broken stairwell (first power)**: draft Mission 01 lines M01_012–013 and all of draft Mission 02 (M02_001–011)
  are the stairwell cutscene: the mother, her daughter behind the slab, and the first power.
- **Ambient lines** (AMB_*): in every region's Street View, one line every 45–80 s, voiced with a caption.
- **Combat**: COMBAT_003 ("Energy low. Use cover…") from NOVA in the Mission 01 Breach when the operator is hurting.
- **Vehicles**: VEHICLES_005 (the racer) at the start of a street race, VEHICLES_004 (NOVA) at the speedway.

## Lines that replaced existing game lines (please review)

| Moment | Was | Now |
| --- | --- | --- |
| Morning, in the lobby | Say hi to Mara (a step), Ellis and the mail room (a step) | Mara's invitation comes as a phone message; the black RESONANCE card comes in an envelope under the door. Lobby chats are optional. |
| The alarm | "The windows shake. Every light in the building goes out at once." / BUILDING / MARA (radio) | The cinematic, then BUILDING (PA) and MARA's call, reworded slightly for voice |
| The surge (street) | NOVA's earlier recorded "first contact" line | "What's happening to me?" (player) and NOVA's two surge lines, voiced. NOVA's first words are now the cinematic's. |
| Stairwell on 12 | A subtitle saying the way down was blocked | The draft's stairwell scene (above) |

## Draft lines voiced and stored, not yet played

- **M01_001–007**: the draft's own apartment opening. It overlaps the cinematic script; the cinematic's version plays.
- **M01_014–015**: their place is taken by M02_010–011 at the end of the stairwell scene.
- **Missions 03–25, branches and companion lines**: those missions don't exist as gameplay yet. Every line is voiced
  and indexed by id, ready for the story work (TASKBOARD step 11) to call with `Lines.pair(id)` or a cutscene's `lines`.
