import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { BODY_TYPES, FACES, faceOr, isFaceFor } from "./operators";
import { forgeDirty, forgeInitial } from "./deployment/forgeState";
import { validateCharacter, type PlayerCharacter } from "./deployment/deployCharacter";
import { ARMOR_SHADERS, buyShader, ownsShader } from "./armor-shaders";
import { ROOKIE_SETS } from "./rookie-armor";
import { DEFAULT_PROGRESSION } from "./progression";

const base = (o: Partial<PlayerCharacter> = {}): PlayerCharacter => ({ deploymentId: "d", operatorId: "nyx", classId: "HUNTER", subclassId: "SHADOW_ASSASSIN" as never, bodyType: "female", displayName: "NYX", appearance: { armor: "#2a2a2f", cloth: "#121215", visor: "#d81f2e", trim: "#c9c9cc", callsign: "NYX" }, loadout: { weaponOrder: [] }, ...o });

describe("faces", () => {
  test("every body type has several distinct faces, with unique ids across bodies", () => {
    const ids = BODY_TYPES.flatMap((b) => FACES[b].map((f) => f.id));
    for (const b of BODY_TYPES) expect(FACES[b].length).toBeGreaterThanOrEqual(2);
    expect(FACES.male.length).toBeGreaterThanOrEqual(4); expect(FACES.robot.length).toBeGreaterThanOrEqual(4);
    expect(new Set(ids).size).toBe(ids.length);
  });
  test("a face only belongs to its own body type; switching body falls back to that body's first face", () => {
    expect(isFaceFor("female", "f-nyx")).toBe(true); expect(isFaceFor("male", "f-nyx")).toBe(false);
    expect(faceOr("robot", "m-sage")).toBe(FACES.robot[0]!.id); expect(faceOr("male", "m-sage")).toBe("m-sage"); expect(faceOr("male", 12)).toBe(FACES.male[0]!.id);
  });
  test("any operator can be any body type with its faces: saves validate for every combination", () => {
    for (const classId of ["TITAN", "HUNTER", "WARLOCK"] as const) for (const b of BODY_TYPES) for (const f of FACES[b]) expect(validateCharacter(base({ classId, bodyType: b, face: f.id }))).toBeNull();
  });
  test("a mismatched face is rejected; an old save without a face still validates", () => {
    expect(validateCharacter(base({ bodyType: "male", face: "f-nyx" }))).not.toBeNull();
    expect(validateCharacter(base({ bodyType: "male" }))).toBeNull();
  });
  test("the forge restores the saved face, repairs a bad one, and notices face edits", () => {
    const saved = base({ bodyType: "robot", face: "r-slit" });
    expect(forgeInitial(saved).face).toBe("r-slit");
    // a bad or old face id falls back to the class's own face for that body (NYX robot: twin-lens)
    expect(forgeInitial(base({ bodyType: "robot", face: "m-scout" })).face).toBe("r-twin");
    expect(forgeInitial(null).face).toBe(FACES.male[0]!.id);
    const a = forgeInitial(saved);
    expect(forgeDirty(a, { ...a, face: "r-twin" })).toBe(true); expect(forgeDirty(a, { ...a, skin: "gold" })).toBe(true); expect(forgeDirty(a, { ...a, eyes: "red" })).toBe(true); expect(forgeDirty(a, forgeInitial(saved))).toBe(false);
  });
});

describe("colour is no longer a creation choice", () => {
  const menu = readFileSync(new URL("../components/game/StartMenu.tsx", import.meta.url), "utf8");
  test("the creation menu has Body, Face, skin/plating, Callsign and Finish steps, no armour editing and no armour colour", () => {
    const tabs = menu.slice(menu.indexOf("const tabsFor"), menu.indexOf("];", menu.indexOf("const tabsFor")));
    for (const t of ["Body", "Face", "Callsign", "Finish"]) expect(tabs).toContain(`label: "${t}"`);
    expect(tabs).toContain('"Skin tone"'); expect(tabs).toContain('"Plating"'); expect(tabs).toContain('"Optics"');
    expect(tabs).not.toContain('"Gear"'); expect(menu).not.toContain("cyclePiece"); expect(menu).not.toContain("Equipped armor");
    for (const t of ["Armor", "Undersuit", "Visor", "Trim"]) expect(tabs).not.toContain(`label: "${t}"`);
    expect(menu).not.toContain("CUSTOMIZATION_PALETTE.map");
  });
  test("the operator archive no longer offers colour variations", () => {
    const roster = readFileSync(new URL("../components/game/OperatorRoster.tsx", import.meta.url), "utf8");
    expect(roster).not.toContain("wearVariant"); expect(roster).not.toContain('role="radiogroup" aria-label="Colour variation"');
  });
  test("every non-standard rookie colourway is available as a shader instead, and is not owned at the start", () => {
    const wanted = new Set(Object.values(ROOKIE_SETS).flatMap((s) => s.variants.slice(1).map((v) => v.armor.toLowerCase())));
    const shaders = ARMOR_SHADERS.filter((s) => s.id.startsWith("rookie-"));
    expect(shaders.length).toBeGreaterThanOrEqual(5);
    for (const s of shaders) expect(ownsShader(DEFAULT_PROGRESSION, s.id)).toBe(false);
    for (const color of ["#a8916b", "#d6dbe0", "#34404f", "#3b4a30", "#3a2a5c"]) { expect(wanted.has(color)).toBe(true); expect(shaders.some((s) => s.base === color)).toBe(true); }
  });
  test("a rookie shader is bought with materials and then owned", () => {
    const rich = { ...DEFAULT_PROGRESSION, materials: { scrapMetal: 100, reinforcedAlloy: 100, microCircuits: 100 } };
    for (const s of ARMOR_SHADERS.filter((x) => x.id.startsWith("rookie-"))) { const r = buyShader(rich, s.id); expect("progression" in r && ownsShader(r.progression, s.id)).toBe(true); expect("error" in buyShader(DEFAULT_PROGRESSION, s.id)).toBe(true); }
  });
});

import { OPERATOR_START_BODY } from "./operators";
import { OPERATORS } from "./loadout";
test("each operator starts on the body shown on the rookie sheet, and every operator has an entry", () => {
  expect(OPERATOR_START_BODY).toEqual({ goliath: "male", nyx: "female", cipher: "male" });
  for (const o of OPERATORS) expect(OPERATOR_START_BODY[o.id as keyof typeof OPERATOR_START_BODY]).toBeDefined();
});
