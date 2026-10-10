import { ZONE_COLOR, ZONE_LABEL } from "@/game/world";
import { LANDMARKS } from "@/game/landmarks";
import { MARKER_COLOR, type MarkerKind } from "@/game/waypoints";
import { LANDMARK_GLYPH, LANDMARK_NAME, MARKER_GLYPH, MARKER_NAME, legendLandmarkTypes } from "@/game/map-symbols";

export { LANDMARK_GLYPH };
const LANDMARK_TYPES = legendLandmarkTypes([...new Set(LANDMARKS.map((l) => l.type))]);
const CYCLE: [string, string][] = [["Day", "#ffe27a"], ["Sunset", "#ff9a4d"], ["Night", "#5a6fd6"], ["Moonlight", "#b9d4ff"], ["Storm", "#7a8aa6"], ["Fog", "#c8d0d8"]];

/** Atlas legend. Every entry is drawn from the same tables the map pins use (map-symbols.ts, ZONE_COLOR, MARKER_COLOR): regions are a coloured dot inside a dashed
 * zone circle, live markers use the chip glyphs, landmarks use their type glyph. */
export function MapLegend({ phase }: { phase: string }) {
  return <div className="mt-3 grid gap-3 border border-border bg-card/40 p-3 text-xs sm:grid-cols-3" aria-label="Map legend">
    <div><p className="ui-kicker">Regions</p><ul className="mt-1 space-y-1">{(["safe", "starter", "war", "fracture", "core"] as const).map((k) => <li key={k} className="flex items-center gap-2"><span className="inline-flex size-4 items-center justify-center rounded-full border border-dashed" style={{ borderColor: ZONE_COLOR[k] }}><span className="size-2 rounded-full" style={{ background: ZONE_COLOR[k] }} /></span>{ZONE_LABEL[k]}</li>)}</ul>
      <p className="ui-kicker mt-3">Cycle</p><ul className="mt-1 space-y-1">{CYCLE.map(([label, color]) => <li key={label} className={`flex items-center gap-2 ${label === phase ? "font-semibold text-primary" : ""}`}><span className="inline-block size-3 rounded-full" style={{ background: color }} />{label}{label === phase && " · now"}</li>)}</ul></div>
    <div><p className="ui-kicker">Live markers</p><ul className="mt-1 space-y-1">{(["MISSION", "RESOURCE", "BOSS", "RUIN"] as MarkerKind[]).map((k) => <li key={k} className="flex items-center gap-2"><span className="w-4 text-center" style={{ color: MARKER_COLOR[k] }}>{MARKER_GLYPH[k]}</span>{MARKER_NAME[k]}</li>)}
      <li className="flex items-center gap-2"><span className="w-4 text-center text-destructive">⚠</span>Hazard zone (dashed red)</li>
      <li className="flex items-center gap-2"><span className="inline-block size-3 w-4 rounded-full border-2 border-black bg-white" />You</li>
      <li className="flex items-center gap-2"><span className="inline-block h-0 w-4 border-t-2 border-dashed" style={{ borderColor: "#f3e2b0" }} />Supply road</li>
      <li className="flex items-center gap-2"><span className="inline-block h-0 w-4 border-t-2 border-dotted" style={{ borderColor: MARKER_COLOR.LANDMARK }} />Landmark trail</li></ul></div>
    <div><p className="ui-kicker">Landmarks (once found)</p><ul className="mt-1 grid grid-cols-1 gap-y-1">{LANDMARK_TYPES.map((t) => <li key={t} className="flex items-center gap-2"><span className="w-4 text-center" style={{ color: MARKER_COLOR.LANDMARK }}>{LANDMARK_GLYPH[t]}</span>{LANDMARK_NAME[t]}</li>)}</ul></div>
  </div>;
}
