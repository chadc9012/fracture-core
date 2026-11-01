import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { ArrowLeft, Layers, LocateFixed, MapPin, Minus, Navigation, Plus, X } from "lucide-react";
import { CARTO_MAPS, COVER_COLOR, COVER_LABEL, SAT_COLOR, cartoBounds, cartoMap, type CartoMap, type CartoMapId, type Cover } from "@/game/carto-maps";
import { POI_GROUPS, POI_STYLE, USE_STYLE, cartoFeatures, type BuildingUse, type CartoBuilding, type CartoPoi, type PoiCat, type RoadClass } from "@/game/carto-features";
import { cartoScaleBar, clampView, placeCartoLabels, viewWindow, zoomAt, type CartoView, type LabelIn } from "@/game/carto-view";
import { getPin, setPin } from "@/game/map-pin";
import { useCartoMap, type CartoStyle } from "./useCartoMap";

/** A street map of one city or region in the look of a web street map: the land-cover image (forest, desert, snow, lava, marsh,
 * city ground) with white streets, buildings coloured by use, points of interest with icons and names that never overlap.
 * Drag to pan, pinch or wheel to zoom; chips pick the map and filter the places. Owner, Nov 1 ("same quality level as Google Maps"). */
const ROAD: Record<RoadClass, { fill: string; casing: string; min: number; dash?: string; fillDash?: string }> = {
  highway: { fill: "#fcd462", casing: "#e3a93a", min: 4 }, main: { fill: "#ffffff", casing: "#c9c9c9", min: 3 }, street: { fill: "#ffffff", casing: "#d6d6d6", min: 2 },
  track: { fill: "#c8ad85", casing: "#c8ad85", min: 1.6, dash: "5 4" }, runway: { fill: "#8d9299", casing: "#6f747b", min: 5 }, taxiway: { fill: "#a7acb2", casing: "#8d9299", min: 2 },
  bridge: { fill: "#ffffff", casing: "#8f969d", min: 4 }, boardwalk: { fill: "#c79a63", casing: "#a07444", min: 2 },
  rail: { fill: "#ffffff", casing: "#7b8188", min: 3, fillDash: "8 6" }, trail: { fill: "#a07444", casing: "#a07444", min: 1.4, dash: "3 3" },
  powerline: { fill: "#8a8f96", casing: "#8a8f96", min: 1, dash: "1 7" }, race: { fill: "#d0287f", casing: "#d0287f", min: 1.6, dash: "7 5" },
  skybridge: { fill: "#e9e4f7", casing: "#9a8fc0", min: 2.5 },
};
const AREA_STYLE: Record<string, { color: string; italic?: boolean; upper?: boolean; weight?: number; size: number }> = {
  city: { color: "#202124", weight: 700, size: 17 }, district: { color: "#5f6368", upper: true, weight: 600, size: 11 }, mountain: { color: "#6d4c41", italic: true, weight: 600, size: 15 },
  valley: { color: "#6d4c41", italic: true, size: 12 }, lake: { color: "#1967d2", italic: true, size: 12 }, sea: { color: "#1967d2", italic: true, size: 13 }, desert: { color: "#8a5a19", italic: true, weight: 600, size: 14 },
  forest: { color: "#2e7d32", italic: true, weight: 600, size: 13 }, lava: { color: "#c2410c", italic: true, weight: 600, size: 13 }, snow: { color: "#546e7a", italic: true, size: 12 }, marsh: { color: "#33691e", italic: true, weight: 600, size: 13 },
  river: { color: "#1967d2", italic: true, size: 11 }, hazard: { color: "#d93025", italic: true, weight: 600, size: 11 },
};
const LEGEND_COVERS: Cover[] = ["sea", "river", "lake", "wash", "beach", "meadow", "forest", "denseForest", "desert", "dunes", "dirt", "sandstone", "rock", "cliff", "snow", "ice", "ash", "basalt", "lava", "magma", "marsh", "urban"];
/** rooftops seen from orbit: greys and tar, a tint of the use */
const SAT_ROOF: Record<BuildingUse, readonly [string, string]> = {
  apartment: ["#9b948a", "#5c564e"], house: ["#8a5a48", "#4e3328"], store: ["#a7b0b8", "#5d656c"], mall: ["#b9c2ca", "#6a737b"], school: ["#a58e6a", "#5d4f39"],
  entertainment: ["#8f6e86", "#4e3a49"], office: ["#7f868e", "#454b51"], civic: ["#b3aa98", "#6a6252"], industrial: ["#80796f", "#4a453e"], transport: ["#8e979f", "#525960"],
  garage: ["#6e7176", "#3e4044"], dome: ["#a8d6e2", "#5fa3b6"],
};
const LEGEND_USES: BuildingUse[] = ["apartment", "house", "store", "mall", "school", "entertainment", "office", "civic", "industrial", "transport"];

/** places you can fast travel to from the map: open ground, never water, lava, a hazard or a peak */
const TRAVEL_CATS = new Set<PoiCat>(["terminal", "port", "airport", "transit", "village", "camp", "outpost", "park", "landmark", "viewpoint", "ruins", "temple", "research", "store", "mall", "school", "university", "entertainment", "casino", "nightclub", "civic", "garage", "dock", "arena", "wreck", "station"]);

export function CartoMapView({ initial, px, pz, onClose, onTravel, travelOk }: {
  initial?: string | null | undefined; px: number; pz: number; onClose: () => void;
  /** fast travel to a place (the planet map passes this; the in-world atlas does not) */
  onTravel?: ((poi: CartoPoi, map: CartoMap) => void) | undefined;
  /** may you fast travel into this map (you have made landfall there)? a reason when not */
  travelOk?: ((map: CartoMap) => string | null) | undefined;
}) {
  const [mapId, setMapId] = useState<CartoMapId>(() => (cartoMap(initial ?? "")?.id ?? "nexus"));
  const m = cartoMap(mapId)!;
  const b = useMemo(() => cartoBounds(m), [m]);
  const feats = useMemo(() => cartoFeatures(m), [m]);
  const [style, setStyle] = useState<CartoStyle>("map");
  const mapArt = useCartoMap(mapId), satArt = useCartoMap(mapId, style);
  const sat = style === "satellite";
  const art = sat && satArt.url ? satArt : mapArt;
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 360, h: 640 });
  const [view, setView] = useState<CartoView>({ cx: m.x, cz: m.z, zoom: 1 });
  const [off, setOff] = useState<Set<string>>(() => new Set());
  const [picked, setPicked] = useState<CartoPoi | CartoBuilding | null>(null);
  const [legend, setLegend] = useState(false);
  // open filling the screen (a phone in portrait would otherwise show sea above and below the square map); cities a step closer
  useEffect(() => { const fill = Math.max(size.w, size.h) / Math.max(1, Math.min(size.w, size.h)); setView({ cx: m.x, cz: m.z, zoom: Math.max(1, fill) }); setPicked(null); }, [m]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setView((v) => (v.zoom < 1.01 ? { ...v, zoom: Math.max(v.zoom, Math.max(size.w, size.h) / Math.max(1, Math.min(size.w, size.h))) } : v)); }, [size]);
  useEffect(() => {
    const el = box.current; if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el); setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } }; window.addEventListener("keydown", k, true); return () => window.removeEventListener("keydown", k, true); }, [onClose]);

  const win = viewWindow(b, view, size.w, size.h);
  const S = (x: number, z: number): [number, number] => [(x - win.x0) * win.ppm, (z - win.z0) * win.ppm];
  const ppm = win.ppm;

  // gestures: one pointer pans, two pinch, wheel zooms at the cursor
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const last = useRef<{ x: number; y: number; d: number } | null>(null);
  const moved = useRef(0);
  const onDown = (e: RPointerEvent) => { (e.target as Element).setPointerCapture?.(e.pointerId); pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); last.current = null; moved.current = 0; };
  const onMove = (e: RPointerEvent) => {
    if (!pts.current.has(e.pointerId)) return;
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const list = [...pts.current.values()], r = box.current!.getBoundingClientRect();
    const cx = list.reduce((a, p) => a + p.x, 0) / list.length - r.left, cy = list.reduce((a, p) => a + p.y, 0) / list.length - r.top;
    const d = list.length > 1 ? Math.hypot(list[0]!.x - list[1]!.x, list[0]!.y - list[1]!.y) : 0;
    const prev = last.current;
    last.current = { x: cx, y: cy, d };
    if (!prev) return;
    moved.current += Math.hypot(cx - prev.x, cy - prev.y);
    setView((v) => {
      let nv = clampView(b, { ...v, cx: v.cx - (cx - prev.x) / win.ppm, cz: v.cz - (cy - prev.y) / win.ppm });
      if (d > 0 && prev.d > 0) nv = zoomAt(b, nv, size.w, size.h, cx, cy, d / prev.d);
      return nv;
    });
  };
  const onUp = (e: RPointerEvent) => { pts.current.delete(e.pointerId); last.current = null; };
  const onWheel = (e: React.WheelEvent) => { const r = box.current!.getBoundingClientRect(); setView((v) => zoomAt(b, v, size.w, size.h, e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015))); };
  const zoomBy = (f: number) => setView((v) => zoomAt(b, v, size.w, size.h, size.w / 2, size.h / 2, f));

  const poiOn = (c: PoiCat) => !POI_GROUPS.some((g) => off.has(g.id) && g.cats.includes(c));
  const maxRank = view.zoom < 1.5 ? 1 : view.zoom < 3.2 ? 2 : 3;
  const pois = feats.pois.filter((p) => poiOn(p.cat) && p.rank <= maxRank);
  const labels = useMemo(() => {
    const items: LabelIn[] = [
      ...feats.areas.map((a) => ({ id: `a:${a.name}:${Math.round(a.x)}`, text: AREA_STYLE[a.kind]?.upper ? a.name.toUpperCase() : a.name, x: a.x, z: a.z, rank: a.rank, size: AREA_STYLE[a.kind]?.size ?? 12 })),
      ...pois.map((p) => ({ id: `p:${p.id}`, text: p.name, x: p.x, z: p.z, rank: p.rank, size: 11, pin: true })),
      ...(ppm > 1.6 ? feats.buildings.filter((bd) => bd.name).map((bd) => ({ id: `b:${bd.name}`, text: bd.name!, x: bd.x, z: bd.z, rank: 3, size: 10 })) : []),
    ];
    return placeCartoLabels(items, S, size.w, size.h, maxRank);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feats, pois.length, view, size, off]);
  const areaKind = useMemo(() => new Map(feats.areas.map((a) => [`a:${a.name}:${Math.round(a.x)}`, a.kind])), [feats]);
  const shownPins = new Set(labels.filter((l) => l.id.startsWith("p:")).map((l) => l.id.slice(2)));

  const [ix0, iz0] = S(b.x0, b.z0), span = b.span * ppm;
  const here = Math.abs(px - m.x) < m.reach && Math.abs(pz - m.z) < m.reach;
  const bar = cartoScaleBar(ppm);
  const poly = (bd: CartoBuilding, dx = 0, dz = 0) => {
    const c = Math.cos(bd.yaw), s = Math.sin(bd.yaw);
    return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => { const lx = u! * bd.hx, lz = v! * bd.hz; const [sx, sy] = S(bd.x + lx * c + lz * s + dx, bd.z - lx * s + lz * c + dz); return `${sx.toFixed(1)},${sy.toFixed(1)}`; }).join(" ");
  };
  const rect = (x: number, z: number, hx: number, hz: number, yaw: number) => poly({ x, z, hx, hz, yaw, use: "office", h: 0 });
  const pinWaypoint = (p: { name?: string; x: number; z: number }) => setPin({ id: `carto:${Math.round(p.x)}:${Math.round(p.z)}`, label: p.name ?? "Pin", x: p.x, z: p.z, source: "MAP" });
  const pin = getPin();

  return <div className="fixed inset-0 z-[60] flex flex-col bg-[#f2efe9] text-[#202124]" role="dialog" aria-modal="true" aria-label={`${m.name} street map`} style={{ fontFamily: "Roboto, 'Segoe UI', system-ui, sans-serif" }}>
    <div className="z-10 flex items-center gap-2 bg-white px-2 py-1.5 shadow-md">
      <button type="button" className="rounded-full p-2 hover:bg-black/5" onClick={onClose} aria-label="Back to the world map"><ArrowLeft className="h-5 w-5" /></button>
      <div className="min-w-0 flex-1"><p className="truncate text-base font-medium leading-tight">{m.name}</p><p className="truncate text-xs text-[#5f6368]">{m.sub}{!art.full ? ` · drawing map ${Math.round(art.progress * 100)}%` : ""}</p></div>
      <button type="button" className={`rounded-full p-2 hover:bg-black/5 ${legend ? "bg-[#e8f0fe] text-[#1a73e8]" : ""}`} onClick={() => setLegend((l) => !l)} aria-pressed={legend} aria-label="Map key"><Layers className="h-5 w-5" /></button>
      <button type="button" className="rounded-full p-2 hover:bg-black/5" onClick={onClose} aria-label="Close map"><X className="h-5 w-5" /></button>
    </div>
    <div className="z-10 flex gap-1.5 overflow-x-auto bg-white/95 px-2 pb-1.5 pt-1" role="tablist" aria-label="Choose a map">
      {CARTO_MAPS.map((c) => <button key={c.id} type="button" role="tab" aria-selected={c.id === mapId} onClick={() => setMapId(c.id)} className={`shrink-0 rounded-full border px-3 py-1 text-xs ${c.id === mapId ? "border-[#1a73e8] bg-[#e8f0fe] text-[#1967d2]" : "border-[#dadce0] bg-white text-[#3c4043]"}`}>{c.kind === "city" ? "🏙 " : "⛰ "}{c.name}</button>)}
    </div>
    <div ref={box} className="relative min-h-0 flex-1 touch-none select-none overflow-hidden" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onWheel={onWheel}
      onClick={() => { if (moved.current < 6) setPicked(null); }}>
      <svg width={size.w} height={size.h} className="absolute inset-0" style={{ background: sat ? "#12304f" : "#9ccbf0" }}>
        {art.url && <image href={art.url} x={ix0} y={iz0} width={span} height={span} preserveAspectRatio="none" style={{ imageRendering: ppm * (b.span / 1536) > 2.5 ? "pixelated" : "auto" }} />}
        {/* streets and paved ground */}
        <g opacity={sat ? 0.92 : 1}>{feats.pavements.map((p, i) => <polygon key={i} points={rect(p.x, p.z, p.hx, p.hz, p.yaw)} fill={sat ? (p.kind === "plaza" ? "#8d8a84" : p.kind === "apron" ? "#6a6e73" : "#3e4247") : p.kind === "apron" ? "#d9dce0" : p.kind === "plaza" ? "#f4efe4" : "#ffffff"} stroke={p.kind === "street" || sat ? "none" : "#c9cdd2"} strokeWidth={1} />)}</g>
        {/* rings (Thalassia) */}
        {feats.rings.map((r, i) => { const [sx, sy] = S(r.x, r.z);
          if (r.kind === "hazard") return <circle key={i} cx={sx} cy={sy} r={r.r * ppm} fill="#d93025" fillOpacity={0.1} stroke="#d93025" strokeOpacity={0.7} strokeWidth={1.5} strokeDasharray="6 4" />;
          if (r.kind === "arena") return <circle key={i} cx={sx} cy={sy} r={r.r * ppm} fill="#e8d6b8" stroke="#a07444" strokeWidth={2} />;
          if (r.kind === "fence") return <circle key={i} cx={sx} cy={sy} r={r.r * ppm} fill="none" stroke="#8d6e63" strokeWidth={Math.max(1, 0.5 * ppm)} strokeDasharray="2 2" />;
          if (r.kind === "pad") return <circle key={i} cx={sx} cy={sy} r={Math.max(3, r.r * ppm)} fill="#e2e6ea" stroke="#8f969d" strokeWidth={1.5} />;
          return <circle key={i} cx={sx} cy={sy} r={r.r * ppm} fill={r.kind === "dome" ? "#c9ecf5" : r.kind === "dock" ? "#e2e6ea" : "none"} fillOpacity={r.kind === "dome" ? 0.85 : 1} stroke={r.kind === "ring" ? "#ffffff" : "#5fb4cc"} strokeWidth={r.kind === "ring" ? Math.max(3, 6 * ppm) : 1.5} />; })}
        {/* roads: casing then fill, widths in metres with a minimum on screen */}
        {(["casing", "fill"] as const).map((layer) => <g key={layer} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={sat ? 0.8 : 1}>{feats.roads.map((r, i) => {
          if (sat && layer === "casing" && !ROAD[r.cls].dash && !r.color) return null;
          const st = ROAD[r.cls], w = Math.max(st.min, r.width * ppm);
          const d = r.pts.map(([x, z], k) => { const [sx, sy] = S(x, z); return `${k ? "L" : "M"}${sx.toFixed(1)} ${sy.toFixed(1)}`; }).join("");
          const fill = sat ? (r.cls === "highway" ? "#f2c94c" : r.cls === "boardwalk" ? "#b48a5a" : r.cls === "runway" ? "#55595e" : st.fillDash ? "#ffffff" : "#d9d4c8") : st.fill;
          return layer === "casing" ? <path key={i} d={d} stroke={r.color ?? st.casing} strokeWidth={w + (st.dash ? 0 : 2)} strokeDasharray={st.dash} /> : !st.dash ? <path key={i} d={d} stroke={fill} strokeWidth={st.fillDash ? Math.max(1, w * 0.45) : sat ? Math.max(1.2, w * 0.7) : w} strokeDasharray={st.fillDash} /> : null;
        })}</g>)}
        {feats.roads.filter((r) => r.cls === "runway").map((r, i) => { const [a, c] = r.pts; const [x0, y0] = S(a![0], a![1]), [x1, y1] = S(c![0], c![1]); return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} stroke="#ffffff" strokeWidth={Math.max(1, 0.6 * ppm)} strokeDasharray={`${Math.max(4, 6 * ppm)} ${Math.max(4, 6 * ppm)}`} />; })}
        {/* buildings: a soft side shadow for tall ones, then the roof in its use's colour */}
        {ppm > 0.35 && <g>{feats.buildings.map((bd, i) => bd.h > 0.25 && ppm > 1 ? <polygon key={`s${i}`} points={poly(bd, bd.h * 2.2, bd.h * 2.2)} fill="#000" fillOpacity={0.1} /> : null)}
          {feats.buildings.map((bd, i) => { const st = USE_STYLE[bd.use]; const on = picked === bd; const roof = sat ? SAT_ROOF[bd.use] : null; return <polygon key={i} points={poly(bd)} fill={roof ? roof[0] : st.fill} stroke={on ? "#1a73e8" : roof ? roof[1] : st.stroke} strokeWidth={on ? 2.5 : 1} onClick={(e) => { e.stopPropagation(); if (moved.current < 6) setPicked(bd); }} />; })}</g>}
        {/* the pin and you */}
        {pin && Math.abs(pin.x - m.x) < m.reach && Math.abs(pin.z - m.z) < m.reach && (() => { const [sx, sy] = S(pin.x, pin.z); return <g transform={`translate(${sx} ${sy})`}><path d="M0 0 C-7 -10 -10 -14 -10 -20 A10 10 0 1 1 10 -20 C10 -14 7 -10 0 0Z" fill="#ea4335" stroke="#a50e0e" /><circle cy={-20} r={3.6} fill="#a50e0e" /></g>; })()}
        {/* points of interest */}
        {pois.filter((p) => shownPins.has(p.id) || p.rank === 0).map((p) => { const [sx, sy] = S(p.x, p.z), st = POI_STYLE[p.cat], on = picked === p; return <g key={p.id} transform={`translate(${sx} ${sy})`} className="cursor-pointer" onClick={(e) => { e.stopPropagation(); if (moved.current < 6) setPicked(p); }}>
          <circle r={on ? 12 : 9.5} fill={st.color} stroke="#ffffff" strokeWidth={2} />
          <text y={3.6} textAnchor="middle" fontSize={10} fill="#fff">{st.glyph}</text>
        </g>; })}
        {labels.map((l) => {
          const area = areaKind.get(l.id), st = area ? AREA_STYLE[area] : null;
          const poi = l.id.startsWith("p:") ? feats.pois.find((p) => `p:${p.id}` === l.id) : null;
          const fill = st ? st.color : poi ? POI_STYLE[poi.cat].color : "#3c4043";
          return <text key={l.id} x={l.sx} y={l.sy} textAnchor={l.anchor} fontSize={l.size} fontWeight={st?.weight ?? 500} fontStyle={st?.italic ? "italic" : undefined} letterSpacing={st?.upper ? "0.12em" : undefined} fill={sat ? "#ffffff" : fill} stroke={sat ? "#1b1f24" : "#ffffff"} strokeWidth={3} strokeLinejoin="round" paintOrder="stroke" pointerEvents="none">{l.text}</text>;
        })}
        {here && (() => { const [sx, sy] = S(px, pz); return <g transform={`translate(${sx} ${sy})`} aria-label="You are here"><circle r={22} fill="#4285f4" fillOpacity={0.16} /><circle r={8} fill="#4285f4" stroke="#ffffff" strokeWidth={3} /></g>; })()}
      </svg>
      {/* controls */}
      <div className="absolute bottom-24 right-3 flex flex-col overflow-hidden rounded-lg bg-white shadow-md">
        <button type="button" className="p-2.5 hover:bg-black/5" onClick={(e) => { e.stopPropagation(); zoomBy(1.6); }} aria-label="Zoom in"><Plus className="h-5 w-5" /></button>
        <div className="h-px bg-[#e8eaed]" />
        <button type="button" className="p-2.5 hover:bg-black/5" onClick={(e) => { e.stopPropagation(); zoomBy(1 / 1.6); }} aria-label="Zoom out"><Minus className="h-5 w-5" /></button>
      </div>
      {here && <button type="button" className="absolute bottom-10 right-3 rounded-full bg-white p-3 shadow-md hover:bg-[#f1f3f4]" onClick={(e) => { e.stopPropagation(); setView((v) => clampView(b, { ...v, cx: px, cz: pz, zoom: Math.max(v.zoom, 3) })); }} aria-label="Show where I am"><LocateFixed className="h-5 w-5 text-[#1a73e8]" /></button>}
      <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); setStyle((v) => (v === "map" ? "satellite" : "map")); }} aria-pressed={sat} aria-label={sat ? "Show the map" : "Show satellite"}
        className="absolute bottom-10 left-3 flex h-16 w-16 flex-col items-center justify-end overflow-hidden rounded-lg border-2 border-white text-[11px] font-medium text-white shadow-md"
        style={{ background: sat ? "linear-gradient(135deg,#eef1e6,#cfe3c4 50%,#9ccbf0)" : "linear-gradient(135deg,#3a5a2c,#6b6a4a 50%,#16395c)" }}>
        <span className="w-full bg-black/45 py-0.5 text-center">{sat ? "Map" : "Satellite"}</span>
      </button>
      {sat && !satArt.full && <div className="pointer-events-none absolute bottom-28 left-3 rounded bg-black/60 px-2 py-0.5 text-[10px] text-white">Loading satellite…</div>}
      <div className="pointer-events-none absolute bottom-3 left-3 rounded bg-white/85 px-1.5 py-0.5 text-[10px] text-[#3c4043]"><div className="border-x border-b border-[#3c4043]" style={{ width: bar.px, height: 5 }} />{bar.label}</div>
      {/* filter chips */}
      <div className="absolute left-0 right-0 top-2 flex gap-1.5 overflow-x-auto px-2" onPointerDown={(e) => e.stopPropagation()}>
        {POI_GROUPS.filter((g) => feats.pois.some((p) => g.cats.includes(p.cat))).map((g) => { const on = !off.has(g.id); return <button key={g.id} type="button" aria-pressed={on} onClick={(e) => { e.stopPropagation(); setOff((s) => { const n = new Set(s); if (n.has(g.id)) n.delete(g.id); else n.add(g.id); return n; }); }}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs shadow ${on ? "bg-white text-[#3c4043]" : "bg-white/60 text-[#9aa0a6] line-through"}`}><span style={{ color: POI_STYLE[g.cats[0]!].color }}>{POI_STYLE[g.cats[0]!].glyph}</span> {g.label}</button>; })}
      </div>
      {legend && <div className="absolute right-2 top-12 max-h-[60%] w-56 overflow-y-auto rounded-lg bg-white p-3 text-xs shadow-lg" onPointerDown={(e) => e.stopPropagation()}>
        <p className="mb-1 font-medium">Ground</p>
        <ul className="grid grid-cols-2 gap-x-2 gap-y-1">{LEGEND_COVERS.map((c) => <li key={c} className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm border border-black/10" style={{ background: `rgb(${(sat ? SAT_COLOR : COVER_COLOR)[c].join(",")})` }} />{COVER_LABEL[c]}</li>)}</ul>
        <p className="mb-1 mt-2 font-medium">Buildings</p>
        <ul className="grid grid-cols-2 gap-x-2 gap-y-1">{LEGEND_USES.map((u) => <li key={u} className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: USE_STYLE[u].fill, border: `1px solid ${USE_STYLE[u].stroke}` }} />{USE_STYLE[u].label}</li>)}</ul>
        <p className="mb-1 mt-2 font-medium">Roads</p>
        <ul className="space-y-1"><li><span className="mr-1.5 inline-block h-1.5 w-6 rounded bg-[#fcd462] align-middle ring-1 ring-[#e3a93a]" />Highway</li><li><span className="mr-1.5 inline-block h-1.5 w-6 rounded bg-white align-middle ring-1 ring-[#c9c9c9]" />Road / street</li><li><span className="mr-1.5 inline-block w-6 border-t-2 border-dashed border-[#c8ad85] align-middle" />Dirt track</li></ul>
      </div>}
      {/* place card */}
      {picked && <div className="absolute bottom-0 left-0 right-0 rounded-t-2xl bg-white p-4 shadow-[0_-2px_12px_rgba(0,0,0,0.18)]" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
        {"cat" in picked ? <>
          <p className="text-lg font-medium">{picked.name}</p>
          <p className="text-sm" style={{ color: POI_STYLE[picked.cat].color }}>{POI_STYLE[picked.cat].glyph} {POI_STYLE[picked.cat].label} · {m.name}</p>
          {picked.blurb && <p className="mt-1 line-clamp-3 text-sm text-[#5f6368]">{picked.blurb}</p>}
        </> : <>
          <p className="text-lg font-medium">{picked.name ?? USE_STYLE[picked.use].label.replace(/s$/, "")}</p>
          <p className="text-sm text-[#5f6368]">{USE_STYLE[picked.use].label.replace(/s$/, "")} · {Math.round(picked.hx * 2)} × {Math.round(picked.hz * 2)} m</p>
        </>}
        <div className="mt-3 flex gap-2">
          <button type="button" className="flex items-center gap-1.5 rounded-full bg-[#1a73e8] px-4 py-2 text-sm font-medium text-white" onClick={() => { pinWaypoint(picked); setPicked(null); }}><MapPin className="h-4 w-4" />Set waypoint</button>
          <button type="button" className="rounded-full border border-[#dadce0] px-4 py-2 text-sm text-[#1a73e8]" onClick={() => setView((v) => clampView(b, { ...v, cx: picked.x, cz: picked.z, zoom: Math.max(v.zoom, 4) }))}>Zoom here</button>
          {onTravel && "cat" in picked && TRAVEL_CATS.has(picked.cat) && (() => { const why = travelOk?.(m) ?? null; return <button type="button" disabled={!!why} title={why ?? undefined} className="flex items-center gap-1.5 rounded-full border border-[#dadce0] px-4 py-2 text-sm text-[#188038] disabled:text-[#9aa0a6]" onClick={() => { if (!why) onTravel(picked, m); }}><Navigation className="h-4 w-4" />{why ?? "Fast travel"}</button>; })()}
        </div>
      </div>}
    </div>
  </div>;
}
