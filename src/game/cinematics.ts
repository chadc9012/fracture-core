/** Cinematic sequence controller + the Act I (Missions 1-5) screenplay as DATA. Pure: no rendering, timers or randomness. The
 * player never touches mission state: a cinematic's only output is its `handoff` (the objective text to show and which existing
 * system takes over). It never awards rewards, completes a mission or sets quest flags, whether it finishes, is skipped or replayed.
 * Played-state is a once-keyed story flag (`cine:<id>`), so it survives save/load and cloud merge, and never replays by accident.
 *
 * What is NOT here: camera world coordinates (shots name symbolic `anchor`s that Scene must resolve), recorded voice (lines are
 * spoken through the existing server-streamed TTS with captions as fallback), or any claim that the scenes have been seen rendering. */
import { applyEffects, hasFlag, type StoryState } from "./story";

export type CameraKind = "crane" | "dolly" | "orbit" | "plunge" | "closeup" | "static" | "track" | "rise" | "pull-behind";
export type CineLine = { id: string; speaker: string; text: string };
export type CineShot = {
  id: string; camera: CameraKind; /** symbolic world anchor Scene must resolve to a position / look-at */ anchor: string; framing: string;
  /** non-subtitle direction: environment, sound, staging */ cues: string[]; lines: CineLine[]; minSeconds: number;
};
/** the existing system that takes over when the scene ends; `exists` is checked against the repo, not assumed */
export type HandoffHook = { system: string; exists: boolean; note: string };
export type Handoff = { objective: string; control: "gameplay" | "class-select"; hook: HandoffHook };
export type Cinematic = {
  id: string; mission: 1 | 2 | 3 | 4 | 5; part: string; title: string; /** screenplay target length, seconds */ target: readonly [number, number];
  trigger: string; shots: CineShot[]; handoff: Handoff; /** the scene ends on a title card */ titleCard?: string;
};

export const SECONDS_PER_CHAR = 0.055, LINE_LEAD = 0.6, LINE_GAP = 0.45, MIN_LINE = 1.8, SHOT_TAIL = 0.5;
export const lineSeconds = (text: string) => Math.max(MIN_LINE, text.length * SECONDS_PER_CHAR + LINE_LEAD);
/** a shot lasts at least minSeconds and always long enough for its subtitles to be read */
export function shotSeconds(s: CineShot): number {
  const spoken = s.lines.reduce((t, l, i) => t + lineSeconds(l.text) + (i ? LINE_GAP : 0), 0);
  return Math.max(s.minSeconds, s.lines.length ? LINE_LEAD + spoken + SHOT_TAIL : 0);
}
/** when each line starts inside its shot */
export function lineStarts(s: CineShot): number[] {
  let t = LINE_LEAD; return s.lines.map((l) => { const at = t; t += lineSeconds(l.text) + LINE_GAP; return at; });
}
export const cinematicSeconds = (c: Cinematic) => c.shots.reduce((t, s) => t + shotSeconds(s), 0);

const N = "NOVA", P = "Operator";
let n = 0;
const L = (speaker: string, text: string, id?: string): CineLine => ({ id: id ?? `l${++n}`, speaker, text });
const S = (id: string, camera: CameraKind, anchor: string, framing: string, minSeconds: number, cues: string[], lines: CineLine[] = []): CineShot => ({ id, camera, anchor, framing, cues, lines, minSeconds });

/* ===== Mission 1 - When the Sky Breaks ===== */
const M1: Cinematic = {
  id: "m1-opening", mission: 1, part: "opening", title: "The night the world changed", target: [75, 90],
  trigger: "start of the first playable mission, before the first enemy encounter",
  shots: [
    S("m1-s1-skyline", "crane", "neon-core-skyline", "Glide between skyscrapers above rain-soaked streets; holographic ads flicker.", 12,
      ["Low-frequency sound rolls through the city; windows vibrate.", "Traffic stops. Every screen goes black.", "A thin violet line appears across the sky."], [L("Civilian", "What is that?")]),
    S("m1-s2-fracture", "dolly", "neon-core-sky", "Slow push toward the sky as the line splits into hundreds of glowing seams.", 12,
      ["Space bends inward; part of the skyline overlaps a ruined version of itself.", "The sound cuts out completely.", "Then the sky breaks."]),
    S("m1-s3-shockwave", "plunge", "neon-core-street", "Plunge to street level as a shockwave throws vehicles sideways.", 9,
      ["Emergency lights ignite.", "Strange silhouettes descend through the fracture.", "The operator is thrown against a vehicle."]),
    S("m1-s4-hand", "closeup", "player-hand", "Stay close on the operator's hand as violet energy crawls across the fingers.", 10,
      ["Static on the HUD frame."], [L(N, "Signal detected. (distorted)"), L(N, "Unknown Resonance signature. Attempting connection.")]),
    S("m1-s5-watcher", "static", "street-armored-figure", "The operator looks up: an armored figure across the street, watching, not attacking.", 9,
      ["A building collapses between them.", "The figure is gone."]),
    S("m1-s6-awakening", "closeup", "fallen-civilian", "The operator reaches for a fallen civilian; violet energy forms a protective field as debris falls.", 15,
      ["The HUD flickers into existence."], [L(N, "You survived direct exposure."), L(N, "That should not be possible."), L(N, "Connection established. I am NOVA. If you can hear me, we need to move. Now.")]),
    S("m1-s7-hostile", "pull-behind", "player-back", "Camera pulls behind the player; the HUD stabilizes; an enemy steps through the smoke.", 9,
      [], [L(N, "Incoming hostile. Weapon system available. Show me what you can do.")]),
  ],
  handoff: { objective: "Survive the breach.", control: "gameplay", hook: { system: "first enemy encounter of the opening mission (existing tutorial/awakening combat)", exists: true, note: "The repo's first mission is the tutorial trial chamber + Awakening (Veridan forest); the Neon Core setting is new staging and needs a decision (see docs/cinematics.md)." } },
};

/* ===== Mission 2 - No One Left Behind ===== */
const M2: Cinematic = {
  id: "m2-evac", mission: 2, part: "opening", title: "The evacuation corridor", target: [35, 45],
  trigger: "start of the civilian rescue mission",
  shots: [
    S("m2-s1-corridor", "track", "evac-street", "Tracking shot into a smoke-filled street; civilians crowd behind an overturned transit vehicle.", 18,
      ["Sirens. An emergency worker holds a barricade while enemies advance through the intersection."],
      [L("Evacuation Worker", "We have people trapped inside! The eastern route is gone!"), L(N, "Three hostile signals approaching. Civilian life signs detected behind that vehicle."), L(N, "I can mark a route, but I cannot guarantee everyone makes it. Your call.")]),
    S("m2-s2-routes", "rise", "evac-street-wide", "Reveal two paths: a dangerous street crossing and a damaged service passage.", 6, ["Both routes are highlighted briefly."]),
    S("m2-s3-survivor", "closeup", "survivor", "The operator approaches; a frightened survivor grabs their arm.", 14,
      ["NOVA highlights the rescue route."], [L("Survivor", "Please. My brother is still in there."), L(N, "I have a route. It will take you through the service passage. Keep them moving and watch the rooftops.")]),
  ],
  handoff: { objective: "Evacuate the survivors.", control: "gameplay", hook: { system: "civilian rescue objectives (rescue, hostiles, optional diversions)", exists: false, note: "No civilian-rescue mission exists in src/game/missions; the six machines are awakening, broken-signal, blackout-protocol, stitched-neon-core, descent-protocol, system-core." } },
};

/* ===== Mission 3 - Resonance ===== */
const M3: Cinematic = {
  id: "m3-facility", mission: 3, part: "opening", title: "Project World Anchor", target: [45, 60],
  trigger: "arrival at the research facility",
  shots: [
    S("m3-s1-elevator", "dolly", "freight-elevator", "Freight elevator descends; emergency lighting sweeps abandoned laboratory floors; walls grow more damaged.", 14, [],
      [L(N, "This facility predates the public Fracture response."), L(P, "They knew it was coming?"), L(N, "I said the facility predates the response. I did not say why it was built.")]),
    S("m3-s2-chamber", "static", "containment-chamber", "The elevator stops; doors open on a containment chamber.", 4, ["A holographic console activates as the operator approaches."]),
    S("m3-s3-briefing", "closeup", "holo-console", "Fragments of a recorded briefing play over the console.", 20, ["The recording breaks into static; the console goes dark."],
      [L("Recorded Scientist", "Project World Anchor was designed to stabilize reality across overlapping dimensional layers. The Resonance trials were not failures. They were producing measurable results."), L("Unknown Researcher", "If the Anchor activates, something on the other side will notice."), L(P, "NOVA, who was that?"), L(N, "I cannot identify the speaker. But the file has been deliberately damaged.")]),
    S("m3-s4-alarm", "pull-behind", "containment-glass", "A containment alarm sounds; something moves behind the glass.", 7, [], [L(N, "We have company. And whatever they were keeping here is no longer contained.")]),
  ],
  handoff: { objective: "Investigate Project World Anchor.", control: "gameplay", hook: { system: "facility exploration and containment encounter", exists: false, note: "Closest existing content is the stitched-neon-core mission; no 'Project World Anchor' facility or containment encounter exists in the repo." } },
};

/* ===== Mission 4 - Choose Your Discipline ===== */
const M4: Cinematic = {
  id: "m4-training", mission: 4, part: "training", title: "The training chamber", target: [45, 60],
  trigger: "entering the operator training facility",
  shots: [
    S("m4-s1-stations", "orbit", "training-chamber", "Three operator stations activate, projecting holographic silhouettes.", 28, ["The first projection steps forward: a massive armored combatant.", "The second appears in a burst of movement.", "The third unfolds a holographic tactical interface."],
      [L(N, "Your Resonance is changing. We need to understand how you control it before it controls you."), L(N, "Goliath. Defense, endurance, and frontline control."), L(N, "Nyx. Mobility, precision, and rapid engagement."), L(N, "Cipher. Intellect, tactical systems, and battlefield manipulation.")]),
    S("m4-s2-choice", "orbit", "training-chamber-center", "Circle the three silhouettes, then return to the player at the selection interface.", 20, [],
      [L(N, "These are not costumes. Your discipline determines how you approach a fight. Your equipment will determine how far you can push it."), L(P, "And if I choose wrong?"), L(N, "Then we learn. But choose deliberately.")]),
  ],
  handoff: { objective: "Complete your discipline trial.", control: "class-select", hook: { system: "existing character/class selection (Identity Forge), then the discipline trial", exists: true, note: "In the repo the class is chosen in Character creation before the tutorial; a mid-campaign choice would be a second entry into the same forge screen." } },
};
const M4B: Cinematic = {
  id: "m4-transmission", mission: 4, part: "transmission", title: "Incoming transmission", target: [8, 16],
  trigger: "after the discipline trial is completed",
  shots: [S("m4b-s1", "static", "training-chamber-console", "A signal interrupts the facility.", 4, ["The transmission terminates."],
    [L(N, "Incoming transmission. Origin: Nexus City."), L("Unknown Transmission", "If the Resonant is alive, bring them to the Anchor. Do not let them enter the city alone.")])],
  handoff: { objective: "Complete your discipline trial.", control: "gameplay", hook: { system: "mission 4 trial completion", exists: false, note: "No discipline-trial mission exists; this only presents the transmission and leaves mission state alone." } },
};

/* ===== Mission 5 - The City That Survived ===== */
const M5: Cinematic = {
  id: "m5-road", mission: 5, part: "road-and-ambush", title: "The road to Nexus", target: [45, 60],
  trigger: "convoy departs for Nexus City",
  shots: [
    S("m5-s1-convoy", "track", "convoy-road", "Armored convoy through the ruins beyond Neon City; camera sweeps damaged vehicles, fractured terrain, structures suspended above the horizon.", 26, [],
      [L(N, "Nexus City maintained its defensive grid after the first breach. If anyone understands what happened, it will be there."), L(P, "You sound hopeful."), L(N, "I am calculating probabilities."), L(N, "Hope is not a measurable variable.")]),
    S("m5-s2-ambush", "dolly", "convoy-narrows", "The convoy enters a narrow stretch of road; an explosion erupts ahead; the lead vehicle swerves; enemy fire tears across the convoy; a massive machine pushes through the smoke.", 18,
      ["Explosion ahead."], [L("Convoy Commander", "Roadblock! Everyone off the main vehicle!"), L(N, "Heavy hostile detected. Its armor is reinforced. We need to disable its systems before it destroys the convoy.")]),
    S("m5-s3-step", "track", "player-road", "Track the player stepping into the road as the enemy turns toward them.", 4, []),
  ],
  handoff: { objective: "Protect the convoy.", control: "gameplay", hook: { system: "the existing 'Roadbreaker' encounter", exists: false, note: "No encounter named Roadbreaker exists in src; convoys exist (lanes.ts / director) but not as an authored Roadbreaker boss. It must be created or an existing encounter chosen." } },
};
const M5B: Cinematic = {
  id: "m5-gates", mission: 5, part: "gates", title: "The gates of Nexus", target: [20, 40],
  trigger: "the convoy survives the ambush", titleCard: "WORLD FRACTURE · Act I - End",
  shots: [
    S("m5b-s1-walls", "rise", "nexus-walls", "Rise above Nexus City's enormous walls: functioning power grids, patrols, fortified entrances. The convoy approaches the gate; turrets track the player.", 8, ["A scanner sweeps over the operator: violet, then red.", "Weapons rise along the wall."],
      [L("Nexus Security", "Stop the convoy. Resonance signature confirmed."), L("Convoy Commander", "We brought you the information you requested."), L("Nexus Security", "We did not request this.")]),
    S("m5b-s2-officer", "static", "gate-hologram", "A gate officer appears on a holographic display.", 8, [],
      [L("Nexus Officer", "Identify yourself. Explain the signature. And tell us why our sensors detected the same energy pattern beneath the city."), L(N, "I believe we have found the reason they survived. (private channel)")]),
    S("m5b-s3-black", "static", "black", "The gate remains closed. Cut to black. Title card.", 3, ["Cut to black."]),
  ],
  handoff: { objective: "Act I complete.", control: "gameplay", hook: { system: "post-Act I free play / next quest", exists: false, note: "Nexus City exists as a world; the Act I end state and what unlocks next must be chosen." } },
};

export const CINEMATICS: readonly Cinematic[] = [M1, M2, M3, M4, M4B, M5, M5B];
export const cinematicById = (id: string) => CINEMATICS.find((c) => c.id === id);

/* ------------------------------ played state (once-keyed story flag) ------------------------------ */
export const playedFlag = (id: string) => `cine:${id}`;
export const hasPlayed = (s: StoryState, id: string) => hasFlag(s, playedFlag(id));
/** a cinematic plays automatically once per save; dev tools can force a replay without touching the saved state */
export const shouldPlay = (s: StoryState, id: string, force = false) => force || !hasPlayed(s, id);
export const markPlayed = (s: StoryState, id: string): StoryState => applyEffects(s, [{ flag: playedFlag(id) }]);

/* ------------------------------ player state machine ------------------------------ */
export type PlayerStatus = "playing" | "paused" | "done";
export type CinePlayer = { id: string; status: PlayerStatus; elapsed: number; skipped: boolean; /** set exactly once, when the scene ends */ handoff: Handoff | null; handedOff: boolean };
export function startCinematic(c: Cinematic): CinePlayer { return { id: c.id, status: "playing", elapsed: 0, skipped: false, handoff: null, handedOff: false }; }
const finish = (p: CinePlayer, c: Cinematic, skipped: boolean): CinePlayer => ({ ...p, status: "done", skipped, handoff: p.handedOff ? null : c.handoff, handedOff: true, elapsed: skipped ? cinematicSeconds(c) : p.elapsed });
/** advance by dt seconds (ignored while paused or done). The handoff is produced exactly once, on the step that ends the scene. */
export function stepCinematic(p: CinePlayer, c: Cinematic, dt: number): CinePlayer {
  if (p.status !== "playing" || !(dt > 0)) return p.handoff ? { ...p, handoff: null } : p;
  const elapsed = p.elapsed + dt;
  return elapsed >= cinematicSeconds(c) ? finish({ ...p, elapsed }, c, false) : { ...p, elapsed };
}
/** Esc / B / skip button: ends the scene at once with the same valid handoff; skipping twice or after the end does nothing. */
export const skipCinematic = (p: CinePlayer, c: Cinematic): CinePlayer => (p.status === "done" ? (p.handoff ? { ...p, handoff: null } : p) : finish(p, c, true));
export const pauseCinematic = (p: CinePlayer): CinePlayer => (p.status === "playing" ? { ...p, status: "paused" } : p);
export const resumeCinematic = (p: CinePlayer): CinePlayer => (p.status === "paused" ? { ...p, status: "playing" } : p);

export type Inspection = { shotIndex: number; shot: CineShot; shotElapsed: number; lineIndex: number; line: CineLine | null; progress: number };
/** what is on screen right now (for the subtitle layer, the camera and the dev inspector); null once finished */
export function inspectCinematic(p: CinePlayer, c: Cinematic): Inspection | null {
  if (p.status === "done") return null;
  let t = p.elapsed;
  for (let i = 0; i < c.shots.length; i++) {
    const shot = c.shots[i]!, len = shotSeconds(shot);
    if (t < len) {
      const starts = lineStarts(shot);
      let lineIndex = -1;
      shot.lines.forEach((l, k) => { if (t >= starts[k]! && t < starts[k]! + lineSeconds(l.text)) lineIndex = k; });
      return { shotIndex: i, shot, shotElapsed: t, lineIndex, line: lineIndex >= 0 ? shot.lines[lineIndex]! : null, progress: len ? t / len : 1 };
    }
    t -= len;
  }
  return null;
}
/** smoothstep for camera moves (Scene applies it between the shot's resolved anchors) */
export const ease = (t: number) => { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x); };
