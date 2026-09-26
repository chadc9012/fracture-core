import { MARKER_COLOR, type MarkerKind, type TrackedMarker } from "@/game/waypoints";

const ICON: Record<MarkerKind, string> = { MISSION: "◆", RESOURCE: "⬢", BOSS: "☠" };
const fmt = (d: number) => (d >= 1000 ? `${(d / 1000).toFixed(1)}km` : `${Math.round(d)}m`);

/** Top compass strip: markers slide by bearing within a ±90° field; closest ones get labels. */
export function Compass({ markers, yaw }: { markers: TrackedMarker[]; yaw: number }) {
  const visible = markers.filter((m) => Math.abs(m.bearing) < Math.PI / 2 && (m.kind !== "RESOURCE" || (m.ready !== false && m.dist < 220)));
  const heading = ((-yaw * 180) / Math.PI + 360 * 4) % 360;
  const dirs = [["N", 0], ["E", 90], ["S", 180], ["W", 270]] as const;
  return (
    <div className="pointer-events-none absolute left-1/2 top-3 h-12 w-[min(34rem,70vw)] -translate-x-1/2 overflow-hidden border-b border-border/60 bg-gradient-to-b from-background/70 to-transparent" aria-label="Compass">
      {dirs.map(([label, deg]) => {
        let rel = deg - heading; rel = ((rel + 540) % 360) - 180;
        if (Math.abs(rel) > 90) return null;
        return <span key={label} className="absolute top-1 -translate-x-1/2 text-[10px] font-bold text-muted-foreground" style={{ left: `${50 + (rel / 90) * 50}%` }}>{label}</span>;
      })}
      <span className="absolute left-1/2 top-0 h-2 w-px bg-foreground" />
      {visible.slice(0, 10).map((m, i) => (
        <span key={m.id} className="absolute top-4 flex -translate-x-1/2 flex-col items-center leading-none" style={{ left: `${50 + (m.bearing / (Math.PI / 2)) * 50}%`, color: MARKER_COLOR[m.kind] }}>
          <span className="text-sm drop-shadow">{ICON[m.kind]}</span>
          {i < 4 && <span className="mt-0.5 whitespace-nowrap text-[8px] text-foreground/80">{fmt(m.dist)}</span>}
        </span>
      ))}
    </div>
  );
}

/** Right-side tracker: nearest active mission, resource site, and boss with distance + direction arrow. */
export function TrackedObjectives({ markers }: { markers: TrackedMarker[] }) {
  const pick = (kind: MarkerKind) => markers.find((m) => m.kind === kind && m.ready !== false);
  const rows = (["MISSION", "RESOURCE", "BOSS"] as const).map((k) => [k, pick(k)] as const).filter(([, m]) => m);
  if (!rows.length) return null;
  return (
    <div className="pointer-events-none absolute right-4 top-20 hidden w-56 space-y-1.5 md:block" aria-label="Tracked objectives">
      {rows.map(([kind, m]) => m && (
        <div key={kind} className="flex items-center gap-2 border-l-2 bg-card/60 px-2 py-1.5 backdrop-blur" style={{ borderColor: MARKER_COLOR[kind] }}>
          <span className="inline-block text-sm" style={{ color: MARKER_COLOR[kind], transform: `rotate(${(m.bearing * 180) / Math.PI}deg)` }}>▲</span>
          <div className="min-w-0 flex-1">
            <p className="text-[8px] uppercase tracking-[0.25em]" style={{ color: MARKER_COLOR[kind] }}>{kind === "RESOURCE" ? "Gather" : kind}</p>
            <p className="truncate text-[11px]">{m.label}</p>
          </div>
          <span className="text-[10px] text-muted-foreground">{fmt(m.dist)}</span>
        </div>
      ))}
    </div>
  );
}
