// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, it } from "bun:test";
import { DEFAULT_BINDINGS, normalizeBindings } from "./bindings";

describe("stance bindings", () => {
  it("defaults crouch and prone and fills them in for older saved bindings", () => {
    expect(DEFAULT_BINDINGS.keyboard.crouch).toBe("ControlLeft");
    const old = normalizeBindings({ keyboard: { reload: "KeyR" } as never });
    expect(old.keyboard.reload).toBe("KeyR");
    expect(old.keyboard.prone).toBe("KeyX");
    expect(old.gamepad.crouch).toBe(1);
  });
});
