/** Runtime for the bonded Operator's Dragonite abilities (rules and numbers live in dragonite.ts). Pure over a WorldSim:
 * Scene forwards key edges and the pose; cost, cooldown, damage, burn, resistance and the Wyrm's attacks happen here. */
import { DRAGONITE, MAX_UPGRADE, armorBonus, createWyrm, dragoniteStats, hasAbility, stepWyrm, summonWyrm, upgradeLevel, wornCovenant, type DragoniteId, type DragoniteStats, type Wyrm } from "./dragonite";
import type { ClassId, GearItem } from "./progression";
import { knockbackFrom } from "./operator-abilities";
import { alert, applyMachineDamageMods, applyVulnPulse, defeatMachine, stunMachine, type WorldSim } from "./sim";

export type DragoniteRuntime = { cd: Record<DragoniteId, number>; pending: { x: number; z: number; left: number; st: DragoniteStats; fury: number } | null; hide: number; hideStats: DragoniteStats | null; glide: number; airDashes: number; wyrm: Wyrm; landingStrike: number };
export const createDragoniteRuntime = (): DragoniteRuntime => ({ cd: { dragonfire: 0, wyrmwing: 0, dragonhide: 0, wyrmcall: 0, roar: 0, scalebreaker: 0, skyfall: 0 }, pending: null, hide: 0, hideStats: null, glide: 0, airDashes: 0, wyrm: createWyrm(), landingStrike: 0 });

export type DragoniteCtx = { earnedRewards: readonly string[]; inventory: readonly GearItem[]; equippedGear: Partial<Record<string, string>>; cls: ClassId | null; /** Vyrak's fury bonus (vyrak-personality.ts), a small damage multiplier */ fury?: number };
export type CastOutcome = { ok: boolean; text: string; launchVy?: number; glideSeconds?: number; airDashes?: number };

const levelOf = (c: DragoniteCtx, id: DragoniteId) => Math.min(MAX_UPGRADE, upgradeLevel({ earnedRewards: [...c.earnedRewards] }, c.cls!, id));
export const statsFor = (c: DragoniteCtx, id: DragoniteId): DragoniteStats => {
  const armor = armorBonus(wornCovenant(c.inventory, c.equippedGear));
  return dragoniteStats(id, levelOf(c, id), armor);
};

/** damage to everything in range inside a cone (deg is the full angle); returns the number hit */
function cone(sim: WorldSim, x: number, z: number, yaw: number, range: number, deg: number, dmg: (corrupted: boolean) => number, burn: boolean): number {
  let hits = 0;
  const half = (deg * Math.PI) / 360;
  for (const m of sim.machines) {
    if (!m.alive) continue;
    const dx = m.x - x, dz = m.z - z, d = Math.hypot(dx, dz);
    if (d > range) continue;
    let da = Math.atan2(dx, dz) - yaw; da = Math.atan2(Math.sin(da), Math.cos(da));
    if (d > 1 && Math.abs(da) > half) continue;
    m.hp -= applyMachineDamageMods(sim, m, dmg(!!m.boss), "THERMAL", x, z);
    stunMachine(m, 0.4);
    if (m.hp <= 0) defeatMachine(sim, m);
    hits++;
  }
  return hits;
}

export function castDragonite(rt: DragoniteRuntime, sim: WorldSim, energy: { value: number }, id: DragoniteId, pose: { x: number; z: number; yaw: number }, grounded: boolean, ctx: DragoniteCtx): CastOutcome {
  const def = DRAGONITE[id];
  if (!ctx.cls || !hasAbility({ earnedRewards: [...ctx.earnedRewards] }, ctx.cls)) return { ok: false, text: "Bond with Vyrak to use Dragonite" };
  if (id === "skyfall" && !ctx.earnedRewards.includes(`vyrak-riding:${ctx.cls}`)) return { ok: false, text: "Skyfall needs the Ancient Bond" };
  if (id === "wyrmwing" && !grounded && rt.airDashes > 0) { rt.airDashes--; return { ok: true, text: "WYRMWING · air dash" }; }
  if (rt.cd[id] > 0) return { ok: false, text: `${def.name} · ${Math.ceil(rt.cd[id])}s` };
  const st = statsFor(ctx, id);
  if (energy.value < st.energy) return { ok: false, text: `${def.name} · not enough energy` };
  const level = levelOf(ctx, id);
  const fury = 1 + Math.max(0, Math.min(0.15, ctx.fury ?? 0));
  energy.value -= st.energy; rt.cd[id] = st.cooldown;
  switch (id) {
    case "dragonfire": {
      const n = cone(sim, pose.x, pose.z, pose.yaw, st["range"]!, st["coneDeg"]!, (boss) => st["damage"]! * fury * (boss ? 1 : st["corruptedMult"]!), true);
      if (level >= 4) cone(sim, pose.x + Math.sin(pose.yaw) * st["range"]!, pose.z + Math.cos(pose.yaw) * st["range"]!, pose.yaw, 4, 360, () => st["damage"]! * 0.8, false);
      sim.playerNoise = 1; alert(sim, n ? `DRAGONFIRE · ${n} burned` : "DRAGONFIRE");
      return { ok: true, text: "DRAGONFIRE" };
    }
    case "wyrmwing": {
      rt.glide = st["glideSeconds"]!; rt.airDashes = Math.max(0, st["airDashes"]! - 1) + 0; rt.landingStrike = st["landingStrike"]!;
      alert(sim, "WYRMWING");
      return { ok: true, text: "WYRMWING", launchVy: st["launch"]!, glideSeconds: rt.glide, airDashes: st["airDashes"]! };
    }
    case "dragonhide": {
      rt.hide = st["duration"]!; rt.hideStats = st; alert(sim, "DRAGONHIDE · scales raised");
      return { ok: true, text: "DRAGONHIDE" };
    }
    case "roar": {
      let n = 0;
      for (const m of sim.machines) {
        if (!m.alive || Math.hypot(m.x - pose.x, m.z - pose.z) > st["radius"]!) continue;
        stunMachine(m, st["stagger"]!); if (!m.boss) m.aim = 0; n++;
        if (st["knockback"] && !m.boss) { const k = knockbackFrom(pose.x, pose.z, m.x, m.z, st["knockback"]); m.x = k.x; m.z = k.z; }
      }
      if (st["vulnMult"]! > 1) applyVulnPulse(sim, pose.x, pose.z, st["radius"]!, st["vulnMult"]!, st["vulnSeconds"]!);
      sim.playerNoise = 1; alert(sim, n ? `ROAR OF RUIN · ${n} staggered` : "ROAR OF RUIN");
      return { ok: true, text: "ROAR" };
    }
    case "scalebreaker": {
      let n = 0;
      for (let k = 0; k < st["strikes"]!; k++) n += cone(sim, pose.x, pose.z, pose.yaw, st["range"]!, st["arcDeg"]!, () => st["damage"]! * fury, false);
      if (st["shieldBreak"]) for (const m of sim.machines) if (m.alive && !m.boss && Math.hypot(m.x - pose.x, m.z - pose.z) <= st["range"]!) m.vulnUntil = Math.max(m.vulnUntil, performance.now() / 1000 + 5), m.vulnMult = Math.max(m.vulnMult, 1.2);
      alert(sim, n ? `SCALEBREAKER · ${n} struck` : "SCALEBREAKER");
      return { ok: true, text: "SCALEBREAKER" };
    }
    case "skyfall": {
      if (rt.pending) { energy.value += st.energy; rt.cd[id] = 0; return { ok: false, text: "Vyrak is already diving" }; }
      rt.pending = { x: pose.x + Math.sin(pose.yaw) * 14, z: pose.z + Math.cos(pose.yaw) * 14, left: st["windup"]!, st, fury };
      alert(sim, "SKYFALL · Vyrak climbs");
      return { ok: true, text: "SKYFALL" };
    }
    case "wyrmcall": {
      const ok = summonWyrm(rt.wyrm, st);
      if (!ok) { energy.value += st.energy; rt.cd[id] = 0; return { ok: false, text: "Vyrak is already answering" }; }
      alert(sim, "WYRMCALL · Vyrak answers"); return { ok: true, text: "WYRMCALL" };
    }
  }
}

/** per-frame: tick cooldowns/timers, step the Wyrm and apply its attacks. Returns the current Dragonhide resistance. */
export function stepDragonite(rt: DragoniteRuntime, sim: WorldSim, dt: number, pose: { x: number; z: number }, ctx: DragoniteCtx): { resist: number; stagger: number; gliding: boolean } {
  for (const k of Object.keys(rt.cd) as DragoniteId[]) rt.cd[k] = Math.max(0, rt.cd[k] - dt);
  rt.glide = Math.max(0, rt.glide - dt);
  rt.hide = Math.max(0, rt.hide - dt);
  if (rt.hide <= 0) rt.hideStats = null;
  if (rt.pending) {
    rt.pending.left -= dt;
    if (rt.pending.left <= 0) {
      const p = rt.pending; rt.pending = null;
      const furious = 1 + Math.max(0, ctx.fury ?? 0) * (p.st["furyMult"]! > 1 ? 2.5 : 1);
      const n = cone(sim, p.x, p.z, 0, p.st["radius"]!, 360, () => p.st["damage"]! * p.fury * furious, false);
      sim.playerNoise = 1; alert(sim, n ? `SKYFALL · ${n} crushed` : "SKYFALL");
    }
  }
  if (ctx.cls && rt.wyrm.state !== "BONDED") {
    const st = statsFor(ctx, "wyrmcall");
    const targets = sim.machines.filter((m) => m.alive && Math.hypot(m.x - pose.x, m.z - pose.z) < 40).map((m) => ({ id: m.id, dist: Math.hypot(m.x - pose.x, m.z - pose.z), boss: !!m.boss, windingUp: m.aim > 0 }));
    const action = stepWyrm(rt.wyrm, dt, targets, st);
    if (action) {
      const m = sim.machines.find((x) => x.id === action.target && x.alive);
      if (m) {
        const base = st["damage"]!;
        const dmg = action.kind === "finisher" ? base * 3 : action.kind === "breath" ? base * 1.5 : base;
        if (action.kind === "interrupt") { m.aim = 0; stunMachine(m, 1.5); }
        else { m.hp -= applyMachineDamageMods(sim, m, dmg, "THERMAL", pose.x, pose.z); if (m.hp <= 0) defeatMachine(sim, m); }
      }
    }
    if (rt.wyrm.finished) { rt.wyrm.finished = false; alert(sim, "Vyrak withdraws"); }
  }
  return { resist: rt.hideStats ? rt.hideStats["resist"]! : 0, stagger: rt.hideStats ? rt.hideStats["stagger"]! : 0, gliding: rt.glide > 0 };
}
