export type ClassId = "TITAN" | "HUNTER" | "WARLOCK";
export type PlaystyleMode = "SOLO" | "HYBRID" | "TEAM";
export type AbilitySlot = "PRIMARY" | "TACTICAL" | "ULTIMATE";
export type AppearanceId = "BASTION" | "SHADE" | "CIPHER";
export type SubclassId =
  | "SHIELD_TITAN" | "BERSERKER_TITAN" | "BULWARK_TITAN"
  | "SHADOW_HUNTER" | "TRACKER_HUNTER" | "FRACTURE_RUNNER"
  | "CODE_WARLOCK" | "VOID_WARLOCK" | "ORACLE_WARLOCK";

export type AbilityDefinition = { slot: AbilitySlot; name: string; description: string };
/** `specialAbility` is this subclass's one signature move — unique to this operator, not shared
 * across the roster (3 operators × 3 subclasses = 9 special abilities total, no two alike). */
export type SubclassDefinition = { id: SubclassId; classId: ClassId; name: string; role: string; description: string; specialAbility: string };
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
    id: "TITAN", name: "Destroyer", title: "Wardens of the Fracture", role: "Heavy Weapons · Durability · Area Damage",
    fantasy: "A heavily armored frontline fighter built to absorb damage and overwhelm enemy positions.", color: "#66e0ff", adaptation: "Defensive specialization",
    abilities: [
      { slot: "PRIMARY", name: "Siege Mode", description: "Increase weapon stability and firepower." },
      { slot: "TACTICAL", name: "Kinetic Slam", description: "Release a shockwave around you." },
      { slot: "ULTIMATE", name: "Bastion Shield", description: "Deploy temporary defensive protection." },
    ],
  },
  {
    id: "HUNTER", name: "Assassin", title: "Fracture Rogues", role: "Mobility · Stealth · Precision",
    fantasy: "A fast, stealth-focused operator built for flanking enemies and striking vulnerable targets.", color: "#ff6f61", adaptation: "Momentum specialization",
    abilities: [
      { slot: "PRIMARY", name: "Phase Veil", description: "Briefly conceal yourself." },
      { slot: "TACTICAL", name: "Rift Dash", description: "Quickly teleport a short distance." },
      { slot: "ULTIMATE", name: "Shadow Strike", description: "Deliver a powerful close-range attack." },
    ],
  },
  {
    id: "WARLOCK", name: "Tech", title: "Oracles of the System", role: "Tactical Support · Control · Technology",
    fantasy: "A tactical specialist who uses drones, battlefield intelligence, and reality-manipulation technology.", color: "#c86bff", adaptation: "System specialization",
    abilities: [
      { slot: "PRIMARY", name: "Recon Swarm", description: "Reveal nearby enemies." },
      { slot: "TACTICAL", name: "Disruption Pulse", description: "Temporarily disable enemy technology." },
      { slot: "ULTIMATE", name: "Rift Turret", description: "Deploy an automated combat device." },
    ],
  },
];

export const SUBCLASSES: readonly SubclassDefinition[] = [
  { id: "SHIELD_TITAN", classId: "TITAN", name: "Shield Destroyer", role: "Mobile Guard", description: "Carry the line forward and absorb fire.", specialAbility: "Reflect Break — release everything the shield absorbed as one directional blast." },
  { id: "BERSERKER_TITAN", classId: "TITAN", name: "Berserker Destroyer", role: "Impact Assault", description: "Build rage through close combat and destructible terrain.", specialAbility: "Rage Engine — every hit taken and landed charges a melee that cracks cover apart." },
  { id: "BULWARK_TITAN", classId: "TITAN", name: "Bulwark Destroyer", role: "Zone Anchor", description: "Become slow, unstoppable armor that holds ground for allies.", specialAbility: "Safe Ground — plant down into armor immune to stagger, projecting a zone allies can heal in." },
  { id: "SHADOW_HUNTER", classId: "HUNTER", name: "Shadow Assassin", role: "Infiltration", description: "Chain brief invisibility into back-line strikes.", specialAbility: "Blackout Strike — vanish for a beat, reappear inside an enemy's guard for a guaranteed critical." },
  { id: "TRACKER_HUNTER", classId: "HUNTER", name: "Tracker Assassin", role: "Recon", description: "Predict routes and mark threats through cover.", specialAbility: "Dead Reckoning — paint a target through walls; the next shot that lands on it never misses." },
  { id: "FRACTURE_RUNNER", classId: "HUNTER", name: "Fracture Runner", role: "Momentum", description: "Link parkour and perfect dodges into combat windows.", specialAbility: "Time Skip — a perfect dodge freezes the field for a half-second only you move through." },
  { id: "CODE_WARLOCK", classId: "WARLOCK", name: "Code Tech", role: "Systems", description: "Hack objects and disable hostile intelligence.", specialAbility: "Machine Whisper — seize a hostile system or turret and turn it on its own side." },
  { id: "VOID_WARLOCK", classId: "WARLOCK", name: "Void Tech", role: "Anomaly", description: "Shape pulls and volatile corruption fields.", specialAbility: "Corrosion Field — drop a zone that pulls enemies together and eats their armor over time." },
  { id: "ORACLE_WARLOCK", classId: "WARLOCK", name: "Oracle Tech", role: "Prediction", description: "Visualize enemy intent before it happens.", specialAbility: "Foresight — see every enemy's next three seconds of movement and attacks, for everyone." },
];

/** Field colors on a deployed Operator: armor plate, undersuit, visor line, and trim/greeble accent
 * (Operator.tsx's `trim` material, previously hardcoded). `callsign` is shown in the deployment
 * briefing and HUD — free text, not locked to a preset, same as the color channels. */
export type AppearanceDefinition = { id: AppearanceId; name: string; armor: string; cloth: string; visor: string; trim: string; callsign: string };

const DEFAULT_APPEARANCE: AppearanceDefinition = { id: "BASTION", name: "Goliath Destroyer", armor: "#4a4036", cloth: "#1c1815", visor: "#ff7a1a", trim: "#2a2420", callsign: "GOLIATH-01" };
/** One signature appearance per Operator (see OPERATORS) — a real starting identity to customize
 * from, not an arbitrary color swatch. Stays the same across that Operator's 3 subclasses. */
export const APPEARANCES: readonly AppearanceDefinition[] = [
  DEFAULT_APPEARANCE,
  { id: "SHADE", name: "Nyx Rift", armor: "#2a2230", cloth: "#0e0b12", visor: "#ff2bd6", trim: "#1a0f22", callsign: "NYX-13" },
  { id: "CIPHER", name: "Cipher Tech", armor: "#3d3a5c", cloth: "#121018", visor: "#ffc864", trim: "#15131d", callsign: "CIPHER-02" },
];
/** Swatch rows offered when freely customizing each color channel in the Identity Forge — every
 * preset's colors plus a few neutrals, so a custom look can still land on a clean, tested value. */
export const CUSTOMIZATION_PALETTE: readonly string[] = [
  "#7f97a8", "#8a4a3a", "#5c6660", "#3a2f4a", "#9c7d4e", "#aab4bd", "#3d3a5c", "#5c3a66", "#8a97a6",
  "#ffffff", "#c8cdd2", "#6b7278", "#2a2f34", "#101317", "#000000",
  "#4a4036", "#2a2230", "#ff7a1a", "#ff2bd6", "#5ad0ff", "#ffb357", "#8dffb0", "#b06bff", "#ffa033", "#7dfff0", "#ffc864", "#ff6bd6", "#bfe8ff",
];
export const DEFAULT_SUBCLASS: Record<ClassId, SubclassId> = { TITAN: "SHIELD_TITAN", HUNTER: "SHADOW_HUNTER", WARLOCK: "CODE_WARLOCK" };
export function appearanceById(id: AppearanceId) { return APPEARANCES.find((item) => item.id === id) ?? DEFAULT_APPEARANCE; }

/** Exactly 3 playable Operators — one per class, each customizable (appearance colors + callsign)
 * and each with their own 3 subclasses (see SUBCLASSES), every subclass granting that Operator a
 * different, unique special ability. Picking a subclass respecs the same character; it doesn't
 * change who they are. */
export type OperatorId = "nyx" | "goliath" | "cipher";
export type OperatorDefinition = {
  id: OperatorId; name: string; callsign: string; className: string; classId: ClassId; appearanceId: AppearanceId; description: string; bio: string;
  baseStats: { health: number; armor: number; mobility: number; tech: number };
};
export const OPERATORS: readonly OperatorDefinition[] = [
  { id: "goliath", name: "GOLIATH", callsign: "GOLIATH", className: "Destroyer", classId: "TITAN", appearanceId: "BASTION", description: "A heavy frontline combat specialist.", bio: "A heavily armored frontline fighter built to absorb damage and overwhelm enemy positions. Heavy weapons, durability, area damage.", baseStats: { health: 160, armor: 130, mobility: 45, tech: 55 } },
  { id: "nyx", name: "NYX", callsign: "NYX", className: "Assassin", classId: "HUNTER", appearanceId: "SHADE", description: "A stealth-focused Rift operative.", bio: "A fast, stealth-focused operator built for flanking enemies and striking vulnerable targets. Mobility, stealth, precision.", baseStats: { health: 100, armor: 70, mobility: 100, tech: 65 } },
  { id: "cipher", name: "CIPHER", callsign: "CIPHER", className: "Tech", classId: "WARLOCK", appearanceId: "CIPHER", description: "A tactical operator specializing in battlefield control.", bio: "A tactical specialist who uses drones, battlefield intelligence, and reality-manipulation technology. Tactical support, control, technology.", baseStats: { health: 110, armor: 75, mobility: 70, tech: 110 } },
];
export function operatorByClass(id: ClassId): OperatorDefinition {
  return OPERATORS.find((item) => item.classId === id) ?? OPERATORS[0]!;
}
export function classById(id: ClassId): ClassDefinition {
  const found = CLASSES.find((item) => item.id === id);
  return found ?? { id: "TITAN", name: "Destroyer", title: "Wardens of the Fracture", role: "Heavy Weapons · Durability · Area Damage", fantasy: "Hold reality together under pressure.", color: "#66e0ff", adaptation: "Defensive specialization", abilities: [] };
}
export function subclassById(id: SubclassId): SubclassDefinition {
  const found = SUBCLASSES.find((item) => item.id === id);
  return found ?? { id: "SHIELD_TITAN", classId: "TITAN", name: "Shield Destroyer", role: "Mobile Guard", description: "Carry the line forward under fire.", specialAbility: "Reflect Break — release everything the shield absorbed as one directional blast." };
}
