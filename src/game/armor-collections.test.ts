import { expect, test } from "bun:test";
import { COLLECTIONS, collectionReward, vendorSellable, PITY_RUNS } from "./armor-collections";
import { setStatuses } from "./armor-sets";
test("five families of six collections", () => { expect(COLLECTIONS.length).toBe(30); for (const f of ["military","ninja","sentinel","street","exotic"]) expect(COLLECTIONS.filter((c) => c.family === f).length).toBe(6); });
test("raid and exotic gear is never sold by vendors", () => { for (const c of COLLECTIONS) if (c.family === "exotic" || c.sources.includes("raid")) expect(vendorSellable(c, 5)).toBe(false); });
test("first clear always drops, repeats only every pity run", () => { expect(collectionReward("story", "m", 1, true)).not.toBeNull(); expect(collectionReward("story", "m", 1, false)).toBeNull(); expect(collectionReward("story", "m", PITY_RUNS, false)).not.toBeNull(); });
test("mixed pieces work without a full set", () => { const inv = [{ id: "a", name: "a", slot: "helmet", power: 1, level: 1, element: "ARC", source: "", setId: "ironwatch" }, { id: "b", name: "b", slot: "chest", power: 1, level: 1, element: "ARC", source: "", setId: "ironwatch" }] as any; const s = setStatuses({ inventory: inv, equippedGear: { helmet: "a", chest: "b" } }).find((x) => x.set.id === "ironwatch")!; expect(s.twoActive).toBe(true); expect(s.fourActive).toBe(false); });
