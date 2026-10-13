import { expect, test } from "bun:test";
import { DEFAULT_BINDINGS } from "./bindings";
import { stickCodes, touchCodes } from "./touch-controls";
test("touch jump and vehicle use the real gameplay controls", () => {
  expect(touchCodes().jump).toBe("KeyC"); expect(touchCodes().vehicle).toBe("KeyV");
});
test("touch honors saved reload, map and weapon remaps", () => {
  const codes = touchCodes({ ...DEFAULT_BINDINGS, keyboard: { ...DEFAULT_BINDINGS.keyboard, reload: "KeyL", map: "KeyP", nextWeapon: "KeyO" } });
  expect(codes.reload).toBe("KeyL"); expect(codes.map).toBe("KeyP"); expect(codes.next).toBe("KeyO");
});
test("releasing the stick releases movement and sprint", () => { expect(stickCodes(0, 0)).toEqual([]); expect(stickCodes(0, -60)).toEqual(["KeyW", "ShiftLeft"]); });