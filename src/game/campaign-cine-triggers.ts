/** Which campaign cinematic a boss story event opens (once-only: the caller checks the played flag). Pure. */
export type BossCineMoment = "intro" | "defeat";
const TRIGGERS: Readonly<Record<string, Readonly<Record<BossCineMoment, string>>>> = {
  "rime-alpha": { intro: "c-rime-alpha-2", defeat: "c-rime-alpha-3" },
  "dark-knight": { intro: "c-null-sovereign-2", defeat: "c-null-sovereign-8" },
};
export function bossCineFor(scenarioId: string, moment: BossCineMoment): string | null {
  return TRIGGERS[scenarioId]?.[moment] ?? null;
}
/** The finale approach plays as one run: the approach, the accusation, then the fight begins. */
export const BOSS_CINE_CHAIN: Readonly<Record<string, string>> = { "c-null-sovereign-2": "c-null-sovereign-3", "c-null-sovereign-3": "c-null-sovereign-4" };
