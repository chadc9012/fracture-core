import type { ClassId } from "./loadout";

export type ClassMission = { id: string; classId: ClassId; name: string; subtitle: string; location: string; mechanic: string; objectives: readonly string[]; reward: string };

export const CLASS_MISSIONS: readonly ClassMission[] = [
  { id: "burial-gates", classId: "TITAN", name: "Burial Gates", subtitle: "Mission 01 · Defensive prototype", location: "Sunken Arcology entrance", mechanic: "Read attacks, time Bastion Shield, then break the siege line.", objectives: ["Hold the western gate", "Perfect-block the Architect strike", "Kinetic Slam the exposed Brute", "Project a dome over the relay"], reward: "Bulwark Calibration" },
  { id: "velocity-protocol", classId: "HUNTER", name: "Velocity Protocol", subtitle: "Mission 01B · Momentum trial", location: "Archive transit spine", mechanic: "Chain phase gates without losing momentum, then mark the moving target.", objectives: ["Cross three collapsing lanes", "Phase through a suppression sweep", "Reveal the route commander with Recon Swarm", "Trigger Shadow Strike at full momentum"], reward: "Velocity Catalyst" },
  { id: "synthesis-fracture", classId: "WARLOCK", name: "Synthesis Fracture", subtitle: "Mission 01C · Systems trial", location: "Data Flood chamber", mechanic: "Read the chamber logic, silence defenders, and rewrite the node sequence.", objectives: ["Reveal the hidden system path", "Silence two sentries", "Stabilize the gravity field", "Override the synthesis core"], reward: "Synthesis Lattice" },
];