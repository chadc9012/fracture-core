/** Plain mutable counters the F3 readout turns into "per second" rates. Incrementing is one add, so it is safe in render bodies.
 * Why: a long main-thread "Scripting" slice is only actionable once we know whether React is re-rendering the world. */
export const renderCounts = { scene: 0, canvas: 0 };

/** Render-cause tracker (diagnostic only). Each render passes the current identity of the tracked state values; a key whose value
 * changed since the previous render is counted. `render` returns the changed keys so a caller can log them. Pure and resettable. */
export function createWhyRender() {
  let prev: Record<string, unknown> | null = null;
  const counts: Record<string, number> = {};
  let renders = 0, noChange = 0;
  return {
    render(values: Record<string, unknown>): string[] {
      renders++;
      const changed: string[] = [];
      if (prev) for (const k of Object.keys(values)) if (!Object.is(prev[k], values[k])) { changed.push(k); counts[k] = (counts[k] ?? 0) + 1; }
      if (prev && changed.length === 0) noChange++;
      prev = values;
      return changed;
    },
    /** top causes since the last call, then reset */
    drain(top = 5): { renders: number; noChange: number; causes: [string, number][] } {
      const causes = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, top);
      const out = { renders, noChange, causes };
      for (const k of Object.keys(counts)) delete counts[k];
      renders = 0; noChange = 0;
      return out;
    },
  };
}
/** Shared instance for GameCanvas; PerfProbe drains it into the F3 text. */
export const canvasWhy = createWhyRender();
