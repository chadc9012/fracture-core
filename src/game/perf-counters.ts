/** Plain mutable counters the F3 readout turns into "per second" rates. Incrementing is one add, so it is safe in render bodies.
 * Why: a long main-thread "Scripting" slice is only actionable once we know whether React is re-rendering the world. */
export const renderCounts = { scene: 0, canvas: 0 };
