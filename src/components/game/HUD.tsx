import { REGIONS, ZONE_COLOR, ZONE_LABEL } from "@/game/world";
import type { HudState } from "./Scene";

export function HUD({ hud }: { hud: HudState }) {
  const color = ZONE_COLOR[hud.kind];

  return (
    <div className="pointer-events-none fixed inset-0 z-10 select-none font-mono text-foreground">
      {/* top left: title + zone */}
      <div className="absolute left-4 top-4 max-w-xs rounded-lg border border-border/60 bg-card/70 p-4 backdrop-blur-md">
        <p className="text-[10px] tracking-[0.35em] text-muted-foreground">THE FRACTURED EARTH</p>
        <h1 className="mt-1 text-xl font-bold tracking-wide" style={{ color }}>
          {hud.region}
        </h1>
        <p className="text-xs text-muted-foreground">{hud.sub}</p>
        <div className="mt-3 flex items-center gap-2 text-[10px] uppercase tracking-widest">
          <span className="rounded px-2 py-0.5" style={{ backgroundColor: `${color}22`, color }}>
            {ZONE_LABEL[hud.kind]}
          </span>
          <span className="text-muted-foreground">RISK {"▮".repeat(Math.max(1, hud.difficulty))}</span>
        </div>
        <ul className="mt-3 space-y-1 text-[11px] leading-snug text-muted-foreground">
          {hud.rules.map((r) => (
            <li key={r}>— {r}</li>
          ))}
        </ul>
      </div>

      {/* top right: cycle + legend */}
      <div className="absolute right-4 top-4 w-56 rounded-lg border border-border/60 bg-card/70 p-4 backdrop-blur-md">
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] tracking-[0.3em] text-muted-foreground">CYCLE</span>
          <span className="text-sm font-bold">{hud.clock}</span>
        </div>
        <p className="text-xs" style={{ color: "var(--accent-glow)" }}>
          {hud.phase}
        </p>
        <div className="mt-3 space-y-1.5 text-[10px] uppercase tracking-widest">
          {REGIONS.map((r) => (
            <div key={r.id} className="flex items-center gap-2">
              <span className="h-2 w-2 rotate-45" style={{ backgroundColor: ZONE_COLOR[r.kind] }} />
              <span className={r.name === hud.region ? "text-foreground" : "text-muted-foreground"}>{r.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* bottom left: controls */}
      <div className="absolute bottom-4 left-4 rounded-lg border border-border/60 bg-card/70 px-4 py-3 text-[11px] text-muted-foreground backdrop-blur-md">
        <p>
          <span className="text-foreground">WASD</span> move ·{" "}
          <span className="text-foreground">SHIFT</span> sprint ·{" "}
          <span className="text-foreground">T</span> accelerate day cycle
        </p>
        <p className="mt-1">Spawn: Nexus City → travel the War Belt → raid the Fracture Zones.</p>
      </div>

      {/* bottom right: speed */}
      <div className="absolute bottom-4 right-4 rounded-lg border border-border/60 bg-card/70 px-4 py-3 text-right backdrop-blur-md">
        <p className="text-[10px] tracking-[0.3em] text-muted-foreground">VELOCITY</p>
        <p className="text-2xl font-bold leading-none">{hud.speed}</p>
      </div>
    </div>
  );
}
