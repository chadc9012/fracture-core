/** Authored multi-phase encounters for the Unique Scenario bosses. Pure data + geometry; encounter-sim.ts runs it against the
 * real WorldSim. Every attack has a tell, a valid range, real hit geometry that is tested against the player's position at
 * impact, a recovery, and a punish window (the boss's poise weak-point opens when the recovery starts), so the only way to
 * hurt these bosses is to read the tell, survive the attack and hit them in the opening. Scenarios without an entry here
 * (Unbroken Glass, System Core, Red Ronin) keep their original poise/gimmick-only behaviour. */

export type AttackKind =
  | "SLAM"    // circle centred on the boss, hits the player inside `radius`
  | "LUNGE"   // boss dashes to where the player stood when the tell began; hits the player within `width` of that path
  | "POUNCE"  // boss leaps to the snapshot point; hits the player inside `radius` of the landing
  | "FAN"     // ranged cone toward the snapshot point: half-angle `arc`, reach `reach`
  | "FIELD"   // spawns hazard zones (no direct hit)
  | "CLONES"  // spawns False Saint decoys (no direct hit)
  | "SUMMON";  // calls in real hostile troops around the boss (no direct hit)

export type ZoneKind = "DAMAGE" | "SLOW";
export type ZoneSpec = {
  kind: ZoneKind; radius: number; dps: number; /** speed multiplier while inside (SLOW) */ slow?: number;
  count: number; /** seconds between spawn and becoming dangerous - the readable warning */ arm: number; life: number;
  /** where the zones go: near the player (one ON them), around the boss, or orbiting the boss */
  place: "PLAYER" | "RING" | "ORBIT"; ringRadius?: number; orbitSpeed?: number;
  name: string;
};

/** troops an encounter boss calls in: ordinary hostile machines (they shoot, chase, drop a little) tagged so the fight can clear them */
export type SummonGroup = { profile: string; kind: "RAIDER" | "OVERCLOCKED" | "ABERRATION" | "VANGUARD"; count: number; hp: number; scale: number; elite?: boolean };
export type AttackDef = {
  id: string; kind: AttackKind; label: string; /** text shown when the tell starts */ tell: string;
  tellTime: number; damage: number;
  /** valid boss-to-player distance for the attack to be chosen */ minRange: number; maxRange: number;
  radius?: number; width?: number; arc?: number; reach?: number; zones?: ZoneSpec; decoys?: number; summon?: readonly SummonGroup[];
  recovery: number; /** seconds the weak point stays open after the attack */ window: number;
};

export type PhaseDef = {
  id: string; name: string; /** the phase begins once hp fraction is at or below this */ below: number;
  nova: string; attacks: readonly string[]; /** idle seconds between attacks */ gap: number;
  /** zones that exist for the whole phase (arena transformation) */ arena?: ZoneSpec;
  /** the last phase: its closing attack opens the finale window and hp cannot fall under `floorHp` before it */
  finale?: { attack: string; window: number; floorHp: number; nova: string };
};

/** A non-lethal encounter (Vaelith's First Trial): once hp falls to `below` of max the boss stops attacking and cannot be reduced further. */
export type TruceDef = { below: number; floorFrac: number; nova: string };
export type EncounterDef = { scenarioId: string; attacks: Record<string, AttackDef>; phases: readonly PhaseDef[]; victory: string; truce?: TruceDef };

const A = (a: AttackDef) => a;

const DARK_KNIGHT: EncounterDef = {
  scenarioId: "dark-knight",
  victory: "Strike during the Last Oath opening to end the duel.",
  attacks: {
    sweep: A({ id: "sweep", kind: "SLAM", label: "Staff sweep", tell: "The Knight raises his staff — sweep. Step out of the circle.", tellTime: 1.0, damage: 14, minRange: 0, maxRange: 10, radius: 9, recovery: 1.8, window: 2.0 }),
    lunge: A({ id: "lunge", kind: "LUNGE", label: "Void lunge", tell: "He drops into a stance — a lunge along your line. Sidestep.", tellTime: 0.9, damage: 16, minRange: 8, maxRange: 32, width: 3.2, recovery: 2.0, window: 2.2 }),
    bolt: A({ id: "bolt", kind: "FAN", label: "Null bolts", tell: "The staff glows cyan — bolts fan toward you. Break the line.", tellTime: 0.8, damage: 9, minRange: 12, maxRange: 48, arc: 0.3, reach: 46, recovery: 1.4, window: 1.5 }),
    fracture: A({ id: "fracture", kind: "FIELD", label: "Fracture field", tell: "Reality cracks around you — the amber rings are about to turn deadly.", tellTime: 1.2, damage: 0, minRange: 0, maxRange: 60, recovery: 1.2, window: 1.4,
      zones: { kind: "DAMAGE", radius: 5, dps: 12, count: 4, arm: 1.6, life: 9, place: "PLAYER", ringRadius: 12, name: "Fracture field" } }),
    "null-nova": A({ id: "null-nova", kind: "SLAM", label: "Null nova", tell: "The reactor overloads — get well clear of him, or break his poise first.", tellTime: 1.3, damage: 20, minRange: 0, maxRange: 60, radius: 14, recovery: 1.5, window: 1.4 }),
    "oath-sweep": A({ id: "oath-sweep", kind: "SLAM", label: "Last Oath", tell: "LAST OATH — the whole floor is the blade. Run to the edge!", tellTime: 2.2, damage: 30, minRange: 0, maxRange: 80, radius: 18, recovery: 0.8, window: 0 }),
  },
  phases: [
    { id: "warden", name: "Warden", below: 1, nova: "NOVA: He fights in patterns. Watch the staff, step out, then hit him in the opening.", attacks: ["sweep", "lunge", "bolt"], gap: 1.8 },
    { id: "fracture-field", name: "Fracture Field", below: 0.72, nova: "NOVA: The floor is breaking up. Amber rings go red — don't stand in them.", attacks: ["sweep", "fracture", "lunge", "bolt"], gap: 1.5 },
    { id: "null-ascendant", name: "Null Ascendant", below: 0.45, nova: "NOVA: His reactor is climbing. Windows are shorter now — a Null Disruption pulse will stagger him.", attacks: ["lunge", "null-nova", "fracture", "bolt", "sweep"], gap: 1.1 },
    { id: "last-oath", name: "Last Oath", below: 0.2, nova: "NOVA: He is out of tricks. Survive the Last Oath and he is open.", attacks: ["bolt", "sweep", "lunge"], gap: 1.2, finale: { attack: "oath-sweep", window: 6, floorHp: 3, nova: "NOVA: FINAL WINDOW — strike now!" } },
  ],
};

const RIME_ALPHA: EncounterDef = {
  scenarioId: "rime-alpha",
  victory: "Hit Rime Alpha in the opening after its Fury chain to finish the hunt.",
  attacks: {
    lunge: A({ id: "lunge", kind: "LUNGE", label: "Hunting lunge", tell: "Spine-crystals flare teal — it is about to lunge at you.", tellTime: 0.8, damage: 12, minRange: 9, maxRange: 36, width: 3.4, recovery: 1.6, window: 2.0 }),
    pounce: A({ id: "pounce", kind: "POUNCE", label: "Pounce", tell: "It crouches low — a pounce on your position. Move before it lands.", tellTime: 1.0, damage: 16, minRange: 8, maxRange: 42, radius: 6, recovery: 2.0, window: 2.4 }),
    breath: A({ id: "breath", kind: "FAN", label: "Frost breath", tell: "Frost gathers in its jaws — a cone of ice is coming.", tellTime: 0.9, damage: 8, minRange: 6, maxRange: 34, arc: 0.45, reach: 32, recovery: 1.5, window: 1.6 }),
    "frost-patches": A({ id: "frost-patches", kind: "FIELD", label: "Frost patches", tell: "Ice spreads across the snow — the pale patches will slow and freeze you.", tellTime: 1.0, damage: 0, minRange: 0, maxRange: 60, recovery: 1.2, window: 1.4,
      zones: { kind: "SLOW", radius: 6, dps: 4, slow: 0.5, count: 3, arm: 1.0, life: 10, place: "PLAYER", ringRadius: 10, name: "Frost patch" } }),
  },
  phases: [
    { id: "hunt", name: "Hunt", below: 1, nova: "NOVA: It is tracking you. Wait for the lunge, then punish its recovery.", attacks: ["lunge", "breath"], gap: 1.8 },
    { id: "predation", name: "Predation", below: 0.7, nova: "NOVA: Pounces now. Watch the ground — it lands where you stood.", attacks: ["pounce", "lunge", "breath"], gap: 1.5 },
    { id: "frostbound", name: "Frostbound", below: 0.4, nova: "NOVA: Frost patches slow you. Stay off the pale ice.", attacks: ["frost-patches", "pounce", "lunge"], gap: 1.3 },
    { id: "alphas-fury", name: "Alpha's Fury", below: 0.18, nova: "NOVA: It is enraged — faster, but every chain ends open. Hit it then.", attacks: ["lunge", "pounce", "breath", "frost-patches"], gap: 0.9 },
  ],
};

const DROWNED_MONARCH: EncounterDef = {
  scenarioId: "drowned-monarch",
  victory: "Survive the Drowning Court and strike the Monarch in the final window.",
  attacks: {
    trident: A({ id: "trident", kind: "SLAM", label: "Trident slam", tell: "The Monarch lifts his trident — a crushing slam around him.", tellTime: 1.0, damage: 14, minRange: 0, maxRange: 10, radius: 8, recovery: 1.8, window: 2.0 }),
    surge: A({ id: "surge", kind: "LUNGE", label: "Tidal surge", tell: "The water draws back along your line — a surge is coming. Step aside.", tellTime: 1.1, damage: 14, minRange: 7, maxRange: 34, width: 5, recovery: 2.0, window: 2.2 }),
    pressure: A({ id: "pressure", kind: "FIELD", label: "Pressure columns", tell: "Pressure builds in amber columns — they crush whoever is inside when they turn red.", tellTime: 1.1, damage: 0, minRange: 0, maxRange: 60, recovery: 1.3, window: 1.5,
      zones: { kind: "DAMAGE", radius: 7, dps: 10, count: 3, arm: 1.6, life: 8, place: "PLAYER", ringRadius: 12, name: "Pressure column" } }),
    "rising-tide": A({ id: "rising-tide", kind: "FIELD", label: "Rising tide", tell: "The tide is rising — hazard zones circle the Monarch. Move with the gap.", tellTime: 1.2, damage: 0, minRange: 0, maxRange: 60, recovery: 1.4, window: 1.6,
      zones: { kind: "DAMAGE", radius: 6, dps: 12, count: 3, arm: 1.2, life: 12, place: "ORBIT", ringRadius: 12, orbitSpeed: 0.5, name: "Rising tide" } }),
    collapse: A({ id: "collapse", kind: "SLAM", label: "Throne collapse", tell: "The throne cracks — a wide collapse around the Monarch.", tellTime: 1.3, damage: 20, minRange: 0, maxRange: 60, radius: 12, recovery: 1.5, window: 1.4 }),
    drown: A({ id: "drown", kind: "SLAM", label: "The Drowning", tell: "THE DROWNING — the whole court floods. Get to the edge!", tellTime: 2.6, damage: 26, minRange: 0, maxRange: 80, radius: 18, recovery: 0.8, window: 0 }),
  },
  phases: [
    { id: "abyssal-court", name: "Abyssal Court", below: 1, nova: "NOVA: Royal arena, deep water. Learn the tells — slam, surge, pressure.", attacks: ["trident", "surge", "pressure"], gap: 1.8 },
    { id: "rising-tide", name: "Rising Tide", below: 0.72, nova: "NOVA: Hazard zones are circling him now. Time your movement to the gaps.", attacks: ["rising-tide", "surge", "trident"], gap: 1.5 },
    { id: "broken-throne", name: "Broken Throne", below: 0.45, nova: "NOVA: The throne is breaking — the flooded corners are now dangerous ground.", attacks: ["pressure", "collapse", "surge", "rising-tide"], gap: 1.2,
      arena: { kind: "DAMAGE", radius: 8, dps: 6, count: 4, arm: 2.5, life: 1e9, place: "RING", ringRadius: 24, name: "Flooded corner" } },
    { id: "monarchs-fall", name: "Monarch's Fall", below: 0.2, nova: "NOVA: He is failing. Survive the Drowning and he is yours.", attacks: ["surge", "trident", "collapse"], gap: 1.2,
      arena: { kind: "DAMAGE", radius: 8, dps: 6, count: 4, arm: 2.5, life: 1e9, place: "RING", ringRadius: 24, name: "Flooded corner" },
      finale: { attack: "drown", window: 5, floorHp: 3, nova: "NOVA: FINAL WINDOW — strike the Monarch now!" } },
  ],
};

const HOLLOW_SAINT: EncounterDef = {
  scenarioId: "hollow-saint",
  victory: "Find the real Saint, survive the Last Benediction and strike it in the final window.",
  attacks: {
    halo: A({ id: "halo", kind: "SLAM", label: "Halo slam", tell: "Its halo flares — a ring of light drops around it.", tellTime: 1.0, damage: 13, minRange: 0, maxRange: 10, radius: 8, recovery: 1.8, window: 2.0 }),
    benediction: A({ id: "benediction", kind: "FAN", label: "Benediction beams", tell: "Light gathers in its palms — beams will fan toward you.", tellTime: 0.9, damage: 9, minRange: 8, maxRange: 44, arc: 0.4, reach: 42, recovery: 1.5, window: 1.7 }),
    "false-saints": A({ id: "false-saints", kind: "CLONES", label: "False Saints", tell: "It splits — only the one that attacks is real. Decoys shatter and never hurt you.", tellTime: 1.2, damage: 0, minRange: 0, maxRange: 80, decoys: 3, recovery: 1.2, window: 0 }),
    shroud: A({ id: "shroud", kind: "FIELD", label: "Shroud mist", tell: "Grave-mist rolls in — the pale patches slow you and sting.", tellTime: 1.0, damage: 0, minRange: 0, maxRange: 60, recovery: 1.2, window: 1.4,
      zones: { kind: "SLOW", radius: 7, dps: 5, slow: 0.6, count: 3, arm: 1.2, life: 10, place: "PLAYER", ringRadius: 11, name: "Shroud mist" } }),
    "last-benediction": A({ id: "last-benediction", kind: "SLAM", label: "Last Benediction", tell: "LAST BENEDICTION — the grove blazes white. Run to the edge!", tellTime: 2.2, damage: 26, minRange: 0, maxRange: 80, radius: 16, recovery: 0.8, window: 0 }),
  },
  phases: [
    { id: "procession", name: "The Procession", below: 1, nova: "NOVA: Watch its halo colour — match your element — and read the slam and beams.", attacks: ["halo", "benediction"], gap: 1.8 },
    { id: "false-saints", name: "False Saints", below: 0.72, nova: "NOVA: Copies! The real Saint is the one that attacks. Shatter the copies to expose it.", attacks: ["false-saints", "benediction", "halo"], gap: 1.5 },
    { id: "shroud-collapse", name: "Shroud Collapse", below: 0.45, nova: "NOVA: The mist is closing in. Keep to clear ground.", attacks: ["shroud", "benediction", "false-saints", "halo"], gap: 1.3 },
    { id: "last-benediction", name: "The Last Benediction", below: 0.2, nova: "NOVA: This is the last one. Survive it and strike.", attacks: ["benediction", "halo"], gap: 1.2, finale: { attack: "last-benediction", window: 5, floorHp: 3, nova: "NOVA: FINAL WINDOW — it is open!" } },
  ],
};

const VAELITH: EncounterDef = {
  scenarioId: "vaelith",
  victory: "Survive the trial. Vaelith cannot be killed here.",
  truce: { below: 0.4, floorFrac: 0.38, nova: "NOVA: It has stopped. It is not retreating - it is deciding to listen." },
  attacks: {
    "fire-sweep": A({ id: "fire-sweep", kind: "FAN", label: "Sweeping flame", tell: "Its throat glows white - a wide sweep of flame. Break the line.", tellTime: 1.1, damage: 11, minRange: 8, maxRange: 44, arc: 0.55, reach: 40, recovery: 1.8, window: 1.8 }),
    "wing-gust": A({ id: "wing-gust", kind: "SLAM", label: "Wing gust", tell: "Its wings lift - a gust will slam the ground around it. Get clear.", tellTime: 1.0, damage: 9, minRange: 0, maxRange: 14, radius: 13, recovery: 1.6, window: 2.0 }),
    dive: A({ id: "dive", kind: "POUNCE", label: "Aerial dive", tell: "It banks overhead - a dive onto where you stand. Move before it lands.", tellTime: 1.3, damage: 15, minRange: 10, maxRange: 50, radius: 8, recovery: 2.2, window: 2.4 }),
    shockwave: A({ id: "shockwave", kind: "FIELD", label: "Volcanic shockwave", tell: "The rock glows red under the ring - the shockwave erupts when it turns white.", tellTime: 1.2, damage: 0, minRange: 0, maxRange: 60, recovery: 1.4, window: 1.6,
      zones: { kind: "DAMAGE", radius: 6, dps: 10, count: 4, arm: 1.6, life: 7, place: "RING", ringRadius: 18, name: "Volcanic shockwave" } }),
  },
  phases: [
    { id: "ashen-gate", name: "The Ashen Gate", below: 1, nova: "NOVA: It tests you. Read the throat glow and the wings.", attacks: ["fire-sweep", "wing-gust"], gap: 1.8 },
    { id: "first-trial", name: "The First Trial", below: 0.7, nova: "NOVA: Dives and shockwaves now. Survive - you do not have to kill it.", attacks: ["dive", "fire-sweep", "shockwave", "wing-gust"], gap: 1.3 },
  ],
};

const VYRAK: EncounterDef = {
  scenarioId: "vyrak",
  victory: "Survive the Covenant Trial and strike Vyrak in the final window to earn the bond.",
  attacks: {
    "strafing-fire": A({ id: "strafing-fire", kind: "FAN", label: "Strafing fire run", tell: "Vyrak banks low — a strafing line of fire. Break the line.", tellTime: 1.3, damage: 11, minRange: 10, maxRange: 48, arc: 0.4, reach: 44, recovery: 1.8, window: 2.2 }),
    "wing-gust": A({ id: "wing-gust", kind: "SLAM", label: "Wing gust", tell: "Its wings beat down — a gust slams the ground around it. Get clear.", tellTime: 1.1, damage: 10, minRange: 0, maxRange: 15, radius: 12, recovery: 1.6, window: 2.2 }),
    dive: A({ id: "dive", kind: "POUNCE", label: "Sovereign dive", tell: "It wheels overhead — a dive onto where you stand. Move before it lands.", tellTime: 1.5, damage: 15, minRange: 10, maxRange: 52, radius: 8, recovery: 2.2, window: 2.8 }),
    "ember-field": A({ id: "ember-field", kind: "FIELD", label: "Ember field", tell: "Embers scatter across the glass — the glowing patches are about to burn.", tellTime: 1.2, damage: 0, minRange: 0, maxRange: 60, recovery: 1.3, window: 1.5,
      zones: { kind: "DAMAGE", radius: 6, dps: 10, count: 3, arm: 1.8, life: 8, place: "PLAYER", ringRadius: 14, name: "Ember field" } }),
    "scale-burst": A({ id: "scale-burst", kind: "SLAM", label: "Scale burst", tell: "Its cracked plates glow white — a burst of shedding scales around it.", tellTime: 1.4, damage: 16, minRange: 0, maxRange: 60, radius: 11, recovery: 1.6, window: 2.4 }),
    "covenant-roar": A({ id: "covenant-roar", kind: "SLAM", label: "Covenant roar", tell: "COVENANT ROAR — the whole lair shakes. Run to the edge!", tellTime: 2.2, damage: 28, minRange: 0, maxRange: 80, radius: 18, recovery: 0.8, window: 0 }),
  },
  phases: [
    { id: "sky-sovereign", name: "Sky Sovereign", below: 1, nova: "NOVA: It owns the sky. Read the banking turn, then punish the recovery.", attacks: ["strafing-fire", "wing-gust", "dive"], gap: 2.0 },
    { id: "scale-shedding", name: "Scale Shedding", below: 0.6, nova: "NOVA: Its chest plates are cracking — the weak point is open between attacks. Ember fields now.", attacks: ["ember-field", "dive", "scale-burst", "strafing-fire"], gap: 1.6 },
    { id: "covenant-trial", name: "Covenant Trial", below: 0.25, nova: "NOVA: It has landed. This is the trial now — survive the roar and it will decide.", attacks: ["scale-burst", "wing-gust", "ember-field"], gap: 1.4,
      finale: { attack: "covenant-roar", window: 5, floorHp: 3, nova: "NOVA: FINAL WINDOW — strike now, and the Covenant is yours!" } },
  ],
};

/** Raid 01's final boss (hollow-star-raid.ts holds the raid rules; this is the 3D fight). Phases follow the raid design: Awakening,
 * Star Collapse, Fractured Reality, Final Stand. Not modelled in this single-player build: separate teams, per-player realities and
 * minion waves as individual enemies (they appear as hazard pits and orbiting void energy instead). */
const ASTRAVORE: EncounterDef = {
  scenarioId: "astravore",
  victory: "Survive the overload and strike the exposed core to end the Hollow Star.",
  attacks: {
    "void-slam": A({ id: "void-slam", kind: "SLAM", label: "Void Slam", tell: "A fist rises over the platform - a massive strike. Leave the circle.", tellTime: 1.6, damage: 18, minRange: 0, maxRange: 26, radius: 16, recovery: 2.2, window: 2.4 }),
    "star-beam": A({ id: "star-beam", kind: "FAN", label: "Star Beam", tell: "The star narrows to a point - a beam will track you. Break the line.", tellTime: 1.2, damage: 12, minRange: 14, maxRange: 80, arc: 0.22, reach: 78, recovery: 1.6, window: 1.8 }),
    "gravity-pull": A({ id: "gravity-pull", kind: "FIELD", label: "Gravity Pull", tell: "Space bends toward the core - the pale wells will drag and crush.", tellTime: 1.3, damage: 0, minRange: 0, maxRange: 90, recovery: 1.4, window: 1.6,
      zones: { kind: "SLOW", radius: 9, dps: 6, slow: 0.45, count: 3, arm: 1.2, life: 10, place: "PLAYER", ringRadius: 14, name: "Gravity well" } }),
    "dimensional-rifts": A({ id: "dimensional-rifts", kind: "FIELD", label: "Dimensional Rifts", tell: "Reality tears open around the platform - the rifts are about to burn.", tellTime: 1.5, damage: 0, minRange: 0, maxRange: 90, recovery: 1.4, window: 1.6,
      zones: { kind: "DAMAGE", radius: 7, dps: 12, count: 4, arm: 1.6, life: 9, place: "RING", ringRadius: 26, name: "Dimensional rift" } }),
    summons: A({ id: "summons", kind: "SUMMON", label: "Summons", tell: "Void spawn claw out of the floor - a pack of Void Hounds is coming.", tellTime: 1.4, damage: 0, minRange: 0, maxRange: 90, recovery: 1.5, window: 1.8,
      summon: [{ profile: "Void Hound", kind: "OVERCLOCKED", count: 3, hp: 3, scale: 0.9 }] }),
    "call-guardians": A({ id: "call-guardians", kind: "SUMMON", label: "Call the Guardians", tell: "A rift splits open - a Dimensional Knight and Reality Mages step through.", tellTime: 1.6, damage: 0, minRange: 0, maxRange: 90, recovery: 1.6, window: 1.8,
      summon: [{ profile: "Dimensional Knight", kind: "VANGUARD", count: 1, hp: 12, scale: 1.7, elite: true }, { profile: "Reality Mage", kind: "RAIDER", count: 2, hp: 4, scale: 1.1 }] }),
    "call-sentinel": A({ id: "call-sentinel", kind: "SUMMON", label: "Call a Sentinel", tell: "The floor lifts - a Star Sentinel rises to guard the core.", tellTime: 1.8, damage: 0, minRange: 0, maxRange: 90, recovery: 1.8, window: 2.0,
      summon: [{ profile: "Star Sentinel", kind: "VANGUARD", count: 1, hp: 22, scale: 2.6, elite: true }] }),
    "star-collapse": A({ id: "star-collapse", kind: "FIELD", label: "Star Collapse", tell: "The star destabilizes - orbiting rings of energy sweep the platform. Move with the gaps.", tellTime: 1.3, damage: 0, minRange: 0, maxRange: 90, recovery: 1.4, window: 1.8,
      zones: { kind: "DAMAGE", radius: 7, dps: 13, count: 3, arm: 1.2, life: 12, place: "ORBIT", ringRadius: 20, orbitSpeed: 0.45, name: "Collapsing energy" } }),
    overload: A({ id: "overload", kind: "SLAM", label: "Overload", tell: "OVERLOAD - the machine is tearing itself apart. Run to the edge!", tellTime: 2.6, damage: 30, minRange: 0, maxRange: 120, radius: 28, recovery: 0.8, window: 0 }),
  },
  phases: [
    { id: "awakening", name: "Awakening", below: 1, nova: "NOVA: It is only testing us. Read the slam and the beam, then hit the opening.", attacks: ["void-slam", "star-beam", "summons"], gap: 1.8 },
    { id: "star-collapse", name: "Star Collapse", below: 0.7, nova: "NOVA: The star is unstable. The energy rings sweep the whole platform - stay in the gaps.", attacks: ["star-collapse", "void-slam", "summons", "star-beam", "call-guardians"], gap: 1.5 },
    { id: "fractured-reality", name: "Fractured Reality", below: 0.4, nova: "NOVA: Reality is splitting. Gravity wells and rifts - keep moving, keep to clear ground.", attacks: ["gravity-pull", "call-guardians", "dimensional-rifts", "star-beam", "void-slam", "call-sentinel"], gap: 1.3,
      arena: { kind: "DAMAGE", radius: 8, dps: 6, count: 4, arm: 2.5, life: 1e9, place: "RING", ringRadius: 38, name: "Fractured ground" } },
    { id: "final-stand", name: "Final Stand", below: 0.15, nova: "NOVA: The arena is coming apart. Survive the overload and the core is open.", attacks: ["star-beam", "dimensional-rifts", "call-guardians", "void-slam"], gap: 1.1,
      arena: { kind: "DAMAGE", radius: 9, dps: 8, count: 5, arm: 2.0, life: 1e9, place: "RING", ringRadius: 38, name: "Collapsing ground" },
      finale: { attack: "overload", window: 6, floorHp: 3, nova: "NOVA: THE CORE IS EXPOSED - everything into it, now!" } },
  ],
};

export const ENCOUNTERS: Readonly<Record<string, EncounterDef>> = {
  "dark-knight": DARK_KNIGHT, "rime-alpha": RIME_ALPHA, "drowned-monarch": DROWNED_MONARCH, "hollow-saint": HOLLOW_SAINT, vaelith: VAELITH, vyrak: VYRAK, astravore: ASTRAVORE,
};
export const encounterFor = (scenarioId: string | undefined): EncounterDef | undefined => (scenarioId ? ENCOUNTERS[scenarioId] : undefined);

/** Phase index for a given hp fraction (never goes backwards by itself; the caller keeps the max). */
export function phaseIndexFor(def: EncounterDef, hpFraction: number): number {
  let idx = 0;
  def.phases.forEach((p, i) => { if (hpFraction <= p.below + 1e-9) idx = i; });
  return idx;
}

/** Next attack from the phase rotation that is valid at `distance`; scans at most one full rotation. Returns the new index too. */
export function pickAttack(def: EncounterDef, phase: PhaseDef, cursor: number, distance: number): { attack: AttackDef; cursor: number } | null {
  const n = phase.attacks.length;
  for (let i = 0; i < n; i++) {
    const atk = def.attacks[phase.attacks[(cursor + i) % n]!];
    if (atk && distance >= atk.minRange && distance <= atk.maxRange) return { attack: atk, cursor: cursor + i + 1 };
  }
  return null;
}

/* ---------- hit geometry (all in world XZ) ---------- */
export const inCircle = (px: number, pz: number, cx: number, cz: number, r: number) => Math.hypot(px - cx, pz - cz) <= r;

/** Distance from point to the segment a→b. */
export function distToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}
export const inLane = (px: number, pz: number, ax: number, az: number, bx: number, bz: number, halfWidth: number) => distToSegment(px, pz, ax, az, bx, bz) <= halfWidth;

/** Cone from (ox,oz) aimed at (tx,tz): within `reach` and within ±`arc` radians of the aim. */
export function inFan(px: number, pz: number, ox: number, oz: number, tx: number, tz: number, arc: number, reach: number): boolean {
  const d = Math.hypot(px - ox, pz - oz);
  if (d > reach) return false;
  if (d < 1e-6) return true;
  const aim = Math.atan2(tx - ox, tz - oz), at = Math.atan2(px - ox, pz - oz);
  let diff = Math.abs(at - aim) % (Math.PI * 2);
  if (diff > Math.PI) diff = Math.PI * 2 - diff;
  return diff <= arc;
}
