export type ClassId = "TITAN" | "HUNTER" | "WARLOCK";
export type PlaystyleMode = "SOLO" | "HYBRID" | "TEAM";
export type AbilitySlot = "PRIMARY" | "TACTICAL" | "ULTIMATE";
export type AppearanceId = "BASTION" | "EMBER" | "ANCHOR" | "SHADE" | "SIGNAL" | "DRIFT" | "CIPHER" | "CURRENT" | "VECTOR";
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
  adaptation: string;
  abilities: readonly AbilityDefinition[];
};

export const CLASSES: readonly ClassDefinition[] = [
  {
    id: "TITAN", name: "Titan", title: "Wardens of the Fracture", role: "Protection · Space Control",
    fantasy: "Grounded defenders who hold reality together under pressure.", color: "#66e0ff", adaptation: "Defensive specialization",
    abilities: [
      { slot: "PRIMARY", name: "Fracture Shield", description: "Place or carry a barrier that blocks incoming fire." },
      { slot: "TACTICAL", name: "Ground Breaker", description: "Interrupt enemies and fracture nearby cover." },
      { slot: "ULTIMATE", name: "Reality Bulwark", description: "Raise a regenerating dome that reflects projectiles." },
    ],
  },
  {
    id: "HUNTER", name: "Hunter", title: "Fracture Rogues", role: "Mobility · Precision",
    fantasy: "Fast operators whose momentum sharpens every strike.", color: "#ff6f61", adaptation: "Momentum specialization",
    abilities: [
      { slot: "PRIMARY", name: "Phase Dash", description: "Pass through danger; perfect timing boosts damage." },
      { slot: "TACTICAL", name: "Mark Target", description: "Reveal movement patterns and shared critical zones." },
      { slot: "ULTIMATE", name: "Time Split Assault", description: "Afterimages repeat attacks inside a burst window." },
    ],
  },
  {
    id: "WARLOCK", name: "Warlock", title: "Oracles of the System", role: "Control · Support DPS",
    fantasy: "Strategists who expose and temporarily rewrite world rules.", color: "#c86bff", adaptation: "System specialization",
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

/** Field colors on a deployed Operator: armor plate, undersuit, visor line, and trim/greeble accent
 * (Operator.tsx's `trim` material, previously hardcoded). `callsign` is shown in the deployment
 * briefing and HUD — free text, not locked to a preset, same as the color channels. */
export type AppearanceDefinition = { id: AppearanceId; name: string; armor: string; cloth: string; visor: string; trim: string; callsign: string };

const DEFAULT_APPEARANCE: AppearanceDefinition = { id: "BASTION", name: "Bastion Warden", armor: "#7f97a8", cloth: "#283840", visor: "#5ad0ff", trim: "#1a1c20", callsign: "BASTION-01" };
/** One signature appearance per subclass (see OPERATORS) — a real starting identity to customize
 * from, not an arbitrary color swatch. */
export const APPEARANCES: readonly AppearanceDefinition[] = [
  DEFAULT_APPEARANCE,
  { id: "EMBER", name: "Ember Breaker", armor: "#8a4a3a", cloth: "#2a211d", visor: "#ffb357", trim: "#1c1210", callsign: "EMBER-04" },
  { id: "ANCHOR", name: "Iron Anchor", armor: "#5c6660", cloth: "#1f2b22", visor: "#8dffb0", trim: "#151a17", callsign: "ANCHOR-09" },
  { id: "SHADE", name: "Null Shade", armor: "#3a2f4a", cloth: "#121015", visor: "#b06bff", trim: "#0e0a14", callsign: "SHADE-13" },
  { id: "SIGNAL", name: "Long Signal", armor: "#9c7d4e", cloth: "#2e2518", visor: "#ffa033", trim: "#1a150d", callsign: "SIGNAL-07" },
  { id: "DRIFT", name: "Kinetic Drift", armor: "#aab4bd", cloth: "#1c3a3c", visor: "#7dfff0", trim: "#141e1f", callsign: "DRIFT-21" },
  { id: "CIPHER", name: "Cipher Oracle", armor: "#3d3a5c", cloth: "#121018", visor: "#ffc864", trim: "#15131d", callsign: "CIPHER-02" },
  { id: "CURRENT", name: "Null Current", armor: "#5c3a66", cloth: "#1c1420", visor: "#ff6bd6", trim: "#17101c", callsign: "CURRENT-18" },
  { id: "VECTOR", name: "Pale Vector", armor: "#8a97a6", cloth: "#232a30", visor: "#bfe8ff", trim: "#171c20", callsign: "VECTOR-05" },
];
/** Swatch rows offered when freely customizing each color channel in the Identity Forge — every
 * preset's colors plus a few neutrals, so a custom look can still land on a clean, tested value. */
export const CUSTOMIZATION_PALETTE: readonly string[] = [
  "#7f97a8", "#8a4a3a", "#5c6660", "#3a2f4a", "#9c7d4e", "#aab4bd", "#3d3a5c", "#5c3a66", "#8a97a6",
  "#ffffff", "#c8cdd2", "#6b7278", "#2a2f34", "#101317", "#000000",
  "#5ad0ff", "#ffb357", "#8dffb0", "#b06bff", "#ffa033", "#7dfff0", "#ffc864", "#ff6bd6", "#bfe8ff",
];
export const DEFAULT_SUBCLASS: Record<ClassId, SubclassId> = { TITAN: "SHIELD_TITAN", HUNTER: "SHADOW_HUNTER", WARLOCK: "CODE_WARLOCK" };
export function appearanceById(id: AppearanceId) { return APPEARANCES.find((item) => item.id === id) ?? DEFAULT_APPEARANCE; }

/** A proper named Operator for each subclass — a real identity (not a mechanical label) to pick
 * in the Identity Forge, with a signature appearance preset you can then customize freely. */
export type OperatorDefinition = { id: string; name: string; callsign: string; classId: ClassId; subclassId: SubclassId; appearanceId: AppearanceId; bio: string };
export const OPERATORS: readonly OperatorDefinition[] = [
  { id: "mara-voss", name: "Mara Voss", callsign: "BASTION", classId: "TITAN", subclassId: "SHIELD_TITAN", appearanceId: "BASTION", bio: "Carried the first forward line out of Veridan on a shield that never fully recharged." },
  { id: "dez-okafor", name: "Dez Okafor", callsign: "EMBER", classId: "TITAN", subclassId: "BERSERKER_TITAN", appearanceId: "EMBER", bio: "Trades armor integrity for momentum — NOVA logs more structural damage from Dez than from the enemy." },
  { id: "priya-anand", name: "Priya Anand", callsign: "ANCHOR", classId: "TITAN", subclassId: "BULWARK_TITAN", appearanceId: "ANCHOR", bio: "Holds ground so still that squads use her position as a map waypoint." },
  { id: "kai-esrin", name: "Kai Esrin", callsign: "SHADE", classId: "HUNTER", subclassId: "SHADOW_HUNTER", appearanceId: "SHADE", bio: "NOVA has three confirmed sightings and forty-one unconfirmed ones." },
  { id: "rook-castillo", name: "Rook Castillo", callsign: "SIGNAL", classId: "HUNTER", subclassId: "TRACKER_HUNTER", appearanceId: "SIGNAL", bio: "Calls shots through two walls and a jammed relay without missing a mark." },
  { id: "lyss-okonkwo", name: "Lyss Okonkwo", callsign: "DRIFT", classId: "HUNTER", subclassId: "FRACTURE_RUNNER", appearanceId: "DRIFT", bio: "Moves like the fracture skips a frame just for her." },
  { id: "theo-marsh", name: "Theo Marsh", callsign: "CIPHER", classId: "WARLOCK", subclassId: "CODE_WARLOCK", appearanceId: "CIPHER", bio: "Talks to hostile machines until they agree with him." },
  { id: "ines-kade", name: "Ines Kade", callsign: "CURRENT", classId: "WARLOCK", subclassId: "VOID_WARLOCK", appearanceId: "CURRENT", bio: "Treats the fracture's instability as a tool instead of a hazard." },
  { id: "sable-quinn", name: "Sable Quinn", callsign: "VECTOR", classId: "WARLOCK", subclassId: "ORACLE_WARLOCK", appearanceId: "VECTOR", bio: "Reads three seconds of enemy intent before it happens — never four, never two." },
];
export function operatorBySubclass(id: SubclassId): OperatorDefinition {
  return OPERATORS.find((item) => item.subclassId === id) ?? OPERATORS[0]!;
}
export function operatorsForClass(id: ClassId): OperatorDefinition[] {
  return OPERATORS.filter((item) => item.classId === id);
}
export function classById(id: ClassId): ClassDefinition {
  const found = CLASSES.find((item) => item.id === id);
  return found ?? { id: "TITAN", name: "Titan", title: "Wardens of the Fracture", role: "Protection · Space Control", fantasy: "Hold reality together under pressure.", color: "#66e0ff", adaptation: "Defensive specialization", abilities: [] };
}
export function subclassById(id: SubclassId): SubclassDefinition {
  const found = SUBCLASSES.find((item) => item.id === id);
  return found ?? { id: "SHIELD_TITAN", classId: "TITAN", name: "Shield Titan", role: "Mobile Guard", description: "Carry the line forward under fire." };
}
