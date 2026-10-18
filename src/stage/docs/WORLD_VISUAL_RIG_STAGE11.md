# World Visual Rig — Stage 11

## What this adds

- `src/world/worldVisualPresentation.ts`: maps Stage 10's pure world profile into renderer-facing fog, light, exposure, wetness, wind and particle settings. Includes exponential transition smoothing and fog-color blending.
- `src/world/WorldVisualRig.tsx`: React Three Fiber scene adapter that controls exponential fog, ambient/directional lighting, a violet Fracture point light, renderer exposure, and lightweight rain/snow/ash/sand point particles.
- `tests/worldVisualPresentation.test.cjs`: checks renderer mapping and smooth region/weather transitions.

## Mounting

Inside the existing `<Canvas>`, mount the rig once:

```tsx
<WorldVisualRig
  regionId="neon-city"
  weather="rain"
  timeOfDay={22}
  fractureIntensity={0.65}
  quality="high"
  fracturePosition={[0, 4, 0]}
/>
```

Replace the example values with the game's actual active region, weather, world time, Fracture intensity and graphics settings. If the game already has its own weather/VFX manager, use `particles={false}` to avoid duplicate particles. The light position should be driven by the actual Fracture anomaly location when available.

## Integration notes and limitations

- This is a real R3F adapter component, but it has not been mounted in the live game because the `fracture-core` application source has not been provided in this conversation.
- It does not create terrain, production geometry, authored cloud volumes, screen-space reflections, volumetric shafts, sky rendering, ocean shaders or texture maps. It provides scene lighting/fog and basic weather particle rendering only.
- The component writes `scene.fog` and `gl.toneMappingExposure`; coordinate those global renderer settings with any existing post-processing/lighting manager to avoid conflicts.
- Its particle system is intentionally simple and should be replaced or integrated with the game's existing GPU particle/VFX system for large storms or high entity counts.
- No browser render or visual quality assessment has been performed. Standalone logic tests and TypeScript syntax checks do not prove full project compilation.
