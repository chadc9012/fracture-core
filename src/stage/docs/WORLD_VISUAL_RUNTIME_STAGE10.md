# World Fracture — Stage 10: World Visual Runtime

This stage establishes a data-driven visual look for the ten major region profiles and a shared production material library for armor fabric, metal, skin, hair, foliage, wet asphalt, architectural glass, water, snow/ice, and Fracture energy.

## Included
- `src/world/worldVisualRuntime.ts`: regional atmosphere/look profiles, physically-inspired material parameter contracts, quality budgets (low/balanced/high/cinematic), weather-aware frame composition, time-of-day lighting blend, Fracture glow, precipitation/ash/sand particle scales, and material-profile validation.
- `tests/worldVisualRuntime.test.cjs`: profile coverage, parameter bounds, weather, day/night, underwater fog, fracture intensity and quality-budget checks.

## Host integration still required
The module is pure TypeScript. It does not create textures or models, load HDRIs, instantiate Three.js materials, render volumetric fog, drive weather particles, animate foliage, set renderer tone mapping, or connect to the existing `fracture-core` app. The R3F host should map returned values to its existing lights/fog/material and post-processing systems, blend values over time, and avoid creating material instances every frame. Use actual scanned/artist-authored texture sets and approved operator/armor models; these parameter contracts are not substitutes for those assets.

Quality tiers are budgets, not performance guarantees. Validate on target mobile, console-controller/browser, and desktop hardware. Do not enable costly screen-space reflections or volumetrics blindly; profile representative scenes first.

## Verification
Run `node tests/worldVisualRuntime.test.cjs`. The standalone logic test is not a full application typecheck/build, browser render, art review, or live-repository integration. This stage is not merged into `chadc9012/fracture-core`.
