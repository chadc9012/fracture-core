# World Fracture — Menu and Graphics Update (2026-10-22)

## Included changes
- Main menu emphasizes a single START action that opens the existing three-slot Operator Archive. New-game creation is handled through empty character slots rather than a competing title-screen button.
- Operator Archive save cards receive a cinematic, controller-friendly layout with a clearer fresh/returning operator distinction.
- Ocean shader gains horizon-dependent sky reflection and spatially varied foam to reduce repetitive water patterns.
- Preserves previous cumulative terrain/material, enemy model, vehicle, and world asset rendering improvements.

## Verification
- `node scripts/release-audit.mjs`: passed (878 source files, 2,582 local imports, 69 hosted asset manifests, zero unresolved imports).
- `npm run test:gameplay-core`: 8/8 passed.
- Full TypeScript, Vite production build, and in-game visual checks: not verified (dependencies unavailable).

## Limitations
This is an updated cumulative source package, not final authored graphics for every 3D asset. Multiplayer remains deferred. No GitHub or Lovable deployment was performed.
