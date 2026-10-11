/** Anti-vault, anti-burnout rules: story stays replayable, next step is always clear, grind tapers gently. */
import type { PlayerProgression } from "./progression";

export type ChronicleEntry = { id: string; title: string; region: string; summary: string };
/** Every campaign chapter, permanently. Nothing here is ever removed. */
export const CHRONICLE: ChronicleEntry[] = [
  { id: "mission-01", title: "First Resonance", region: "Veridan Forest", summary: "You woke inside the fracture. NOVA calibrated your Resonance and you broke the forest patrol." },
  { id: "awakening", title: "Awakening", region: "Nexus City", summary: "The Nexus core stirred. You reached the city and learned the fracture remembers every battle." },
  { id: "broken-signal", title: "Broken Signal", region: "Nexus City", summary: "A dead relay whispered coordinates. You restored the signal and found who silenced it." },
  { id: "drowned-relay", title: "The Drowned Relay", region: "Shrouded Swamps", summary: "The trace sank into the swamp. You purged a drowned Vanguard relay and put down the war-frame the swamp had grown into." },
  { id: "blackout-protocol", title: "Blackout Protocol", region: "Nexus City", summary: "The grid went dark on purpose. You held the substations until the city could breathe." },
  { id: "stitched-neon-core", title: "Stitched Neon Core", region: "Nexus City", summary: "Something was sewn into the neon core. You tore it out before it could wake." },
  { id: "solar-array", title: "Solar Array Alpha", region: "Solara Desert", summary: "You followed Neon's power into the desert, turned the mirrors back on target and shattered the anomaly feeding on the beam. It led to Nexus." },
  { id: "core-node", title: "The Core Node", region: "Nexus City", summary: "Inside the Authority's Core Node, NOVA told you what she really is, and you chose who you would stand with at the end." },
  { id: "frozen-beacon", title: "The Frozen Beacon", region: "Frostspire Mountains", summary: "The purge order came down from the high passes. You re-keyed the beacon and put down Subject Zero, the Authority's first Resonant." },
  { id: "failure-core", title: "The Failure Core", region: "Ember Peaks", summary: "You vented the reactor where containment first failed and found it had been feeding the Fracture all along." },
  { id: "convoy-breaker", title: "Convoy Breaker", region: "Wastelands", summary: "You stopped the Rust-King's fuel convoy on the Grid-Iron Highway and learned who was buying: the Fuel King." },
  { id: "descent-protocol", title: "Descent Protocol", region: "Swamps", summary: "Beneath the swamps, the vaults opened. You went down so the surface would not have to." },
  { id: "system-core", title: "The System Core", region: "Swamps", summary: "At the heart of the fracture you faced the system that wrote the war." },
];

/** The story's next missions, not feature flags — what's actually coming for your Operator, in-world. */
export const ROADMAP: { label: string; status: "LIVE" | "NEXT" | "PLANNED" }[] = [
  { label: "The System Core — the full seven-region campaign, playable start to finish right now", status: "LIVE" },
  { label: "Chronicle — every chapter you've cleared, replayable anytime, nothing ever archived", status: "LIVE" },
  { label: "Signal Beyond — NOVA has traced a transmission the System Core should not have been able to send", status: "NEXT" },
  { label: "The Silent Array — a Frostspire raid built around that signal, for a full fireteam", status: "PLANNED" },
  { label: "Fireteam Protocol — missions rebuilt so NOVA can run a whole squad through them together", status: "PLANNED" },
  { label: "Archive Seasons — new chapters added beyond the Array; everything before them stays playable", status: "PLANNED" },
];

export function nextActivity(p: Pick<PlayerProgression, "completedMissions">) {
  const next = CHRONICLE.find((c) => !p.completedMissions.includes(c.id));
  if (next) return { title: next.title, region: next.region, why: "Next chapter of the story", reward: "Mission XP + materials" };
  return { title: "Regional patrol", region: "Any destination", why: "Campaign complete — earn materials at your own pace", reward: "Materials" };
}

export const RECAP_AFTER_MS = 3 * 24 * 60 * 60 * 1000;
export function recapDue(lastPlayedIso: string | null, now: number): boolean {
  if (!lastPlayedIso) return false;
  const t = Date.parse(lastPlayedIso);
  return Number.isFinite(t) && now - t >= RECAP_AFTER_MS;
}

export function recapLine(p: Pick<PlayerProgression, "completedMissions">): string | null {
  const done = CHRONICLE.filter((c) => p.completedMissions.includes(c.id));
  const last = done[done.length - 1];
  if (!last) return null;
  const next = nextActivity(p);
  return `Welcome back. Last time: ${last.title}. ${last.summary} Next: ${next.title}, ${next.region}.`;
}

/** Repeat-activity reward factor: full for the first 10 runs today, tapering to 25%; first-ever clear pays 1.5×. */
export function repeatRewardFactor(runsToday: number, firstEver: boolean): number {
  if (firstEver) return 1.5;
  if (runsToday < 10) return 1;
  return Math.max(0.25, 1 - (runsToday - 9) * 0.15);
}
