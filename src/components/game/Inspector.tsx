import type { Faction } from "@/game/sim";

export type InspectorView = {
  /* world simulation */
  clock: string;
  phase: string;
  tick: number;
  fps: number;
  stepMs: number;
  avgMs: number;
  warIntensity: number;
  coreHp: number;
  /* optimisation layer */
  tiers: [number, number, number, number];
  ticked: number;
  skipped: number;
  dormant: number;
  relevant: number;
  offloaded: string[];
  regionLoad: { id: string; load: number }[];
  /* entities */
  machines: { alive: number; elite: number; engaging: number };
  convoys: { id: number; state: string; lane: number; speed: number; cargo: number; hp: number; tierNote: string }[];
  /* regions */
  regions: { id: string; name: string; owner: Faction; progress: number; instability: number }[];
  /* cluster */
  shards: { region: string; latency: number; sync: string }[];
  /* player */
  identity: string;
  mutations: string[];
  missions: { name: string; state: string }[];
};

function Row({ label, value, tone }: { label: string; value: string | number; tone?: string | undefined }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span style={tone ? { color: tone } : undefined}>{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-border/50 px-3 py-2">
      <p className="mb-1 text-[9px] tracking-[0.3em] text-muted-foreground">{title}</p>
      <div className="space-y-0.5 text-[10px]">{children}</div>
    </div>
  );
}

export function Inspector({ view }: { view: InspectorView }) {
  const load = view.stepMs > 6 ? "#ff4d4d" : view.stepMs > 3 ? "#ff9f1c" : "#3ddc97";

  return (
    <div className="pointer-events-none absolute left-4 top-1/2 max-h-[80vh] w-72 -translate-y-1/2 overflow-hidden rounded-lg border border-border/60 bg-card/85 font-mono backdrop-blur-md">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-[10px] font-bold tracking-[0.25em]">ENGINE INSPECTOR</span>
        <span className="text-[9px] text-muted-foreground">[I] hide</span>
      </div>

      <Section title="WORLD SIMULATION">
        <Row label="cycle" value={`${view.clock} · ${view.phase}`} />
        <Row label="tick" value={view.tick} />
        <Row label="frame rate" value={`${view.fps} fps`} />
        <Row label="sim step" value={`${view.stepMs.toFixed(2)} ms`} tone={load} />
        <Row label="avg step" value={`${view.avgMs.toFixed(2)} ms`} />
        <Row label="war intensity" value={view.warIntensity} tone={view.warIntensity > 80 ? "#ff4d4d" : undefined} />
        <Row label="core integrity" value={`${view.coreHp}%`} />
      </Section>

      <Section title="OPTIMISATION / LOD">
        <Row label="tier 0 full" value={view.tiers[0]} tone="#3ddc97" />
        <Row label="tier 1 high" value={view.tiers[1]} tone="#7bd3ff" />
        <Row label="tier 2 low" value={view.tiers[2]} tone="#ffb454" />
        <Row label="tier 3 stub" value={view.tiers[3]} tone="#8b93a1" />
        <Row label="ticked / skipped" value={`${view.ticked} / ${view.skipped}`} />
        <Row label="dormant AI" value={view.dormant} />
        <Row label="interest set" value={view.relevant} />
        <Row label="offloaded regions" value={view.offloaded.length ? view.offloaded.join(", ") : "none"} />
      </Section>

      <Section title="REGION LOAD">
        {view.regionLoad.length === 0 && <Row label="—" value="idle" />}
        {view.regionLoad.map((r) => (
          <Row key={r.id} label={r.id} value={r.load} tone={r.load >= 12 ? "#ff9f1c" : undefined} />
        ))}
      </Section>

      <Section title="VEHICLE / AI">
        <Row label="machines alive" value={view.machines.alive} />
        <Row label="elite" value={view.machines.elite} />
        <Row label="engaging player" value={view.machines.engaging} tone={view.machines.engaging ? "#ff4d4d" : undefined} />
      </Section>

      <Section title="CONVOY LOGISTICS">
        {view.convoys.length === 0 && <Row label="—" value="no convoys" />}
        {view.convoys.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">
              #{c.id} L{c.lane}
            </span>
            <span>{c.state}</span>
            <span className="text-muted-foreground">
              {c.cargo}cr hp{c.hp} {c.tierNote}
            </span>
          </div>
        ))}
      </Section>

      <Section title="PLAYER EVOLUTION">
        <Row label="identity" value={view.identity} />
        {view.mutations.length === 0 && <Row label="mutations" value="none" />}
        {view.mutations.map((m) => (
          <Row key={m} label="mutation" value={m} tone="var(--accent-glow)" />
        ))}
        {view.missions.map((m) => (
          <Row key={m.name} label={m.name} value={m.state} />
        ))}
      </Section>

      <Section title="CLUSTER SHARDS">
        {view.shards.map((s) => (
          <Row
            key={s.region}
            label={s.region}
            value={`${s.latency}ms ${s.sync}`}
            tone={s.latency > 120 ? "#ff4d4d" : s.latency > 70 ? "#ff9f1c" : "#3ddc97"}
          />
        ))}
      </Section>
    </div>
  );
}
