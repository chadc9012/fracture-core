import { describe, expect, test } from "bun:test";
import { frameOfItem, killLine, weaponProfile } from "./weapon-card";
import { itemTooltip } from "./character-sheet";
import { STARTER_GEAR, type GearItem } from "./inventory";
import { WEAPON_CATALOG } from "./weapon-catalog";

const item = (slot: GearItem["slot"], name: string, power = 135): GearItem => ({ id: "x", name, slot, power, level: 1, element: "KINETIC", source: "test" });

describe("weapon cards say what the gun does", () => {
  test("the class follows the slot and the name, as combat fires it", () => {
    expect(frameOfItem(item("primary", "Scout Sniper"))).toBe("SNIPER");
    expect(frameOfItem(item("primary", "Viper SMG"))).toBe("SMG");
    expect(frameOfItem(item("primary", "Vanguard MK-IV"))).toBe("AUTO");
    expect(frameOfItem(item("heavy", "Bulwark LMG"))).toBe("LMG");
    expect(frameOfItem(item("secondary", "Scrap-Slugger"))).toBe("PULSE");
    expect(frameOfItem(item("helmet", "Field Helmet"))).toBeNull();
  });
  test("each class's job shows in its numbers", () => {
    const sniper = weaponProfile(item("primary", "Scout Sniper"))!;
    expect(sniper.kills.trooper.body).toBe(1);
    expect(sniper.kills.elite.head).toBe(1);
    expect(sniper.role).toBe("LONG");
    const fusion = weaponProfile(item("primary", "Phase Fusion"))!;
    expect(fusion.unit).toBe("volley");
    expect(fusion.kills.elite.body).toBe(1);
    const shotgun = weaponProfile(item("primary", "Riot Shotgun"))!;
    expect(shotgun.kills.trooper.body).toBe(1); // eight pellets are one shot
    expect(weaponProfile(item("secondary", "Scrap-Slugger"))!.unit).toBe("burst");
    // a stronger copy of the same gun never needs more shots
    const weak = weaponProfile(item("primary", "Viper SMG", 90))!, strong = weaponProfile(item("primary", "Viper SMG", 340))!;
    expect(strong.kills.elite.body).toBeLessThanOrEqual(weak.kills.elite.body);
  });
  test("the kill line reads naturally and only mentions headshots when they help", () => {
    expect(killLine(weaponProfile(item("primary", "Scout Sniper"))!)).toBe("Trooper: 1 shot · Elite: 2 shots (1 to the head)");
    expect(killLine(weaponProfile(item("primary", "Phase Fusion"))!)).toBe("Trooper: 1 volley · Elite: 1 volley");
  });
  test("every weapon a player can own gets a card; the tooltip leads with class and kills", () => {
    for (const w of [...STARTER_GEAR.filter((g) => ["primary", "secondary", "heavy"].includes(g.slot)), ...WEAPON_CATALOG.map((c) => item(c.archetype === "HEAVY" ? "heavy" : c.archetype === "SIDEARM" ? "secondary" : "primary", c.name))]) {
      const p = weaponProfile(w);
      expect(p, w.name).not.toBeNull();
      for (const k of [p!.kills.trooper, p!.kills.elite]) { expect(Number.isFinite(k.body), w.name).toBe(true); expect(k.head).toBeLessThanOrEqual(k.body); }
    }
    const t = itemTooltip(item("primary", "Scout Sniper"));
    expect(t.type).toContain("Sniper Rifle");
    expect(t.perks[0]).toContain("Sniper Rifle");
    expect(t.perks[1]).toContain("Trooper");
    expect(t.stats.map((s) => s.label)).toEqual(["Impact", "Level", "Range", "Headshot"]);
    // armor cards are untouched
    expect(itemTooltip(STARTER_GEAR.find((g) => g.slot === "helmet")!).stats.map((s) => s.label)).toEqual(["Mobility", "Defense", "Intellect"]);
  });
});
