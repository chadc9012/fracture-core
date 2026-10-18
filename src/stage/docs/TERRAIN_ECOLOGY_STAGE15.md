# Stage 15 — Terrain Ecology & Placement Integration

## What changed

- Added `src/world/terrainEcology.ts`, a reusable placement gate for vegetation and future props.
- Added circle and rectangle exclusion zones, with reason-aware margins for roads and water and direct exclusion for buildings/gameplay areas.
- Added terrain-slope sampling and biome-specific default slope limits.
- Added biome-specific density multipliers for trees, rocks, and ground cover, including sparse desert/wasteland/neon dressing.
- Extended `ProductionVegetation` with optional `exclusionZones`, `waterLevel`, and `maxSlopeDegrees` props. It uses bounded retry attempts so dense exclusions cannot cause an infinite placement loop.

## Integration example

```tsx
<ProductionVegetation
  biome="verdant"
  count={260}
  rockCount={120}
  groundCoverCount={900}
  area={120}
  seed={41}
  waterLevel={-0.25}
  exclusionZones={[
    { kind: 'rect', minX: -5, maxX: 5, minZ: -60, maxZ: 60, reason: 'road' },
    { kind: 'circle', x: 18, z: -8, radius: 7, reason: 'water' },
    { kind: 'rect', minX: 28, maxX: 44, minZ: 8, maxZ: 24, reason: 'building' },
  ]}
/>
```

Coordinates are local to the component's dressing area; zones must be authored in that same local coordinate space. The host should use terrain-compatible height/seed values and supply actual road, water, and building footprints. This is a procedural contract, not automatic collision/world-map discovery.

## Limits

- Terrain slope is sampled from the existing procedural height function, not from arbitrary host terrain meshes. For hand-authored terrain, replace it with actual mesh-normal sampling.
- Exclusion areas are supplied by the host; this stage does not infer roads or water bodies automatically.
- It does not include scanned assets, wind animation, LODs, navmesh/collision, or a live-game merge.
- The React component's geometry/material lifecycle and instance counts still need profiling in the actual R3F scene.

## Verification

Standalone Node tests cover source contracts. TypeScript/TSX syntax transpilation checks syntax only, not full typechecking or browser rendering.
