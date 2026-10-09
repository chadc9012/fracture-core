export type GameSettings = {
  aimAssist: boolean;
  firstPersonDefault: boolean;
  zoneLabels: boolean;
  hudDensity: "full" | "lean";
  renderTier: "LOW" | "MEDIUM" | "HIGH" | "ULTRA";
  bindings?: Bindings;
  volume?: number;
  musicVolume?: number;
  sfxVolume?: number;
  voiceVolume?: number;
  spokenDialogue?: boolean;
  reducedMotion?: boolean;
  highContrastHud?: boolean;
};

export const DEFAULT_SETTINGS: GameSettings = {
  aimAssist: true,
  firstPersonDefault: true,
  zoneLabels: true,
  hudDensity: "full",
  renderTier: "MEDIUM",
  bindings: DEFAULT_BINDINGS,
  volume: 0.7,
  musicVolume: 1,
  sfxVolume: 1,
  voiceVolume: 0.85,
  spokenDialogue: true,
  reducedMotion: false,
  highContrastHud: false,
};

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <Button
      variant="outline"
      onClick={() => onChange(!on)}
      className="flex w-full items-center justify-between rounded border border-border bg-card/60 px-3 py-2 text-left hover:border-primary/60"
    >
      <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-foreground">{label}</span>
      <span
        className={`font-mono text-[10px] uppercase tracking-[0.2em] ${on ? "text-primary" : "text-muted-foreground"}`}
      >
        {on ? "on" : "off"}
      </span>
    </Button>
  );
}

import { Accessibility, BookOpen, ChevronLeft, Compass, Gamepad2, Map as MapIcon, Monitor, Play, SlidersHorizontal, Speaker, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DEFAULT_BINDINGS, type Bindings } from "@/game/bindings";
import { CHRONICLE, ROADMAP, nextActivity } from "@/game/retention";
import { speakVoice } from "@/game/voice-director";
import { ControlsPanel } from "./ControlsPanel";

type SettingsSection = "NEXT" | "CHRONICLE" | "ROADMAP" | "GAMEPLAY" | "DISPLAY" | "AUDIO" | "INTERFACE" | "CONTROLS" | "ACCESSIBILITY";
const SECTIONS: { id: SettingsSection; label: string; icon: typeof Gamepad2 }[] = [
  { id: "NEXT", label: "What next", icon: Compass },
  { id: "CHRONICLE", label: "Chronicle", icon: BookOpen },
  { id: "ROADMAP", label: "Roadmap", icon: MapIcon },
  { id: "GAMEPLAY", label: "Gameplay", icon: Gamepad2 },
  { id: "DISPLAY", label: "Display", icon: Monitor },
  { id: "AUDIO", label: "Audio", icon: Speaker },
  { id: "INTERFACE", label: "Interface", icon: SlidersHorizontal },
  { id: "CONTROLS", label: "Controls", icon: Gamepad2 },
  { id: "ACCESSIBILITY", label: "Accessibility", icon: Accessibility },
];

/** Full-screen game menu: direction, story chronicle, roadmap, and settings. */
export function SettingsWindow({
  settings,
  onChange,
  onClose,
  onOrbit,
  completedMissions = [],
}: {
  settings: GameSettings;
  onChange: (s: GameSettings) => void;
  onClose: () => void;
  onOrbit: () => void;
  completedMissions?: string[];
}) {
  const set = (patch: Partial<GameSettings>) => onChange({ ...settings, ...patch });
  const [section, setSection] = useState<SettingsSection>("NEXT");
  const next = nextActivity({ completedMissions });

  return (
    <div className="pointer-events-auto fixed inset-0 z-[60] overflow-y-auto bg-background/92" role="dialog" aria-modal="true" aria-label="Game settings">
      <div className="mx-auto flex min-h-full max-w-6xl flex-col px-4 py-5 sm:px-8 sm:py-8">
        <header className="flex items-center justify-between border-b border-foreground/15 pb-4">
          <div><p className="ui-kicker">System / Configuration</p><h2 className="mt-1 font-mono text-2xl uppercase sm:text-4xl">Settings</h2></div>
          <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close settings"><X /></Button>
        </header>

        <div className="grid flex-1 gap-8 py-6 md:grid-cols-[14rem_minmax(0,1fr)]">
          <nav className="flex gap-1 overflow-x-auto md:flex-col" aria-label="Settings sections">
            {SECTIONS.map(({ id, label, icon: Icon }) => <Button key={id} variant="ghost" onClick={() => setSection(id)} className={`min-w-fit justify-start rounded-none border-l-2 px-3 ${section === id ? "border-primary bg-primary/10 text-foreground" : "border-transparent text-muted-foreground"}`}><Icon />{label}</Button>)}
          </nav>

          <section className="max-w-2xl ui-enter">
            <p className="ui-kicker">{section}</p>
            <h3 className="mt-2 text-2xl font-light">{SECTIONS.find((item) => item.id === section)?.label}</h3>
            <div className="mt-7 space-y-3 border-t border-foreground/15 pt-5">
              {section === "NEXT" && <div className="border-l-2 border-primary bg-primary/5 p-5"><p className="ui-kicker">Recommended</p><p className="mt-2 text-2xl font-light">{next.title}</p><p className="mt-1 font-mono text-xs uppercase text-muted-foreground">{next.region}</p><p className="mt-4 text-sm">{next.why}</p><p className="mt-1 text-xs text-muted-foreground">Reward: {next.reward}</p></div>}
              {section === "CHRONICLE" && <><p className="text-xs text-muted-foreground">Every chapter stays here forever. Replay any story you have finished.</p>{CHRONICLE.map((c) => { const done = completedMissions.includes(c.id); return <div key={c.id} className="flex items-start justify-between gap-4 border-b border-foreground/10 py-3"><div><p className="font-mono text-xs uppercase">{c.title} <span className="text-muted-foreground">/ {c.region}</span></p><p className="mt-1 text-sm text-muted-foreground">{done ? c.summary : "Locked until played."}</p></div>{done && <Button size="sm" variant="ghost" onClick={() => speakVoice({ id: `chronicle-${c.id}-${Date.now()}`, scope: "chronicle", speaker: "NOVA", text: c.summary, priority: "story" })}><Play />Replay</Button>}</div>; })}</>}
              {section === "ROADMAP" && <>{ROADMAP.map((r) => <div key={r.label} className="flex justify-between border-b border-foreground/10 py-3"><span className="text-sm">{r.label}</span><span className={`font-mono text-[10px] ${r.status === "LIVE" ? "text-primary" : "text-muted-foreground"}`}>{r.status}</span></div>)}<p className="text-xs text-muted-foreground">No content is ever removed. Progress never resets.</p></>}
              {section === "GAMEPLAY" && <><Toggle label="Predictive aim assist" on={settings.aimAssist} onChange={(v) => set({ aimAssist: v })} /><Toggle label="First-person camera" on={settings.firstPersonDefault} onChange={(v) => set({ firstPersonDefault: v })} /></>}
              {section === "DISPLAY" && <><p className="ui-kicker">Rendering quality</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{(["LOW", "MEDIUM", "HIGH", "ULTRA"] as const).map((tier) => <Button key={tier} variant={settings.renderTier === tier ? "default" : "outline"} onClick={() => set({ renderTier: tier })} className="rounded-none">{tier}</Button>)}</div><p className="text-xs text-muted-foreground">Simulation and combat remain identical at every quality.</p></>}
              {section === "AUDIO" && <>{([["Master volume", "volume", 0.7], ["Music volume", "musicVolume", 1], ["Sound effects", "sfxVolume", 1], ["Voice volume", "voiceVolume", 0.85]] as const).map(([label, key, def]) => <Volume key={key} label={label} value={settings[key] ?? def} onChange={(value) => set({ [key]: value })} />)}<Toggle label="Spoken dialogue" on={settings.spokenDialogue ?? true} onChange={(v) => set({ spokenDialogue: v })} /></>}
              {section === "INTERFACE" && <><Toggle label="Zone name markers" on={settings.zoneLabels} onChange={(v) => set({ zoneLabels: v })} /><Toggle label="Full HUD panels" on={settings.hudDensity === "full"} onChange={(v) => set({ hudDensity: v ? "full" : "lean" })} /></>}
              {section === "CONTROLS" && <ControlsPanel bindings={settings.bindings ?? DEFAULT_BINDINGS} onChange={(bindings) => set({ bindings })} />}
              {section === "ACCESSIBILITY" && <><Toggle label="Reduced interface motion" on={settings.reducedMotion ?? false} onChange={(v) => set({ reducedMotion: v })} /><Toggle label="High contrast HUD" on={settings.highContrastHud ?? false} onChange={(v) => set({ highContrastHud: v })} /><Toggle label="Spoken dialogue" on={settings.spokenDialogue ?? true} onChange={(v) => set({ spokenDialogue: v })} /></>}
            </div>
          </section>
        </div>

        <footer className="flex flex-wrap justify-between gap-3 border-t border-foreground/15 pt-4"><Button variant="ghost" onClick={onOrbit}><ChevronLeft />Back to title</Button><Button className="min-w-32 rounded-none" onClick={onClose}>Resume</Button></footer>
      </div>
    </div>
  );
}

function Volume({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label className="block border-b border-foreground/10 py-2"><span className="flex justify-between font-mono text-[10px] uppercase text-muted-foreground"><span>{label}</span><span>{Math.round(value * 100)}%</span></span><input type="range" min={0} max={1} step={0.05} value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-3 w-full accent-primary" /></label>;
}
