# World Fracture — Combat Camera Assist, Stage 8

Adds `src/camera/combatCameraAssist.ts` as a pure host-integration module for camera target acquisition, target-lock validation, deterministic target cycling, left/right shoulder swap, and lock-on look-at calculation with optional target-velocity lead.

## Integration contract
- The host must supply world-space target positions and actual line-of-sight results (`visible`). This module does not raycast, identify enemies, apply damage, or own target authority.
- Target acquisition uses a forward cone, maximum distance, and optional priority. Priority is bounded so it cannot overpower the geometric checks.
- Lock retention uses a larger distance than acquisition to reduce flicker. Dead, hidden, missing, or too-distant targets release lock.
- Shoulder switching changes the camera rig offset only. The host must still raycast from the target to the desired camera location to avoid walls.
- `applyCameraLockPose` changes only `lookAt`; it deliberately preserves the collision-resolved camera position.
- First-person and map modes ignore shoulder swaps.

## Verification
Run `node tests/combatCameraAssist.test.cjs` and the full `node tests/*.test.cjs` suite from this package root. TypeScript syntax transpilation is not a full application typecheck/build. This package is not merged into the live `chadc9012/fracture-core` repository and has not been browser-playtested.
