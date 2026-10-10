import { ZONE_COLOR, ZONE_LABEL } from "@/game/world";
import type { LandmarkType } from "@/game/landmarks";

/** Glyph per landmark type, shared by the atlas pins and this legend. */
export const LANDMARK_GLYPH: Record<LandmarkType, string> = {
  hub: "◉", outpost: "▣", ruin: "✦", mountain: "▲", volcano: "◭", lake: "◒", river: "≈", forest: "♣", desert: "∴", ocean: "≋", hazard: "⚠", resource: "⬢",
};
const SYMBOLS: [LandmarkType, string][] = [
  ["hub", "City / Hub"], ["outpost", "Outpost"], ["resource", "Resource point"], ["volcano", "Volcano"], ["mountain", "Mountain"], ["river", "River / Highway"],
  ["forest", "Forest"], ["desert", "Desert"], ["ocean", "Ocean"], ["ruin", "Ruin"], ["hazard", "Hazard zone"],
];
const CYCLE: [string, string][] = [["Day", "#ffe27a"], ["Sunset", "#ff9a4d"], ["Night", "#5a6fd6"], ["Moonlight", "#b9d4ff"], ["Storm", "#7a8aa6"], ["Fog", "#c8d0d8"]];

/** Atlas legend: zone types, landmark symbols, routes and the day/weather cycle (reference: "The Fractured Earth" map). */
export function MapLegend({ phase }: { phase: string }) {
  return <div className="mt-3 grid gap-3 border border-border bg-card/40 p-3 text-xs sm:grid-cols-3" aria-label="Map legend">
    <div><p className="ui-kicker">Zones</p><ul className="mt-1 space-y-1">{(["safe", "starter", "war", "fracture", "core"] as const).map((k) => <li key={k} className="flex items-center gap-2"><span className="inline-block size-3 rounded-sm" style={{ background: ZONE_COLOR[k] }} />{ZONE_LABEL[k]}</li>)}</ul></div>
    <div><p className="ui-kicker">Symbols</p><ul className="mt-1 grid grid-cols-2 gap-x-2 gap-y-1">{SYMBOLS.map(([t, label]) => <li key={t} className="flex items-center gap-1.5"><span className="w-4 text-center text-primary">{LANDMARK_GLYPH[t]}</span>{label}</li>)}<li className="col-span-2 flex items-center gap-1.5"><span className="inline-block h-0 w-4 border-t-2 border-dashed" style={{ borderColor: "#f3e2b0" }} />Supply road</li><li className="col-span-2 flex items-center gap-1.5"><span className="inline-block h-0 w-4 border-t-2 border-dotted" style={{ borderColor: "#9fd4ff" }} />Landmark trail</li></ul></div>
    <div><p className="ui-kicker">Cycle</p><ul className="mt-1 space-y-1">{CYCLE.map(([label, color]) => <li key={label} className={`flex items-center gap-2 ${label === phase ? "font-semibold text-primary" : ""}`}><span className="inline-block size-3 rounded-full" style={{ background: color }} />{label}{label === phase && " · now"}</li>)}</ul></div>
  </div>;
}
