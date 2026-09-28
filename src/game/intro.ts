/**
 * Opening cinematic beats — replaces the previous silent ~2-second MATERIALIZE pause between
 * finishing Identity Forge and being dropped straight into the tutorial trial chamber (the
 * "instant launch-to-world jump" the roadmap called out). Pure data + a stepper so the timing
 * can be unit-tested; IntroCinematic.tsx owns the fade/transition rendering and audio cues.
 *
 * Sequence: THE FRACTURE (world already broken) -> A WORLD AT WAR (factions) -> THE SIGNAL
 * (hook) -> NOVA (first contact) — matching the "Fracture event -> NOVA first contact" beats
 * from the onboarding spec, without duplicating the Awakening/Broken Signal missions that
 * already carry the story forward once gameplay starts.
 */

export type IntroStage = { id: string; kicker: string; lines: string[]; holdSeconds: number };

export const INTRO_SEQUENCE: readonly IntroStage[] = [
  {
    id: "fracture",
    kicker: "THE FRACTURE",
    lines: ["Reality did not end. It split.", "Seven regions, severed from one timeline, now drift inside one broken world."],
    holdSeconds: 4.4,
  },
  {
    id: "factions",
    kicker: "A WORLD AT WAR",
    lines: ["Resonants. Controllers. Breakers.", "Corp Architects and Nomads scavenge whatever's left between them."],
    holdSeconds: 3.8,
  },
  {
    id: "signal",
    kicker: "THE SIGNAL",
    lines: ["Something is transmitting from inside the Fracture itself.", "It found you first."],
    holdSeconds: 3.6,
  },
  {
    id: "nova",
    kicker: "NOVA",
    lines: ["NOVA: System online.", "NOVA: Identity signature recognized. Stabilizing your resonance now."],
    holdSeconds: 4.2,
  },
];

export function introTotalSeconds(): number {
  return INTRO_SEQUENCE.reduce((sum, stage) => sum + stage.holdSeconds, 0);
}

export type IntroPosition = { index: number; stage: IntroStage; stageElapsed: number };

/** Which stage is active at `elapsed` seconds into the sequence, or null once it's finished. */
export function introStageAt(elapsed: number): IntroPosition | null {
  let t = elapsed;
  for (let i = 0; i < INTRO_SEQUENCE.length; i++) {
    const stage = INTRO_SEQUENCE[i]!;
    if (t < stage.holdSeconds) return { index: i, stage, stageElapsed: t };
    t -= stage.holdSeconds;
  }
  return null;
}
