import { FACTIONS } from "@/game/sim";
import { ZONE_COLOR, ZONE_LABEL } from "@/game/world";
import type { HudState } from "./Scene";
import { EvolutionPanel } from "./EvolutionPanel";
import { Inspector } from "./Inspector";

export function HUD({ hud, onMenu }: { hud: HudState; onMenu: () => void }) {
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

      {/* right: AI mission director */}
      <div className="absolute right-4 top-64 w-60 rounded-lg border border-border/60 bg-card/70 p-4 backdrop-blur-md">
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] tracking-[0.3em] text-muted-foreground">AI DIRECTOR</span>
          <span className="text-[10px]" style={{ color: hud.threat > 80 ? "#ff4d4d" : "var(--accent-glow)" }}>
            THREAT {hud.threat}
          </span>
        </div>
        <div className="mt-1 h-1 w-full overflow-hidden rounded bg-muted">
          <div
            className="h-full"
            style={{
              width: `${Math.min(100, hud.threat)}%`,
              backgroundColor: hud.threat > 80 ? "#ff4d4d" : "#ff9f1c",
            }}
          />
        </div>
        <p className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
          HEAT {hud.heat} · CORE {hud.coreHp}%
        </p>
        <p className="text-[10px] italic text-muted-foreground">{hud.trend}</p>

        <div className="mt-3 space-y-2">
          {hud.missions.length === 0 && (
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">No active contracts</p>
          )}
          {hud.missions.map((m) => (
            <div key={m.id} className="rounded border border-border/60 px-2 py-1.5">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-bold leading-tight">{m.name}</span>
                <span
                  className="text-[9px] uppercase"
                  style={{ color: m.intensity === "HIGH" ? "#ff4d4d" : "#ff9f1c" }}
                >
                  {m.intensity}
                </span>
              </div>
              <ul className="mt-1 space-y-0.5 text-[10px] text-muted-foreground">
                {m.objectives.map((o, i) => (
                  <li key={i} className="flex items-center justify-between gap-2">
                    <span className={o.done ? "line-through opacity-60" : ""}>{o.label}</span>
                    <span>
                      {Math.floor(o.progress)}/{o.amount}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>



      {/* adaptive build evolution */}
      <EvolutionPanel evo={hud.evo} />

      {/* dev engine inspector */}
      {hud.inspector && <Inspector view={hud.inspector} />}

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

      {/* menu button */}
      <button
        onClick={onMenu}
        className="pointer-events-auto absolute left-1/2 top-4 -translate-x-1/2 rounded-md border border-border/60 bg-card/80 px-4 py-2 text-[10px] uppercase tracking-[0.3em] text-foreground backdrop-blur-md hover:border-primary"
      >
        menu
      </button>

      {/* crosshair + weapon heat */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div
          className="h-4 w-4 rounded-full border"
          style={{
            borderColor: hud.overheated ? "#ff4d4d" : hud.aimLocked ? "#7dffca" : "#ffffff88",
            boxShadow: hud.aimLocked ? "0 0 10px #7dffca" : "none",
          }}
        />
      </div>
      <div className="absolute bottom-28 left-1/2 w-56 -translate-x-1/2 rounded-lg border border-border/60 bg-card/70 px-3 py-2 backdrop-blur-md">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.25em]">
          <span className="text-muted-foreground">weapon heat</span>
          <span style={{ color: hud.overheated ? "#ff4d4d" : hud.weaponHeat > 70 ? "#ff9f1c" : "#8fe3ff" }}>
            {hud.overheated ? "venting" : `${hud.weaponHeat}%`}
          </span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded bg-muted">
          <div
            className="h-full transition-[width] duration-150"
            style={{
              width: `${hud.weaponHeat}%`,
              backgroundColor: hud.overheated ? "#ff4d4d" : hud.weaponHeat > 70 ? "#ff9f1c" : "#5bb8ff",
            }}
          />
        </div>
        <p className="mt-1 text-[9px] uppercase tracking-[0.25em] text-muted-foreground">
          {hud.view === "first" ? "first person" : "third person"} · F to swap
        </p>
      </div>

      {/* generated loot feed */}
      {hud.loot.length > 0 && (
        <div className="absolute right-4 top-1/2 w-64 -translate-y-1/2 space-y-2">
          {hud.loot.map((it, i) => (
            <div
              key={`${it.name}-${i}`}
              className="rounded-lg border bg-card/80 px-3 py-2 backdrop-blur-md"
              style={{ borderColor: `${it.color}66` }}
            >
              <div className="flex items-baseline justify-between">
                <span className="text-[10px] uppercase tracking-[0.25em]" style={{ color: it.color }}>
                  {it.rarity}
                </span>
                <span className="text-[10px] text-muted-foreground">PWR {it.power}</span>
              </div>
              <p className="text-[12px] leading-tight text-foreground">{it.name}</p>
              <ul className="mt-1 space-y-0.5 text-[10px] text-muted-foreground">
                {it.mods.map((m) => (
                  <li key={m}>+ {m}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

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
          day cycle · <span className="text-foreground">F</span> camera view ·{" "}
          <span className="text-foreground">I</span> engine inspector
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
