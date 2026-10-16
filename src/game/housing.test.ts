import { describe, expect, test } from "bun:test";
import { buyDecor, buyHome, mergeHousing, placeDecor, EMPTY_HOUSING, homeById } from "./housing";
import { nexBalance } from "./nex";

const base = (nex: number, garages: string[] = []) => ({ nexLedger: { grant: nex } as Record<string, number>, housing: EMPTY_HOUSING, fleet: { garages: garages as never[] } });

describe("housing", () => {
  test("cheap Undercity flat vs expensive Aegis penthouse", () => {
    expect(homeById("rustmuck-capsule")!.price).toBe(2500);
    expect(homeById("aegis-penthouse")!.price).toBe(250000);
  });
  test("buying charges once and refuses a second buy", () => {
    const r = buyHome(base(3000), "rustmuck-capsule");
    if ("error" in r) throw new Error(r.error);
    expect(nexBalance(r.progression.nexLedger)).toBe(500);
    expect("error" in buyHome(r.progression, "rustmuck-capsule")).toBe(true);
  });
  test("can own several homes", () => {
    let p = base(30000);
    for (const id of ["rustmuck-capsule", "grid-loft"]) { const r = buyHome(p, id); if ("error" in r) throw new Error(r.error); p = r.progression; }
    expect(nexBalance(p.nexLedger)).toBe(9500);
  });
  test("not enough Nex is refused", () => expect("error" in buyHome(base(100), "grid-loft")).toBe(true));
  test("garage quarters need the garage", () => {
    expect("error" in buyHome(base(9000), "wastes-hangar-bunk")).toBe(true);
    expect("error" in buyHome(base(9000, ["base-01"]), "wastes-hangar-bunk")).toBe(false);
  });
  test("decor must be owned, fit the slot and the room", () => {
    let p: ReturnType<typeof base> = base(10000);
    const h = buyHome(p, "rustmuck-capsule"); if ("error" in h) throw 0; p = h.progression;
    expect("error" in placeDecor(p, "rustmuck-capsule", 0, "tv", "tv-wall")).toBe(true);
    const d = buyDecor(p, "tv-wall"); if ("error" in d) throw 0; p = d.progression;
    expect("error" in placeDecor(p, "rustmuck-capsule", 1, "tv", "tv-wall")).toBe(true); // bathroom
    const ok = placeDecor(p, "rustmuck-capsule", 0, "tv", "tv-wall");
    if ("error" in ok) throw new Error(ok.error);
    expect(ok.progression.housing.placed["rustmuck-capsule"]!["0:tv"]).toBe("tv-wall");
  });
  test("merge keeps both copies' rooms, newer wins a slot", () => {
    const a = { placed: { x: { "0:tv": "tv-holo" } }, home: "x" }, b = { placed: { x: { "0:tv": "tv-wall", "0:art": "art-vyrak" } }, home: null };
    const m = mergeHousing(a, b, true);
    expect(m.placed["x"]).toEqual({ "0:tv": "tv-holo", "0:art": "art-vyrak" });
  });
});
