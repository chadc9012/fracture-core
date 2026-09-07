import { BEHAVIOR_KEYS, type BehaviorKey, type SkillForm } from "@/game/evolution";

export type EvoSkillView = {
  id: string;
  name: string;
  level: number;
  xp: number;
  form: SkillForm;
  driver: BehaviorKey;
  counterplay: string | null;
  fresh: boolean;
};

export type EvoView = {
  identity: string;
  cycle: number;
  nextIn: number;
  playstyle: Record<BehaviorKey, number>;
  skills: EvoSkillView[];
  log: string[];
};

const DRIVER_COLOR: Record<BehaviorKey, string> = {
  combat: "#ff6b6b",
  logistics: "#ffb454",
  vehicles: "#7bd3ff",
  stealth: "#b58cff",
  support: "#3ddc97",
};

const FORM_LABEL: Record<SkillForm, string> = {
  BASE: "BASE",
  SPECIALIZED: "SPECIALIZED",
  ELITE_MUTATION: "ELITE MUTATION",
};

export function EvolutionPanel({ evo }: { evo: EvoView }) {
  const active = evo.skills.filter((s) => s.level > 0);

  return (
    <div className="pointer-events-none absolute bottom-4 left-1/2 w-80 -translate-x-1/2 rounded-lg border border-border/60 bg-card/70 p-4 backdrop-blur-md">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] tracking-[0.3em] text-muted-foreground">EVOLVED IDENTITY</span>
        <span className="text-[10px] text-muted-foreground">
          CYCLE {evo.cycle} · {Math.ceil(evo.nextIn)}s
        </span>
      </div>
      <p className="mt-0.5 text-sm font-bold" style={{ color: "var(--accent-glow)" }}>
        {evo.identity}
      </p>

      {/* behaviour profile */}
      <div className="mt-2 space-y-1">
        {BEHAVIOR_KEYS.map((k) => (
          <div key={k} className="flex items-center gap-2">
            <span className="w-16 text-[9px] uppercase tracking-widest text-muted-foreground">{k}</span>
            <div className="h-1 flex-1 overflow-hidden rounded bg-muted">
              <div
                className="h-full transition-[width] duration-500"
                style={{ width: `${Math.round(evo.playstyle[k] * 100)}%`, backgroundColor: DRIVER_COLOR[k] }}
              />
            </div>
            <span className="w-7 text-right text-[9px] text-muted-foreground">
              {Math.round(evo.playstyle[k] * 100)}%
            </span>
          </div>
        ))}
      </div>

      {/* evolved skills */}
      <div className="mt-3 space-y-1.5">
        {active.length === 0 && (
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            No skills yet — play, and the build grows itself
          </p>
        )}
        {active.map((s) => (
          <div
            key={s.id}
            className="rounded border px-2 py-1"
            style={{
              borderColor: s.fresh ? DRIVER_COLOR[s.driver] : "hsl(var(--border) / 0.6)",
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold" style={{ color: DRIVER_COLOR[s.driver] }}>
                {s.name}
              </span>
              <span className="text-[9px] uppercase text-muted-foreground">
                L{s.level} · {FORM_LABEL[s.form]}
              </span>
            </div>
            <div className="mt-1 h-0.5 w-full overflow-hidden rounded bg-muted">
              <div
                className="h-full"
                style={{ width: `${Math.round(s.xp * 100)}%`, backgroundColor: DRIVER_COLOR[s.driver] }}
              />
            </div>
            {s.counterplay && <p className="mt-1 text-[9px] italic text-muted-foreground">— {s.counterplay}</p>}
          </div>
        ))}
      </div>

      {evo.log.length > 0 && (
        <div className="mt-2 space-y-0.5">
          {evo.log.slice(0, 3).map((l, i) => (
            <p key={`${l}-${i}`} className="text-[9px] text-muted-foreground" style={{ opacity: 1 - i * 0.3 }}>
              ▸ {l}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
