export type GameSettings = {
  aimAssist: boolean;
  firstPersonDefault: boolean;
  zoneLabels: boolean;
  hudDensity: "full" | "lean";
};

export const DEFAULT_SETTINGS: GameSettings = {
  aimAssist: true,
  firstPersonDefault: false,
  zoneLabels: true,
  hudDensity: "full",
};

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className="flex w-full items-center justify-between rounded border border-border bg-card/60 px-3 py-2 text-left hover:border-primary/60"
    >
      <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-foreground">{label}</span>
      <span
        className={`font-mono text-[10px] uppercase tracking-[0.2em] ${on ? "text-primary" : "text-muted-foreground"}`}
      >
        {on ? "on" : "off"}
      </span>
    </button>
  );
}

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
    <div className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-background/60 backdrop-blur-sm">
      <div className="w-[22rem] rounded-lg border border-border bg-card/95 p-4 shadow-xl">
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
            label="Start in first person"
            on={settings.firstPersonDefault}
            onChange={(v) => set({ firstPersonDefault: v })}
          />
          <Toggle label="Zone name markers" on={settings.zoneLabels} onChange={(v) => set({ zoneLabels: v })} />
          <Toggle
            label="Full HUD panels"
            on={settings.hudDensity === "full"}
            onChange={(v) => set({ hudDensity: v ? "full" : "lean" })}
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            onClick={onOrbit}
            className="rounded border border-border px-3 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-foreground hover:border-primary"
          >
            Back to orbit
          </button>
          <button
            onClick={onClose}
            className="rounded bg-primary px-3 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-primary-foreground hover:opacity-90"
          >
            Resume
          </button>
        </div>
      </div>
    </div>
  );
}
