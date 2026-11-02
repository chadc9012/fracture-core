import { describe, expect, test } from "bun:test";
import { BASE_MODEL, BUILD_MODEL, FLEET_MODELS, vehicleModelFor, type FleetModelId } from "./fleet-models";
import { MODEL_SOUND, SOUNDS, engineFrame, soundForModel } from "./vehicle-sound";
import { VEHICLES } from "./vehicles";

describe("vehicle sounds match the vehicles", () => {
  test("every body in the fleet has a sound family", () => {
    for (const id of Object.keys(FLEET_MODELS) as FleetModelId[]) expect(MODEL_SOUND[id], id).toBeDefined();
  });
  test("the sound follows the body, not the chassis: a city pod on the jeep chassis is electric, a hover car whines", () => {
    expect(soundForModel(vehicleModelFor("wasteland-jeep", "civic-rover").id).family).toBe("electric");
    expect(soundForModel(vehicleModelFor("wasteland-jeep").id).family).toBe("diesel");
    expect(soundForModel(vehicleModelFor("ai-interceptor", "void-chaser").id).family).toBe("hover");
    expect(soundForModel(vehicleModelFor("scrap-interceptor", "neon-drift").id).family).toBe("sport");
    for (const build of Object.keys(BUILD_MODEL)) expect(MODEL_SOUND[BUILD_MODEL[build]!]).toBeDefined();
  });
  test("by domain: aircraft sound like aircraft, boats like boats, tanks like tanks", () => {
    const fam = (id: keyof typeof BASE_MODEL) => soundForModel(BASE_MODEL[id]).family;
    for (const v of VEHICLES) {
      const f = fam(v.id);
      if (v.domain === "AIR" || v.domain === "SPACE") expect(["rotor", "jet", "shuttle", "drone"], v.id).toContain(f);
      if (v.domain === "WATER" || v.domain === "AMPHIBIOUS") expect(["outboard", "submarine", "ship"], v.id).toContain(f);
    }
    expect(fam("goliath-tank")).toBe("tracks");
    expect(fam("aether-hoverbike")).toBe("hover");
  });
  test("the layers behave like the real thing", () => {
    const at = (f: keyof typeof SOUNDS, v: number, th = 1) => engineFrame(SOUNDS[f], v, th);
    // rotor blades chop at a few beats a second whatever the speed; an engine's firing rate rises with revs
    expect(at("rotor", 0).pulseHz).toBeGreaterThan(4); expect(at("rotor", 1).pulseHz).toBeLessThan(12);
    expect(at("v8", 1).pulseHz).toBeGreaterThan(at("v8", 0, 0).pulseHz * 2);
    // electric motors and jets don't pulse; a jet is mostly roar, an electric car mostly whine
    expect(SOUNDS.electric.pulseDepth).toBe(0); expect(SOUNDS.jet.pulseDepth).toBe(0);
    expect(at("jet", 1).noiseGain).toBeGreaterThan(at("jet", 1).toneGain);
    expect(at("electric", 0, 0).noiseGain).toBe(0);
    // big things are low, small fast things high
    expect(SOUNDS.ship.base).toBeLessThan(SOUNDS.diesel.base); expect(SOUNDS.tracks.base).toBeLessThan(SOUNDS.v8.base);
    expect(SOUNDS.sport.base).toBeGreaterThan(SOUNDS.v8.base); expect(SOUNDS.jet.base).toBeGreaterThan(SOUNDS.sport.base * 4);
    // everything gets louder and higher with speed
    for (const f of Object.keys(SOUNDS) as (keyof typeof SOUNDS)[]) {
      expect(at(f, 1).tone, f).toBeGreaterThan(at(f, 0, 0).tone);
      expect(at(f, 1).noiseGain, f).toBeGreaterThanOrEqual(at(f, 0, 0).noiseGain);
    }
  });
});
