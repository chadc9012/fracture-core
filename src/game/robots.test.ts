import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { ROBOT_CIVILIANS, ROBOT_ENEMY, robotChassis, robotCivilianSpecs, robotModelUrl, type RobotVariant } from "./robots";
import { bloodOf } from "./gore";
import { ENCOUNTERS } from "./encounters";

const pub = (url: string) => new URL(`../../public${url}`, import.meta.url);

describe("robots", () => {
  test("every robot model exists, and each enemy rank has one", () => {
    for (const v of ["service", "hauler", "courier", "sentry", "enforcer", "warden"] as RobotVariant[]) expect(existsSync(pub(robotModelUrl(v))), v).toBe(true);
    for (const r of ["standard", "elite", "boss"] as const) expect(existsSync(pub(ROBOT_ENEMY[r].url))).toBe(true);
  });
  test("machine troops of the armoured-people factions are robots, and they spark (the body matches the blood)", () => {
    expect(robotChassis({ kind: "OVERCLOCKED", profile: "Data Drone Scout" })).toBe(true);
    expect(robotChassis({ kind: "OVERCLOCKED", profile: "Nexus Sentry Frame" })).toBe(true);
    expect(robotChassis({ kind: "VANGUARD", profile: "Glacial Sentinel" })).toBe(true);
    expect(robotChassis({ kind: "OVERCLOCKED", profile: "Overclocked Operative" })).toBe(false);
    expect(robotChassis({ kind: "GUARDIAN", profile: "Ruin Sentinel" })).toBe(false); // guardians have their own construct bodies
    expect(robotChassis({ kind: "ABERRATION", profile: "Crater Crawler" })).toBe(false);
    expect(robotChassis({ kind: "OVERCLOCKED", profile: "Data Drone Scout", rival: "TITAN" })).toBe(false);
    for (const e of ENCOUNTERS) for (const t of e.troops) { const m = { kind: t.kind, profile: t.name }; if (robotChassis(m)) expect(bloodOf(m)).toBe("MACHINE"); }
  });
  test("Nexus fields a robot squad among its regular troops", () => {
    const nexus = ENCOUNTERS.find((e) => e.regionId === "nexus")!;
    expect(nexus.troops.some((t) => robotChassis({ kind: t.kind, profile: t.name }))).toBe(true);
  });
  test("robot civilians: unique ids, placed around their city, with a body for their job", () => {
    const specs = robotCivilianSpecs({ nexus: { x: 100, z: 200 }, neon: { x: -50, z: 10 } });
    expect(new Set(specs.map((s) => s.id)).size).toBe(specs.length);
    expect(specs.length).toBe(ROBOT_CIVILIANS.length);
    for (const s of specs) { expect(["service", "hauler", "courier"]).toContain(s.robot); expect(s.id.startsWith("rb-")).toBe(true); }
    expect(specs.filter((s) => s.id.startsWith("rb-nx")).every((s) => Math.hypot(s.homeX - 100, s.homeZ - 200) < 80)).toBe(true);
  });
});
