# World Fracture — World Camera Runtime (Stage 7)

## New runtime adapter
`src/camera/worldCameraRuntime.ts` connects the Stage 6 camera math to a deterministic per-frame host contract.

- **Context-based mode selection:** cinematic, map, photo, first-person, aim, vehicle, underwater, combat, exploration (in priority order).
- **Gamepad camera input:** standard right-stick axes (2/3), deadzone normalization, and D-pad up/down zoom. The host still owns input polling, remapping, and accessibility preferences.
- **Collision obstruction:** accepts a host raycast hit and pulls the camera toward its target to avoid clipping through walls.
- **Ground/water floor clearance:** uses a sampled floor height to keep the camera above the local surface.
- **Mode transitions:** returns a blended camera pose when the context changes.
- **Damped follow:** frame-rate-independent exponential smoothing helper.

## Host integration
Each frame, the host should sample target position/heading, context, gamepad state, collision raycast, and ground/water surface; call `stepWorldCamera`; then apply `pose.position`, `pose.lookAt`, and `pose.fov` to the active R3F camera. Use the host's actual scene collision raycaster and surface queries. This module does not create or mount an R3F component and does not attach browser/controller listeners.

## Verification
`tests/worldCameraRuntime.test.cjs` covers mode priority, standard controller input, deadzone, collision pull-in, floor clearance, transition timing, and damping. The package tests and TS/TSX syntax transpilation should be run from the project root.

## Limits
This is a host-ready adapter, not a merge into `chadc9012/fracture-core`. Real collision and surface samples, camera application, full application build, and browser/controller playthrough remain to be integrated and verified.
