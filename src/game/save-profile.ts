/** Save profiles: the player's real save ("main") and a separate test profile used whenever the game runs with ?dev=1 (where the dev test
 * aids live) or ?profile=test. The test profile has its own local keys and never syncs to the cloud, so test runs can't overwrite or merge
 * into genuine progress (owner request after the Descent playtest marked a mission complete on the preview save). Pure key mapping. */
export type SaveProfile = "main" | "test";

export function profileFromSearch(search: string): SaveProfile {
  const q = new URLSearchParams(search);
  return q.get("dev") === "1" || q.get("profile") === "test" ? "test" : "main";
}
export function activeProfile(): SaveProfile {
  return typeof window === "undefined" ? "main" : profileFromSearch(window.location.search);
}
export const isTestProfile = () => activeProfile() === "test";
/** the storage key for `base` in the active profile (main keeps the original keys, so existing saves are untouched) */
export function profileKey(base: string, profile: SaveProfile = activeProfile()): string {
  return profile === "main" ? base : `${base}.test-profile`;
}
