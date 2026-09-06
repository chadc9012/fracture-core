import { FACTIONS } from "@/game/sim";
import { ZONE_COLOR, ZONE_LABEL } from "@/game/world";
import type { HudState } from "./Scene";

export function HUD({ hud }: { hud: HudState }) {
  const color = ZONE_COLOR[hud.kind];
  const owner = FACTIONS[hud.owner];
  const challenger = FACTIONS[hud.challenger];

  return (
    <div className="pointer-events-none fixed inset-0 z-10 select-none font-mono text-foreground">
      {/* top left: zone + capture */}
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

        {/* faction control */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-widest">
            <span style={{ color: owner.color }}>HELD BY {owner.short}</span>
            {hud.contested && <span style={{ color: challenger.color }}>{challenger.short} PUSHING</span>}
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded bg-muted">
            <div
              className="h-full transition-[width] duration-200"
              style={{ width: `${Math.round(hud.progress * 100)}%`, backgroundColor: challenger.color }}
            />
          </div>
        </div>

        {hud.instability > 0.05 && (
          <div className="mt-3 rounded border border-border/60 px-2 py-1 text-[10px] uppercase tracking-widest">
            <span style={{ color: "#ff9f1c" }}>INSTABILITY {Math.round(hud.instability * 100)}%</span>
            <span className="ml-2 text-muted-foreground">GRAVITY {hud.gravity.toFixed(1)}</span>
          </div>
        )}

        <ul className="mt-3 space-y-1 text-[11px] leading-snug text-muted-foreground">
          {hud.rules.map((r) => (
            <li key={r}>— {r}</li>
          ))}
        </ul>
      </div>

      {/* top right: cycle + world control */}
      <div className="absolute right-4 top-4 w-60 rounded-lg border border-border/60 bg-card/70 p-4 backdrop-blur-md">
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] tracking-[0.3em] text-muted-foreground">CYCLE</span>
          <span className="text-sm font-bold">{hud.clock}</span>
        </div>
        <p className="text-xs" style={{ color: "var(--accent-glow)" }}>
          {hud.phase}
        </p>
        <p className="mt-3 text-[10px] tracking-[0.3em] text-muted-foreground">ZONE CONTROL</p>
        <div className="mt-1.5 space-y-1 text-[10px] uppercase tracking-widest">
          {hud.ownership.map((z) => (
            <div key={z.id} className="flex items-center justify-between gap-2">
              <span className={z.name === hud.region ? "text-foreground" : "text-muted-foreground"}>{z.name}</span>
              <span style={{ color: FACTIONS[z.owner].color }}>{FACTIONS[z.owner].short}</span>
            </div>
          ))}
        </div>
      </div>

      {/* alerts */}
      <div className="absolute left-1/2 top-4 w-72 -translate-x-1/2 space-y-1 text-center text-[11px]">
        {hud.alerts.map((a, i) => (
          <p
            key={`${a}-${i}`}
            className="rounded border border-border/60 bg-card/70 px-3 py-1 backdrop-blur-md"
            style={{ opacity: 1 - i * 0.22 }}
          >
            {a}
          </p>
        ))}
      </div>

      {/* bottom left: controls */}
      <div className="absolute bottom-4 left-4 rounded-lg border border-border/60 bg-card/70 px-4 py-3 text-[11px] text-muted-foreground backdrop-blur-md">
        <p>
          <span className="text-foreground">WASD</span> {hud.mode === "vehicle" ? "drive / steer" : "move"} ·{" "}
          <span className="text-foreground">SHIFT</span> boost ·{" "}
          <span className="text-foreground">SPACE</span> fire ·{" "}
          <span className="text-foreground">V</span> {hud.mode === "vehicle" ? "exit buggy" : "enter buggy"}
        </p>
        <p className="mt-1">
          <span className="text-foreground">C</span> jump · <span className="text-foreground">T</span> fast-forward the
          day cycle
        </p>
        <p className="mt-1">Ambush convoys on the lanes, then extract at Nexus City for credits.</p>
      </div>

      {/* bottom right: status */}
      <div className="absolute bottom-4 right-4 w-52 rounded-lg border border-border/60 bg-card/70 px-4 py-3 text-right backdrop-blur-md">
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] tracking-[0.3em] text-muted-foreground">
            {hud.mode === "vehicle" ? "KM/H" : "SPEED"}
          </span>
          <span className="text-2xl font-bold leading-none">{hud.speed}</span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded bg-muted">
          <div
            className="h-full"
            style={{ width: `${hud.hp}%`, backgroundColor: hud.hp > 40 ? "#3ddc97" : "#ff4d4d" }}
          />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
          <span className="text-left">HULL</span>
          <span>{hud.hp}%</span>
          <span className="text-left">CARGO</span>
          <span>{hud.cargo}</span>
          <span className="text-left">CREDITS</span>
          <span>{hud.credits}</span>
          <span className="text-left">KILLS</span>
          <span>{hud.kills}</span>
          <span className="text-left">ELEV</span>
          <span>{hud.elevation}m</span>
          <span className="text-left">TRACTION</span>
          <span>{Math.round(hud.traction * 100)}%</span>
        </div>
      </div>
    </div>
  );
}
