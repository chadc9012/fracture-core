import { describe, expect, test } from "bun:test";
import { RIVAL_PERSONAS, personaForSlot } from "./rival-personas";

describe("rival personas", () => {
  test("every persona's shape is endpoint-preserving so it can never move the real finish time", () => {
    for (const persona of RIVAL_PERSONAS) {
      expect(persona.shape(0)).toBeCloseTo(0, 6);
      expect(persona.shape(1)).toBeCloseTo(1, 6);
      // monotonic across the race, and never below 0 / sends the rival backwards
      let prev = -1;
      for (let u = 0; u <= 1.0001; u += 0.05) { const v = persona.shape(u); expect(v).toBeGreaterThanOrEqual(prev - 1e-9); expect(v).toBeGreaterThanOrEqual(-1e-9); prev = v; }
    }
  });
  test("a finished or not-yet-started rival (u outside [0,1]) still reads as the plain ratio", () => {
    for (const persona of RIVAL_PERSONAS) { expect(persona.shape(1.4)).toBeCloseTo(1.4, 6); expect(persona.shape(-0.2)).toBeCloseTo(-0.2, 6); }
  });
  test("every persona is named and distinct", () => {
    const names = new Set(RIVAL_PERSONAS.map((p) => p.name));
    expect(names.size).toBe(RIVAL_PERSONAS.length);
    expect(RIVAL_PERSONAS.length).toBe(6);
  });
  test("the same race+difficulty+slot always gets the same driver, and slots vary", () => {
    expect(personaForSlot("nc-circuit", "standard", 2).id).toBe(personaForSlot("nc-circuit", "standard", 2).id);
    const bySlot = Array.from({ length: 6 }, (_, k) => personaForSlot("nc-circuit", "standard", k).id);
    expect(new Set(bySlot).size).toBeGreaterThan(1); // not every slot in the same race collapses to one persona
    // a different difficulty is free to assign a different driver to the same slot number (the field itself reshuffles)
    const a = personaForSlot("nc-circuit", "standard", 0).id, b = personaForSlot("nc-circuit", "legendary", 0).id;
    expect(typeof a).toBe("string"); expect(typeof b).toBe("string");
  });
});
