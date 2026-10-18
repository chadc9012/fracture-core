# World Fracture — Stage 14: Instanced Vegetation & Rock Dressing

## What changed
- Added `src/world/ProductionVegetation.tsx`, an opt-in React Three Fiber scene component for deterministic trees, rocks, and ground-cover clumps.
- Tree silhouettes are assembled from instanced trunks and layered canopy geometry rather than a single cone per tree.
- Six biome palettes: Verdant, Swamp, Frost, Ember, Wasteland, and Desert.
- Placement is seeded and uses the shared `sampleTerrainHeight` function so dressing can follow the procedural terrain convention.
- Uses instanced meshes to reduce draw-call pressure; default density is 220 trees, 95 rocks, and 700 cover clumps over a 100-unit area.
- Shared geometries are disposed on unmount.

## Example

```tsx
<ProductionVegetation biome="verdant" count={260} rockCount={120} groundCoverCount={900} area={120} seed={41} />
```

Mount it inside the existing R3F `<Canvas>` and coordinate `seed`, `area`, and terrain height with the region's terrain. This is intentionally opt-in; it does not silently replace the current `InstancedForest` or alter existing scenes.

## Important limitations
- This is a procedural blockout-quality dressing pass, not scanned photogrammetry or final AAA tree assets. Canopy and ground cover use shared stylized geometry; production bark/leaf textures, wind animation, LODs, collision/nav exclusions, and biome-specific species libraries remain follow-up work.
- The terrain sampler is shared, but this component currently places all props within a rectangular area without slope/road/water exclusion sampling. Integrators should provide placement masks or filter transforms before using it on final gameplay terrain.
- Not integrated into the live `chadc9012/fracture-core` repository in this session.

## Verification
The package test suite and TypeScript/TSX syntax transpilation are run for this stage. These are not a full app typecheck/build, GPU profile, or in-browser visual playthrough.
