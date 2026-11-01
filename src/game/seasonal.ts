/**
 * Seasonal and holiday collections (owner's board, Nov 1): limited-time events with their own stock. An event runs every
 * year between its start and end (month/day, in the player's local calendar); while it runs, its cosmetics (cosmetics.ts,
 * `event`), clothing sets (clothing-sets.ts, `event`) and armour (Frostveil Knight in winter) can be bought or earned, and
 * what you got stays yours. Pure dates and lookups, no clock of its own.
 */
export type SeasonalEvent = { id: string; name: string; theme: string; start: [month: number, day: number]; end: [month: number, day: number]; weaponSkin: string; palette: [string, string] };

export const SEASONAL_EVENTS: readonly SeasonalEvent[] = [
  { id: "newyear", name: "New Year's", theme: "Fireworks, celebration", start: [12, 30], end: [1, 7], weaponSkin: "Starburst", palette: ["#ffd25a", "#ff8a3a"] },
  { id: "lunar", name: "Lunar Festival", theme: "Dragons, lanterns, red and gold", start: [1, 25], end: [2, 12], weaponSkin: "Lantern Dragon", palette: ["#c8202a", "#ffd25a"] },
  { id: "valentines", name: "Valentine's", theme: "Love, hearts", start: [2, 7], end: [2, 16], weaponSkin: "Heartstring", palette: ["#e0304a", "#ff8ac0"] },
  { id: "stpatricks", name: "St. Patrick's", theme: "Luck, green", start: [3, 12], end: [3, 20], weaponSkin: "Shamrock", palette: ["#2f9a3a", "#59ff7a"] },
  { id: "spring", name: "Spring / Easter", theme: "Fresh, floral, pastel", start: [3, 25], end: [4, 15], weaponSkin: "Blossom", palette: ["#f5b8d0", "#b8e8a0"] },
  { id: "summer", name: "Summer Festival", theme: "Beach, tropical, vibrant", start: [6, 20], end: [7, 20], weaponSkin: "Tropic", palette: ["#ff5a8a", "#ffd25a"] },
  { id: "independence", name: "Independence", theme: "Fireworks, patriot", start: [6, 30], end: [7, 7], weaponSkin: "Stars & Stripes", palette: ["#2a3a8a", "#c82a2a"] },
  { id: "anniversary", name: "Anniversary", theme: "Exclusive, premium gold", start: [10, 20], end: [11, 3], weaponSkin: "First Light", palette: ["#ffe08a", "#ffd25a"] },
  { id: "halloween", name: "Halloween Collection", theme: "Spooky, dark, haunted", start: [10, 15], end: [11, 2], weaponSkin: "Jack-o'-lantern", palette: ["#c85a14", "#7a3aff"] },
  { id: "dayofthedead", name: "Day of the Dead", theme: "Calaveras, marigolds", start: [10, 28], end: [11, 4], weaponSkin: "Calavera", palette: ["#f2f2f2", "#e0304a"] },
  { id: "harvest", name: "Harvest", theme: "Autumn, festival", start: [9, 20], end: [10, 14], weaponSkin: "Reaper's Edge", palette: ["#8a4a1e", "#c88a2a"] },
  { id: "thanksgiving", name: "Thanksgiving", theme: "Harvest bounty", start: [11, 18], end: [11, 30], weaponSkin: "Bounty", palette: ["#c88a2a", "#ffb02e"] },
  { id: "winter", name: "Winter / Christmas", theme: "Festive, ice, holiday", start: [12, 1], end: [1, 6], weaponSkin: "Frostbite", palette: ["#e8f0ff", "#9fd8ff"] },
];

const dayOfYear = (month: number, day: number) => month * 40 + day; // ordering only
/** true when the local calendar date (month 1–12, day) falls in the event window; windows may wrap the new year */
export function eventRuns(e: SeasonalEvent, month: number, day: number): boolean {
  const t = dayOfYear(month, day), a = dayOfYear(e.start[0], e.start[1]), b = dayOfYear(e.end[0], e.end[1]);
  return a <= b ? t >= a && t <= b : t >= a || t <= b;
}
/** the events running on a date (local time) */
export function activeEvents(now: Date = new Date()): SeasonalEvent[] {
  const m = now.getMonth() + 1, d = now.getDate();
  return SEASONAL_EVENTS.filter((e) => eventRuns(e, m, d));
}
export const activeEventIds = (now: Date = new Date()): string[] => activeEvents(now).map((e) => e.id);
export const eventById = (id: string) => SEASONAL_EVENTS.find((e) => e.id === id);
