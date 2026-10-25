// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, it } from "bun:test";
import { windupHud, type EncounterState } from "./encounter-sim";
import { ENCOUNTERS } from "./scenario-encounters";

const id = Object.keys(ENCOUNTERS)[0]!;
const attackId = Object.keys(ENCOUNTERS[id]!.attacks)[0]!;
const enc = (over: Partial<EncounterState> = {}): EncounterState => ({ phase: 0, state: "TELL", timer: 1, atk: attackId, cursor: 0, tx: 0, tz: 0, cx: 0, cz: 0, sinceFinale: 0, finaleUntil: 0, tellTotal: 2, ...over });

describe("boss wind-up HUD", () => {
  it("reports the attack label and progress only while the boss is winding up", () => {
    const w = windupHud(enc(), id)!;
    expect(w.label).toBe(ENCOUNTERS[id]!.attacks[attackId]!.label);
    expect(w.progress).toBeCloseTo(0.5);
    expect(windupHud(enc({ state: "RECOVER" }), id)).toBeNull();
    expect(windupHud(enc({ state: "IDLE" }), id)).toBeNull();
    expect(windupHud(undefined, id)).toBeNull();
  });
  it("clamps progress and ignores unknown attacks or encounters", () => {
    expect(windupHud(enc({ timer: -1 }), id)!.progress).toBe(1);
    expect(windupHud(enc({ timer: 9 }), id)!.progress).toBe(0);
    expect(windupHud(enc({ atk: "nope" }), id)).toBeNull();
    expect(windupHud(enc(), "no-such-scenario")).toBeNull();
    expect(windupHud(enc({ tellTotal: 0 }), id)).toBeNull();
  });
});
