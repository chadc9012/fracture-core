/** Destiny-style mission banners (reference: Destiny 2 "New mission" ribbon + location card, docs/ui-references.md): a slanted ribbon when a
 * scripted mission starts and a "Mission complete" card when it finishes. Pure: compares the previous and current state of every mission run
 * and returns at most one banner; GameCanvas shows it. Never changes mission state. */
export type MissionBanner = { kind: "NEW" | "COMPLETE"; title: string; subtitle: string };

export const MISSION_NAMES: Record<string, { title: string; place: string }> = {
  "awakening": { title: "Awakening", place: "Neon Core District" },
  "broken-signal": { title: "Broken Signal", place: "Verdant Forest" },
  "blackout-protocol": { title: "Blackout Protocol", place: "Nexus City" },
  "drowned-relay": { title: "The Drowned Relay", place: "The Swamps" },
  "stitched-neon-core": { title: "Stitched Neon Core", place: "Neon City" },
  "solar-array": { title: "The Solar Array", place: "Solara Desert" },
  "core-node": { title: "Core Node", place: "The Wastelands" },
  "descent-protocol": { title: "Descent Protocol", place: "Thalassia · Sentry Dock" },
  "system-core": { title: "The System Core", place: "Thalassia · Sunk-Core" },
};

const DONE = new Set(["COMPLETE", "WORLD_UPDATE"]);
const IDLE = new Set(["IDLE"]);

/** `prev`/`next`: mission id -> state (absent = no run). Returns the banner for the first mission that just started or just finished. */
export function bannerFor(prev: Record<string, string | undefined>, next: Record<string, string | undefined>): MissionBanner | null {
  for (const [id, state] of Object.entries(next)) {
    const before = prev[id];
    if (!state || state === before) continue;
    const name = MISSION_NAMES[id] ?? { title: id.replace(/-/g, " "), place: "" };
    if (state === "COMPLETE" && before && !DONE.has(before)) return { kind: "COMPLETE", title: name.title, subtitle: "Mission complete" };
    if (!IDLE.has(state) && !DONE.has(state) && (!before || IDLE.has(before))) return { kind: "NEW", title: name.title, subtitle: name.place };
  }
  return null;
}
