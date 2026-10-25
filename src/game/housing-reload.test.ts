import { describe, expect, test } from "bun:test";
import { DEFAULT_PROGRESSION, normalizeProgression } from "./progression";
import { buyDecor, buyHome, ownsDecor, ownsHome, placeDecor, type HousingResult } from "./housing";

type P = typeof DEFAULT_PROGRESSION;
const ok = (r: HousingResult<P>): P => { if ("error" in r) throw new Error(r.error); return r.progression; };
const reload = (p: P): P => normalizeProgression(JSON.parse(JSON.stringify(p)));

describe("housing survives a full save and reload", () => {
  test("ownership, furnishings and the placed layout round-trip through the whole progression", () => {
    let p: P = { ...DEFAULT_PROGRESSION, nexLedger: { ...DEFAULT_PROGRESSION.nexLedger, grant: 100000 } };
    p = ok(buyHome(p, "grid-loft"));
    for (const d of ["sofa-street", "art-fracture", "tv-wall", "light-neon", "bed-bunk", "floor-oak"]) p = ok(buyDecor(p, d));
    p = ok(placeDecor(p, "grid-loft", 0, "furniture", "sofa-street"));
    p = ok(placeDecor(p, "grid-loft", 0, "art", "art-fracture"));
    p = ok(placeDecor(p, "grid-loft", 0, "tv", "tv-wall"));
    p = ok(placeDecor(p, "grid-loft", 0, "lighting", "light-neon"));
    p = ok(placeDecor(p, "grid-loft", 1, "bed", "bed-bunk"));
    const after = reload(reload(p)); // twice: a reload of a reload must not drift
    expect(ownsHome(after, "grid-loft")).toBe(true);
    for (const d of ["sofa-street", "art-fracture", "tv-wall", "light-neon", "bed-bunk", "floor-oak"]) expect(ownsDecor(after, d)).toBe(true);
    expect(after.housing.placed["grid-loft"]).toEqual(p.housing.placed["grid-loft"]);
    expect(after.nexLedger).toEqual(p.nexLedger);
  });
  test("a reload never refunds or double-charges: buying again is still refused and the balance is unchanged", () => {
    let p: P = { ...DEFAULT_PROGRESSION, nexLedger: { ...DEFAULT_PROGRESSION.nexLedger, grant: 50000 } };
    p = ok(buyHome(p, "rustmuck-capsule"));
    const after = reload(p);
    expect("error" in buyHome(after, "rustmuck-capsule")).toBe(true);
    expect(after.nexLedger).toEqual(p.nexLedger);
  });
  test("a save with junk housing data loads as empty housing instead of crashing", () => {
    const junk = reload({ ...DEFAULT_PROGRESSION, housing: { placed: 7, home: {} } as never });
    expect(junk.housing.placed).toEqual({});
    expect(junk.housing.home).toBeNull();
  });
});
