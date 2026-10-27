/**
 * Robots (owner, October 2026: "it's a sci-fi game, where are the robots"). Pure rules and data; the models are jointed
 * machines built by scripts/build-robots.py on an operator's Mixamo rig (every plate skinned to one bone, the rig's clips kept).
 *
 *  - Enemies: a machine whose profile names a machine ("Data Drone Scout", "Nexus Sentry Frame"...) in a faction of armoured
 *    people (Overclocked, Raiders, Vanguard) wears a robot chassis: a Sentry, an Enforcer for elites, a Warden for bosses.
 *    The same profile rule already makes them spark instead of bleed (gore.ts bloodOf), so the body and the blood agree.
 *  - Civilians: service droids, cargo haulers and courier units walk Nexus and Neon City among the people, and flee fights
 *    like them (civilians.ts AI; they wear civilian roles for its wander profile).
 */
import { bloodOf } from "./gore";
import type { CivilianRole, CivilianSpec } from "./civilians";
import type { EnemyKind, EnemyRole, EnemyVisual } from "./enemy-visuals";

export type RobotVariant = "service" | "hauler" | "courier" | "sentry" | "enforcer" | "warden";
export const robotModelUrl = (v: RobotVariant) => `/models/robots/${v}.glb`;

/** the factions whose troops are armoured people: a machine profile among them is a robot. Aberrations, the Skyborn,
 * Guardians and the Abyssal have bodies of their own (a Guardian construct is already a stone machine). */
const ROBOT_FACTIONS: ReadonlySet<EnemyKind> = new Set(["OVERCLOCKED", "RAIDER", "VANGUARD"]);

/** does this enemy wear a robot chassis? (bosses with their own authored models keep them: the renderer only asks for
 * regular and elite troops) */
export function robotChassis(m: { kind: EnemyKind; profile: string; rival?: unknown }): boolean {
  return !m.rival && ROBOT_FACTIONS.has(m.kind) && bloodOf(m) === "MACHINE";
}

export const ROBOT_ENEMY: Record<EnemyRole, EnemyVisual> = {
  standard: { id: "robot-sentry", url: robotModelUrl("sentry"), height: 1.9, motion: "biped", note: "Sentry Frame: gunmetal trooper robot, red optic; build-robots.py" },
  elite: { id: "robot-enforcer", url: robotModelUrl("enforcer"), height: 2.05, motion: "biped", note: "Enforcer Frame: armoured heavy robot with pauldrons" },
  boss: { id: "robot-warden", url: robotModelUrl("warden"), height: 2.3, motion: "biped", note: "Warden Frame: command robot with a reactor core" },
};

/** which robot a civilian robot is, by the job its role stands for */
export const CIVILIAN_ROBOT: Record<CivilianRole, RobotVariant> = {
  VENDOR: "service", MEDIC: "service", OBSERVER: "service",
  ENGINEER: "hauler", ARTISAN: "hauler",
  SCAVENGER: "courier",
};

type RobotCivilian = { id: string; city: "nexus" | "neon"; name: string; role: CivilianRole; title: string; lore: string; dx: number; dz: number };
/** robot civilians, placed off the cities' centres (Civilians.tsx adds them to the roster; spacing keeps them off people) */
export const ROBOT_CIVILIANS: readonly RobotCivilian[] = [
  { id: "rb-nx-serv-1", city: "nexus", name: "Service Droid SD-14", role: "VENDOR", title: "Plaza Service Unit", lore: "Hands out transit passes and directions.", dx: 18, dz: 10 },
  { id: "rb-nx-serv-2", city: "nexus", name: "Medi-Droid M-3", role: "MEDIC", title: "Refugee Camp Aide", lore: "Carries supplies for Dr. Aris.", dx: -8, dz: -18 },
  { id: "rb-nx-haul-1", city: "nexus", name: "Cargo Hauler CH-7", role: "ENGINEER", title: "Shipyard Lifter", lore: "Moves crates nobody else can lift.", dx: 10, dz: 52 },
  { id: "rb-nx-haul-2", city: "nexus", name: "Lift Tech LT-2", role: "ARTISAN", title: "Arcology Maintenance Frame", lore: "Keeps the arcology lifts in alignment.", dx: -52, dz: 10 },
  { id: "rb-nx-cour-1", city: "nexus", name: "Courier Unit CU-9", role: "SCAVENGER", title: "Parcel Runner", lore: "Delivers between the districts, never late.", dx: 46, dz: -14 },
  { id: "rb-nx-serv-3", city: "nexus", name: "Greeter G-1", role: "OBSERVER", title: "Spire Lobby Unit", lore: "Welcomes visitors to the Spire district.", dx: 6, dz: -48 },
  { id: "rb-ne-serv-1", city: "neon", name: "Noodle Bot NB-2", role: "VENDOR", title: "Market Stall Helper", lore: "Ladles broth under the Grid.", dx: 6, dz: 22 },
  { id: "rb-ne-cour-1", city: "neon", name: "Courier Unit CU-31", role: "SCAVENGER", title: "Undercity Runner", lore: "Runs packages through the Undercity.", dx: -20, dz: 12 },
  { id: "rb-ne-haul-1", city: "neon", name: "Grid Hauler GH-5", role: "ENGINEER", title: "Grid Maintenance Frame", lore: "Carries deck panels up the pillars.", dx: 26, dz: 26 },
  { id: "rb-ne-serv-2", city: "neon", name: "Checkpoint Droid CD-8", role: "OBSERVER", title: "Spire Checkpoint Unit", lore: "Scans clearance codes, politely.", dx: -6, dz: -26 },
  { id: "rb-ne-cour-2", city: "neon", name: "Courier Unit CU-44", role: "SCAVENGER", title: "Rooftop Runner", lore: "Takes the fast way over the stalls.", dx: 30, dz: -4 },
];

/** the robot civilians as roster specs at their cities (centres supplied by the caller: region centre for Nexus, NEON_CENTER) */
export function robotCivilianSpecs(centres: Record<RobotCivilian["city"], { x: number; z: number }>): (CivilianSpec & { robot: RobotVariant })[] {
  return ROBOT_CIVILIANS.map((r) => ({ id: r.id, name: r.name, role: r.role, title: r.title, lore: r.lore, homeX: centres[r.city].x + r.dx, homeZ: centres[r.city].z + r.dz, robot: CIVILIAN_ROBOT[r.role] }));
}
