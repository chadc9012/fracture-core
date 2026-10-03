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

import { Button } from "@/components/ui/button";
import { DEFAULT_BINDINGS, type Bindings } from "@/game/bindings";
import { ControlsPanel } from "./ControlsPanel";

/** Small in-game window: settings, back to orbit, and a back button to close. */
export function SettingsWindow({
  settings,
  onChange,
  onClose,
  onOrbit,
}: {
  settings: GameSettings;
  onChange: (s: GameSettings) => void;
  onClose: () => void;
  onOrbit: () => void;
}) {
  const set = (patch: Partial<GameSettings>) => onChange({ ...settings, ...patch });

  return (
    <div className="pointer-events-auto fixed inset-0 z-[60] flex items-center justify-center bg-background/60 backdrop-blur-sm">
      <div className="max-h-[90vh] w-[22rem] overflow-y-auto rounded-lg border border-border bg-card/95 p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Menu</p>
          <button
            onClick={onClose}
            className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary hover:underline"
          >
            ‹ back
          </button>
        </div>

        <div className="space-y-2">
          <Toggle label="Predictive aim assist" on={settings.aimAssist} onChange={(v) => set({ aimAssist: v })} />
          <Toggle
            label="First-person camera"
            on={settings.firstPersonDefault}
            onChange={(v) => set({ firstPersonDefault: v })}
          />
          <div className="pt-2"><p className="mb-2 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Rendering quality</p><div className="grid grid-cols-4 gap-1">{(["LOW", "MEDIUM", "HIGH", "ULTRA"] as const).map((tier) => <Button key={tier} size="sm" variant={settings.renderTier === tier ? "default" : "outline"} onClick={() => set({ renderTier: tier })} className="px-1 text-[9px]">{tier}</Button>)}</div><p className="mt-2 text-[10px] text-muted-foreground">Gameplay, damage, and enemy decisions remain identical at every quality.</p></div>
          <Toggle label="Zone name markers" on={settings.zoneLabels} onChange={(v) => set({ zoneLabels: v })} />
          <Toggle
            label="Full HUD panels"
            on={settings.hudDensity === "full"}
            onChange={(v) => set({ hudDensity: v ? "full" : "lean" })}
          />
          <Toggle label="Spoken dialogue" on={settings.spokenDialogue ?? true} onChange={(v) => set({ spokenDialogue: v })} />
          {([["Master volume", "volume", 0.7], ["Music volume", "musicVolume", 1], ["Sound effects volume", "sfxVolume", 1], ["Voice volume", "voiceVolume", 0.85]] as const).map(([label, key, def]) => (
            <label key={key} className="block pt-2"><span className="flex justify-between font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground"><span>{label}</span><span>{Math.round((settings[key] ?? def) * 100)}%</span></span><input type="range" min={0} max={1} step={0.05} value={settings[key] ?? def} onChange={(e) => set({ [key]: Number(e.target.value) })} className="mt-1 w-full accent-primary" /></label>
          ))}
          <ControlsPanel bindings={settings.bindings ?? DEFAULT_BINDINGS} onChange={(bindings) => set({ bindings })} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            onClick={onOrbit}
            className="rounded border border-border px-3 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-foreground hover:border-primary"
          >
            Back to orbit
          </Button>
          <Button
            onClick={onClose}
            className="rounded bg-primary px-3 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-primary-foreground hover:opacity-90"
          >
            Resume
          </Button>
        </div>
      </div>
    </div>
  );
}
