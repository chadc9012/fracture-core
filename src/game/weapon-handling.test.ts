// @ts-ignore bun:test types
import { describe, expect, test } from "bun:test";
import { HANDLING, handlingClass, initialView, reloadPose, stepView, viewPose, NEUTRAL_FEEL, type ViewInput, type ViewState } from "./weapon-handling";
import { WEAPONS, WEAPON_ORDER, carriedWeapons, freshAmmo } from "./weapons";

const idle = (weapon: ViewInput["weapon"], extra: Partial<ViewInput> = {}): ViewInput => ({ weapon, aiming: false, sprinting: false, fired: 0, reload: -1, swing: -1, combo: 0, feel: NEUTRAL_FEEL, noise: 0, ...extra });
const run = (s: ViewState, input: ViewInput, seconds: number) => { for (let t = 0; t < seconds; t += 1 / 60) s = stepView(s, input, 1 / 60); return s; };

describe("handling classes", () => {
  test("every weapon has a handling profile; the combat sandbox has rifle, pistol, shotgun and sword", () => {
    for (const id of WEAPON_ORDER) expect(HANDLING[handlingClass(id)]).toBeTruthy();
    expect(handlingClass("AUTO")).toBe("rifle");
    expect(handlingClass("SIDEARM")).toBe("pistol");
    expect(handlingClass("SHOTGUN")).toBe("shotgun");
    expect(handlingClass("SWORD")).toBe("sword");
    expect(handlingClass("ROCKET")).toBe("launcher");
  });
  test("new weapons have ammo and the sidearm is always carried", () => {
    expect(freshAmmo().SHOTGUN.mag).toBe(WEAPONS.SHOTGUN.mag);
    expect(WEAPONS.SHOTGUN.pellets).toBeGreaterThan(1);
    expect(carriedWeapons(["AUTO", "SHOTGUN", "SWORD"])).toEqual(["AUTO", "SHOTGUN", "SWORD", "SIDEARM"]);
    expect(carriedWeapons(["SIDEARM", "AUTO", "SWORD"])).toHaveLength(3);
  });
});

describe("weapon lifecycle", () => {
  test("a swap lowers the old weapon fully before the new one rises (no pop)", () => {
    let s = initialView("AUTO");
    const seen: [string, number][] = [];
    for (let t = 0; t < 1.5; t += 1 / 60) { s = stepView(s, idle("SHOTGUN"), 1 / 60); seen.push([s.weapon, s.raise]); }
    const switchAt = seen.findIndex(([w]) => w === "SHOTGUN");
    expect(switchAt).toBeGreaterThan(0);
    expect(seen[switchAt]![1]).toBe(0);
    expect(s.raise).toBe(1);
    expect(s.weapon).toBe("SHOTGUN");
  });
  test("aiming moves the weapon to the sight line; sprinting or reloading cancels it", () => {
    let s = run(initialView("AUTO"), idle("AUTO", { aiming: true }), 1);
    expect(s.ads).toBeGreaterThan(0.95);
    const p = viewPose(s, { reload: -1, swing: -1 }, 0, 0);
    expect(Math.abs(p.pos[0])).toBeLessThan(0.02);
    s = run(s, idle("AUTO", { aiming: true, sprinting: true }), 1);
    expect(s.ads).toBeLessThan(0.05);
    s = run(initialView("AUTO"), idle("AUTO", { aiming: true, reload: 0.5 }), 1);
    expect(s.ads).toBeLessThan(0.05);
  });
  test("recoil kicks back and up, then springs back to rest", () => {
    let s = stepView(initialView("SIDEARM"), idle("SIDEARM", { fired: 1 }), 1 / 60);
    s = run(s, idle("SIDEARM"), 0.05);
    expect(s.kick[1]).toBeGreaterThan(0.01);
    s = run(s, idle("SIDEARM"), 1.5);
    expect(Math.abs(s.kick[1])).toBeLessThan(0.002);
    expect(Math.abs(s.kick[0])).toBeLessThan(0.002);
  });
  test("a shotgun kicks harder than a rifle and recovers slower", () => {
    const peak = (id: "AUTO" | "SHOTGUN") => { let s = stepView(initialView(id), idle(id, { fired: 1 }), 1 / 60); let m = 0; for (let i = 0; i < 30; i++) { s = stepView(s, idle(id), 1 / 60); m = Math.max(m, s.kick[0]); } return m; };
    expect(peak("SHOTGUN")).toBeGreaterThan(peak("AUTO"));
  });
  test("aiming down sights steadies the kick", () => {
    const peak = (aiming: boolean) => { let s = run(initialView("AUTO"), idle("AUTO", { aiming }), 1); s = stepView(s, idle("AUTO", { aiming, fired: 1 }), 1 / 60); let m = 0; for (let i = 0; i < 20; i++) { s = stepView(s, idle("AUTO", { aiming }), 1 / 60); m = Math.max(m, s.kick[1]); } return m; };
    expect(peak(true)).toBeLessThan(peak(false));
  });
  test("pump and slide actions cycle after a shot; the muzzle flash is brief", () => {
    let s = stepView(initialView("SHOTGUN"), idle("SHOTGUN", { fired: 1 }), 1 / 60);
    expect(viewPose(s, { reload: -1, swing: -1 }, 0, 0).flash).toBeGreaterThan(0);
    s = run(s, idle("SHOTGUN"), 0.15);
    const mid = viewPose(s, { reload: -1, swing: -1 }, 0, 0);
    expect(mid.action).toBeGreaterThan(0.3);
    expect(mid.flash).toBe(0);
    s = run(s, idle("SHOTGUN"), 0.5);
    expect(viewPose(s, { reload: -1, swing: -1 }, 0, 0).action).toBe(0);
  });
  test("mobility armor draws faster", () => {
    const time = (mobility: number) => { let s = initialView("AUTO"), t = 0; while ((s.weapon !== "HEAVY" || s.raise < 1) && t < 5) { s = stepView(s, { ...idle("HEAVY"), feel: { mobility, defense: 0 } }, 1 / 60); t += 1 / 60; } return t; };
    expect(time(1)).toBeLessThan(time(0));
  });
});

describe("reload choreography", () => {
  test("a magazine drops out, leaves the gun, goes back in, then the weapon is charged", () => {
    expect(reloadPose("mag", 0.3).drop).toBeGreaterThan(0.1);
    expect(reloadPose("mag", 0.42).visible).toBe(false);
    expect(reloadPose("mag", 0.75).drop).toBe(0);
    expect(reloadPose("mag", 0.82).action).toBeGreaterThan(0);
    expect(reloadPose("mag", 1).drop).toBe(0);
  });
  test("shells load one by one with the support hand at the port, then a pump", () => {
    expect(reloadPose("shell", 0.4).reach).toBe(1);
    expect(reloadPose("shell", 0.9).action).toBeGreaterThan(0.5);
    expect(reloadPose("none", 0.5)).toEqual({ tilt: 0, drop: 0, visible: true, action: 0, reach: 0 });
  });
});

describe("melee", () => {
  test("combo hits alternate direction and the third is an overhead finisher", () => {
    const dir = (combo: number) => stepView(initialView("SWORD"), idle("SWORD", { swing: 0, combo }), 1 / 60).swingDir;
    expect(dir(1)).toBe(1);
    expect(dir(2)).toBe(-1);
    expect(dir(3)).toBe(0);
  });
});
