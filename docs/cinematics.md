# Act I cinematics (Missions 1–5)

Status legend: **implemented** = code exists · **tested** = covered by `bun test src/game/cinematics.test.ts` · **unverified** = never seen rendering.

## What exists
- `src/game/cinematics.ts` — a pure, data-driven sequence controller plus the screenplay as data (7 scenes: `m1-opening`, `m2-evac`, `m3-facility`, `m4-training`, `m4-transmission`, `m5-road`, `m5-gates`). **Implemented, tested.**
- Controller: ordered shots (camera kind, symbolic `anchor`, framing, cues, subtitle lines with speaker names and computed timing), `start/step/skip/pause/resume`, `inspectCinematic` (current shot + line, for the subtitle layer and a dev inspector), `shouldPlay/markPlayed` (once-keyed story flag `cine:<id>`, merged with the save).
- Guarantees (tested): the handoff is produced exactly once; skipping at any moment yields the same valid handoff and objective; skipping or replaying only ever touches the `cine:<id>` flag — no rewards, no mission completion, no quest flags; line ids are unique across all scenes; every line fits its shot; each scene lands inside its screenplay target length; played state survives save/reload and cloud merge.

## What does NOT exist yet
- **Not wired into Scene/GameCanvas.** No camera is driven, no subtitles are drawn, nothing triggers a scene. Shots name symbolic anchors (`neon-core-skyline`, `player-hand`, …) that Scene must resolve to world positions. **Unverified.**
- No recorded audio. Lines are meant to go through the existing server-streamed TTS with captions as fallback.
- No dev route (routeTree.gen.ts cannot be regenerated in this environment); use `inspectCinematic` from a dev panel when wiring.
- Nothing has been seen in a browser.

## Screenplay vs the existing campaign
| Screenplay | Repo today | Handoff hook exists? |
|---|---|---|
| M1 opening → first combat | Intro text cinematic, then forge, then trial-chamber tutorial | yes (tutorial/first combat) |
| M2 evacuation, rescue survivors | no civilian-rescue mission | **no** |
| M3 Project World Anchor facility | no such location/mission | **no** |
| M4 discipline trial + class choice | class is chosen in Character creation before the tutorial; no trial | partly (class select exists, trial does not) |
| M4 transmission | none | **no** |
| M5 convoy + Roadbreaker | no Roadbreaker in the repo | **no** |
| M5 Nexus gates / Act I end | Nexus City exists; Act I end state undefined | **no** |

The existing quest chain (fd-01…) starts in Veridan Forest, so the screenplay's Neon City opening does not line up with it.

## Decisions needed from you
1. Does the screenplay replace the current opening (intro → forge → tutorial), or sit in front of it as a prologue?
2. Class selection is currently before the tutorial; the screenplay puts it in M4. Move it, or keep it and treat the M4 scene as a recap?
3. Should I build the missing mission content (rescue, facility, discipline trial, Roadbreaker boss) or only the cinematics and fall back to existing missions?
