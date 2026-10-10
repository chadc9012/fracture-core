/** Runs the authored Unique Scenario encounters (scenario-encounters.ts) against the real WorldSim. Everything with a gameplay
 * consequence happens here - hits go through hurtPlayer (so Rift Dash i-frames, Bastion Shield and armor resistance apply),
 * zones damage/slow by actual position, decoys are real machines flagged `decoy`, and the hp floor is enforced inside the shared
 * damage path - while presentation only reads `sim.encounterEvents`, `sim.encounterZones` and `machine.encounter`. */
import { INITIAL_POISE, isStaggered, openWeakPoint } from "./boss-poise";
import { ENCOUNTERS, encounterFor, inCircle, inFan, inLane, phaseIndexFor, pickAttack, type AttackDef, type EncounterDef, type PhaseDef, type ZoneKind, type ZoneSpec } from "./scenario-encounters";
import { walkHeight as walkHeightFor } from "./terrain";
import { alert, hurtPlayer, type Machine, type WorldSim } from "./sim";

export type EncounterState = {
  phase: number; state: "IDLE" | "TELL" | "RECOVER"; timer: number; atk?: string; cursor: number;
  /** snapshot of the player's position when the current tell began (what lunges/pounces/fans aim at) */
  tx: number; tz: number; /** arena centre: where the boss was summoned */ cx: number; cz: number;
  /** attacks since the last finale; the finale attack replaces the next rotation slot once a full cycle is done */
  sinceFinale: number; finaleUntil: number; tellTotal: number;
};
export type EncounterZone = {
  id: number; scenarioId: string; name: string; kind: ZoneKind; x: number; z: number; radius: number; dps: number; slow: number;
  armAt: number; until: number; orbit?: { cx: number; cz: number; r: number; ang: number; speed: number }; /** "phase" zones live until the phase ends */ scope: "attack" | "phase";
};
export type EncounterEventKind = "TELL" | "IMPACT" | "INTERRUPT" | "PHASE" | "ZONE" | "FINALE" | "DECOY" | "DECOY_SHATTER" | "RESET" | "VICTORY";
export type EncounterEvent = {
  id: number; kind: EncounterEventKind; scenarioId: string; phase: number; phaseName: string; attack?: string; text: string;
  x: number; z: number; radius: number; duration: number; /** IMPACT: did it actually hit the player */ hit?: boolean; at: number;
};
export const MAX_ENCOUNTER_EVENTS = 40;
/** the encounter only runs while the player is this close to the boss (otherwise it waits, it never attacks from across the map) */
export const ENGAGE_RANGE = 90;
const DECOY_COOL = 99;

const nowS = () => performance.now() / 1000;

function emit(sim: WorldSim, m: Machine | null, e: Omit<EncounterEvent, "id" | "at" | "scenarioId" | "phase" | "phaseName"> & { scenarioId?: string; phase?: number }) {
  const def = encounterFor(m?.scenarioId ?? e.scenarioId);
  const phase = m?.encounter?.phase ?? e.phase ?? 0;
  const event: EncounterEvent = { ...e, id: sim.nextEncounterEventId++, at: nowS(), scenarioId: m?.scenarioId ?? e.scenarioId ?? "", phase, phaseName: def?.phases[phase]?.name ?? "" };
  sim.encounterEvents.push(event);
  if (sim.encounterEvents.length > MAX_ENCOUNTER_EVENTS) sim.encounterEvents.splice(0, sim.encounterEvents.length - MAX_ENCOUNTER_EVENTS);
  return event;
}

const fresh = (m: Machine): EncounterState => ({ phase: 0, state: "IDLE", timer: 2.5, cursor: 0, tx: m.x, tz: m.z, cx: m.x, cz: m.z, sinceFinale: 0, finaleUntil: 0, tellTotal: 0 });

function addZone(sim: WorldSim, scenarioId: string, spec: ZoneSpec, x: number, z: number, scope: EncounterZone["scope"], now: number, orbit?: EncounterZone["orbit"]) {
  const zone: EncounterZone = { id: sim.nextEncounterZoneId++, scenarioId, name: spec.name, kind: spec.kind, x, z, radius: spec.radius, dps: spec.dps, slow: spec.slow ?? 1, armAt: now + spec.arm, until: now + spec.life, scope, ...(orbit ? { orbit } : {}) };
  sim.encounterZones.push(zone);
  return zone;
}

/** Spawns a FIELD attack's zones. PLAYER: the first lands on the player's snapshot position, the rest ring it; RING: evenly around the arena; ORBIT: circling the boss. */
function spawnZones(sim: WorldSim, m: Machine, enc: EncounterState, spec: ZoneSpec, scope: EncounterZone["scope"], now: number, px: number, pz: number) {
  const id = m.scenarioId!;
  for (let i = 0; i < spec.count; i++) {
    const a = (i / spec.count) * Math.PI * 2 + enc.cursor * 0.7;
    if (spec.place === "PLAYER") {
      const x = i === 0 ? px : px + Math.sin(a) * (spec.ringRadius ?? 10), z = i === 0 ? pz : pz + Math.cos(a) * (spec.ringRadius ?? 10);
      addZone(sim, id, spec, x, z, scope, now);
    } else if (spec.place === "RING") {
      const a2 = (i / spec.count) * Math.PI * 2 + Math.PI / 4;
      addZone(sim, id, spec, enc.cx + Math.sin(a2) * (spec.ringRadius ?? 20), enc.cz + Math.cos(a2) * (spec.ringRadius ?? 20), scope, now);
    } else {
      const r = spec.ringRadius ?? 12;
      addZone(sim, id, spec, m.x + Math.sin(a) * r, m.z + Math.cos(a) * r, scope, now, { cx: m.x, cz: m.z, r, ang: a, speed: spec.orbitSpeed ?? 0.5 });
    }
  }
  emit(sim, m, { kind: "ZONE", text: spec.name, x: spec.place === "PLAYER" ? px : m.x, z: spec.place === "PLAYER" ? pz : m.z, radius: spec.radius, duration: spec.arm });
}

function enterPhase(sim: WorldSim, m: Machine, def: EncounterDef, enc: EncounterState, index: number, now: number, px: number, pz: number) {
  enc.phase = index; enc.state = "IDLE"; enc.timer = 2.5; enc.cursor = 0; enc.atk = undefined as unknown as string; enc.sinceFinale = 0; enc.finaleUntil = 0;
  sim.encounterZones = sim.encounterZones.filter((z) => z.scenarioId !== m.scenarioId || z.scope !== "phase");
  const phase = def.phases[index]!;
  if (phase.arena) spawnZones(sim, m, enc, phase.arena, "phase", now, px, pz);
  alert(sim, `${phase.name.toUpperCase()} · ${phase.nova}`);
  emit(sim, m, { kind: "PHASE", text: phase.nova, x: m.x, z: m.z, radius: 0, duration: 0 });
}

function dealDamage(sim: WorldSim, atk: AttackDef, hit: boolean) {
  if (hit && atk.damage > 0) hurtPlayer(sim, atk.damage, atk.label);
}

/** Resolve an attack at the end of its tell. Returns whether the player was actually hit. */
function impact(sim: WorldSim, m: Machine, enc: EncounterState, atk: AttackDef, phase: PhaseDef, now: number, px: number, pz: number): boolean {
  let hit = false;
  let x = m.x, z = m.z, radius = atk.radius ?? 0;
  switch (atk.kind) {
    case "SLAM": hit = inCircle(px, pz, m.x, m.z, atk.radius ?? 8); break;
    case "POUNCE": {
      m.x = enc.tx; m.z = enc.tz; m.y = walkHeightFor(m.x, m.z); x = m.x; z = m.z;
      hit = inCircle(px, pz, m.x, m.z, atk.radius ?? 6); break;
    }
    case "LUNGE": {
      const ax = m.x, az = m.z, d = Math.hypot(enc.tx - ax, enc.tz - az) || 1;
      const reach = Math.min(d + 4, 34); // overshoots the snapshot a little, never across the map
      const bx = ax + ((enc.tx - ax) / d) * reach, bz = az + ((enc.tz - az) / d) * reach;
      hit = inLane(px, pz, ax, az, bx, bz, (atk.width ?? 3) / 2 + 1);
      m.x = bx; m.z = bz; m.y = walkHeightFor(m.x, m.z); radius = (atk.width ?? 3) / 2;
      break;
    }
    case "FAN": hit = inFan(px, pz, m.x, m.z, enc.tx, enc.tz, atk.arc ?? 0.3, atk.reach ?? 40); radius = atk.reach ?? 40; break;
    case "FIELD": if (atk.zones) spawnZones(sim, m, enc, atk.zones, "attack", now, px, pz); break;
    case "CLONES": spawnDecoys(sim, m, enc, atk.decoys ?? 3); break;
  }
  dealDamage(sim, atk, hit);
  if (atk.kind !== "FIELD" && atk.kind !== "CLONES") emit(sim, m, { kind: "IMPACT", attack: atk.id, text: atk.label, x, z, radius, duration: 0, hit });
  void phase;
  return hit;
}

function spawnDecoys(sim: WorldSim, boss: Machine, enc: EncounterState, count: number) {
  const live = sim.machines.filter((x) => x.alive && x.decoy).length;
  for (let i = 0; i < count && live + i < 4; i++) {
    const slot = sim.machines.find((x) => !x.alive);
    if (!slot) break;
    const a = (i / count) * Math.PI * 2 + enc.cursor;
    // 16 m out: beyond the machine-separation distance (2.8 * scale each), so copies are never shoved around and stay readable
    const x = boss.x + Math.sin(a) * 16, z = boss.z + Math.cos(a) * 16;
    Object.assign(slot, { alive: true, x, z, y: walkHeightFor(x, z), hp: 2, maxHp: 2, rot: 0, scale: boss.scale, zone: boss.zone, cool: DECOY_COOL, elite: true, boss: false, mission: false, profile: "False Saint", kind: "ABERRATION", drop: "dataShards", kx: 0, kz: 0, vulnUntil: 0, vulnMult: 1, aim: 0, decoy: true, scenarioId: undefined, scenarioRun: undefined, playerHits: undefined, gimmickHistory: undefined, attuned: undefined, poiseState: undefined, phase: undefined, encounter: undefined, eq: undefined });
    emit(sim, boss, { kind: "DECOY", text: "False Saint", x, z, radius: 0, duration: 0 });
  }
}

/** A False Saint was destroyed. No kill, credit, loot or progress; when the last one falls the real Saint is exposed. */
export function onDecoyShattered(sim: WorldSim, decoy: Machine) {
  alert(sim, "False Saint shattered — it was never the real one");
  emit(sim, null, { kind: "DECOY_SHATTER", scenarioId: "hollow-saint", text: "False Saint shattered", x: decoy.x, z: decoy.z, radius: 0, duration: 0 });
  if (sim.machines.some((x) => x.alive && x.decoy && x !== decoy)) return;
  const boss = sim.machines.find((x) => x.alive && x.boss && x.scenarioId === "hollow-saint");
  if (boss) {
    boss.poiseState = openWeakPoint(boss.poiseState ?? INITIAL_POISE, nowS());
    alert(sim, "All copies shattered — the real Saint is exposed!");
  }
}

function pickNext(def: EncounterDef, phase: PhaseDef, enc: EncounterState, d: number): AttackDef | null {
  if (phase.finale && enc.sinceFinale >= phase.attacks.length) return def.attacks[phase.finale.attack] ?? null;
  const picked = pickAttack(def, phase, enc.cursor, d);
  if (!picked) return null;
  enc.cursor = picked.cursor;
  return picked.attack;
}

/** One boss, one step. */
function stepBoss(sim: WorldSim, m: Machine, dt: number, px: number, pz: number, now: number) {
  const def = encounterFor(m.scenarioId);
  if (!def) return;
  const enc = (m.encounter ??= fresh(m));
  const maxHp = m.maxHp ?? 34;
  const target = phaseIndexFor(def, m.hp / maxHp);
  if (target > enc.phase) enterPhase(sim, m, def, enc, target, now, px, pz);
  const phase = def.phases[enc.phase]!;
  const d = Math.hypot(px - m.x, pz - m.z);
  if (d > ENGAGE_RANGE) return;

  if (enc.state === "TELL") {
    const poise = m.poiseState ?? INITIAL_POISE;
    if (isStaggered(poise, now)) { // a stagger (e.g. Null Disruption breaking poise) interrupts the wind-up
      emit(sim, m, { kind: "INTERRUPT", ...(enc.atk ? { attack: enc.atk } : {}), text: "Attack interrupted", x: m.x, z: m.z, radius: 0, duration: 0 });
      enc.state = "RECOVER"; enc.timer = 0.8; enc.atk = undefined as unknown as string;
      return;
    }
    enc.timer -= dt;
    if (enc.timer > 0) return;
    const atk = def.attacks[enc.atk!]!;
    impact(sim, m, enc, atk, phase, now, px, pz);
    if (m.encounter !== enc || !m.alive) return; // the hit killed the player and reset the fight
    enc.sinceFinale++;
    const isFinale = !!phase.finale && atk.id === phase.finale.attack;
    if (isFinale) {
      enc.sinceFinale = 0;
      enc.finaleUntil = now + phase.finale!.window;
      m.poiseState = { poise: 0, staggerUntil: enc.finaleUntil, weakPointUntil: enc.finaleUntil };
      alert(sim, phase.finale!.nova);
      emit(sim, m, { kind: "FINALE", text: phase.finale!.nova, x: m.x, z: m.z, radius: 0, duration: phase.finale!.window });
    } else if (atk.window > 0) {
      m.poiseState = openWeakPoint(m.poiseState ?? INITIAL_POISE, now);
      // openWeakPoint uses the standard window; trim it to this attack's authored opening
      m.poiseState = { ...m.poiseState, weakPointUntil: Math.min(m.poiseState.weakPointUntil, now + atk.window) };
    }
    enc.state = "RECOVER"; enc.timer = atk.recovery; enc.atk = undefined as unknown as string;
    return;
  }
  if (enc.state === "RECOVER") {
    enc.timer -= dt;
    if (enc.timer <= 0) { enc.state = "IDLE"; enc.timer = phase.gap; }
    return;
  }
  // IDLE: a stunned boss does not start new attacks (Null Disruption / Disruption Pulse buy real time, but bosses are never hard-locked: stuns are capped in sim.stunMachine)
  if (m.cool > 0) return;
  enc.timer -= dt;
  if (enc.timer > 0) return;
  const atk = pickNext(def, phase, enc, d);
  if (!atk) { enc.timer = 0.5; return; }
  enc.state = "TELL"; enc.atk = atk.id; enc.timer = atk.tellTime; enc.tellTotal = atk.tellTime; enc.tx = px; enc.tz = pz;
  alert(sim, atk.tell);
  const aimX = atk.kind === "SLAM" ? m.x : enc.tx, aimZ = atk.kind === "SLAM" ? m.z : enc.tz;
  emit(sim, m, { kind: "TELL", attack: atk.id, text: atk.tell, x: aimX, z: aimZ, radius: atk.radius ?? atk.width ?? atk.reach ?? 0, duration: atk.tellTime });
}

function stepZones(sim: WorldSim, dt: number, px: number, pz: number, now: number) {
  sim.hazardSpeedMult = 1;
  if (!sim.encounterZones.length) return;
  sim.encounterZones = sim.encounterZones.filter((z) => z.until > now);
  for (const z of [...sim.encounterZones]) {
    if (z.orbit) { z.orbit.ang += z.orbit.speed * dt; z.x = z.orbit.cx + Math.sin(z.orbit.ang) * z.orbit.r; z.z = z.orbit.cz + Math.cos(z.orbit.ang) * z.orbit.r; }
    if (now < z.armAt || !inCircle(px, pz, z.x, z.z, z.radius)) continue;
    if (z.kind === "SLOW") sim.hazardSpeedMult = Math.min(sim.hazardSpeedMult, z.slow);
    if (z.dps > 0) hurtPlayer(sim, z.dps * dt, z.name);
  }
}

/** Called once per stepSim. */
export function stepEncounters(sim: WorldSim, dt: number, px: number, pz: number) {
  const now = nowS();
  const bosses = sim.machines.filter((m) => m.alive && m.boss && m.scenarioId && ENCOUNTERS[m.scenarioId]);
  for (const m of bosses) stepBoss(sim, m, dt, px, pz, now);
  if (!bosses.length) {
    // no live encounter boss: nothing may keep damaging, slowing or masquerading as the boss
    if (sim.encounterZones.length) sim.encounterZones = [];
    for (const x of sim.machines) if (x.alive && x.decoy) { x.alive = false; delete x.decoy; }
  } else {
    for (const x of sim.machines) if (x.alive && x.decoy) x.cool = Math.max(x.cool, DECOY_COOL); // decoys never fight
  }
  stepZones(sim, dt, px, pz, now);
}

/** hp the boss cannot be brought under until its finale window opens (Last Oath / Drowning / Last Benediction). */
export function encounterHpFloor(m: Machine, now: number): number {
  const def = encounterFor(m.scenarioId);
  const enc = m.encounter;
  if (!def || !enc) return 0;
  const finale = def.phases[enc.phase]?.finale;
  if (!finale) return 0;
  return now < enc.finaleUntil ? 0 : finale.floorHp;
}

/** The player died (or the fight otherwise failed): every encounter boss returns to full health and phase 0. */
export function resetEncounters(sim: WorldSim) {
  for (const m of sim.machines) {
    if (m.alive && m.decoy) { m.alive = false; delete m.decoy; continue; }
    if (!m.alive || !m.boss || !m.scenarioId || !ENCOUNTERS[m.scenarioId]) continue;
    const old = m.encounter;
    m.hp = m.maxHp ?? 34; m.poiseState = INITIAL_POISE; m.cool = Math.max(m.cool, 2); m.aim = 0;
    if (old) { m.x = old.cx; m.z = old.cz; m.y = walkHeightFor(m.x, m.z) + 2.2 * m.scale; } // back to the arena centre
    m.encounter = fresh(m);
    emit(sim, m, { kind: "RESET", text: "The encounter resets", x: m.x, z: m.z, radius: 0, duration: 0 });
    alert(sim, `${m.profile} regains its strength — the encounter resets`);
  }
  sim.encounterZones = [];
  sim.hazardSpeedMult = 1;
}

/** The boss died: clear its arena. Called from defeatMachine. */
export function endEncounter(sim: WorldSim, m: Machine) {
  if (!m.scenarioId || !ENCOUNTERS[m.scenarioId]) return;
  sim.encounterZones = sim.encounterZones.filter((z) => z.scenarioId !== m.scenarioId);
  for (const x of sim.machines) if (x.alive && x.decoy) { x.alive = false; delete x.decoy; }
  sim.hazardSpeedMult = 1;
  emit(sim, m, { kind: "VICTORY", text: ENCOUNTERS[m.scenarioId]!.victory, x: m.x, z: m.z, radius: 0, duration: 0 });
}
