/** Director sound cues (pure data): each destination answers in its own voice when it is selected or opened — a cold
 * chime for Frostspire, a low rumble for Ember, sonar for Thalassia, a synth blip for Neon. audio.ts plays them through the
 * procedural synth (no files to load). */
export type DirectorCue = { f0: number; f1: number; wave: OscillatorType; noise: number; /** noise band centre, Hz (0 = none) */ band: number };
export const DIRECTOR_CUES: Readonly<Record<string, DirectorCue>> = {
  nexus: { f0: 660, f1: 990, wave: "triangle", noise: 0, band: 0 },
  "neon-city": { f0: 880, f1: 1760, wave: "square", noise: 0.1, band: 5200 },
  thalassia: { f0: 1200, f1: 600, wave: "sine", noise: 0.15, band: 700 },
  veridan: { f0: 520, f1: 780, wave: "sine", noise: 0.25, band: 3000 },
  frostspire: { f0: 1560, f1: 2340, wave: "sine", noise: 0.2, band: 7000 },
  ember: { f0: 110, f1: 70, wave: "sawtooth", noise: 0.45, band: 250 },
  wastelands: { f0: 220, f1: 165, wave: "sawtooth", noise: 0.4, band: 1200 },
  solara: { f0: 740, f1: 1110, wave: "triangle", noise: 0.3, band: 4000 },
  swamps: { f0: 180, f1: 140, wave: "triangle", noise: 0.35, band: 600 },
};
const FALLBACK: DirectorCue = { f0: 600, f1: 900, wave: "sine", noise: 0, band: 0 };
export const directorCue = (id: string | null | undefined): DirectorCue => (id && DIRECTOR_CUES[id]) || FALLBACK;
/** how each action shapes the cue: opening a map sweeps up and lasts longer, back sweeps down */
export const CUE_SHAPE = { select: { dur: 0.09, up: 1 }, open: { dur: 0.28, up: 1 }, back: { dur: 0.12, up: -1 } } as const;
export type CueAction = keyof typeof CUE_SHAPE;
