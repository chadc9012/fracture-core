# World Fracture — Combat Camera & Weapon Feel Stage 9

## Added
- `src/camera/combatCameraWeapon.ts`: controller input contract for ADS/fire/shoulder switch, aim FOV easing, aim sensitivity scaling, bounded recoil accumulation/decay, recoil pose offsets, and normalized aim-point direction.
- `tests/combatCameraWeapon.test.cjs`: isolated unit coverage.

## Integration contract
This module is pure TypeScript. The host game must poll the controller, provide monotonically changing `shotId` values for individual shots, apply returned camera pose fields to its existing camera rig, and keep weapon damage/hit registration authoritative in the combat system. Recoil is a camera presentation effect, not weapon ballistics. Apply actual raycasts/collision correction after camera offsets. The shoulder button is a held-state input here; call the step only on a rising edge or debounce it in the host to avoid flipping every frame.

## Verification limits
Standalone tests and syntax transpilation only. This is not merged into `chadc9012/fracture-core`; no full app build, browser/controller playthrough, weapon animation, or live camera validation has been run.
