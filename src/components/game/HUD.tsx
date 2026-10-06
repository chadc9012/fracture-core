import { StratagemPanel } from "./StratagemPanel";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { HudState } from "./Scene";
import { Compass, TrackedObjectives } from "./Tracker";
import { FACTIONS } from "@/game/sim";
import { CornerBrackets, HudPanel } from "./HudChrome";
import { useVoiceLine } from "./useVoiceLine";

export function HUD({ hud, tutorialActive = false, onMenu }: { hud: HudState; tutorialActive?: boolean; onMenu: () => void; onStrategy: () => void; onGarage: () => void; onAnalyze: () => void; onInventory: () => void; onAtlas: () => void; onOperations: (view: "DUNGEONS" | "ARSENAL" | "ABILITIES") => void }) {
  const ammo = hud.ammo?.[hud.weaponSlot - 1];
  const melee = ammo?.magSize === 0;
  const lowAmmo = Boolean(ammo && !melee && ammo.mag <= Math.ceil(ammo.magSize * 0.25));
  useVoiceLine(`boss-${hud.bossHud?.name ?? "none"}-${hud.bossHud?.adaptedTell ?? "idle"}`, hud.bossHud?.name ?? "ENEMY", hud.bossHud?.adaptedTell, "critical");
  useVoiceLine(`emergency-${hud.emergencyQuest?.state ?? "none"}-${hud.emergencyQuest?.bossName ?? "none"}`, "NOVA", hud.emergencyQuest ? `${hud.emergencyQuest.state === "WARNING" ? "Emergency quest inbound" : hud.emergencyQuest.state === "ACTIVE" ? "Emergency quest active" : hud.emergencyQuest.state === "COMPLETE" ? "Emergency quest cleared" : "Emergency quest failed"}. ${hud.emergencyQuest.bossName}.` : null, "critical");
  return <div className="pointer-events-none fixed inset-0 z-10 hud-scanline select-none font-mono text-foreground">
    <div className="pointer-events-auto absolute left-3 top-3"><Button title="Menu" size="icon" variant="ghost" className="bg-background/25 backdrop-blur-sm" onClick={onMenu} aria-label="Open menu"><Menu /></Button></div>
    {!hud.insideInterior && (
      <div className="absolute left-14 top-3 border-l border-primary/60 px-2.5 py-0.5 text-[9px] uppercase">
        <p style={{ color: FACTIONS[hud.owner]?.color }}>{hud.region} · {FACTIONS[hud.owner]?.short}{hud.contested ? " · CONTESTED" : ""}</p>
        {hud.zoneTier !== "STABLE" && <p className="text-destructive">{hud.zoneTier}</p>}
      </div>
    )}
    {!tutorialActive && <><Compass markers={hud.markers ?? []} yaw={hud.yaw ?? 0} /><TrackedObjectives markers={hud.markers ?? []} /></>}
    <div className="absolute left-1/2 top-4 w-[min(26rem,calc(100%-7rem))] -translate-x-1/2 space-y-1 text-center text-[10px]">{hud.alerts.slice(0, 2).map((alert, index) => <p key={`${alert}-${index}`} className="hud-panel border-x border-primary/40 bg-background/45 px-3 py-1 text-foreground/90 backdrop-blur-sm" style={{ opacity: 1 - index * 0.28 }}>{alert}</p>)}</div>
    {!tutorialActive && (hud.environment || hud.hazardWarning) && <div className="pointer-events-none absolute left-1/2 top-24 -translate-x-1/2 text-center font-mono text-[10px] uppercase tracking-[0.18em]">
      {hud.environment && <p className="text-muted-foreground">{hud.environment}</p>}
      {hud.hazardWarning && <p className="mt-1 text-destructive">{hud.hazardWarning}</p>}
    </div>}
    {!tutorialActive && <StratagemPanel hud={hud.stratagem} />}
    <EmergencyQuestBanner eq={hud.emergencyQuest} />
    <BossHealthBar boss={hud.bossHud} />
    <Crosshair hud={hud} />
    <div className="absolute bottom-4 left-4 w-[min(24rem,calc(100%-8rem))]">
      <div className={`hud-status px-3 py-2 ${hud.hp <= 40 ? "hud-glow-destructive" : ""}`}>
        <div className="flex items-center justify-between"><span className="hud-label">{hud.callsign} // Hull Integrity</span><span className={`text-xs font-bold ${hud.hp > 40 ? "text-primary" : "text-destructive"}`}>{hud.hp}%</span></div>
        <div className="mt-1 h-2.5 overflow-hidden border border-foreground/20 bg-background/60">
          <div className={`relative h-full hud-ticks ${hud.hp > 40 ? "bg-primary" : "bg-destructive"}`} style={{ width: `${hud.hp}%`, transition: "width 200ms linear" }} />
        </div>
        <div className="mt-1.5 flex items-center gap-3 text-[8px] uppercase tracking-[0.18em] text-muted-foreground"><span>{hud.playerClass}</span><span>{hud.subclassName}</span>{hud.playerClass === "TITAN" && <span className="text-primary">Shield {hud.shield}%</span>}</div>
        <div className="mt-2 flex gap-1">{hud.abilities.map((ability) => <div key={ability.slot} className={`min-w-0 flex-1 border-t px-1 pt-1 ${ability.ready ? "border-primary text-foreground" : "border-border text-muted-foreground"}`}><p className="truncate text-[8px] uppercase">{ability.slot.slice(0, 1)} · {ability.name}</p></div>)}</div>
      </div>
    </div>
    {ammo && (
      <div className={`hud-status absolute bottom-4 right-4 w-36 px-3 py-2 text-right ${hud.overheated ? "hud-glow-destructive" : ""}`}>
        <p className="hud-label truncate">{ammo.name}</p>
        <p className={`text-3xl font-semibold leading-none ${lowAmmo ? "text-warning" : "text-foreground"}`}>{melee ? "∞" : ammo.mag}<span className="text-xs text-muted-foreground">{melee ? "" : ` / ${ammo.reserve}`}</span></p>
        <div className="mt-1.5 h-1.5 overflow-hidden border border-foreground/20 bg-background/60">{hud.reloading > 0 ? <div className="h-full hud-ticks bg-primary" style={{ width: `${hud.reloading * 100}%` }} /> : <div className={`h-full hud-ticks ${lowAmmo ? "bg-warning" : "bg-primary"}`} style={{ width: `${melee ? 100 : (ammo.mag / Math.max(1, ammo.magSize)) * 100}%` }} />}</div>
        <p className="mt-1 hud-label text-[8px]">{hud.reloading > 0 ? "Reloading" : hud.overheated ? "Venting" : `Weapon Heat ${hud.weaponHeat}%`}</p>
      </div>
    )}
    <WeaponSelector hud={hud} />
  </div>;
}

function Crosshair({ hud }: { hud: HudState }) {
  const gap = 5 + hud.bloom * 18 - (hud.aiming ? 3 : 0);
  const color = hud.overheated ? "var(--destructive)" : hud.aimLocked ? "var(--primary)" : "var(--foreground)";
  return <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"><div className="relative h-0 w-0">{([[0, -1], [0, 1], [-1, 0], [1, 0]] as const).map(([x, y], index) => <span key={index} className="absolute block" style={{ width: x ? 8 : 2, height: y ? 8 : 2, background: color, boxShadow: `0 0 6px ${color}`, left: x * gap - (x ? (x > 0 ? 0 : 8) : 1), top: y * gap - (y ? (y > 0 ? 0 : 8) : 1), opacity: 0.85 }} />)}{hud.hitMarker && <span className="absolute -left-3 -top-3 size-6 text-center text-lg leading-6 text-destructive" style={{ textShadow: "0 0 8px var(--destructive)" }}>✕</span>}</div></div>;
}

/** Shangri-La Frontier-style boss readout: hp bar, a poise/stagger bar underneath that flashes
 * gold when the weak point is open and red when it's broken, and the adaptive-AI "tell" line the
 * instant it locks onto a pattern. Top-center, under the alert stack so it doesn't collide with it. */
function BossHealthBar({ boss }: { boss: HudState["bossHud"] }) {
  if (!boss) return null;
  const poiseColor = boss.staggered ? "bg-destructive" : boss.weakPointOpen ? "bg-warning" : "bg-primary";
  return (
    <div className="pointer-events-none absolute left-1/2 top-[4.6rem] w-[min(30rem,calc(100%-4rem))] -translate-x-1/2">
      <HudPanel className={`px-3 py-2 ${boss.staggered ? "hud-glow-destructive" : "hud-glow"}`}>
        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em]">
          <span className="truncate text-destructive">{boss.name}{boss.scenario ? " · ANOMALY" : ""}</span>
          <span className="text-muted-foreground">{boss.phaseLabel}</span>
        </div>
        <div className="mt-1 h-2 overflow-hidden border border-foreground/20 bg-background/60">
          <div className="h-full bg-destructive hud-ticks" style={{ width: `${boss.hpPct}%`, transition: "width 150ms linear" }} />
        </div>
        <div className="mt-1 h-1.5 overflow-hidden border border-foreground/10 bg-background/60">
          <div className={`h-full hud-ticks ${poiseColor}`} style={{ width: `${boss.staggered ? 100 : boss.poisePct}%`, transition: "width 150ms linear" }} />
        </div>
        <div className="mt-1 flex items-center justify-between text-[8px] uppercase tracking-[0.18em] text-muted-foreground">
          <span>{boss.staggered ? "STAGGERED · CRITICAL WINDOW OPEN" : boss.weakPointOpen ? "WEAK POINT EXPOSED" : "Poise"}</span>
          {boss.adaptedTell && <span className="text-warning">Adapting · {boss.adaptedTell}</span>}
        </div>
      </HudPanel>
    </div>
  );
}

/** Emergency Quest countdown banner — Shangri-La Frontier's server-wide "EQ" warning. */
function EmergencyQuestBanner({ eq }: { eq: HudState["emergencyQuest"] }) {
  if (!eq) return null;
  const tone = eq.state === "COMPLETE" ? "text-primary" : eq.state === "FAILED" ? "text-muted-foreground" : "text-destructive";
  const label =
    eq.state === "WARNING" ? `EMERGENCY QUEST INBOUND · ${eq.bossName} · ${eq.regionId}` :
    eq.state === "ACTIVE" ? `EMERGENCY QUEST ACTIVE · ${eq.bossName} · ${eq.regionId}` :
    eq.state === "COMPLETE" ? "EMERGENCY QUEST CLEARED" : "EMERGENCY QUEST FAILED";
  return (
    <div className="pointer-events-none absolute left-1/2 top-2 w-[min(28rem,calc(100%-6rem))] -translate-x-1/2 text-center">
      <div className={`hud-panel animate-pulse border-x border-destructive/50 bg-background/55 px-3 py-1 text-[9px] uppercase tracking-[0.22em] backdrop-blur-sm ${tone}`}>
        {label}{(eq.state === "WARNING" || eq.state === "ACTIVE") && ` · ${eq.timer}s`}
      </div>
    </div>
  );
}

function WeaponSelector({ hud }: { hud: HudState }) {
  if (!hud.ammo?.length) return null;
  const recent = performance.now() - (hud.weaponSwitched ?? 0) < 1100;
  if (!recent && !hud.weaponWheel) return null;
  if (hud.weaponWheel) return <div className="absolute left-1/2 top-1/2 grid size-64 -translate-x-1/2 -translate-y-1/2 grid-cols-2 gap-20">{hud.ammo.map((weapon, index) => <div key={weapon.id} className={`hud-panel relative grid place-items-center p-2 text-center ${index + 1 === hud.weaponSlot ? "hud-glow text-primary" : "text-muted-foreground"}`}><CornerBrackets /><span className="text-[9px] uppercase">{weapon.name}<br />{weapon.magSize ? `${weapon.mag}/${weapon.reserve}` : "melee"}</span></div>)}</div>;
  return <div className="absolute bottom-24 left-1/2 flex -translate-x-1/2 gap-1">{hud.ammo.map((weapon, index) => <div key={weapon.id} className={`h-1 w-10 ${index + 1 === hud.weaponSlot ? "bg-primary" : "bg-foreground/20"}`} style={index + 1 === hud.weaponSlot ? { boxShadow: "0 0 6px color-mix(in oklch, var(--primary) 70%, transparent)" } : undefined} />)}</div>;
}