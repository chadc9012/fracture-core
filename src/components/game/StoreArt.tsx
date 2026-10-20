import { DESIGNS, GARAGE_BAYS, type HomeStyle } from "@/game/residences";
import type { HomeKind } from "@/game/housing";
import type { FleetEntry } from "@/game/fleet";

/**
 * Listing art for the property agent and the dealership, drawn from the game's own data rather than stock photos:
 * a home's street elevation uses its real design (residences.ts: wall and trim colours, storeys, roof, garage bays),
 * set against its city's skyline at dusk; a vehicle card shows a silhouette of its class on a lit turntable.
 */
const SKY: Record<string, [string, string]> = { neon: ["#2a0b4a", "#ff4fb4"], nexus: ["#0c2438", "#f2a65a"], wild: ["#0d2a1f", "#9fd27a"], desert: ["#3a1f0c", "#ffcf7a"], frost: ["#0d1f33", "#bfe6ff"], wastes: ["#2a1608", "#e8935a"] };

export function HomeArt({ style, kind, city = "nexus", className = "" }: { style?: HomeStyle | undefined; kind?: HomeKind | undefined; city?: string; className?: string }) {
  const [top, glow] = SKY[city] ?? SKY["nexus"]!;
  const id = `sky-${city}-${style ?? kind}`;
  // a walk-in residence uses its design; an agent home (housing.ts) a stand-in of its kind
  const d = style ? DESIGNS[style] : kind === "PENTHOUSE" ? DESIGNS.condo : kind === "APARTMENT" ? DESIGNS.apartment : kind === "GARAGE_QUARTERS" ? DESIGNS.loft : DESIGNS.suburban;
  const levels = kind === "PENTHOUSE" ? 9 : d.levels;
  const bays = style ? GARAGE_BAYS[style] : kind === "GARAGE_QUARTERS" ? 2 : 0;
  const W = 200, H = 120, ground = 104, unit = 7.2;
  const bw = Math.min(110, d.w * unit * 0.62), storey = Math.min(15, 70 / levels), bh = levels * storey;
  const bx = 60 - (bays ? 14 : 0), by = ground - bh;
  const towers = [[8, 46], [24, 70], [150, 58], [170, 82], [186, 40], [132, 30]] as const;
  return <svg viewBox={`0 0 ${W} ${H}`} className={className} role="img" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={top} /><stop offset="1" stopColor={glow} stopOpacity={0.85} /></linearGradient>
    </defs>
    <rect width={W} height={H} fill={`url(#${id})`} />
    {towers.map(([x, h], i) => <g key={i} opacity={0.55}><rect x={x} y={ground - h} width={14} height={h} fill="#0a0f1c" />{Array.from({ length: Math.floor(h / 8) }, (_, k) => <rect key={k} x={x + 3} y={ground - h + 4 + k * 8} width={8} height={2} fill={glow} opacity={0.5} />)}</g>)}
    <rect y={ground} width={W} height={H - ground} fill="#141a22" />
    <rect y={ground} width={W} height={2} fill="#2b333d" />
    {/* the home */}
    <rect x={bx} y={by} width={bw} height={bh} fill={d.wall} />
    {Array.from({ length: levels }, (_, l) => { const n = Math.max(2, Math.round(bw / 18)); return Array.from({ length: n }, (_, k) => {
      const ww = Math.min(10, (bw / n) * 0.5);
      const x = bx + (k + 0.5) * (bw / n) - ww / 2, y = by + l * storey + storey * 0.3;
      return l === levels - 1 && Math.abs(k - (n - 1) / 2) < 0.6 ? null : <rect key={`${l}-${k}`} x={x} y={y} width={ww} height={storey * 0.42} fill={d.glass} stroke={d.trim} strokeWidth={0.6} />;
    }); })}
    {/* door, with a warm light inside */}
    <rect x={bx + bw / 2 - 5} y={ground - 15} width={10} height={15} fill="#ffcf8a" />
    <rect x={bx + bw / 2 - 6.5} y={ground - 16.5} width={13} height={1.5} fill={d.trim} />
    {d.roof === "gable" ? <polygon points={`${bx - 4},${by} ${bx + bw / 2},${by - 16} ${bx + bw + 4},${by}`} fill={d.trim} />
      : <rect x={bx - 2} y={by - 3} width={bw + 4} height={d.roof === "parapet" ? 5 : 3} fill={d.trim} />}
    {/* garage, one door per bay */}
    {bays > 0 && <g>
      <rect x={bx + bw + 6} y={ground - 22} width={bays * 16 + 4} height={22} fill="#8c8f93" />
      <rect x={bx + bw + 5} y={ground - 24} width={bays * 16 + 6} height={2.5} fill="#3b4046" />
      {Array.from({ length: bays }, (_, i) => <g key={i}><rect x={bx + bw + 8 + i * 16} y={ground - 17} width={14} height={17} fill="#c9ccd0" />{[0.25, 0.5, 0.75].map((k) => <rect key={k} x={bx + bw + 8 + i * 16} y={ground - 17 + 17 * k} width={14} height={0.8} fill="#9a9ea4" />)}<rect x={bx + bw + 13 + i * 16} y={ground - 20} width={4} height={1.2} fill="#3dff8a" /></g>)}
    </g>}
    <rect width={W} height={H} fill="none" stroke="#ffffff" strokeOpacity={0.08} />
  </svg>;
}

const CATEGORY_COLOR: Record<FleetEntry["category"], string> = { LAND: "#ff6b4a", AIR: "#7ad7ff", HEAVY: "#c9b089", AQUATIC: "#4ae3c9" };

/** a vehicle class silhouette on a lit turntable */
export function VehicleArt({ category, className = "" }: { category: FleetEntry["category"]; className?: string }) {
  const c = CATEGORY_COLOR[category];
  const body = {
    LAND: "M30 78 L52 62 L96 58 L122 66 L160 70 L168 82 L30 84 Z",
    HEAVY: "M26 82 L30 64 L70 60 L84 50 L120 50 L128 60 L170 64 L172 82 Z",
    AIR: "M20 70 L70 62 L110 44 L120 46 L104 62 L150 64 L178 52 L182 56 L168 72 L104 76 L22 74 Z",
    AQUATIC: "M24 70 L160 66 L178 72 L160 80 L40 82 Z",
  }[category];
  return <svg viewBox="0 0 200 120" className={className} role="img" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
    <defs>
      <radialGradient id={`stage-${category}`} cx="0.5" cy="0.75" r="0.7"><stop offset="0" stopColor={c} stopOpacity={0.45} /><stop offset="1" stopColor="#050b14" stopOpacity={1} /></radialGradient>
    </defs>
    <rect width={200} height={120} fill={`url(#stage-${category})`} />
    <ellipse cx={100} cy={92} rx={78} ry={10} fill="none" stroke={c} strokeOpacity={0.8} strokeWidth={1.4} />
    <ellipse cx={100} cy={92} rx={64} ry={7} fill={c} fillOpacity={0.12} />
    {category === "AQUATIC" && <path d="M10 88 Q 40 82 70 88 T 130 88 T 190 88" fill="none" stroke={c} strokeOpacity={0.6} />}
    <path d={body} fill="#0b121c" stroke={c} strokeWidth={1.2} />
    {category === "LAND" && [56, 140].map((x) => <circle key={x} cx={x} cy={84} r={9} fill="#05080d" stroke={c} strokeOpacity={0.7} />)}
    {category === "HEAVY" && <><rect x={32} y={78} width={136} height={10} rx={5} fill="#05080d" stroke={c} strokeOpacity={0.7} /><rect x={96} y={52} width={56} height={3} fill={c} /></>}
    <path d={body} fill="none" stroke="#ffffff" strokeOpacity={0.25} strokeWidth={0.5} transform="translate(0,-1)" />
  </svg>;
}
