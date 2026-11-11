# World Fracture — Racing Tracks Pack 01

Eight original local-space track route definitions. Each track has JSON route geometry/checkpoints, CSV checkpoint table, and SVG schematic preview. **Not integrated into the current game**; the project source is required to attach routes to roads, terrain, collision, race triggers, AI and saves.

## Tracks

- Neon Midnight Run: target 12 km; 17 checkpoints; calculated 12.0 km.
- Neon Ring Express: target 24 km; 31 checkpoints; calculated 24.0 km.
- Nexus Grand Prix: target 18 km; 24 checkpoints; calculated 18.0 km.
- Nexus Outlaw Highway: target 42 km; 32 checkpoints; calculated 42.0 km.
- Glass Flats Rally: target 86 km; 63 checkpoints; calculated 86.0 km.
- Frostveil Summit: target 54 km; 40 checkpoints; calculated 54.0 km.
- Azure Coastal Rush: target 32 km; 42 checkpoints; calculated 32.0 km.
- Azure Hover Challenge: target 28 km; 36 checkpoints; calculated 28.0 km.

## Integration contract

- Each route uses xM/zM in local meters. Choose a world-space origin and rotation matching the existing terrain and roads. Do not use these positions directly as global coordinates.
- Snap road races to actual road spline network and water races to navigable water. Recompute distance/checkpoints after snapping.
- Add start/finish triggers, collision boundaries, checkpoint order validation, lap counter, AI racing line, traffic, pursuits, and event rewards through existing systems.
- Preserve existing race content and progression; register these as additive tracks only.
- SVG previews are schematic and do not represent a flat connected world map.
- Run actual Vite build and browser drive tests after integrating; no such tests were possible without the source project.
