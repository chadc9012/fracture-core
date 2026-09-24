# WORLD FRACTURE progression, analysis, and Titan slice

## What will be built

- Save completed missions, unlocked abilities, earned vehicles, selected garage vehicle, and garage loadout in the browser so progress survives reloads.
- Add a Zone Analysis panel where players upload a zone screenshot and receive AI-generated hazards and traversal tactics.
- Add an explicit performance architecture with independent gameplay, simulation, visual, network, and optimization layers.
- Add Low, Medium, High, and Ultra rendering modes, a 100-point per-player effects budget, distance-based boss behavior, inactive-room freezing, and sync-safe gameplay event definitions.
- Build the Titan combat vertical slice: shield health, energy, stability, timed blocking, perfect blocks, shield overload, Shield Bash, Dome Projection, readable enemy heavy attacks, cover, and an arena hazard.
- Update the launch and character selection presentation using the supplied world and operative artwork, while keeping the live character preview.

## Player flow

1. Start from the cinematic WORLD FRACTURE launch screen.
2. Choose class, specialization, and appearance with reference-led character presentation.
3. Deploy into Mission 01 on foot.
4. Play the Titan timing-based defensive loop when Titan is selected.
5. Complete missions to persist rewards and choose the first reward vehicle.
6. Reopen the game with mission, ability, vehicle, and garage progress restored.
7. Open Zone Analysis, upload a screenshot, and receive hazard and traversal guidance.

## Technical details

- Progress uses a versioned, validated local save with safe defaults and event-based writes; it will not serialize the live simulation every frame.
- Screenshot analysis stays server-side through Lovable AI using `openai/gpt-6-astra`; uploads are validated by size and actual image MIME type.
- Gameplay calculations remain independent of visuals. Visual quality can degrade without changing damage, timing, AI decisions, or mission state.
- Multiplayer support in this slice defines authoritative event/state contracts and player-count presets; it does not add a live network server.
- Supplied images are stored through the project asset flow and used as launch/selection artwork, not embedded as raw binaries.

## Verification

- Run the full TypeScript check.
- Verify the automated production build is healthy.
- Test launch, onboarding, Titan combat, saved progression, quality settings, and zone screenshot analysis in desktop and mobile layouts.
- Audit player-facing text for removed legacy names.
