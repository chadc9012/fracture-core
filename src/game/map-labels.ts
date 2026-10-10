/** Collision-free label placement for the region map (pure). Regions sit close together (Nexus beside the Wastelands, Ember beside Veridan),
 * so labels centred on each region overlapped and clipped. Each label tries a short list of slots around its marker and takes the first one
 * that stays inside the map and clears every label already placed and every marker. */
export type LabelRegion = { id: string; name: string; x: number; z: number };
export type PlacedLabel = { id: string; x: number; y: number; anchor: "start" | "end" | "middle"; box: { x0: number; y0: number; x1: number; y1: number } };

/** approximate text width in map units for a monospace-ish uppercase label */
export const labelWidth = (text: string, fontSize: number) => text.length * fontSize * 0.64;

export function placeLabels(regions: readonly LabelRegion[], opts: { extent: number; fontSize: number; markerRadius: number; margin?: number }): PlacedLabel[] {
  const { extent, fontSize, markerRadius } = opts, margin = opts.margin ?? fontSize * 0.5, gap = markerRadius * 1.6 + fontSize * 0.25;
  const placed: PlacedLabel[] = [];
  const markers = regions.map((r) => ({ x0: r.x - markerRadius, y0: r.z - markerRadius, x1: r.x + markerRadius, y1: r.z + markerRadius }));
  const hit = (a: PlacedLabel["box"], b: PlacedLabel["box"]) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
  // larger regions first: they keep the best slot; smaller ones route around
  const order = [...regions].sort((a, b) => b.name.length - a.name.length);
  for (const r of order) {
    const w = labelWidth(r.name, fontSize), h = fontSize;
    const slots: { x: number; y: number; anchor: PlacedLabel["anchor"] }[] = [
      { x: r.x + gap, y: r.z + h * 0.35, anchor: "start" }, { x: r.x - gap, y: r.z + h * 0.35, anchor: "end" },
      { x: r.x, y: r.z - gap - h * 0.1, anchor: "middle" }, { x: r.x, y: r.z + gap + h, anchor: "middle" },
      { x: r.x + gap, y: r.z - h * 0.9, anchor: "start" }, { x: r.x - gap, y: r.z - h * 0.9, anchor: "end" },
      { x: r.x + gap, y: r.z + h * 1.7, anchor: "start" }, { x: r.x - gap, y: r.z + h * 1.7, anchor: "end" },
    ];
    let chosen: PlacedLabel | null = null, fallback: PlacedLabel | null = null;
    for (const s of slots) {
      const x0 = s.anchor === "start" ? s.x : s.anchor === "end" ? s.x - w : s.x - w / 2;
      const box = { x0, y0: s.y - h * 0.85, x1: x0 + w, y1: s.y + h * 0.2 };
      const label: PlacedLabel = { id: r.id, x: s.x, y: s.y, anchor: s.anchor, box };
      const inside = box.x0 >= -extent + margin && box.x1 <= extent - margin && box.y0 >= -extent + margin && box.y1 <= extent - margin;
      const clear = placed.every((p) => !hit(p.box, box)) && markers.every((m) => !hit(m, box));
      if (inside && clear) { chosen = label; break; }
      if (inside && !fallback) fallback = label;
    }
    placed.push(chosen ?? fallback ?? { id: r.id, x: r.x, y: r.z - gap, anchor: "middle", box: { x0: r.x - w / 2, y0: r.z - gap - h, x1: r.x + w / 2, y1: r.z - gap } });
  }
  return regions.map((r) => placed.find((p) => p.id === r.id)!);
}

/** "nice" scale-bar length (metres) for a map `extent` units from centre to edge: about a fifth of the map width */
export function scaleBarMeters(extent: number): number {
  const target = (extent * 2) / 5, steps = [50, 100, 200, 250, 500, 1000, 2000];
  return steps.reduce((best, s) => (Math.abs(s - target) < Math.abs(best - target) ? s : best), steps[0]!);
}

/** graticule line positions (multiples of `step` inside +-extent, excluding the frame) */
export function graticule(extent: number, step: number): number[] {
  const out: number[] = [];
  for (let v = -Math.floor(extent / step) * step; v <= extent; v += step) if (Math.abs(v) < extent - step * 0.2) out.push(v);
  return out;
}
