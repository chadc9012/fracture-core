/** Crucible (PvP) against AI rival operators: the match rules, kept pure so they are testable apart from Scene.
 * There is no online multiplayer yet, so rivals are bot GOLIATH / NYX / CIPHER operators in an enemy colourway. A
 * match is a normal activity (activities.ts, objective kind "crucible"): you score by eliminating rivals (sim.rivalKills),
 * they score when you die (sim.deaths). Rivals respawn at the arena edge after a short delay. When real players can
 * connect, the same scoring applies with people in the rival slots. */
import type { Machine, WorldSim } from "./sim";

export type RivalClass = NonNullable<Machine["rival"]>;
export type CrucibleModeId = "duel" | "skirmish";
export type CrucibleMode = { id: CrucibleModeId; name: string; rivals: number; target: number; brief: string };

export const CRUCIBLE_MODES: Readonly<Record<CrucibleModeId, CrucibleMode>> = {
  duel: { id: "duel", name: "Duel", rivals: 1, target: 5, brief: "One rival operator, first to five eliminations." },
  skirmish: { id: "skirmish", name: "Skirmish", rivals: 3, target: 10, brief: "Free-for-all against three rival operators, first to ten." },
};

/** The arena: the Grid-Iron Highway stretch of the Wastelands (fractions of the Wastelands area radius). */
export const ARENA_POINT: readonly [number, number] = [0.05, -0.1];
export const ARENA_RADIUS = 34;
export const RIVAL_RESPAWN_S = 3.5;
/** the Crucible opens after NOVA's field calibration (the Mission 01 tutorial), like Destiny's after the intro */
export const CRUCIBLE_LOCKED = "Finish NOVA's field calibration in Mission 01 to unlock the Crucible";
export const RIVAL_HP = 9;
export const RIVAL_LABEL: Record<RivalClass, string> = { TITAN: "GOLIATH", HUNTER: "NYX", WARLOCK: "CIPHER" };
/** rivals wear a hostile colourway so they never read as the player's own operator */
export const RIVAL_COLORS: Record<RivalClass, { armor: string; trim: string; cloth: string }> = {
  TITAN: { armor: "#5a1f1a", trim: "#ff4a2a", cloth: "#1b0e0c" },
  HUNTER: { armor: "#2a1030", trim: "#ff3df0", cloth: "#120814" },
  WARLOCK: { armor: "#16242e", trim: "#ffb02e", cloth: "#0b1218" },
};

/** which operator fills rival slot `i`: the duel opponent is never your own class; a skirmish fields all three */
export function rivalLineup(mode: CrucibleModeId, playerClass: RivalClass): RivalClass[] {
  const all: RivalClass[] = ["TITAN", "HUNTER", "WARLOCK"];
  if (mode === "duel") return [all.find((c) => c !== playerClass) ?? "HUNTER"];
  return all.slice(0, CRUCIBLE_MODES[mode].rivals);
}

export type CrucibleState = { mode: CrucibleModeId; respawn: number[] };
export const newCrucible = (mode: CrucibleModeId): CrucibleState => ({ mode, respawn: Array.from({ length: CRUCIBLE_MODES[mode].rivals }, () => 0) });

/** keep the lineup on the field: each missing rival respawns at the arena edge once its timer runs out */
export function stepRivals(sim: WorldSim, st: CrucibleState, center: { x: number; z: number }, playerClass: RivalClass, dt: number, rng = Math.random): void {
  const lineup = rivalLineup(st.mode, playerClass);
  lineup.forEach((cls, slot) => {
    const tag = `crucible:${slot}`;
    if (sim.machines.some((m) => m.alive && m.rival && m.living === tag)) { st.respawn[slot] = RIVAL_RESPAWN_S; return; }
    st.respawn[slot] = (st.respawn[slot] ?? 0) - dt;
    if ((st.respawn[slot] ?? 0) > 0) return;
    const m = sim.machines.find((e) => !e.alive);
    if (!m) return;
    const a = rng() * Math.PI * 2;
    Object.assign(m, {
      alive: true, x: center.x + Math.cos(a) * ARENA_RADIUS * 0.8, z: center.z + Math.sin(a) * ARENA_RADIUS * 0.8, hp: RIVAL_HP, rot: 0, scale: 1, zone: "wastelands",
      cool: 1.2 + rng(), elite: false, profile: `Rival ${RIVAL_LABEL[cls]}`, kind: "VANGUARD" as const, drop: "scrapMetal", boss: false, kx: 0, kz: 0, mission: false,
      vulnUntil: 0, vulnMult: 1, encounter: undefined, decoy: undefined, living: tag, scenarioId: undefined, eq: undefined, swimY: undefined,
      nemesis: undefined, nemesisWeak: undefined, nemesisDamage: undefined, rival: cls,
    });
    delete m.lastPlayerDamage; delete m.ai;
    st.respawn[slot] = RIVAL_RESPAWN_S;
  });
}

/** match over or abandoned: rivals leave the field without awarding anything */
export function clearRivals(sim: WorldSim): number {
  let n = 0;
  for (const m of sim.machines) if (m.alive && m.rival) { m.alive = false; delete m.rival; delete m.living; n++; }
  return n;
}
