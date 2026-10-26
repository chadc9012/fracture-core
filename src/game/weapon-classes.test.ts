import { describe, expect, test } from "bun:test";
import { arsenalFor, FRAMES, frameFor, itemClass } from "./weapon-classes";
import { WEAPON_CATALOG } from "./weapon-catalog";
import { STARTER_GEAR } from "./inventory";
import { WEAPONS, type WeaponId } from "./weapons";
import { rangeFalloff, shotsToKill, timeToKill, WEAPON_META } from "./weapon-meta";

/** a fresh build's damage scale (weapon-meta.test.ts) */
const FRESH = 1.2 * 1.08;
const GRUNT = 5, ELITE = 11;
const ttk = (id: Parameters<typeof timeToKill>[0], hp: number, distance: number, precision = false) => timeToKill(id, hp, { distance, precision, scale: FRESH });
const gear = (slot: string, name: string) => ({ inventory: [{ id: "x", name, slot }], equippedGear: { [slot]: "x" } });

describe("an equipped weapon's class decides how its slot fires", () => {
  test("every catalogue weapon resolves to its own class", () => {
    for (const w of WEAPON_CATALOG) expect(itemClass(w.name), w.name).toBe(w.cls);
  });
  test("manifest and starter names read sensibly; names that say nothing stay the slot's gun", () => {
    expect(itemClass("Enforcer SMG")).toBe("smg");
    expect(itemClass("Makeshift Sub-Carbine")).toBe("smg");
    expect(itemClass("Kinetic DMR · Pattern 07")).toBe("sniper");
    expect(itemClass("Rebar Crossbow")).toBe("sniper");
    expect(itemClass("West Frontline MG")).toBe("lmg");
    expect(itemClass("Singularity-Core Minigun")).toBe("lmg");
    expect(itemClass("Bio-Luminescent Arc-Caster")).toBe("fusion");
    expect(itemClass("Overclocked Phase-Disruptor")).toBe("fusion");
    expect(itemClass("Vanguard MK-IV")).toBeNull();
    expect(itemClass(undefined)).toBeNull();
    expect(frameFor("AUTO", STARTER_GEAR.find((g) => g.slot === "primary")!.name)).toBe("AUTO");
  });
  test("primary-slot classes take the Auto Rifle's place; an LMG takes the Heavy Cannon's; other guns never change", () => {
    expect(frameFor("AUTO", "Viper SMG")).toBe("SMG");
    expect(frameFor("AUTO", "Scout Sniper")).toBe("SNIPER");
    expect(frameFor("AUTO", "Nomad Crossbow")).toBe("SNIPER");
    expect(frameFor("AUTO", "Phase Fusion")).toBe("FUSION");
    expect(frameFor("AUTO", "Arc Disruptor")).toBe("FUSION");
    expect(frameFor("AUTO", "Riot Shotgun")).toBe("SHOTGUN");
    expect(frameFor("AUTO", "Axiom AR")).toBe("AUTO");
    expect(frameFor("AUTO", "Razor Fang")).toBe("AUTO"); // a blade in the primary slot leaves the rifle alone
    expect(frameFor("HEAVY", "Bulwark LMG")).toBe("LMG");
    expect(frameFor("HEAVY", "Breach GL")).toBe("HEAVY");
    for (const id of ["PULSE", "SIDEARM", "SHOTGUN", "SWORD", "ROCKET"] as WeaponId[]) expect(frameFor(id, "Viper SMG")).toBe(id);
  });
  test("the arsenal keeps every slot's id (ammo, binds, model) and swaps in the class's stats and name", () => {
    const a = arsenalFor(gear("primary", "Scout Sniper"));
    expect(a.AUTO.id).toBe("AUTO");
    expect(a.AUTO.frame).toBe("SNIPER");
    expect(a.AUTO.name).toBe("Sniper Rifle");
    expect(a.AUTO.mag).toBe(FRAMES.SNIPER.mag);
    expect(a.AUTO.sound).toBe("HEAVY");
    expect(a.PULSE).toMatchObject({ ...WEAPONS.PULSE, frame: "PULSE" });
    const none = arsenalFor(undefined);
    for (const id of Object.keys(WEAPONS) as WeaponId[]) expect(none[id]).toMatchObject({ ...WEAPONS[id], frame: id });
    // an item only counts in its own slot
    expect(arsenalFor(gear("secondary", "Scout Sniper")).AUTO.frame).toBe("AUTO");
    expect(arsenalFor(gear("heavy", "Bulwark LMG")).HEAVY.frame).toBe("LMG");
  });
  test("every class has range and precision rules", () => {
    for (const f of Object.keys(FRAMES)) expect(WEAPON_META[f as keyof typeof FRAMES], f).toBeDefined();
  });
});

describe("each class has a job (kill time, fresh build)", () => {
  test("SMG: beats the Auto Rifle up close, loses to it at rifle range", () => {
    expect(ttk("SMG", ELITE, 8)).toBeLessThan(ttk("AUTO", ELITE, 8));
    expect(ttk("SMG", ELITE, 35)).toBeGreaterThan(ttk("AUTO", ELITE, 35));
  });
  test("Sniper: one body shot drops a trooper, one headshot an elite, out at 150 m", () => {
    expect(shotsToKill("SNIPER", GRUNT, { distance: 150, precision: false, scale: FRESH })).toBe(1);
    expect(shotsToKill("SNIPER", ELITE, { distance: 150, precision: true, scale: FRESH })).toBe(1);
    expect(shotsToKill("SNIPER", ELITE, { distance: 150, precision: false, scale: FRESH })).toBe(2);
    expect(rangeFalloff("SNIPER", 150)).toBe(1);
    // and it is the worst thing to hip-fire: the widest unaimed spread of any primary
    for (const f of ["AUTO", "SMG", "LMG", "FUSION"] as const) expect(FRAMES.SNIPER.spread).toBeGreaterThan(f === "AUTO" ? WEAPONS.AUTO.spread : FRAMES[f].spread);
  });
  test("Fusion: one volley drops an elite inside its band, not far outside it", () => {
    expect(ttk("FUSION", ELITE, 12)).toBeLessThanOrEqual(FRAMES.FUSION.burstGap * (FRAMES.FUSION.burst - 1) + 1e-9);
    expect(ttk("FUSION", ELITE, 40)).toBeGreaterThanOrEqual(FRAMES.FUSION.fireRate);
  });
  test("LMG: the biggest magazine, outlasts the Auto Rifle on a long fight, slowest reload", () => {
    expect(FRAMES.LMG.mag).toBeGreaterThan(WEAPONS.AUTO.mag * 2);
    expect(FRAMES.LMG.reload).toBeGreaterThan(WEAPONS.AUTO.reload);
    // three elites back to back at mid range: the Auto Rifle has to reload, the LMG does not
    expect(ttk("LMG", ELITE * 3, 30)).toBeLessThan(ttk("AUTO", ELITE * 3, 30));
  });
});
