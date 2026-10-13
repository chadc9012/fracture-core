import { expect, test } from "bun:test";
import { VEHICLES } from "./vehicles";
import { ENGINE_VOICES, engineVoice, driveTelemetry } from "./vehicle-audio";
test("all fourteen vehicles have distinct ignition and engine profiles", () => {
  expect(VEHICLES.length).toBe(14);
  expect(new Set(VEHICLES.map((v) => JSON.stringify(ENGINE_VOICES[v.id]))).size).toBe(14);
});
test("actual performance upgrades alter engine pitch and startup", () => {
  const stock = engineVoice("scrap-interceptor"), tuned = engineVoice("scrap-interceptor", 1.3);
  expect(tuned.base).toBeGreaterThan(stock.base); expect(tuned.ignition).toBeLessThan(stock.ignition);
});
test("RPM follows throttle and speed", () => { expect(driveTelemetry("goliath-tank", 1, 1).rpm).toBeGreaterThan(driveTelemetry("goliath-tank", 0, 0).rpm); });