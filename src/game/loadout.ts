export type ClassId = "TITAN" | "HUNTER" | "WARLOCK";
export type PlaystyleMode = "SOLO" | "HYBRID" | "TEAM";
export type AbilitySlot = "PRIMARY" | "TACTICAL" | "ULTIMATE";
export type AppearanceId = "RANGER" | "WARDEN" | "PHANTOM" | "CONDUIT";
export type SubclassId =
  | "SHIELD_TITAN" | "BERSERKER_TITAN" | "BULWARK_TITAN"
  | "SHADOW_HUNTER" | "TRACKER_HUNTER" | "FRACTURE_RUNNER"
  | "CODE_WARLOCK" | "VOID_WARLOCK" | "ORACLE_WARLOCK";

export type AbilityDefinition = { slot: AbilitySlot; name: string; description: string };
export type SubclassDefinition = { id: SubclassId; classId: ClassId; name: string; role: string; description: string };
export type ClassDefinition = {
  id: ClassId;
  name: string;
  title: string;
  role: string;
  fantasy: string;
  color: string;
  evolution: string;
  abilities: readonly AbilityDefinition[];
};

export const CLASSES: readonly ClassDefinition[] = [
  {
    id: "TITAN", name: "Titan", title: "Wardens of the Fracture", role: "Protection · Space Control",
    fantasy: "Grounded defenders who hold reality together under pressure.", color: "#66e0ff", evolution: "Defensive adaptation",
    abilities: [
      { slot: "PRIMARY", name: "Fracture Shield", description: "Place or carry a barrier that blocks incoming fire." },
      { slot: "TACTICAL", name: "Ground Breaker", description: "Interrupt enemies and fracture nearby cover." },
      { slot: "ULTIMATE", name: "Reality Bulwark", description: "Raise a regenerating dome that reflects projectiles." },
    ],
  },
  {
    id: "HUNTER", name: "Hunter", title: "Fracture Rogues", role: "Mobility · Precision",
    fantasy: "Fast operators whose momentum sharpens every strike.", color: "#ff6f61", evolution: "Adaptive evolution",
    abilities: [
      { slot: "PRIMARY", name: "Phase Dash", description: "Pass through danger; perfect timing boosts damage." },
      { slot: "TACTICAL", name: "Mark Target", description: "Reveal movement patterns and shared critical zones." },
      { slot: "ULTIMATE", name: "Time Split Assault", description: "Afterimages repeat attacks inside a burst window." },
    ],
  },
  {
    id: "WARLOCK", name: "Warlock", title: "Oracles of the System", role: "Control · Support DPS",
    fantasy: "Strategists who expose and temporarily rewrite world rules.", color: "#c86bff", evolution: "System evolution",
    abilities: [
      { slot: "PRIMARY", name: "Code Pulse", description: "Reveal hidden systems and disable hostile abilities." },
      { slot: "TACTICAL", name: "Reality Tweak", description: "Create a slow, gravity, or suppression field." },
      { slot: "ULTIMATE", name: "System Override", description: "Reduce cooldowns and confuse enemy coordination." },
    ],
  },
];

export const SUBCLASSES: readonly SubclassDefinition[] = [
  { id: "SHIELD_TITAN", classId: "TITAN", name: "Shield Titan", role: "Mobile Guard", description: "Carry the line forward, absorb fire, then release it as Reflect Break." },
  { id: "BERSERKER_TITAN", classId: "TITAN", name: "Berserker Titan", role: "Impact Assault", description: "Build rage through close combat, slams, and destructible terrain." },
  { id: "BULWARK_TITAN", classId: "TITAN", name: "Bulwark Titan", role: "Zone Anchor", description: "Become slow, unstoppable armor that creates safe ground for allies." },
  { id: "SHADOW_HUNTER", classId: "HUNTER", name: "Shadow Hunter", role: "Infiltration", description: "Chain brief invisibility, phase movement, and back-line critical hits." },
  { id: "TRACKER_HUNTER", classId: "HUNTER", name: "Tracker Hunter", role: "Recon", description: "Predict routes, mark threats through cover, and amplify precision fire." },
  { id: "FRACTURE_RUNNER", classId: "HUNTER", name: "Fracture Runner", role: "Momentum", description: "Link parkour and perfect dodges into time-slow combat windows." },
  { id: "CODE_WARLOCK", classId: "WARLOCK", name: "Code Warlock", role: "Systems", description: "Hack objects, disable hostile intelligence, and rewrite machines." },
  { id: "VOID_WARLOCK", classId: "WARLOCK", name: "Void Warlock", role: "Anomaly", description: "Shape pulls, corruption fields, and volatile energy zones." },
  { id: "ORACLE_WARLOCK", classId: "WARLOCK", name: "Oracle Warlock", role: "Prediction", description: "Visualize enemy intent and open short perception windows." },
];

export type AppearanceDefinition = { id: AppearanceId; name: string; armor: string; cloth: string; visor: string; marking: string };
const DEFAULT_APPEARANCE: AppearanceDefinition = { id: "RANGER", name: "Dust Ranger", armor: "#b7ab93", cloth: "#6d6a4a", visor: "#66e0ff", marking: "Frontier / 01" };
export const APPEARANCES: readonly AppearanceDefinition[] = [
  DEFAULT_APPEARANCE,
  { id: "WARDEN", name: "Nexus Warden", armor: "#8fa6b0", cloth: "#34434a", visor: "#7dffca", marking: "Citadel / 07" },
  { id: "PHANTOM", name: "Rift Phantom", armor: "#827598", cloth: "#3d3548", visor: "#c86bff", marking: "Phase / 13" },
  { id: "CONDUIT", name: "Solar Conduit", armor: "#b89462", cloth: "#51463b", visor: "#ffb057", marking: "Ember / 04" },
];
export const DEFAULT_SUBCLASS: Record<ClassId, SubclassId> = { TITAN: "SHIELD_TITAN", HUNTER: "SHADOW_HUNTER", WARLOCK: "CODE_WARLOCK" };
export function appearanceById(id: AppearanceId) { return APPEARANCES.find((item) => item.id === id) ?? DEFAULT_APPEARANCE; }
export function classById(id: ClassId): ClassDefinition {
  const found = CLASSES.find((item) => item.id === id);
  return found ?? { id: "TITAN", name: "Titan", title: "Wardens of the Fracture", role: "Protection · Space Control", fantasy: "Hold reality together under pressure.", color: "#66e0ff", evolution: "Defensive adaptation", abilities: [] };
}
export function subclassById(id: SubclassId): SubclassDefinition {
  const found = SUBCLASSES.find((item) => item.id === id);
  return found ?? { id: "SHIELD_TITAN", classId: "TITAN", name: "Shield Titan", role: "Mobile Guard", description: "Carry the line forward under fire." };
}
