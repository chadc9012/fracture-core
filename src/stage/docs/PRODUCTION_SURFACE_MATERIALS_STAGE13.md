# Stage 13 — Production Surface Materials

Adds a procedural surface-map generator and reusable React Three Fiber / Three.js material helpers. The generated color, bump, and roughness maps are created in the browser at runtime; they are a detail pass and not a substitute for authored PBR texture sets from a scanned/material library.

## Use in R3F

```tsx
<meshStandardMaterial>
  {/* instead, use <ProductionSurfaceMaterial biome="neon" seed={22} /> as the material child */}
</mesh>
```

Example:

```tsx
<mesh receiveShadow castShadow>
  <planeGeometry args={[24, 24, 1, 1]} />
  <ProductionSurfaceMaterial biome="neon" seed={22} />
</mesh>
```

Supported biomes: verdant, swamp, desert, frost, ember, wasteland, neon. Texture generation returns `null` outside a browser (e.g. SSR or Node tests), so the material falls back to its PBR scalar settings. Runtime texture generation costs CPU at creation; cache maps by biome/seed in a production integration to avoid duplicate canvases across many meshes.

## Scope and verification

This is an opt-in asset/material module. It does not automatically replace the material on existing world geometry. Browser render, lighting response, GPU cost, and final art quality must be validated in the host game. Procedural textures are generic microdetail, not final scanned AAA assets.
