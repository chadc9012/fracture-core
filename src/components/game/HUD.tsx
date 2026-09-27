import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { HudState } from "./Scene";
import { Compass, TrackedObjectives } from "./Tracker";
import { FACTIONS } from "@/game/sim";

export function HUD({ hud, tutorialActive = false, onMenu }: { hud: HudState; tutorialActive?: boolean; onMenu: () => void; onStrategy: () => void; onGarage: () => void; onAnalyze: () => void; onInventory: () => void; onAtlas: () => void; onOperations: (view: "DUNGEONS" | "ARSENAL" | "ABILITIES") => void }) {
  const ammo = hud.ammo?.[hud.weaponSlot - 1];
  const melee = ammo?.magSize === 0;
  const lowAmmo = Boolean(ammo && !melee && ammo.mag <= Math.ceil(ammo.magSize * 0.25));
  return <div className="pointer-events-none fixed inset-0 z-10 select-none font-mono text-foreground">
    <div className="pointer-events-auto absolute left-3 top-3"><Button title="Menu" size="icon" variant="outline" className="border-border/60 bg-background/45 backdrop-blur-md" onClick={onMenu} aria-label="Open menu"><Menu /></Button></div>
    {!hud.insideInterior && (
      <div className="absolute left-14 top-3.5 text-[9px] uppercase tracking-[0.16em]">
        <p style={{ color: FACTIONS[hud.owner]?.color }}>{hud.region} · {FACTIONS[hud.owner]?.short}{hud.contested ? " · CONTESTED" : ""}</p>
        {hud.zoneTier !== "STABLE" && <p className="text-destructive">{hud.zoneTier}</p>}
      </div>
    )}
    {!tutorialActive && <><Compass markers={hud.markers ?? []} yaw={hud.yaw ?? 0} /><TrackedObjectives markers={hud.markers ?? []} /></>}
    <div className="absolute left-1/2 top-4 w-[min(26rem,calc(100%-7rem))] -translate-x-1/2 space-y-1 text-center text-[10px]">{hud.alerts.slice(0, 2).map((alert, index) => <p key={`${alert}-${index}`} className="border-x border-primary/40 bg-background/45 px-3 py-1 text-foreground/90 backdrop-blur-sm" style={{ opacity: 1 - index * 0.28 }}>{alert}</p>)}</div>
    <Crosshair hud={hud} />
    <div className="absolute bottom-4 left-4 w-[min(24rem,calc(100%-8rem))]">
      <div className="flex items-end gap-2"><div className="h-2 flex-1 skew-x-[-18deg] overflow-hidden border border-foreground/30 bg-background/50"><div className={`h-full ${hud.hp > 40 ? "bg-primary" : "bg-destructive"}`} style={{ width: `${hud.hp}%` }} /></div><span className="text-[10px] font-bold">{hud.hp}</span></div>
      <div className="mt-1 flex items-center gap-3 text-[8px] uppercase tracking-[0.18em] text-muted-foreground"><span>{hud.playerClass}</span><span>{hud.subclassName}</span>{hud.playerClass === "TITAN" && <span>Shield {hud.shield}%</span>}</div>
      <div className="mt-2 flex gap-1">{hud.abilities.map((ability) => <div key={ability.slot} className={`min-w-0 flex-1 border-t px-1 pt-1 ${ability.ready ? "border-primary text-foreground" : "border-border text-muted-foreground"}`}><p className="truncate text-[8px] uppercase">{ability.slot.slice(0, 1)} · {ability.name}</p></div>)}</div>
    </div>
    {ammo && <div className="absolute bottom-4 right-4 w-32 text-right"><p className="truncate text-[8px] uppercase tracking-[0.18em] text-muted-foreground">{ammo.name}</p><p className={`text-3xl font-semibold leading-none ${lowAmmo ? "text-warning" : "text-foreground"}`}>{melee ? "∞" : ammo.mag}<span className="text-xs text-muted-foreground">{melee ? "" : ` / ${ammo.reserve}`}</span></p><div className="mt-1 h-1 overflow-hidden bg-background/60">{hud.reloading > 0 ? <div className="h-full bg-primary" style={{ width: `${hud.reloading * 100}%` }} /> : <div className={`h-full ${lowAmmo ? "bg-warning" : "bg-primary"}`} style={{ width: `${melee ? 100 : (ammo.mag / Math.max(1, ammo.magSize)) * 100}%` }} />}</div><p className="mt-1 text-[8px] uppercase tracking-[0.12em] text-muted-foreground">{hud.reloading > 0 ? "Reloading" : hud.overheated ? "Venting" : `Heat ${hud.weaponHeat}%`}</p></div>}
    <WeaponSelector hud={hud} />
  </div>;
}

function Crosshair({ hud }: { hud: HudState }) {
  const gap = 5 + hud.bloom * 18 - (hud.aiming ? 3 : 0);
  const color = hud.overheated ? "var(--destructive)" : hud.aimLocked ? "var(--primary)" : "var(--foreground)";
  return <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"><div className="relative h-0 w-0">{([[0, -1], [0, 1], [-1, 0], [1, 0]] as const).map(([x, y], index) => <span key={index} className="absolute block" style={{ width: x ? 8 : 2, height: y ? 8 : 2, background: color, left: x * gap - (x ? (x > 0 ? 0 : 8) : 1), top: y * gap - (y ? (y > 0 ? 0 : 8) : 1), opacity: 0.78 }} />)}{hud.hitMarker && <span className="absolute -left-3 -top-3 size-6 text-center text-lg leading-6 text-destructive">✕</span>}</div></div>;
}

function WeaponSelector({ hud }: { hud: HudState }) {
  if (!hud.ammo?.length) return null;
  const recent = performance.now() - (hud.weaponSwitched ?? 0) < 1100;
  if (!recent && !hud.weaponWheel) return null;
  if (hud.weaponWheel) return <div className="absolute left-1/2 top-1/2 grid size-64 -translate-x-1/2 -translate-y-1/2 grid-cols-2 gap-20">{hud.ammo.map((weapon, index) => <div key={weapon.id} className={`grid place-items-center border bg-background/65 p-2 text-center backdrop-blur-sm ${index + 1 === hud.weaponSlot ? "border-primary text-primary" : "border-border text-muted-foreground"}`}><span className="text-[9px] uppercase">{weapon.name}<br />{weapon.magSize ? `${weapon.mag}/${weapon.reserve}` : "melee"}</span></div>)}</div>;
  return <div className="absolute bottom-24 left-1/2 flex -translate-x-1/2 gap-1">{hud.ammo.map((weapon, index) => <div key={weapon.id} className={`h-1 w-10 ${index + 1 === hud.weaponSlot ? "bg-primary" : "bg-foreground/20"}`} />)}</div>;
}