/** View maths for the street maps: zoom limits, the visible window, screen<->world, and label placement that never overlaps
 * (greedy by importance, in screen space, recomputed as the view changes). Pure, so it can be tested without a DOM. */
import type { CartoBounds } from "./carto-maps";

export type CartoView = { cx: number; cz: number; /** 1 = the whole map fits the viewport's short side */ zoom: number };
export const ZOOM_MIN = 1, ZOOM_MAX = 18;
export const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

/** the world window the viewport shows */
export function viewWindow(b: CartoBounds, v: CartoView, vw: number, vh: number): { x0: number; z0: number; w: number; h: number; ppm: number } {
  const short = Math.min(vw, vh) || 1;
  const ppm = (short / b.span) * v.zoom; // screen pixels per metre
  const w = vw / ppm, h = vh / ppm;
  return { x0: v.cx - w / 2, z0: v.cz - h / 2, w, h, ppm };
}
/** keep the centre on the map */
export function clampView(b: CartoBounds, v: CartoView): CartoView {
  const zoom = clampZoom(v.zoom);
  return { zoom, cx: Math.min(b.x0 + b.span, Math.max(b.x0, v.cx)), cz: Math.min(b.z0 + b.span, Math.max(b.z0, v.cz)) };
}
/** zoom about a screen point (the cursor or the pinch centre), so the point under it stays put */
export function zoomAt(b: CartoBounds, v: CartoView, vw: number, vh: number, sx: number, sy: number, factor: number): CartoView {
  const win = viewWindow(b, v, vw, vh);
  const wx = win.x0 + sx / win.ppm, wz = win.z0 + sy / win.ppm;
  const zoom = clampZoom(v.zoom * factor), k = v.zoom / zoom;
  return clampView(b, { zoom, cx: wx + (v.cx - wx) * k, cz: wz + (v.cz - wz) * k });
}

export type LabelIn = { id: string; text: string; x: number; z: number; rank: number; /** screen px */ size: number; /** a pin under the label: the label sits beside it */ pin?: boolean };
export type LabelOut = LabelIn & { sx: number; sy: number; anchor: "start" | "middle" | "end" };
/** Place labels in screen space: most important first, each tried centred / right / left / below its point, dropped when it
 * would overlap one already placed (or leave the screen). `maxRank` hides the detail of a zoomed-out view. */
export function placeCartoLabels(items: readonly LabelIn[], toScreen: (x: number, z: number) => [number, number], vw: number, vh: number, maxRank: number): LabelOut[] {
  const boxes: [number, number, number, number][] = [];
  const out: LabelOut[] = [];
  const sorted = [...items].filter((i) => i.rank <= maxRank).sort((a, b) => a.rank - b.rank || b.size - a.size);
  const hits = (x0: number, y0: number, x1: number, y1: number) => boxes.some(([a, b, c, d]) => x0 < c && x1 > a && y0 < d && y1 > b);
  for (const it of sorted) {
    const [sx, sy] = toScreen(it.x, it.z);
    if (sx < -40 || sy < -20 || sx > vw + 40 || sy > vh + 20) continue;
    const w = it.text.length * it.size * 0.56, h = it.size * 1.15, gap = it.pin ? 11 : 0;
    const tries: [number, number, "start" | "middle" | "end"][] = it.pin
      ? [[sx + gap, sy + h * 0.32, "start"], [sx - gap, sy + h * 0.32, "end"], [sx, sy + gap + h * 0.8, "middle"], [sx, sy - gap - h * 0.25, "middle"]]
      : [[sx, sy, "middle"], [sx, sy + h, "middle"], [sx, sy - h, "middle"]];
    for (const [tx, ty, anchor] of tries) {
      const x0 = anchor === "start" ? tx : anchor === "end" ? tx - w : tx - w / 2, y0 = ty - h * 0.8;
      const box: [number, number, number, number] = [x0 - 2, y0 - 2, x0 + w + 2, y0 + h + 2];
      if (box[0] < 0 || box[2] > vw || box[1] < 0 || box[3] > vh) continue;
      if (hits(...box)) continue;
      boxes.push(box); out.push({ ...it, sx: tx, sy: ty, anchor });
      break;
    }
  }
  return out;
}

/** scale bar length (metres) for a given pixels-per-metre: a round number about 90 px long */
export function cartoScaleBar(ppm: number): { m: number; px: number; label: string } {
  const target = 90 / ppm, steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000];
  const m = steps.reduce((best, s) => (Math.abs(s - target) < Math.abs(best - target) ? s : best), steps[0]!);
  return { m, px: m * ppm, label: m >= 1000 ? `${m / 1000} km` : `${m} m` };
}
