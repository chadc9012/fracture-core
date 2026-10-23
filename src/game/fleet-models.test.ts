import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { BASE_MODEL, BUILD_MODEL, FLEET_MODELS, paintColor, vehicleModelFor } from "./fleet-models";
import { VEHICLES } from "./vehicles";
import { FLEET } from "./fleet";

const pub = join(process.cwd(), "public");

describe("authored fleet models", () => {
  test("every model file exists and is a real glTF binary with the named rig nodes", () => {
    for (const m of Object.values(FLEET_MODELS)) {
      const file = join(pub, m.url);
      expect(existsSync(file)).toBe(true);
      const buf = readFileSync(file);
      expect(buf.subarray(0, 4).toString()).toBe("glTF");
      const json = buf.subarray(20, 20 + buf.readUInt32LE(12)).toString();
      expect(json).toContain('"Body"');
      if (m.kind === "car" && m.id !== "hover-car") { expect(json).toContain('"SteerFL"'); expect(json).toContain('"WheelRR"'); expect(json).toContain('"Taillight"'); }
      if (m.id === "rift-helicopter") expect(json).toContain('"Rotor"');
    }
  });
  test("every vehicle and every fleet build resolves to a model", () => {
    for (const v of VEHICLES) expect(BASE_MODEL[v.id]).toBeTruthy();
    for (const f of FLEET) expect(vehicleModelFor(f.base, f.id)).toBeTruthy();
    for (const id of Object.keys(BUILD_MODEL)) expect(FLEET.some((f) => f.id === id)).toBe(true);
  });
  test("builds show their own body; unknown builds fall back to the chassis", () => {
    expect(vehicleModelFor("scrap-interceptor", "neon-drift").id).toBe("street-racer");
    expect(vehicleModelFor("scrap-interceptor", null).id).toBe("armored-muscle");
    expect(vehicleModelFor("rift-helicopter", "skyhawk").id).toBe("rift-helicopter");
  });
  test("garage paint names map to colours; unknown names keep the model's paint", () => {
    for (const f of FLEET) for (const p of f.paints) expect(paintColor(p) ?? "keep").toBeTruthy();
    expect(paintColor("Stealth Black")).toBe("#121318");
    expect(paintColor("Magenta Glow")).toBe("#c0208f");
    expect(paintColor("Xyzzy")).toBeNull();
    expect(paintColor(undefined)).toBeNull();
  });
});
