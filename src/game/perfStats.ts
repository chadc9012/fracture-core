/**
 * Module-level perf counters, sampled once per rendered frame by PerfSampler (inside the R3F
 * Canvas, where the live WebGLRenderer lives) and read a few times a second by PerfOverlay
 * (outside it, as a plain DOM readout) — avoids re-rendering any React tree at 60fps just to
 * show a number. Diagnostic only: real renderer.info counters, never estimated, never read by
 * gameplay code.
 */
export const perfStats = {
  fps: 0,
  frameMs: 0,
  calls: 0,
  triangles: 0,
  geometries: 0,
  textures: 0,
};
