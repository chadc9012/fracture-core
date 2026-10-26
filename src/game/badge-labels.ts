/** Marker and district label placement for the destination close-ups (pure; map-labels.ts places the region names on the
 * world map). Every marker keeps its icon, but a label is only drawn where it fits. Labels are placed in
 * priority order; each tries its preferred side, then the other sides, and gives up (icon only, name in the tooltip) when every
 * spot would overlap an icon or a label already placed. A label's optional second line (a district's caption) is dropped first.
 * Owner's phone shots (Oct 26): Neon City's district names and captions sat on top of each other and the landmark names.
 * Units are whatever the map draws in (world units here); sizes come in already scaled. */

export type LabelSide = "right" | "left" | "below" | "above";
export type LabelItem = {
  id: string;
  /** icon centre */
  x: number;
  z: number;
  /** icon radius (always kept clear of other labels) */
  r: number;
  /** label text and its font size; an optional caption line under it in its own size */
  text: string;
  size: number;
  sub?: string | undefined;
  subSize?: number | undefined;
  /** higher goes first */
  priority: number;
  /** the side to try first */
  prefer: LabelSide;
  /** false: the icon is drawn but this item never gets a label (it still blocks others) */
  labelled?: boolean;
};
export type LabelPlacement = { side: LabelSide; sub: boolean } | null;
type Box = { x0: number; z0: number; x1: number; z1: number };

/** rough rendered width of a line of text: map fonts run about 0.6 em per character */
export const textWidth = (text: string, size: number) => text.length * size * 0.6;
const GAP = 0.6; // clear space kept between boxes, in font-size-ish units of the label

const ORDER: Record<LabelSide, LabelSide[]> = {
  right: ["right", "left", "below", "above"],
  left: ["left", "right", "below", "above"],
  below: ["below", "above", "right", "left"],
  above: ["above", "below", "right", "left"],
};

/** the label's box for an icon at (x, z) on a side, one or two lines */
export function labelBox(it: Pick<LabelItem, "x" | "z" | "r" | "text" | "size" | "sub" | "subSize">, side: LabelSide, withSub: boolean): Box {
  const subSize = it.subSize ?? it.size * 0.7;
  const w = Math.max(textWidth(it.text, it.size), withSub && it.sub ? textWidth(`(${it.sub})`, subSize) : 0);
  const h = it.size * 1.15 + (withSub && it.sub ? subSize * 1.2 : 0);
  const pad = it.r + it.size * 0.35;
  switch (side) {
    case "right": return { x0: it.x + pad, z0: it.z - it.size * 0.85, x1: it.x + pad + w, z1: it.z - it.size * 0.85 + h };
    case "left": return { x0: it.x - pad - w, z0: it.z - it.size * 0.85, x1: it.x - pad, z1: it.z - it.size * 0.85 + h };
    case "below": return { x0: it.x - w / 2, z0: it.z + pad, x1: it.x + w / 2, z1: it.z + pad + h };
    case "above": return { x0: it.x - w / 2, z0: it.z - pad - h, x1: it.x + w / 2, z1: it.z - pad };
  }
}

const hit = (a: Box, b: Box, m: number) => a.x0 < b.x1 + m && b.x0 < a.x1 + m && a.z0 < b.z1 + m && b.z0 < a.z1 + m;

export function placeBadgeLabels(items: readonly LabelItem[]): Map<string, LabelPlacement> {
  const out = new Map<string, LabelPlacement>();
  const icons: Box[] = items.map((it) => ({ x0: it.x - it.r, z0: it.z - it.r, x1: it.x + it.r, z1: it.z + it.r }));
  const placed: Box[] = [];
  const order = items.map((it, i) => ({ it, i })).sort((a, b) => b.it.priority - a.it.priority || a.i - b.i);
  for (const { it, i } of order) {
    if (it.labelled === false) { out.set(it.id, null); continue; }
    const margin = it.size * GAP * 0.5;
    const fits = (b: Box) => !placed.some((p) => hit(b, p, margin)) && !icons.some((c, j) => j !== i && hit(b, c, margin));
    let done: LabelPlacement = null;
    // the full label (with its caption) anywhere it fits, then the name alone
    for (const withSub of it.sub ? [true, false] : [false]) {
      for (const side of ORDER[it.prefer]) {
        const b = labelBox(it, side, withSub);
        if (fits(b)) { placed.push(b); done = { side, sub: withSub }; break; }
      }
      if (done) break;
    }
    out.set(it.id, done);
  }
  return out;
}

/** where to draw a placed label relative to its icon, in the icon's own (unscaled) units: the text anchor point and alignment */
export function labelAnchor(side: LabelSide, r: number, size: number): { x: number; y: number; anchor: "start" | "middle" | "end" } {
  const pad = r + size * 0.35;
  switch (side) {
    case "right": return { x: pad, y: size * 0.15, anchor: "start" };
    case "left": return { x: -pad, y: size * 0.15, anchor: "end" };
    case "below": return { x: 0, y: pad + size * 0.9, anchor: "middle" };
    case "above": return { x: 0, y: -pad - size * 0.25, anchor: "middle" };
  }
}
