# Stage 16 — Water Environment

Adds an opt-in shader-driven water surface and pure water-profile helpers.

## Included
- Profiles for ocean, river, lake, waterfall, and underwater surfaces.
- Distinct color depth, wave scale/speed, directional-current metadata, foam strength, caustics strength, and fog-density targets.
- `sampleWaterHeight`, `sampleWaterCurrent`, `shorelineFoamWeight`, and `underwaterVisibility` helpers for simulation/gameplay integration.
- `WaterEnvironment` R3F component with shader-based waves, Fresnel-like view-angle coloring, procedural ripple/foam highlights, and caustic-like modulation.

## Example

```tsx
<WaterEnvironment kind="ocean" width={180} depth={180} segments={96} position={[0, 0.12, 0]} />
<WaterEnvironment kind="river" width={14} depth={90} shorelineDepth={0.35} />
<WaterEnvironment kind="underwater" width={80} depth={80} position={[0, -12, 0]} />
```

Mount inside the existing React Three Fiber `Canvas`. This component is opt-in and does not replace the existing `AnimatedWater` component automatically.

## Integration requirements and limitations
- `shorelineDepth` is an explicitly supplied approximation; the component does not inspect terrain or depth buffers to find real shorelines.
- Current vectors are profile metadata and helper output; the component does not physically advect floating objects or drive a river simulation.
- Caustics and foam are procedural shader patterns, not ray-traced caustics or terrain-conforming foam meshes.
- No underwater post-processing, real waterfall geometry, splash particle system, buoyancy, or audio is integrated here.
- Validate shader compilation and visual quality on the target device/GPU. Automated source tests are not a browser/GPU test.
- Full app build and live repository integration were not performed as part of this standalone package.
