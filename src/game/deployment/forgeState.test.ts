import { describe, expect, test } from "bun:test";
import { armorSummary, defaultAppearance, forgeDirty, forgeInitial } from "./forgeState";
import { applyCharacter } from "./applyCharacter";
import { DEFAULT_PROGRESSION, normalizeProgression } from "../progression";
import { loadoutAttributes } from "../armor-attributes";
import { makeSetPiece } from "../armor-sets";
import type { PlayerCharacter } from "./deployCharacter";

const saved: PlayerCharacter = {
  deploymentId: "d1", operatorId: "nyx", classId: "HUNTER", subclassId: "TRACKER_HUNTER", bodyType: "male", displayName: "RAVEN",
  appearance: { armor: "#eeeeee", cloth: "#111111", visor: "#7c3aed", trim: "#a78bfa", callsign: "RAVEN" }, loadout: { weaponOrder: [] },
};

describe("restoring the saved character", () => {
  test("nothing saved gives the default Goliath", () => {
    const s = forgeInitial(null);
    expect(s.classId).toBe("TITAN");
    expect(s.appearance.callsign).toBe(defaultAppearance("TITAN").callsign);
  });
  test("a saved character restores class, subclass, body, colours and callsign", () => {
    const s = forgeInitial(saved);
    expect(s).toMatchObject({ classId: "HUNTER", subclassId: "TRACKER_HUNTER", bodyType: "male" });
    expect(s.appearance).toMatchObject({ armor: "#eeeeee", visor: "#7c3aed", callsign: "RAVEN" });
  });
  test("round-trips through applyCharacter and normalizeProgression", () => {
    const p = normalizeProgression(JSON.parse(JSON.stringify(applyCharacter(DEFAULT_PROGRESSION, saved))));
    expect(forgeInitial(p.character)).toEqual(forgeInitial(saved));
  });
  test("corrupt fields fall back per field and never throw", () => {
    const s = forgeInitial({ classId: "HUNTER", subclassId: "SHIELD_TITAN", bodyType: "alien" as never, appearance: { armor: "red", cloth: 5 as never, visor: "#00ff00", trim: "#12345", callsign: "  " } });
    expect(s.subclassId).toBe("SHADOW_HUNTER"); // a subclass of another class is rejected
    expect(s.bodyType).toBe("male");
    expect(s.appearance.armor).toBe(defaultAppearance("HUNTER").armor);
    expect(s.appearance.visor).toBe("#00ff00");
    expect(s.appearance.callsign).toBe(defaultAppearance("HUNTER").callsign);
    expect(() => forgeInitial({} as never)).not.toThrow();
  });
});

describe("unsaved-edit detection", () => {
  test("identical is clean; any change is dirty", () => {
    const a = forgeInitial(saved);
    expect(forgeDirty(a, forgeInitial(saved))).toBe(false);
    expect(forgeDirty(a, { ...a, bodyType: "robot" })).toBe(true);
    expect(forgeDirty(a, { ...a, appearance: { ...a.appearance, trim: "#000000" } })).toBe(true);
    expect(forgeDirty(a, { ...a, classId: "TITAN" })).toBe(true);
  });
});

describe("armor summary", () => {
  test("lists five independent slots and uses the one attribute calculation", () => {
    const helm = makeSetPiece("verdant-warden", "helmet", 5)!, legs = makeSetPiece("mire-stalker", "legs", 5)!;
    const p = { ...DEFAULT_PROGRESSION, inventory: [helm, legs], equippedGear: { helmet: helm.id, legs: legs.id } };
    const sum = armorSummary(p);
    expect(sum.slots.map((s) => s.label).sort()).toEqual(["Accessory", "Arms", "Chest", "Helmet", "Legs"]);
    expect(sum.slots.length).toBe(5);
    expect(sum.slots.find((s) => s.slot === "helmet")?.setId).toBe("verdant-warden");
    expect(sum.slots.find((s) => s.slot === "legs")?.setId).toBe("mire-stalker"); // mixed sets
    expect(sum.slots.find((s) => s.slot === "chest")?.name).toBeNull();
    expect(sum.stats).toEqual(loadoutAttributes(p).effective);
    expect(sum.worn).toBe(2);
  });
  test("equipping a piece changes the stats", () => {
    const chest = makeSetPiece("frostwrought-aegis", "chest", 8)!;
    const before = armorSummary(DEFAULT_PROGRESSION).stats;
    const after = armorSummary({ ...DEFAULT_PROGRESSION, inventory: [...DEFAULT_PROGRESSION.inventory, chest], equippedGear: { ...DEFAULT_PROGRESSION.equippedGear, chest: chest.id } }).stats;
    expect(after.defense).toBeGreaterThan(before.defense);
  });
});
