/** First-visit Operations Hub intros — the "meet your vendors, learn your playlists" beat
 * (Destiny's Tower tour + Strikes/Crucible/Gambit explainer, adapted to this game's own systems:
 * Dungeon Operations, the Arsenal's vendor districts, the Ability Network, World/Director systems,
 * and Social/PvP/Raid). Shown once the first time the hub opens, then never again. Client-local
 * presentation only (like bindings.ts/camera) — never synced to player_saves. */
const STORAGE_KEY = "world-fracture-hub-intros-seen";

export type HubView = "DUNGEONS" | "ARSENAL" | "ABILITIES" | "WORLD" | "SOCIAL";
export type HubTourStop = { view: HubView; title: string; body: string };

export const HUB_TOUR: readonly HubTourStop[] = [
  { view: "DUNGEONS", title: "Dungeon Operations", body: "Your core playlist. Queue scripted dungeon runs and class field trials here — solo or with a local fireteam." },
  { view: "ARSENAL", title: "Arsenal & vendor districts", body: "Four vendors, four districts: Scrap-Market, Faction Quarter, Singularity Exchange, and the Black-Market Node. Stock rotates daily — check back for new gear." },
  { view: "ABILITIES", title: "Ability Network", body: "Spend mastery to unlock and equip Primary, Tactical, and Ultimate abilities, then branch them once they level up." },
  { view: "WORLD", title: "World & Director", body: "See how the living world reacts to you — biomes, layers, and the AI Director's current read on the fight." },
  { view: "SOCIAL", title: "Social, PvP & Raid", body: "Your guild, competitive modes, and the Fracture Raid — the endgame fireteam encounter." },
] as const;

/** Teach-test-twist pacing: each hub section introduces itself once, the first time it is opened,
 * instead of front-loading all five explainers on first entry. */
function readSeen(): HubView[] {
  if (typeof window === "undefined") return HUB_TOUR.map((stop) => stop.view);
  try { const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]"); return Array.isArray(raw) ? raw : []; } catch { return HUB_TOUR.map((stop) => stop.view); }
}

export function hubStopFor(view: HubView): HubTourStop | null {
  return readSeen().includes(view) ? null : HUB_TOUR.find((stop) => stop.view === view) ?? null;
}

export function markHubStopSeen(view: HubView) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(new Set([...readSeen(), view])))); } catch { /* ignore */ }
}
