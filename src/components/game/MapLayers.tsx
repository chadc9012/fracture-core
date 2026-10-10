import type { ReactNode } from "react";
import { REGIONS, ZONE_COLOR, WORLD_SCALE } from "@/game/world";
import { LANES, laneSamples } from "@/game/lanes";
import { MAP_EXTENT, MAP_OCEAN_EDGE } from "@/game/terrain-map";
import { graticule, placeLabels, scaleBarMeters } from "@/game/map-labels";

/** Shared cartography for the hub star map and the in-game atlas: terrain image, faint grid, supply roads, soft region zones, markers with
 * collision-free labels, compass and scale bar. Extra overlays (mission markers, hazards, the player) go in as children, between the
 * zones and the labels, so labels always stay readable on top. Sizes derive from the map extent, so the page reads the same at any world scale. */
const E = MAP_EXTENT;
export const MAP_FONT = E * 0.032;
const MARKER_R = E * 0.011;
const LABELS = placeLabels(REGIONS.map((r) => ({ id: r.id, name: r.name.toUpperCase(), x: r.x, z: r.z })), { extent: E, fontSize: MAP_FONT, markerRadius: MARKER_R });
const GRID = graticule(E, 200);
const BAR = scaleBarMeters(E);

export function MapLayers({ art, preview, selected, recommended, onSelect, children, showZones = true }: { art: string | null; preview?: boolean; selected: string; recommended?: string | undefined; onSelect: (id: string) => void; children?: ReactNode; showZones?: boolean }) {
  const stroke = (n: number) => E * 0.0022 * n;
  return <>
    <rect x={-E} y={-E} width={E * 2} height={E * 2} fill={MAP_OCEAN_EDGE} />
    {art && <image href={art} x={-E} y={-E} width={E * 2} height={E * 2} preserveAspectRatio="none" style={{ imageRendering: "auto", filter: preview ? "blur(1.2px)" : undefined }} />}
    <g aria-hidden="true" stroke="#ffffff" strokeOpacity={0.07} strokeWidth={stroke(0.5)}>{GRID.map((v) => <g key={v}><line x1={v} y1={-E} x2={v} y2={E} /><line x1={-E} y1={v} x2={E} y2={v} /></g>)}</g>
    {LANES.map((l) => { const pts = laneSamples(l, 24).map((p) => `${p.x},${p.z}`).join(" "); return <g key={l.name} fill="none" strokeLinecap="round"><polyline points={pts} stroke="#1a1208" strokeOpacity={0.55} strokeWidth={stroke(2.4)} /><polyline points={pts} stroke="#f6e7b8" strokeOpacity={0.95} strokeWidth={stroke(1.2)} strokeDasharray={`${stroke(5)} ${stroke(3.4)}`} /></g>; })}
    {showZones && REGIONS.map((r) => {
      const on = r.id === selected, rec = r.id === recommended, color = ZONE_COLOR[r.kind];
      return <g key={r.id} onClick={() => onSelect(r.id)} className="cursor-pointer">
        <circle cx={r.x} cy={r.z} r={r.radius} fill={color} fillOpacity={on ? 0.2 : 0.05} stroke={color} strokeOpacity={on ? 0.95 : 0.45} strokeWidth={stroke(on ? 1.6 : 0.8)} strokeDasharray={on ? undefined : `${stroke(4)} ${stroke(3)}`} />
        {rec && <circle cx={r.x} cy={r.z} r={r.radius + E * 0.02} fill="none" stroke="#ffffff" strokeOpacity={0.85} strokeDasharray={`${stroke(5)} ${stroke(4)}`} strokeWidth={stroke(1.1)} />}
      </g>;
    })}
    {children}
    {REGIONS.map((r) => {
      const on = r.id === selected, rec = r.id === recommended, color = ZONE_COLOR[r.kind], label = LABELS.find((l) => l.id === r.id)!;
      return <g key={`l-${r.id}`} onClick={() => onSelect(r.id)} className="cursor-pointer">
        <circle cx={r.x} cy={r.z} r={MARKER_R * (on ? 1.35 : 1)} fill={color} stroke="#06101f" strokeWidth={stroke(1.3)} />
        <circle cx={r.x} cy={r.z} r={MARKER_R * (on ? 2.1 : 1.7)} fill="none" stroke={color} strokeOpacity={on ? 0.9 : 0.5} strokeWidth={stroke(0.9)} />
        <text x={label.x} y={label.y} textAnchor={label.anchor} fontSize={MAP_FONT} fontWeight={on ? 700 : 600} fill={on ? "#ffffff" : "#e8f0f8"} stroke="#06101f" strokeWidth={MAP_FONT * 0.2} strokeLinejoin="round" paintOrder="stroke" className="font-mono" style={{ letterSpacing: "0.06em" }}>{r.name.toUpperCase()}{rec ? " ◆" : ""}</text>
      </g>;
    })}
    <g aria-label="Compass rose" transform={`translate(${E - E * 0.1} ${-E + E * 0.1})`}>
      <circle r={E * 0.058} fill="#06101f" fillOpacity={0.55} stroke="#ffffff" strokeOpacity={0.55} strokeWidth={stroke(0.8)} />
      <polygon points={`0,${-E * 0.05} ${E * 0.014},0 0,${E * 0.012} ${-E * 0.014},0`} fill="#ff5a5a" /><polygon points={`0,${E * 0.05} ${E * 0.014},0 0,${-E * 0.012} ${-E * 0.014},0`} fill="#e8e8e8" />
      <text y={-E * 0.066} textAnchor="middle" fontSize={MAP_FONT * 0.9} fill="#ffffff" fontWeight={700} stroke="#06101f" strokeWidth={MAP_FONT * 0.16} paintOrder="stroke">N</text>
    </g>
    <g aria-label="Scale bar" transform={`translate(${-E + E * 0.05} ${E - E * 0.06})`}>
      <rect x={-E * 0.012} y={-MAP_FONT * 1.25} width={BAR + E * 0.1} height={MAP_FONT * 1.9} fill="#06101f" fillOpacity={0.5} />
      <line x1={0} y1={0} x2={BAR} y2={0} stroke="#ffffff" strokeWidth={stroke(1.6)} /><line x1={0} y1={-E * 0.01} x2={0} y2={E * 0.01} stroke="#ffffff" strokeWidth={stroke(1.6)} /><line x1={BAR} y1={-E * 0.01} x2={BAR} y2={E * 0.01} stroke="#ffffff" strokeWidth={stroke(1.6)} />
      <text x={BAR / 2} y={-MAP_FONT * 0.4} textAnchor="middle" fontSize={MAP_FONT * 0.7} fill="#ffffff" className="font-mono">{BAR >= 1000 ? `${BAR / 1000} km` : `${BAR} m`}</text>
    </g>
  </>;
}
export const MAP_VIEWBOX = `${-E} ${-E} ${E * 2} ${E * 2}`;
export { WORLD_SCALE };
