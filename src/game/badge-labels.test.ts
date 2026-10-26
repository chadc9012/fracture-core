import { describe, expect, it } from "bun:test";
import { labelBox, placeBadgeLabels, type LabelItem } from "./badge-labels";
import { cityDistricts, destinationById } from "./destination-director";

const overlap = (a: ReturnType<typeof labelBox>, b: ReturnType<typeof labelBox>) => a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1;
const item = (id: string, x: number, z: number, extra: Partial<LabelItem> = {}): LabelItem => ({ id, x, z, r: 4, text: id, size: 3, priority: 1, prefer: "right", ...extra });

describe("badge labels", () => {
  it("a lone label takes its preferred side with its caption", () => {
    expect(placeBadgeLabels([item("Luxury District", 0, 0, { sub: "Penthouses" })]).get("Luxury District")).toEqual({ side: "right", sub: true });
  });

  it("a crowded label moves to another side, then drops its caption, then its text", () => {
    const p = placeBadgeLabels([item("AAAAAAAA", 0, 0, { priority: 2 }), item("BBBBBBBB", 12, 0, { priority: 1 })]);
    expect(p.get("AAAAAAAA")).not.toBeNull();
    expect(p.get("BBBBBBBB")?.side).not.toBe("left"); // left of B is where A's label sits
    // a label boxed in on every side by icons gets no text at all
    const boxed = placeBadgeLabels([item("X", 0, 0), item("n", 0, -9, { labelled: false }), item("s", 0, 9, { labelled: false }), item("e", 9, 0, { labelled: false }), item("w", -9, 0, { labelled: false })]);
    expect(boxed.get("X")).toBeNull();
  });

  it("Neon City's districts and their captions never overlap each other (owner's map shot, Oct 26)", () => {
    const dest = destinationById("neon-city")!;
    const ds = cityDistricts(dest);
    expect(ds.length).toBeGreaterThan(5);
    for (const scale of [0.6, 1, 1.6]) {
      const items: LabelItem[] = ds.map((k, i) => ({ id: k.id, x: k.x, z: k.z, r: 5.6 * scale, text: k.name, size: 3.5 * scale, sub: k.tagline.split(" · ")[0], subSize: 2.5 * scale, priority: 100 - i, prefer: "right" }));
      const placed = placeBadgeLabels(items);
      const boxes = items.flatMap((it) => { const p = placed.get(it.id); return p ? [labelBox(it, p.side, p.sub)] : []; });
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(overlap(boxes[i]!, boxes[j]!)).toBe(false);
      // and no label sits on another district's badge
      items.forEach((it, i) => boxes.forEach((b) => { const own = placed.get(it.id); const mine = own ? labelBox(it, own.side, own.sub) : null; if (b === mine) return; const icon = { x0: it.x - it.r, z0: it.z - it.r, x1: it.x + it.r, z1: it.z + it.r }; expect(overlap(icon, b), `${it.id} badge under a label (${i})`).toBe(false); }));
    }
  });
});
