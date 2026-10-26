import { describe, expect, test } from "bun:test";
import { arsenalFor, FRAMES, frameFor, itemClass } from "./weapon-classes";
import { WEAPON_CATALOG } from "./weapon-catalog";
import { STARTER_GEAR } from "./inventory";
import { WEAPONS, type WeaponId } from "./weapons";
import { HEAT_PER_SHOT_FOOT } from "./sim";
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
  test("Fusion: four of a volley's five bolts drop an elite inside its band (one stray bolt doesn't spoil it)", () => {
    expect(shotsToKill("FUSION", ELITE, { distance: 12, precision: false, scale: FRESH })).toBeLessThanOrEqual(4);
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

describe("every gun can be fired as designed (play-test findings)", () => {
  const ALL = [...(Object.keys(WEAPONS) as WeaponId[]).filter((id) => WEAPONS[id].kind !== "sword"), ...(Object.keys(FRAMES) as (keyof typeof FRAMES)[])];
  const def = (id: string) => (id in WEAPONS ? WEAPONS[id as WeaponId] : FRAMES[id as keyof typeof FRAMES]);
  /** sim.ts: heat drains at 34/s while firing normally; a gun that hits 100 vents for seconds */
  const COOL = 34;
  test("from cold, no gun overheats before its magazine runs dry", () => {
    for (const id of ALL) {
      const w = def(id), pellets = w.pellets ?? 1, perRound = HEAT_PER_SHOT_FOOT * w.heat; // the shoot() call is charged once per pellet at heat/pellets
      let heat = 0, t = 0;
      for (let r = 0; r < w.mag; r++) {
        heat = Math.max(0, heat + perRound * (pellets > 1 ? 1 : 1));
        expect(heat, `${id} round ${r + 1}`).toBeLessThan(100);
        const gap = (r + 1) % Math.max(1, w.burst) === 0 ? w.fireRate - (Math.max(1, w.burst) - 1) * w.burstGap : w.burstGap;
        heat = Math.max(0, heat - COOL * gap); t += gap;
      }
    }
  });
  test("a burst's recoil stays on target: the whole volley climbs no more than 0.04 rad (≈0.5 m at 12 m)", () => {
    for (const id of ALL) { const w = def(id); if (w.burst > 1) expect(w.recoil * (w.burst - 1), id).toBeLessThanOrEqual(0.04); }
  });
});
