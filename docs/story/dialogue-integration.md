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

## Phase 3 package (Nov 11): directed scenes, Missions 04–06

The owner's `WorldFracture_Cinematic_Dialogue_Phase3_M04-M06.zip` groups the draft's lines into 22 directed scenes (M01–M06)
with locations, camera notes, sound beds and timed cues. Every one of its 63 cues is a draft line already voiced here, word for
word (tests/cinema/scenes_test.gd checks this). The package's screenplay, voice profiles and recording sheets are kept in
`docs/story/cinematic-phase3/`.

| What | Where |
| --- | --- |
| The scene list (scenes + cues, from `cinematic_scenes_all_M01-M06.json`) | `godot-world-fracture/data/dialogue/scenes.json` |
| Scenes → shots for the two existing cutscene players; branch chains | `godot-world-fracture/scripts/cinema/scenes.gd` |
| The story choice overlay | `godot-world-fracture/scripts/cinema/choice.gd` |

The package's own `DialogueCinematicPlayer` is **not** added: the game already has two cutscene players (Mission 01's cinema
player and the descent's beats), and the scenes play through those, with the recorded voices and their real lengths
(the package's cue timings are estimates for subtitles-only playback). Its camera notes are read for framing (wide / tight /
over-the-shoulder / tracking, handheld shake); they are directions, not authored camera paths.

What plays now:

- **Missions 04 and 05** — after Mission 01's "new world" reveal, the first time it is cleared: Captain Vale (a Vanguard
  captain, standing at the Breach) — 04A checkpoint, 04B NOVA, 04C terms of protection; 05A temporary command, 05B the relief
  line; then the choice **Work with Vale's team** / **Stay independent**, and only that branch's scene (05C_COOPERATE or
  05C_INDEPENDENT). The choice is kept in the profile as `m05_choice`; with a choice made, replays skip the scenes.
- **Mission 06** — the descent's Verdant Forest openings: 06A at the tree line when fd-02 starts (was M06_001 and M06_003
  only), 06B + 06C on the root path and at the ancient roots when fd-03 starts (was M06_006 and M06_007 only).

Not done: M01–M03 scenes stay as Mission 01 already plays them (the cinematic script's own versions); the M05 choice is
recorded but nothing reads it yet (reputation / later dialogue is story work, step 11); Scout Mira has no body in the
forest (a voice in the trees), and the checkpoint and command scenes share one place, the Breach.
